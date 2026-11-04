import { Prisma } from "../../../../generated/prisma/client";

export interface ICreateAuditLog {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}

export interface IAuditLogFilters {
  userId?: string;
  entityType?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}
