import { randomUUID } from "node:crypto";
import {
  AssessmentStatus,
  PaymentStatus,
} from "../../../../generated/prisma/enums";
import { PaymentWhereInput } from "../../../../generated/prisma/models";
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

  // Database কাজগুলো transaction-এর মধ্যে
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

    const pendingPayment = await tx.payment.findFirst({
      where: {
        assessmentId: assessment.id,
        companyId: company.id,
        status: PaymentStatus.PENDING,
      },
    });

    if (pendingPayment) {
      throw new AppError(
        httpStatus.CONFLICT,
        "You already have a pending payment.",
      );
    }

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

  // bKash API call transaction-এর বাইরে
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
          callbackURL: `${config.bkash_callback_url}/payments/bkash/callback`,
          amount: String(ASSESSMENT_FEE),
          currency: "BDT",
          intent: "sale",
          merchantInvoiceNumber: payment.merchantInvoiceNumber,
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    const bkashResult = await bkashPaymentResponse.json();

    // bKash সরাসরি request reject করলে FAILED হবে
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
      // Response অসম্পূর্ণ হলে PENDING রাখব
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
    // AppError হলে আগের error-টাই পাঠাব
    if (error instanceof AppError) {
      throw error;
    }

    // Network error হলে FAILED করব না।
    // কারণ bKash-এ payment তৈরি হয়ে থাকতে পারে।
    await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        failureReason:
          error instanceof Error
            ? error.message
            : "Unknown bKash request error.",
      },
    });

    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Could not communicate with bKash. Check payment status before retrying.",
    );
  }
};


const paymentCallback = async (
  query: Record<string, any>,
) => {
  const paymentId = query.paymentID;
  const status = query.status;

  if (!paymentId || !status) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment information missing.",
    );
  }

  const payment = await prisma.payment.findFirst({
    where: {
      bkashPaymentId: paymentId,
    },
    include: {
      company: true,
    },
  });

  if (!payment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Payment not found.",
    );
  }

  if (payment.status === PaymentStatus.PAID) {
    return {
      redirectUrl: `${config.frontend_url}/dashboard/assessments?payment=success`,
    };
  }

  if (payment.status !== PaymentStatus.PENDING) {
    return {
      redirectUrl: `${config.frontend_url}/dashboard/assessments?payment=${payment.status.toLowerCase()}`,
    };
  }

  // SUCCESS PAYMENT
  if (status === "success") {
    const bkashIdToken = await getBkashIdToken();

    if (!bkashIdToken) {
      throw new AppError(
        httpStatus.BAD_GATEWAY,
        "Unable to get bKash access token.",
      );
    }

    const response = await fetch(
      `${config.bkash_sendbase_url}/tokenized/checkout/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: bkashIdToken,
          "X-App-Key": config.bkash_app_key,
        },
        body: JSON.stringify({
          paymentID: paymentId,
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    const result = await response.json();

    if (
      !response.ok ||
      result.statusCode !== "0000" ||
      result.transactionStatus !== "Completed" ||
      !result.trxID
    ) {
      throw new AppError(
        httpStatus.BAD_GATEWAY,
        result.statusMessage || "Payment verification failed.",
      );
    }

    // bKash response-এর payment information মিলিয়ে দেখা
    if (
      result.paymentID !== paymentId ||
      result.merchantInvoiceNumber !==
        payment.merchantInvoiceNumber ||
      Number(result.amount) !== Number(payment.amount) ||
      result.currency !== payment.currency
    ) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Payment information does not match.",
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.PAID,
          bkashTrxId: result.trxID,
          paidAt: new Date(),
          failureReason: null,
          getWayResponse: result,
        },
      });

      const currentPayment = await tx.payment.findUnique({
        where: {
          id: payment.id,
        },
      });

      if (!currentPayment) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "Payment not found.",
        );
      }

      if (
        updatedPayment.count === 0 &&
        currentPayment.status !== PaymentStatus.PAID
      ) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Payment is not pending.",
        );
      }

      return {
        payment: currentPayment,
        isUpdated: updatedPayment.count > 0,
      };
    });

    // শুধু payment নতুন করে PAID হলে Audit Log হবে
    if (updated.isUpdated) {
      await AuditLogService.createAuditLog({
        userId: payment.company.userId,
        action: "UPDATE",
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          status: "PAID",
          transactionId: result.trxID,
          amount: payment.amount,
          currency: payment.currency,
          assessmentId: payment.assessmentId,
        },
      });
    }

    return {
      payment: updated.payment,
      redirectUrl: `${config.frontend_url}/dashboard/assessments?payment=success`,
    };
  }

  // FAILURE অথবা CANCEL CALLBACK
  else if (status === "failure" || status === "cancel") {
    const bkashIdToken = await getBkashIdToken();

    if (!bkashIdToken) {
      throw new AppError(
        httpStatus.BAD_GATEWAY,
        "Unable to get bKash access token.",
      );
    }

    // Callback-এর status সরাসরি বিশ্বাস না করে bKash থেকে যাচাই
    const response = await fetch(
      `${config.bkash_sendbase_url}/tokenized/checkout/payment/status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: bkashIdToken,
          "X-App-Key": config.bkash_app_key,
        },
        body: JSON.stringify({
          paymentID: paymentId,
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    const result = await response.json();

    if (
      !response.ok ||
      result.statusCode !== "0000"
    ) {
      throw new AppError(
        httpStatus.BAD_GATEWAY,
        result.statusMessage || "Unable to verify payment status.",
      );
    }

    // Callback failure/cancel হলেও bKash-এ Completed হতে পারে
    if (
      result.transactionStatus === "Completed" &&
      result.trxID
    ) {
      if (
        (result.paymentID && result.paymentID !== paymentId) ||
        (result.merchantInvoiceNumber &&
          result.merchantInvoiceNumber !==
            payment.merchantInvoiceNumber) ||
        (result.amount !== undefined &&
          Number(result.amount) !== Number(payment.amount)) ||
        (result.currency &&
          result.currency !== payment.currency)
      ) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          "Payment information does not match.",
        );
      }

      const updated = await prisma.payment.updateMany({
        where: {
          id: payment.id,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.PAID,
          bkashTrxId: result.trxID,
          paidAt: new Date(),
          failureReason: null,
          getWayResponse: result,
        },
      });

      if (updated.count > 0) {
        await AuditLogService.createAuditLog({
          userId: payment.company.userId,
          action: "UPDATE",
          entityType: "Payment",
          entityId: payment.id,
          metadata: {
            status: "PAID",
            transactionId: result.trxID,
            amount: payment.amount,
            currency: payment.currency,
            assessmentId: payment.assessmentId,
          },
        });
      }

      return {
        redirectUrl: `${config.frontend_url}/dashboard/assessments?payment=success`,
      };
    }

    // bKash নিশ্চিতভাবে Failed/Cancelled বললেই status update
    if (
      result.transactionStatus === "Failed" ||
      result.transactionStatus === "Cancelled" ||
      result.transactionStatus === "Canceled"
    ) {
      const isCancelled =
        result.transactionStatus === "Cancelled" ||
        result.transactionStatus === "Canceled";

      const finalStatus = isCancelled
        ? PaymentStatus.CANCELLED
        : PaymentStatus.FAILED;

      const updated = await prisma.payment.updateMany({
        where: {
          id: payment.id,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: finalStatus,
          failureReason:
            result.statusMessage ||
            `bKash transaction ${result.transactionStatus}.`,
          getWayResponse: result,
        },
      });

      if (updated.count > 0) {
        await AuditLogService.createAuditLog({
          userId: payment.company.userId,
          action: "UPDATE",
          entityType: "Payment",
          entityId: payment.id,
          metadata: {
            status: finalStatus,
            amount: payment.amount,
            currency: payment.currency,
            assessmentId: payment.assessmentId,
            reason: result.transactionStatus,
          },
        });
      }

      return {
        redirectUrl: `${config.frontend_url}/dashboard/assessments?payment=${isCancelled ? "cancel" : "failure"}`,
      };
    }

    // Pending বা unknown status হলে payment PENDING থাকবে
    return {
      redirectUrl: `${config.frontend_url}/dashboard/assessments?payment=pending`,
    };
  }

  else {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid payment status.",
    );
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

  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      companyId: company.id,
    },
  });

  if (!payment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Payment not found.",
    );
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