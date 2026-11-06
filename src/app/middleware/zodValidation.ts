import httpStatus from "http-status";
import type { NextFunction, Request, Response } from "express";
import type z from "zod";
import { AppError } from "./appError";

export const zodValidate = (zodSchema: z.ZodType) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = zodSchema.safeParse(req.body ?? {});

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return next(
        new AppError(httpStatus.BAD_REQUEST, errors[0].message || "Invalid request data")
      );
    }

    req.body = result.data;
    next();
  };
};