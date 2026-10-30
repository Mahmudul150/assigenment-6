
import z from "zod";
import { Difficulty, ProblemType } from "../../../../generated/prisma/enums";

export const createProblemSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters long"),

  description: z
    .string()
    .min(10, "Description must be at least 10 characters long"),

  type: z.enum(ProblemType),

  difficulty: z.enum(Difficulty),

  points: z
    .number()
    .int("Points must be an integer")
    .positive("Points must be greater than 0")
    .optional(),

  options: z
    .json()
    .optional(),

  correctAnswer: z
    .string()
    .optional(),

  testCases: z
    .json()
    .optional(),
});


export const updateProblemSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters long")
    .optional(),

  description: z
    .string()
    .min(10, "Description must be at least 10 characters long")
    .optional(),

  type: z
    .enum(ProblemType)
    .optional(),

  difficulty: z
    .enum(Difficulty)
    .optional(),

  points: z
    .number()
    .int("Points must be an integer")
    .positive("Points must be greater than 0")
    .optional(),

  options: z
    .json()
    .optional(),

  correctAnswer: z
    .string()
    .optional(),

  testCases: z
    .json()
    .optional(),
});


export const problemValidationSchema = {
  createProblemSchema,
  updateProblemSchema,
};
