import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponseData";
import httpStatus from 'http-status'
import { PaymentService } from "./payment.service";

const createPayment = catchAsync(async (req: Request, res: Response) => {
  const { assessmentId } = req.body;
  const user = req.user!;

  const result = await PaymentService.paymentCreate(
    assessmentId,
    user
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment initiated successfully",
    data: result,
  });
});


const paymentCallback = catchAsync(
  async (req: Request, res: Response) => {
    const result = await PaymentService.paymentCallback(req.query);

    if (result.redirectUrl) {
      return res.redirect(result.redirectUrl);
    }

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Payments callback processed successfully.",
      data: result,
    });
  },
);


const getMyPayments = catchAsync(
  async (req: Request, res: Response) => {

    const user = req.user!;

    const result = await PaymentService.getMyPayments(user);

     sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Payment history retrieved successfully",
      data: result,
    });
  }
);


const getAllPayments = catchAsync(
  async (req: Request, res: Response) => {
    const query = req.query;

    const result = await PaymentService.getAllPayments(query);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Payments retrieved successfully",
      data: result,
    });
  }
);

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
  const paymentId = req.params.id as string;
  const user = req.user!;

  const result = await PaymentService.getPaymentById(paymentId, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment retrieved successfully",
    data: result,
  });
});

export const paymentController = {
    createPayment,
    paymentCallback,
    getMyPayments,
    getAllPayments,
    getPaymentById
}