import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import config from "../config";
import { AppError } from "./appError";

export const globalErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode:number = httpStatus.INTERNAL_SERVER_ERROR;
  let message = "Internal Server Error";
  let errors: { field?: string; message: string }[] = [];

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      statusCode = httpStatus.CONFLICT;
      message = "Duplicate value already exists";
      errors = [
        {
          field: String(err.meta?.target ?? ""),
          message: "Must be unique",
        },
      ];
    } else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      message = "Record not found";
    } else if (err.code === "P2003") {
      statusCode = httpStatus.BAD_REQUEST;
      message = "Foreign key constraint failed";
    } else {
      statusCode = httpStatus.BAD_REQUEST;
      message = "Database request failed";
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Invalid or missing fields";
  } else if (err?.type === "entity.parse.failed") {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Invalid JSON body";
  } else if (err instanceof Error) {
    message =
      config.node_env === "development"
        ? err.message
        : "Internal Server Error";
  }

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors,
    ...(config.node_env === "development" && {
      stack: err.stack,
    }),
  });
};
