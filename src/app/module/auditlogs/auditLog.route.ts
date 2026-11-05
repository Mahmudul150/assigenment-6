import express from "express";
import { AuditLogController } from "./auditLog.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";

const router = express.Router();

router.get(
  "/",
  auth(Role.ADMIN),
  AuditLogController.getAllAuditLogs
);


export const AuditLogRoutes = router;