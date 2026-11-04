import { z } from "zod";

const createPaymentValidationSchema = z.object({
  assessmentId: z.uuid("Invalid assessment id"),
})

export const PaymentValidation = {
  createPaymentValidationSchema,
};