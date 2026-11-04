import {
  AssessmentStatus,
  PaymentStatus,
  UserStatus,
} from "../../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/appError";
import httpStatus from "http-status";
import { IAdminUpdateUserStatus } from "./interface";
import { IQuery } from "../../quaryInterface";

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

  return {
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

  const allUser = await prisma.user.findMany({
    where: {
      isDeleted: false,
    },
    take: limit,
    skip: skip,
    orderBy: {
      [sortBy]: sortOrder,
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
    where: {
      isDeleted: false,
    },
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
) => {
  const user = await prisma.user.findFirst({
    where: {
      id,
      isDeleted: false,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const result = await prisma.user.update({
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

  return result;
};

export const AdminService = {
  adminDasboard,
  adminGetAllUser,
  adminGetSingleUser,
  adminUpdateUserStatus,
};
