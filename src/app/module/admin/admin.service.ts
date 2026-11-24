import {
  AssessmentStatus,
  PaymentStatus,
  Role,
  UserStatus,
} from "../../../../generated/prisma/enums";
import { UserWhereInput } from "../../../../generated/prisma/models";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/appError";
import httpStatus from "http-status";
import { IAdminUpdateUserStatus } from "./interface";
import { IQuery } from "../../quaryInterface";
import { RequestUser } from "../../middleware/auth";

const adminDasboard = async () => {
  const totalUser = await prisma.user.count({
    where: {
      isDeleted: false,
    },
  });
  const totalCandidates = await prisma.candidateProfile.count();
  const totalCompany = await prisma.companyProfile.count();

  const approveCompany = await prisma.companyProfile.count({
    where: {
      isApproved: true,
    },
  });
  const pendingCompany = await prisma.companyProfile.count({
    where: {
      isApproved: false,
    },
  });
  const totalAssesment = await prisma.assessment.count();
  const isPublishedAssesment = await prisma.assessment.count({
    where: {
      status: AssessmentStatus.PUBLISHED,
    },
  });
  const isDarftAssesment = await prisma.assessment.count({
    where: {
      status: AssessmentStatus.DRAFT,
    },
  });
  const isClosedAssesment = await prisma.assessment.count({
    where: {
      status: AssessmentStatus.CLOSED,
    },
  });

  const totalPaidPayment = await prisma.payment.count({
    where: {
      status: PaymentStatus.PAID,
    },
  });
  const totalPaidAmount = await prisma.payment.aggregate({
    where: {
      status: PaymentStatus.PAID,
    },
    _sum: {
      amount: true,
    },
  });
  const totalAttampts = await prisma.attempt.count();
  const progressAttampts = await prisma.attempt.count({
    where: {
      status: "IN_PROGRESS",
    },
  });
  const submitedAttampts = await prisma.attempt.count({
    where: {
      status: "SUBMITTED",
    },
  });
  const evaluatedAttampts = await prisma.attempt.count({
    where: {
      status: "EVALUATED",
    },
  });

  const totalSubmission = await prisma.submission.count();

  const totalRevenue = totalPaidAmount._sum.amount ?? 0;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const recentPaidPayments = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.PAID,
      paidAt: { gte: sixMonthsAgo },
    },
    select: { amount: true, paidAt: true },
  });

  const revenueByMonthMap = new Map<string, number>();
  for (const payment of recentPaidPayments) {
    const month = payment.paidAt
      ? payment.paidAt.toLocaleString("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        })
      : "Unknown";
    revenueByMonthMap.set(
      month,
      (revenueByMonthMap.get(month) ?? 0) + payment.amount,
    );
  }
  const revenueByMonth = Array.from(revenueByMonthMap, ([month, amount]) => ({
    month,
    amount,
  }));

  return {
    totalRevenue,
    revenueByMonth,
    TotalPayment: totalPaidPayment,
    totalUser,
    totalCompany,
    totalCandidates,
    approveCompany,
    pendingCompany,
    totalAssesment,
    isPublishedAssesment,
    isDarftAssesment,
    isClosedAssesment,
    totalPaidPayment,
    totalPaidAmount,
    totalAttampts,
    totalSubmission,
    progressAttampts,
    submitedAttampts,
    evaluatedAttampts,
  };
};

const adminGetAllUser = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: UserWhereInput[] = [{ isDeleted: false }];

  if (typeof query.role === "string") {
    const role = query.role.toUpperCase();
    if (Object.values(Role).includes(role as Role)) {
      andConditions.push({ role: role as Role });
    }
  }

  if (typeof query.status === "string") {
    const status = query.status.toUpperCase();
    if (Object.values(UserStatus).includes(status as UserStatus)) {
      andConditions.push({ status: status as UserStatus });
    }
  }

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: String(query.searchTerm), mode: "insensitive" } },
        { email: { contains: String(query.searchTerm), mode: "insensitive" } },
      ],
    });
  }

  const allowedSortFields = [
    "createdAt",
    "updatedAt",
    "name",
    "email",
    "role",
    "status",
  ];
  const finalSortBy = allowedSortFields.includes(sortBy)
    ? sortBy
    : "createdAt";
  const finalSortOrder = sortOrder === "asc" ? "asc" : "desc";
  const where = { AND: andConditions };

  const allUser = await prisma.user.findMany({
    where,
    take: limit,
    skip: skip,
    orderBy: {
      [finalSortBy]: finalSortOrder,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      authProvider: true,
      emailVerified: true,
      imageUrl: true,
      createdAt: true,
    },
  });

  const totalUserCount = await prisma.user.count({
    where,
  });

  return {
    data: allUser,
    meta: {
      page: page,
      limit: limit,
      total: totalUserCount,
      totalPages: Math.ceil(totalUserCount / limit),
    },
  };
};

const adminGetSingleUser = async (id: string) => {
  const result = await prisma.user.findUnique({
    where: {
      id,
      isDeleted: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      authProvider: true,
      emailVerified: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
      candidate: true,
      company: true,
    },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return result;
};

const adminUpdateUserStatus = async (
  id: string,
  payload: IAdminUpdateUserStatus,
  admin: RequestUser,
) => {
  if (id === admin.userId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You cannot change your own status",
    );
  }

  const user = await prisma.user.findFirst({
    where: {
      id,
      isDeleted: false,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.role === Role.ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You cannot change another admin's status",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: {
        id,
      },
      data: {
        status: payload.status,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: admin.userId,
        action: "UPDATE",
        entityType: "User",
        entityId: id,
        metadata: {
          from: user.status,
          to: payload.status,
        },
      },
    });

    return updated;
  });

  return result;
};

export const AdminService = {
  adminDasboard,
  adminGetAllUser,
  adminGetSingleUser,
  adminUpdateUserStatus,
};
