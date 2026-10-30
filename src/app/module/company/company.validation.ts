
import z from "zod";

export const createCompanyProfileSchema = z.object({
  name: z
    .string()
    .min(6, "Name must be at least 6 characters long"),

  email: z.email("Invalid email address"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(16, "Password cannot exceed 16 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character"
    ),

  company: z.object({
    name: z
      .string()
      .min(2, "Company name must be at least 2 characters long"),

    website: z
      .url("Invalid website URL")
      .optional(),

    industry: z
      .string()
      .optional(),

    description: z
      .string()
      .optional(),

    logoUrl: z
      .url("Invalid logo URL")
      .optional(),
  }),
});


export const updateCompanyProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Company name must be at least 2 characters long")
    .optional(),

  website: z
    .url("Invalid website URL")
    .optional(),

  industry: z
    .string()
    .optional(),

  description: z
    .string()
    .optional(),

  logoUrl: z
    .url("Invalid logo URL")
    .nullable()
    .optional(),
});

export const companyValidateSchema = {
    createCompanyProfileSchema,
    updateCompanyProfileSchema
}