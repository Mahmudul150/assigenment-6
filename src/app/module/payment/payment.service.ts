import { randomUUID } from "node:crypto";
import {
  AssessmentStatus,
  PaymentStatus,
} from "../../../../generated/prisma/enums";
import { PaymentWhereInput } from "../../../../generated/prisma/models";
import { Prisma } from "../../../../generated/prisma/client";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/appError";
import { RequestUser } from "../../middleware/auth";
import httpStatus from "http-status";
import { AuditLogService } from "../auditlogs/auditLog.service";
import { IQuery } from "../../quaryInterface";

const ASSESSMENT_FEE = Number(config.admin_fee);


const paymentCreate = async (
  assessmentId: string,
  user: RequestUser,
) => {
  if (!ASSESSMENT_FEE || ASSESSMENT_FEE <= 0) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Invalid assessment fee configuration.",
    );
  }

 
  const transactionResult = await prisma.$transaction(async (tx) => {
    const company = await tx.companyProfile.findUnique({
      where: {
        userId: user.userId,
      },
    });

    if (!company) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Company not found.",
      );
    }

    if (!company.isApproved) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Your company is not approved.",
      );
    }

    const assessment = await tx.assessment.findFirst({
      where: {
        id: assessmentId,
        companyId: company.id,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            problems: true,
          },
        },
      },
    });

    if (!assessment) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Assessment not found.",
      );
    }

    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Only draft assessment can be paid.",
      );
    }

    if (assessment._count.problems === 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Add at least one problem before payment.",
      );
    }

    const paidPayment = await tx.payment.findFirst({
      where: {
        assessmentId: assessment.id,
        companyId: company.id,
        status: PaymentStatus.PAID,
      },
    });

    if (paidPayment) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Assessment payment already completed.",
      );
    }

    await tx.payment.updateMany({
      where: {
        assessmentId: assessment.id,
        companyId: company.id,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.CANCELLED,
        failureReason: "Superseded by a new payment attempt.",
      },
    });

    const merchantInvoiceNumber = `ASSESS-${randomUUID()}`;

    const payment = await tx.payment.create({
      data: {
        companyId: company.id,
        assessmentId: assessment.id,
        amount: ASSESSMENT_FEE,
        currency: "BDT",
        method: "bkash",
        merchantInvoiceNumber,
        payerReference: user.email,
        status: PaymentStatus.PENDING,
      },
    });

    return {
      payment,
      company,
      assessment,
    };
  });

  const { payment, company, assessment } = transactionResult;

  
  try {
    const bkashIdToken = await getBkashIdToken();

    if (!bkashIdToken) {
      throw new AppError(
        httpStatus.BAD_GATEWAY,
        "Unable to get bKash access token.",
      );
    }

    const bkashPaymentResponse = await fetch(
      `${config.bkash_sendbase_url}/tokenized/checkout/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: bkashIdToken,
          "X-App-Key": config.bkash_app_key,
        },
        body: JSON.stringify({
          mode: "0011",
          payerReference: user.email,
          callbackURL: `${config.bkash_callback_url}`,
          amount: String(ASSESSMENT_FEE),
          currency: "BDT",
          intent: "sale",
          merchantInvoiceNumber: payment.merchantInvoiceNumber,
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    const bkashResult = await bkashPaymentResponse.json();

   
    if (
      !bkashPaymentResponse.ok ||
      bkashResult.statusCode !== "0000"
    ) {
      await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          status: PaymentStatus.FAILED,
          failureReason:
            bkashResult.statusMessage || "bKash payment failed.",
          getWayResponse: bkashResult,
        },
      });

      throw new AppError(
        httpStatus.BAD_GATEWAY,
        bkashResult.statusMessage || "bKash payment failed.",
      );
    }

    if (!bkashResult.paymentID || !bkashResult.bkashURL) {

      await prisma.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          failureReason: "Invalid response received from bKash.",
          getWayResponse: bkashResult,
        },
      });

      throw new AppError(
        httpStatus.BAD_GATEWAY,
        "Invalid response received from bKash.",
      );
    }

    const updatedPayment = await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        bkashPaymentId: bkashResult.paymentID,
        getWayResponse: bkashResult,
      },
    });

    await AuditLogService.createAuditLog({
      userId: user.userId,
      action: "CREATE",
      entityType: "Payment",
      entityId: updatedPayment.id,
      metadata: {
        assessmentId: assessment.id,
        companyId: company.id,
        amount: updatedPayment.amount,
        currency: updatedPayment.currency,
        method: updatedPayment.method,
        status: updatedPayment.status,
        merchantInvoiceNumber:
          updatedPayment.merchantInvoiceNumber,
      },
    });

    return {
      payment: updatedPayment,
      paymentUrl: bkashResult.bkashURL,
    };
  } catch (error) {
    await prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.FAILED,
        failureReason:
          error instanceof Error
            ? error.message
            : "Unknown bKash request error.",
      },
    });

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Could not communicate with bKash. Check payment status before retrying.",
    );
  }
};


interface BkashCallbackResult {
  statusCode?: string;
  statusMessage?: string;
  paymentID?: string;
  merchantInvoiceNumber?: string;
  amount?: string | number;
  currency?: string;
  transactionStatus?: string;
  trxID?: string;
  [key: string]: unknown;
}

interface PaymentIdentity {
  id: string;
  bkashPaymentId: string | null;
  merchantInvoiceNumber: string;
  amount: unknown;
  currency: string;
}

const frontendBaseUrl = () =>
  String(config.frontend_url ?? "").replace(/\/$/, "");

const successRedirect = (paymentId: string) =>
  `${frontendBaseUrl()}/payment/success?paymentId=${paymentId}`;

const cancelRedirect = (paymentId: string) =>
  `${frontendBaseUrl()}/payment/cancel?paymentId=${paymentId}`;

const failedRedirect = (paymentId?: string) =>
  `${frontendBaseUrl()}/payment/failed${paymentId ? `?paymentId=${paymentId}` : ""}`;

function bkashHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: token,
    "X-App-Key": config.bkash_app_key,
  };
}

async function queryBkashPayment(
  bkashPaymentId: string,
  token: string,
): Promise<BkashCallbackResult | null> {
  try {
    const response = await fetch(
      `${config.bkash_sendbase_url}/tokenized/checkout/payment/status`,
      {
        method: "POST",
        headers: bkashHeaders(token),
        body: JSON.stringify({ paymentID: bkashPaymentId }),
        signal: AbortSignal.timeout(30000),
      },
    );
    const result = (await response.json()) as BkashCallbackResult;
    if (!response.ok || result.statusCode !== "0000") return null;
    return result;
  } catch {
    return null;
  }
}

function matchesPayment(
  result: BkashCallbackResult,
  payment: PaymentIdentity,
  strict: boolean,
) {
  if (strict) {
    return (
      result.paymentID === payment.bkashPaymentId &&
      result.merchantInvoiceNumber === payment.merchantInvoiceNumber &&
      Number(result.amount) === Number(payment.amount) &&
      result.currency === payment.currency
    );
  }

  return (
    (!result.paymentID || result.paymentID === payment.bkashPaymentId) &&
    (!result.merchantInvoiceNumber ||
      result.merchantInvoiceNumber === payment.merchantInvoiceNumber) &&
    (result.amount === undefined ||
      Number(result.amount) === Number(payment.amount)) &&
    (!result.currency || result.currency === payment.currency)
  );
}

async function settlePayment(
  payment: {
    id: string;
    company: { userId: string };
    assessmentId: string;
    amount: unknown;
    currency: string;
  },
  status: PaymentStatus,
  result: BkashCallbackResult,
  trxId?: string,
) {
  const isPaid = status === PaymentStatus.PAID;
  const updated = await prisma.payment.updateMany({
    where: { id: payment.id, status: PaymentStatus.PENDING },
    data: {
      status,
      ...(isPaid
        ? {
            bkashTrxId: trxId,
            paidAt: new Date(),
            failureReason: null,
          }
        : {
            failureReason:
              result.statusMessage ||
              `bKash transaction ${result.transactionStatus ?? "failed"}.`,
          }),
      getWayResponse: result as unknown as Prisma.InputJsonValue,
    },
  });

  if (updated.count > 0) {
    await AuditLogService.createAuditLog({
      userId: payment.company.userId,
      action: "UPDATE",
      entityType: "Payment",
      entityId: payment.id,
      metadata: {
        status,
        transactionId: trxId,
        amount: Number(payment.amount),
        currency: payment.currency,
        assessmentId: payment.assessmentId,
        reason: result.transactionStatus,
      },
    });
  }

  return updated.count > 0;
}

const paymentCallback = async (query: Record<string, any>) => {
  const bkashPaymentId = query.paymentID;
  const callbackStatus = query.status;
  const internalPaymentId = query.paymentId;

  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        ...(bkashPaymentId ? [{ bkashPaymentId }] : []),
        ...(internalPaymentId ? [{ id: internalPaymentId }] : []),
      ],
    },
    include: { company: true },
  });

  if (!payment) {
    return { redirectUrl: failedRedirect() };
  }

  const paymentId = payment.id;

  try {
    if (payment.status === PaymentStatus.PAID) {
      return { redirectUrl: successRedirect(paymentId) };
    }

    if (payment.status === PaymentStatus.CANCELLED) {
      return { redirectUrl: cancelRedirect(paymentId) };
    }

    if (payment.status === PaymentStatus.FAILED) {
      return { redirectUrl: failedRedirect(paymentId) };
    }

    const bkashIdToken = await getBkashIdToken();
    if (!bkashIdToken) {
      return { redirectUrl: failedRedirect(paymentId) };
    }

    let result: BkashCallbackResult | null = null;
    let fromExecute = false;

    if (callbackStatus === "success") {
      try {
        const response = await fetch(
          `${config.bkash_sendbase_url}/tokenized/checkout/execute`,
          {
            method: "POST",
            headers: bkashHeaders(bkashIdToken),
            body: JSON.stringify({ paymentID: bkashPaymentId }),
            signal: AbortSignal.timeout(30000),
          },
        );
        const executed = (await response.json()) as BkashCallbackResult;
        if (
          response.ok &&
          executed.statusCode === "0000" &&
          executed.transactionStatus === "Completed" &&
          executed.trxID
        ) {
          result = executed;
          fromExecute = true;
        }
      } catch {
        result = null;
      }

      // Execute failed (or returned an unusable result): ask bKash for the
      // real status before deciding this payment failed.
      if (!result) {
        result = await queryBkashPayment(
          payment.bkashPaymentId ?? String(bkashPaymentId),
          bkashIdToken,
        );
      }

      if (
        result &&
        result.transactionStatus === "Completed" &&
        result.trxID &&
        matchesPayment(result, payment, fromExecute)
      ) {
        await settlePayment(
          payment,
          PaymentStatus.PAID,
          result,
          result.trxID,
        );
        return { redirectUrl: successRedirect(paymentId) };
      }

      if (result) {
        const isCancelled =
          result.transactionStatus === "Cancelled" ||
          result.transactionStatus === "Canceled";
        await settlePayment(
          payment,
          isCancelled ? PaymentStatus.CANCELLED : PaymentStatus.FAILED,
          result,
        );
        return {
          redirectUrl: isCancelled
            ? cancelRedirect(paymentId)
            : failedRedirect(paymentId),
        };
      }

      return { redirectUrl: failedRedirect(paymentId) };
    }

    if (callbackStatus === "failure" || callbackStatus === "cancel") {
      const result = await queryBkashPayment(
        payment.bkashPaymentId ?? String(bkashPaymentId),
        bkashIdToken,
      );

      if (
        result &&
        result.transactionStatus === "Completed" &&
        result.trxID &&
        matchesPayment(result, payment, false)
      ) {
        await settlePayment(payment, PaymentStatus.PAID, result, result.trxID);
        return { redirectUrl: successRedirect(paymentId) };
      }

      if (result) {
        const isCancelled =
          callbackStatus === "cancel" ||
          result.transactionStatus === "Cancelled" ||
          result.transactionStatus === "Canceled";

        await settlePayment(
          payment,
          isCancelled ? PaymentStatus.CANCELLED : PaymentStatus.FAILED,
          result,
        );
        return {
          redirectUrl: isCancelled
            ? cancelRedirect(paymentId)
            : failedRedirect(paymentId),
        };
      }

      return {
        redirectUrl:
          callbackStatus === "cancel"
            ? cancelRedirect(paymentId)
            : failedRedirect(paymentId),
      };
    }

    return { redirectUrl: failedRedirect(paymentId) };
  } catch (error) {
    console.error("Payment callback error:", error);
    return { redirectUrl: failedRedirect(paymentId) };
  }
};

const getMyPayments = async (user: RequestUser) => {
  const company = await prisma.companyProfile.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!company) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Company profile not found.",
    );
  }

  const payments = await prisma.payment.findMany({
    where: {
      companyId: company.id,
    },
    include: {
      assessment: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return payments;
};

const getAllPayments = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: PaymentWhereInput[] = [];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        {
          merchantInvoiceNumber: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          bkashTrxId: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          payerReference: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (query.status) {
    andConditions.push({
      status: query.status,
    });
  }

  if (query.companyId) {
    andConditions.push({
      companyId: query.companyId,
    });
  }

  if (query.assessmentId) {
    andConditions.push({
      assessmentId: query.assessmentId,
    });
  }

  const allowedSortFields = [
    "createdAt",
    "updatedAt",
    "amount",
    "paidAt",
  ];

  const finalSortBy = allowedSortFields.includes(sortBy)
    ? sortBy
    : "createdAt";

  const finalSortOrder = sortOrder === "asc" ? "asc" : "desc";

  const payment = await prisma.payment.findMany({
    where: {
      AND: andConditions,
    },
    take: limit,
    skip,
    orderBy: {
      [finalSortBy]: finalSortOrder,
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      assessment: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });

  const total = await prisma.payment.count({
    where: {
      AND: andConditions,
    },
  });

  return {
    data: payment,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};


const getPaymentById = async (
  paymentId: string,
  user: RequestUser,
) => {
  const company = await prisma.companyProfile.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!company) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Company profile not found.",
    );
  }

  const paymentInclude = {
    company: { select: { userId: true, name: true } },
    assessment: {
      select: {
        id: true,
        title: true,
        status: true,
        durationMinutes: true,
      },
    },
  } as const;

  let payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      companyId: company.id,
    },
    include: paymentInclude,
  });

  if (!payment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Payment not found.",
    );
  }

  if (payment.status === PaymentStatus.PENDING && payment.bkashPaymentId) {
    const bkashIdToken = await getBkashIdToken();

    if (bkashIdToken) {
      const result = await queryBkashPayment(
        payment.bkashPaymentId,
        bkashIdToken,
      );

      if (
        result &&
        result.transactionStatus === "Completed" &&
        result.trxID &&
        matchesPayment(result, payment, false)
      ) {
        await settlePayment(payment, PaymentStatus.PAID, result, result.trxID);

        const refreshed = await prisma.payment.findFirst({
          where: {
            id: paymentId,
            companyId: company.id,
          },
          include: paymentInclude,
        });
        if (refreshed) payment = refreshed;
      }
    }
  }

  return payment;
};

export const PaymentService = {
  paymentCreate,
  paymentCallback,
  getMyPayments,
  getAllPayments,
  getPaymentById,
};