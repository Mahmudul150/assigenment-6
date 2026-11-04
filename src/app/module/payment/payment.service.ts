/*
import { randomUUID } from "node:crypto"
import { AssessmentStatus, PaymentStatus } from "../../../../generated/prisma/enums"
import config from "../../config"
import { getBkashIdToken } from "../../lib/bkash"
import { prisma } from "../../lib/prisma"
import { AppError } from "../../middleware/appError"
import { RequestUser } from "../../middleware/auth"
import httpStats from 'http-status'
import { PaymentWhereInput } from "../../../../generated/prisma/models"
import { AuditLogService } from "../auditlogs/auditLog.service"

const ASSESSMENT_FEE = config.admin_fee;


const paymentCreate = async (
  assessmentId: string,
  user: RequestUser
) => {
  const transactionResult = await prisma.$transaction(async (tx) => {

    const company = await tx.companyProfile.findUnique({
      where: {
        userId: user.userId,
      },
    });
    console.log("Company ID:", company?.id);
    if (!company) {
      throw new AppError(
        httpStats.NOT_FOUND,
        "Company not found."
      );
    }

    if (!company.isApproved) {
      throw new AppError(
        httpStats.FORBIDDEN,
        "Your company is not approved."
      );
    }

    const assessment = await tx.assessment.findFirst({
      where: {
        id: assessmentId,
        companyId: company.id,
        deletedAt: null,
      },
    });
    console.log("Assessment:", assessment);

    if (!assessment) {
      throw new AppError(
        httpStats.NOT_FOUND,
        "Assessment not found."
      );
    }

    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new AppError(
        httpStats.BAD_REQUEST,
        "Only draft assessment can be paid."
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
        httpStats.BAD_REQUEST,
        "Assessment payment already completed."
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
        httpStats.BAD_REQUEST,
        "You already have a pending payment."
      );
    }

    const merchantInvoiceNumber = `ASSESS-${randomUUID()}`;

    const payment = await tx.payment.create({
      data: {
        companyId: company.id,
        assessmentId: assessment.id,
        amount: Number(ASSESSMENT_FEE),
        currency: "BDT",
        method: "bkash",
        merchantInvoiceNumber,
        payerReference: user.email,
        status: PaymentStatus.PENDING,
      },
    });

    const bkashIdToken = await getBkashIdToken();

    if (!bkashIdToken) {
      throw new AppError(
        httpStats.BAD_REQUEST,
        "Unable to get bKash access token."
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
      }
    );

    const bkashResult = await bkashPaymentResponse.json();

    if (
      !bkashPaymentResponse.ok ||
      bkashResult.statusCode !== "0000" ||
      !bkashResult.paymentID ||
      !bkashResult.bkashURL
    ) {
      throw new AppError(
        httpStats.BAD_REQUEST,
        bkashResult.statusMessage || "bKash payment failed."
      );
    }

    const updatedPayment = await tx.payment.update({
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
    merchantInvoiceNumber: updatedPayment.merchantInvoiceNumber,
  },
  });

    return {
      payment: updatedPayment,
      paymentUrl: bkashResult.bkashURL,
    };
  });

  return transactionResult;
};


const paymentCallback = async (
  query: Record<string, any>
) => {
  const paymentId = query.paymentID;
  const status = query.status;

  if (!paymentId || !status) {
    throw new AppError(
      httpStats.BAD_REQUEST,
      "Payment information missing."
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
      httpStats.NOT_FOUND,
      "Payment not found."
    );
  }

  if (payment.status === PaymentStatus.PAID) {
    return {
      redirectUrl: `${config.frontend_url}/dashboard/assessments?payment=success`,
    };
  }

  // SUCCESS PAYMENT
  if (status === "success") {
    const bkashIdToken = await getBkashIdToken();

    if (!bkashIdToken) {
      throw new AppError(
        httpStats.BAD_REQUEST,
        "Unable to get bKash access token."
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
      }
    );

    const result = await response.json();

    if (
      !response.ok ||
      result.statusCode !== "0000" ||
      !result.trxID
    ) {
      throw new AppError(
        httpStats.BAD_REQUEST,
        result.statusMessage || "Payment verification failed."
      );
    }

    if (
      result.paymentID !== paymentId ||
      result.merchantInvoiceNumber !== payment.merchantInvoiceNumber ||
      Number(result.amount) !== Number(payment.amount) ||
      result.currency !== payment.currency
    ) {
      throw new AppError(
        httpStats.BAD_REQUEST,
        "Payment information does not match."
      );
    }

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.PAID,
          bkashTrxId: result.trxID,
          paidAt: new Date(),
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
          httpStats.NOT_FOUND,
          "Payment not found."
        );
      }

      if (
        updated.count === 0 &&
        currentPayment.status !== PaymentStatus.PAID
      ) {
        throw new AppError(
          httpStats.BAD_REQUEST,
          "Payment is not pending."
        );
      }

      // SUCCESS AUDIT LOG
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

      return currentPayment;
    });

    return {
      payment: updatedPayment,
      redirectUrl: `${config.frontend_url}/dashboard/assessments?payment=success`,
    };
  }

  // FAILED PAYMENT
  else if (status === "failure") {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: "bKash payment failed.",
        },
      });

      // FAILED AUDIT LOG
      if (updated.count > 0) {
        await AuditLogService.createAuditLog({
          userId: payment.company.userId,
          action: "UPDATE",
          entityType: "Payment",
          entityId: payment.id,
          metadata: {
            status: "FAILED",
            amount: payment.amount,
            currency: payment.currency,
            assessmentId: payment.assessmentId,
            reason: "bKash payment failed.",
          },
        });
      }
    });

    return {
      redirectUrl: `${config.frontend_url}/dashboard/assessments?payment=failure`,
    };
  }

  // CANCEL PAYMENT
  else if (status === "cancel") {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.CANCELLED,
        },
      });

      // CANCEL AUDIT LOG
      if (updated.count > 0) {
        await AuditLogService.createAuditLog({
          userId: payment.company.userId,
          action: "UPDATE",
          entityType: "Payment",
          entityId: payment.id,
          metadata: {
            status: "CANCELLED",
            amount: payment.amount,
            currency: payment.currency,
            assessmentId: payment.assessmentId,
          },
        });
      }
    });

    return {
      redirectUrl: `${config.frontend_url}/dashboard/assessments?payment=cancel`,
    };
  }

  else {
    throw new AppError(
      httpStats.BAD_REQUEST,
      "Invalid payment status."
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
      httpStats.NOT_FOUND,
      "Company profile not found."
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



const getAllPayments = async (query: any) => {
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



 const payment = await prisma.payment.findMany({
		where: { AND: andConditions },
		take: limit,
		skip,
		orderBy: { [sortBy] : sortOrder },
		include: {
			company: { select: { id: true, name: true } },
			assessment: { select: { id: true, title: true, status: true } }
            
		},
	});

    const total = await prisma.payment.count({
		where: { AND: andConditions },
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

export const PaymentSercice = {
    paymentCreate,
    paymentCallback,
    getMyPayments,
    getAllPayments
}
*/











/*

import { randomUUID } from "node:crypto";
import { Prisma } from "../../../../generated/prisma/client";
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

const ASSESSMENT_FEE = Number(config.admin_fee);

type BkashResponse = Record<string, unknown>;

type PaymentQuery = {
  page?: string;
  limit?: string;
  searchTerm?: string;
  status?: PaymentStatus;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

const getString = (value: unknown): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

const getNumber = (value: unknown): number | undefined => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

// bKash API request helper
const bkashRequest = async (
  endpoint: string,
  body: Record<string, unknown>,
): Promise<BkashResponse> => {
  const idToken = await getBkashIdToken();

  const response = await fetch(
    `${config.bkash_sendbase_url}${endpoint}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: idToken,
        "X-App-Key": config.bkash_app_key,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    },
  );

  const data: unknown = await response.json();

  if (!data || typeof data !== "object") {
    throw new Error("Invalid response from bKash");
  }

  if (!response.ok) {
    throw new Error("bKash API request failed");
  }

  return data as BkashResponse;
};

const bkashCreate = (body: Record<string, unknown>) =>
  bkashRequest("/tokenized/checkout/create", body);

const bkashExecute = (paymentID: string) =>
  bkashRequest("/tokenized/checkout/execute", { paymentID });

const bkashQuery = (paymentID: string) =>
  bkashRequest("/tokenized/checkout/payment/status", { paymentID });

// Audit log helper
const createPaymentAuditLog = async (
  userId: string,
  paymentId: string,
  action: string,
  metadata?: Prisma.InputJsonValue,
) => {
  await AuditLogService.createAuditLog({
    userId,
    action,
    entityType: "PAYMENT",
    entityId: paymentId,
    metadata,
  });
};

// 1. Create payment
const paymentCreate = async (
  assessmentId: string,
  user: RequestUser,
) => {
  if (!ASSESSMENT_FEE || ASSESSMENT_FEE <= 0) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Invalid assessment fee configuration",
    );
  }

  // Find company profile
  const company = await prisma.companyProfile.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!company) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Company profile not found",
    );
  }

  if (!company.isApproved) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your company is not approved yet",
    );
  }

  // Find assessment and check ownership
  const assessment = await prisma.assessment.findFirst({
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
      "Assessment not found",
    );
  }

  if (assessment.status !== AssessmentStatus.DRAFT) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only draft assessments can be paid for",
    );
  }

  if (assessment._count.problems === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Add at least one problem before payment",
    );
  }

  // Check already paid payment
  const paidPayment = await prisma.payment.findFirst({
    where: {
      assessmentId,
      companyId: company.id,
      status: PaymentStatus.PAID,
    },
  });

  if (paidPayment) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Payment has already been completed for this assessment",
    );
  }

  // Check existing pending payment
  const pendingPayment = await prisma.payment.findFirst({
    where: {
      assessmentId,
      companyId: company.id,
      status: PaymentStatus.PENDING,
    },
  });

  if (pendingPayment) {
    throw new AppError(
      httpStatus.CONFLICT,
      "A pending payment already exists. Check its status before creating another payment",
    );
  }

  const merchantInvoiceNumber = `ASSESSMENT-${randomUUID()}`;
  const payerReference = `COMPANY-${company.id}`;

  // Create payment record first
  const payment = await prisma.payment.create({
    data: {
      companyId: company.id,
      assessmentId,
      amount: ASSESSMENT_FEE,
      currency: "BDT",
      method: "BKASH",
      status: PaymentStatus.PENDING,
      merchantInvoiceNumber,
      payerReference,
    },
  });

  // Call bKash outside the database transaction
  try {
    const bkashResponse = await bkashCreate({
      mode: "0011",
      payerReference,
      callbackURL: `${config.bkash_callback_url}/payments/bkash/callback`,
      amount: ASSESSMENT_FEE.toString(),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber,
    });

    const paymentID = getString(bkashResponse.paymentID);
    const bkashURL = getString(bkashResponse.bkashURL);
    const statusCode = getString(bkashResponse.statusCode);

    // bKash explicitly rejected the create request
    if (statusCode && statusCode !== "0000") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason:
            getString(bkashResponse.statusMessage) ??
            "bKash payment creation failed",
          getWayResponse:
            bkashResponse as Prisma.InputJsonValue,
        },
      });

      throw new AppError(
        httpStatus.BAD_GATEWAY,
        "Unable to create bKash payment",
      );
    }

    if (!paymentID || !bkashURL) {
      // Keep it pending: the request may have reached bKash
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          failureReason: "bKash response did not contain payment details",
          getWayResponse:
            bkashResponse as Prisma.InputJsonValue,
        },
      });

      throw new AppError(
        httpStatus.BAD_GATEWAY,
        "Invalid response from bKash",
      );
    }

    const updatedPayment = await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        bkashPaymentId: paymentID,
        getWayResponse:
          bkashResponse as Prisma.InputJsonValue,
      },
    });

    await createPaymentAuditLog(
      user.userId,
      payment.id,
      "PAYMENT_INITIATED",
      {
        assessmentId,
        amount: ASSESSMENT_FEE,
        method: "BKASH",
      },
    );

    return {
      payment: updatedPayment,
      paymentUrl: bkashURL,
    };
  } catch (error) {
    // Do not mark as FAILED for network errors/timeouts.
    // bKash might have created the payment even if our request timed out.
    if (error instanceof AppError) {
      throw error;
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        failureReason:
          error instanceof Error
            ? error.message
            : "Unknown bKash request error",
      },
    });

    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "Could not communicate with bKash. Check payment status before retrying",
    );
  }
};

// 2. Verify payment using Execute or Query
const verifyPayment = async (
  paymentId: string,
  mode: "execute" | "query",
) => {
  const payment = await prisma.payment.findUnique({
    where: {
      id: paymentId,
    },
  });

  if (!payment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Payment not found",
    );
  }

  if (payment.status !== PaymentStatus.PENDING) {
    return payment;
  }

  if (!payment.bkashPaymentId) {
    return payment;
  }

  let bkashResponse: BkashResponse;

  if (mode === "execute") {
    try {
      bkashResponse = await bkashExecute(payment.bkashPaymentId);
    } catch {
      // Execute may fail due to a temporary network issue.
      // Query bKash before deciding the payment result.
      bkashResponse = await bkashQuery(payment.bkashPaymentId);
    }

    const transactionStatus = getString(
      bkashResponse.transactionStatus,
    );

    const statusCode = getString(bkashResponse.statusCode);

    if (
      statusCode !== "0000" ||
      transactionStatus !== "Completed"
    ) {
      bkashResponse = await bkashQuery(payment.bkashPaymentId);
    }
  } else {
    bkashResponse = await bkashQuery(payment.bkashPaymentId);
  }

  const statusCode = getString(bkashResponse.statusCode);
  const transactionStatus = getString(
    bkashResponse.transactionStatus,
  );
  const trxID = getString(bkashResponse.trxID);
  const responsePaymentID = getString(
    bkashResponse.paymentID,
  );
  const responseInvoice = getString(
    bkashResponse.merchantInvoiceNumber,
  );
  const responseAmount = getNumber(bkashResponse.amount);
  const responseCurrency = getString(bkashResponse.currency);

  const isCompleted =
    statusCode === "0000" &&
    transactionStatus === "Completed" &&
    Boolean(trxID) &&
    (!responsePaymentID ||
      responsePaymentID === payment.bkashPaymentId) &&
    (!responseInvoice ||
      responseInvoice === payment.merchantInvoiceNumber) &&
    (responseAmount === undefined ||
      responseAmount === payment.amount) &&
    (!responseCurrency ||
      responseCurrency === payment.currency);

  // Only mark PAID when bKash confirms successful payment.
  if (isCompleted) {
    const result = await prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.PAID,
        bkashTrxId: trxID,
        paidAt: new Date(),
        failureReason: null,
        getWayResponse:
          bkashResponse as Prisma.InputJsonValue,
      },
    });

    if (result.count > 0) {
      await createPaymentAuditLog(
        payment.companyId,
        payment.id,
        "PAYMENT_PAID",
        {
          assessmentId: payment.assessmentId,
          trxID,
          amount: payment.amount,
        },
      );
    }

    return prisma.payment.findUnique({
      where: { id: payment.id },
    });
  }

  // Do not mark a still-pending/unknown transaction as failed.
  // Keep it pending until bKash confirms a terminal result.
  const currentStatus = getString(
    bkashResponse.transactionStatus,
  );

  const isTerminalFailure =
    currentStatus === "Failed" ||
    currentStatus === "Cancelled" ||
    currentStatus === "Canceled";

  if (isTerminalFailure) {
    const result = await prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.FAILED,
        failureReason:
          getString(bkashResponse.statusMessage) ??
          `bKash transaction status: ${currentStatus}`,
        getWayResponse:
          bkashResponse as Prisma.InputJsonValue,
      },
    });

    if (result.count > 0) {
      await createPaymentAuditLog(
        payment.companyId,
        payment.id,
        "PAYMENT_FAILED",
        {
          assessmentId: payment.assessmentId,
          reason: currentStatus,
        },
      );
    }
  }

  return prisma.payment.findUnique({
    where: { id: payment.id },
  });
};

// 3. bKash callback
const paymentCallback = async (
  query: Record<string, unknown>,
) => {
  const paymentID = getString(query.paymentID);
  const callbackStatus = getString(query.status);

  if (!paymentID) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Payment ID is required",
    );
  }

  const payment = await prisma.payment.findFirst({
    where: {
      bkashPaymentId: paymentID,
    },
  });

  if (!payment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Payment record not found",
    );
  }

  if (payment.status !== PaymentStatus.PENDING) {
    return payment;
  }

  // Even if callback says success, execute and verify with bKash.
  if (callbackStatus === "success") {
    return verifyPayment(payment.id, "execute");
  }

  // Cancel/failure callback is not enough proof that no payment
  // was completed. Query bKash before updating our database.
  return verifyPayment(payment.id, "query");
};

// 4. Get logged-in company's payment history
const getMyPayments = async (user: RequestUser) => {
  const company = await prisma.companyProfile.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!company) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Company profile not found",
    );
  }

  return prisma.payment.findMany({
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
};

// 5. Get all payments (Admin)
const getAllPayments = async (query: PaymentQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(
    Math.max(Number(query.limit) || 10, 1),
    100,
  );
  const skip = (page - 1) * limit;

  const andConditions: PaymentWhereInput[] = [];

  if (query.status) {
    andConditions.push({
      status: query.status,
    });
  }

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
      ],
    });
  }

  const whereConditions: PaymentWhereInput = {
    AND: andConditions,
  };

  const allowedSortFields = [
    "createdAt",
    "updatedAt",
    "amount",
    "paidAt",
  ];

  const sortBy =
    query.sortBy && allowedSortFields.includes(query.sortBy)
      ? query.sortBy
      : "createdAt";

  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  const [payments, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where: whereConditions,
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
          },
        },
        assessment: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    }),
    prisma.payment.count({
      where: whereConditions,
    }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: payments,
  };
};

// 6. Get one payment by ID (Company)
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
      "Company profile not found",
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
      "Payment not found",
    );
  }

  if (
    payment.status === PaymentStatus.PENDING &&
    payment.bkashPaymentId
  ) {
    return verifyPayment(payment.id, "query");
  }

  return payment;
};

export const PaymentSercice = {
  paymentCreate,
  verifyPayment,
  paymentCallback,
  getMyPayments,
  getAllPayments,
  getPaymentById,
};

*/






































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

const ASSESSMENT_FEE = Number(config.admin_fee);

// 1. Create Payment
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

// 2. Payment Callback
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

// 3. Get My Payments
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

// 4. Get All Payments (Admin)
const getAllPayments = async (query: any) => {
  const limit = Math.min(
    Math.max(Number(query.limit) || 10, 1),
    100,
  );

  const page = Math.max(Number(query.page) || 1, 1);
  const skip = (page - 1) * limit;

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

  const sortBy =
    query.sortBy && allowedSortFields.includes(query.sortBy)
      ? query.sortBy
      : "createdAt";

  const sortOrder = query.sortOrder === "asc" ? "asc" : "desc";

  const payment = await prisma.payment.findMany({
    where: {
      AND: andConditions,
    },
    take: limit,
    skip,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      company: {
        select: {
          id: true,
          companyName: true,
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

// 5. Get Payment By ID (Company)
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