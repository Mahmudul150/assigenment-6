import { z } from "zod";

const adminUpdateUserStatusValidationSchema = z.object({
  status:z.enum(["ACTIVE", "BLOCKED", "INACTIVE"])
});

export const AdminValidation = {
  adminUpdateUserStatusValidationSchema,
};