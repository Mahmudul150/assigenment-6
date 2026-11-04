import { Router } from "express";
// import { paymentController, paymentController } from "./payment.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";
import { zodValidate } from "../../middleware/zodValidation";
import { PaymentValidation } from "./payment.validation";
import { paymentController } from "./payment.controller";

const route = Router()

route.post(
  "/initiate",
  auth(Role.COMPANY),
  zodValidate(PaymentValidation.createPaymentValidationSchema),
  paymentController.createPayment
);

route.get("/bkash/callback", paymentController.paymentCallback);

route.get(
  "/my-payment-history",
  auth(Role.COMPANY),
  paymentController.getMyPayments
);

route.get(
  "/allPayments",
  auth(Role.ADMIN),
  paymentController.getAllPayments
);

route.get(
  "/:id",
  auth(Role.COMPANY),
  paymentController.getPaymentById
);

export const PaymentRouter = route