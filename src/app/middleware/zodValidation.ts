// import type { NextFunction, Request, Response } from "express";
// import type z from "zod";
// import { catchAsync } from "../utils/catchAsync";

// export const zodValidate = (zodSchema: z.ZodObject) => {
// 	return catchAsync((req: Request, res: Response, next: NextFunction) => {
// 		const payload = req.body ?? {};
// 		// const result = patientValidation.PatientRegistationZodSchmea.safeParse(payload)
// 		const result = zodSchema.safeParse(payload);

// 		if (!result.success) {
// 			console.log(result.error);
// 			console.log(result.error.issues);
// 			throw new Error(result.error.issues[0].message);
// 		}
// 		req.body = result.data;
// 		next();
// 	});
// };






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
        new AppError(400, "Validation failed", errors)
      );
    }

    req.body = result.data;
    next();
  };
};