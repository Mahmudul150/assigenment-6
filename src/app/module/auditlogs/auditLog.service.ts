import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/appError";
import { IAuditLogFilters, ICreateAuditLog } from "./auditLog.interface";
import { Prisma } from "../../../../generated/prisma/client";

// Create Audit Log
const createAuditLog = async (payload: ICreateAuditLog) => {
  const result = await prisma.auditLog.create({
    data: {
      userId: payload.userId,
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId,
      metadata: payload.metadata,
    },
  });

  return result;
};

// Get Audit Logs with Filter and Pagination
const getAuditLogs = async (filters: IAuditLogFilters) => {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {};

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.entityType) {
    where.entityType = filters.entityType;
  }

  if (filters.action) {
    where.action = filters.action;
  }

  if (filters.from || filters.to) {
    where.createdAt = {
      gte: filters.from ? new Date(filters.from) : undefined,
      lte: filters.to ? new Date(filters.to) : undefined,
    };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),

    prisma.auditLog.count({ where }),
  ]);

  return {
    data: logs,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get Single Audit Log
const getSingleAuditLog = async (id: string) => {
  const result = await prisma.auditLog.findUnique({
    where: {
      id,
    },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Audit log not found"
    );
  }

  return result;
};

export const AuditLogService = {
  createAuditLog,
getAuditLogs,
  getSingleAuditLog,
};
