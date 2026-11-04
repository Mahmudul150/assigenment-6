import { z } from "zod";

const updatedProfileValidationSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  location: z.string().optional(),
  skills: z.array(z.string()).optional(),
  experienceYears: z.number().optional(),
  githubUrl: z.string().url("Invalid Github URL").optional(),
  linkedinUrl: z.string().url("Invalid LinkedIn URL").optional(),
});

export const CandidateProfileValidation = {
  updatedProfileValidationSchema,
};