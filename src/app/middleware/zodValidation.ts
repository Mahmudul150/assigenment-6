import type { NextFunction, Request, Response } from "express";
import type z from "zod";
import { catchAsync } from "../utils/catchAsync";

export const zodValidate = (zodSchema: z.ZodObject) => {
	return catchAsync((req: Request, res: Response, next: NextFunction) => {
		const payload = req.body ?? {};
		// const result = patientValidation.PatientRegistationZodSchmea.safeParse(payload)
		const result = zodSchema.safeParse(payload);

		if (!result.success) {
			console.log(result.error);
			console.log(result.error.issues);
			throw new Error(result.error.issues[0].message);
		}
		req.body = result.data;
		next();
	});
};
