import { Request, Response } from "express";
import httpStatus from "http-status";
import { AuditLogService } from "./auditLog.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponseData";

const getAllAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const filters = {
    userId: req.query.userId as string | undefined,
    entityType: req.query.entityType as string | undefined,
    action: req.query.action as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 20,
  };

  const { data, meta } = await AuditLogService.getAuditLogs(filters);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Audit logs retrieved successfully",
    data: {
      data,
      meta,
    },
  });
});

const getSingleAuditLog = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const result = await AuditLogService.getSingleAuditLog(id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Audit log retrieved successfully",
    data: result,
  });
});

export const AuditLogController = {
  getAllAuditLogs,
  getSingleAuditLog,
};
