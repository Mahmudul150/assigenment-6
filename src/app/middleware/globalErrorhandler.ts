// import { NextFunction, Request, Response } from "express";

// import config from "../config";
// import httpStatus from 'http-status'
// import { Prisma } from "../../../generated/prisma/client";
// import { AppError } from "./appError";

// export const globalErrorHandler = async (
// 	err: any,
// 	_req: Request,
// 	res: Response,
// 	_next: NextFunction,
// ) => {
// 	if (config.node_env === "development") {
// 		console.log("Error from Global Error Handler", err);
// 	}

// 	let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
// 	let errorMessage = err.message || "Internal Server Error";
// 	const errorName = err.name || "Internal Server Error";
// 	// let errorDetails = err.stack

// 	if (err instanceof Prisma.PrismaClientValidationError) {
// 		statusCode = httpStatus.BAD_REQUEST;
// 		errorMessage = "You have provided incorrect field type or missing fields";
// 	} else if (err instanceof Prisma.PrismaClientKnownRequestError) {
// 		if (err.code === "P2002") {
// 			(statusCode = httpStatus.BAD_REQUEST),
// 				(errorMessage = "Duplicate Key Error");
// 		} else if (err.code === "P2003") {
// 			(statusCode = httpStatus.BAD_REQUEST),
// 				(errorMessage = "Foreign key constraint failed");
// 		} else if (err.code === "P2025") {
// 			(statusCode = httpStatus.BAD_REQUEST),
// 				(errorMessage =
// 					"An operation failed because it depends on one or more records that were required but not found.");
// 		}
// 	} else if (err instanceof Prisma.PrismaClientInitializationError) {
// 		if (err.errorCode === "P1000") {
// 			statusCode = httpStatus.UNAUTHORIZED;
// 			errorMessage =
// 				"Authentication failed against database server. Please Check Your Credentials";
// 		} else if (err.errorCode === "P1001") {
// 			statusCode = httpStatus.BAD_REQUEST;
// 			errorMessage = "Can't reach database server";
// 		}
// 	} else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
// 		statusCode = httpStatus.INTERNAL_SERVER_ERROR;
// 		errorMessage = "Error occurred during query execution";
// 	}else if(err instanceof AppError){	//app error 
// 		statusCode = err.statusCode;
// 		errorMessage = err.message
// 	}
// 	 else if (err instanceof Error) {
// 		errorMessage = err.message;
// 	}

// 	res.status(statusCode).json({
// 		success: false,
// 		statusCode: statusCode || httpStatus.INTERNAL_SERVER_ERROR,
// 		name:
// 			config.node_env === "development" ? errorName : "Internal Server Error",
// 		message:
// 			config.node_env === "development"
// 				? errorMessage
// 				: "Internal Server Error",
// 		error: config.node_env === "development" ? err : undefined,
// 		stack: config.node_env === "development" ? err.stack : undefined,
// 	});
// };








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
