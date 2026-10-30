import z from "zod";
import { Role } from "../../../../generated/prisma/enums";

export const authRegisterSchema = z.object({
  email: z.email("Invalid email address"),
  name: z.string("Name must be at least 2 characters long").min(6),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(16, "Password cannot exceed 32 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
    role: z.string().optional(),
      candidate: z
    .object({
      phone: z.string("Invalid phone number").min(11).optional(),
      bio: z.string().optional(),
      skills: z.array(z.string()).min(1, "At least one skill is required"),
      experienceYears: z
        .number()
        .min(0, { message: "Experience years cannot be negative" }),
    })
    .optional(),
});
export const authLoginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(16, "Password cannot exceed 32 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
   
});

const ForgotPasswordZodSchema = z.object({
	email: z.email(),
});

const ResetPasswordZodSchema = z.object({
	email: z.email(),
	newPassword: z
		.string()
		.min(8, "Password Must Minimum 8 Characters Long.")
		.regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
		.regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

		.regex(/[0-9]/, "Password must contain atleast 1 Number")
		.regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
	otp: z.string().length(6),
});

export const UserValidaton = {
    authRegisterSchema,
    authLoginSchema,
    ForgotPasswordZodSchema,
    ResetPasswordZodSchema
}