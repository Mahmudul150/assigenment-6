import { z } from "zod";

const addProblemsToAssessmentValidation = z.object({
  problems: z
    .array(
      z.object({
        problemId: z.string().uuid(),
        order: z.number().int().positive(),
      })
    )
    .min(1, "At least one problem is required"),
});

export const assessmentProblemValidation = {
  addProblemsToAssessmentValidation,
};