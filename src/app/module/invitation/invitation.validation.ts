import { z } from "zod";

export const createInvitationValidation = z.object({
	assessmentId: z
		.string()
		.trim()
		.min(1, "Assessment id is required"),

	email: z
		.string()
		.trim()
		.toLowerCase()
		.email("Please provide a valid email address"),
});

export const updateInvitationValidation = z.object({
	status: z.enum(["ACCEPTED", "DECLINED"], {
		message: "Status must be either ACCEPTED or DECLINED",
	}),
});

export const invitationSchema = {
	createInvitationValidation,
	updateInvitationValidation,
};
