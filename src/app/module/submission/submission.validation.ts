import { z } from "zod";

const createSubmissionValidationSchema = z.object({
  attemptId: z.string("Attempt ID is required"),
  problemId: z.string("Problem ID is required"),
  answer: z.any().optional(),
});

const updateSubmissionValidationSchema = z.object({
  answer: z.any()
})
export const SubmissionValidation = {
  createSubmissionValidationSchema,
  updateSubmissionValidationSchema,
};