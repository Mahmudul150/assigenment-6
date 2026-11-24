import { z } from "zod";

const createSubmissionValidationSchema = z.object({
  attemptId: z.string("Attempt ID is required"),
  problemId: z.string("Problem ID is required"),
  answer: z.any().optional(),
});

const updateSubmissionValidationSchema = z.object({
  answer: z.any()
})

const evaluateSubmissionValidationSchema = z.object({
  score: z.number().min(0, "Score cannot be negative"),
  feedback: z.string().optional(),
});

export const SubmissionValidation = {
  createSubmissionValidationSchema,
  updateSubmissionValidationSchema,
  evaluateSubmissionValidationSchema,
};