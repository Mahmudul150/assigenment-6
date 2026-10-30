import { z } from "zod";

export const createAssessmentValidation = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(150, "Title cannot exceed 150 characters"),

  description: z
    .string()
    .optional(),

  durationMinutes: z
    .number()
    .int("Duration must be an integer")
    .positive("Duration must be greater than 0"),

  passingScore: z
    .number()
    .int("Passing score must be an integer")
    .min(0, "Passing score cannot be less than 0")
    .max(100, "Passing score cannot exceed 100"),

  status: z
    .enum(["DRAFT"])
    .default("DRAFT"),

  startsAt: z
    .coerce
    .date()
    .optional(),

  endsAt: z
    .coerce
    .date()
    .optional(),
});


export const updateAssessmentValidation = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(150, "Title cannot exceed 150 characters")
    .optional(),

  description: z
    .string()
    .optional(),

  durationMinutes: z
    .number()
    .int("Duration must be an integer")
    .positive("Duration must be greater than 0")
    .optional(),

  passingScore: z
    .number()
    .int("Passing score must be an integer")
    .min(0, "Passing score cannot be less than 0")
    .max(100, "Passing score cannot exceed 100")
    .optional(),

  status: z
    .enum(["DRAFT", "CANCELLED"])
    .optional(),

  startsAt: z
    .coerce
    .date()
    .optional(),

  endsAt: z
    .coerce
    .date()
    .optional(),
});


export const assessmentSchema = {
  createAssessmentValidation,
  updateAssessmentValidation
};