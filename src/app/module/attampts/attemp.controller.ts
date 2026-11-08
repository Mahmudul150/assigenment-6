import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponseData";
import httpStatus from "http-status";
import { AttemptService } from "./attempt.service";
import { AppError } from "../../middleware/appError";

const createAttempt = catchAsync(async (req: Request, res: Response) => {
  const invitationId = req.params.invitationId as string;
  const user = req.user!;

  if (!user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "User is not authenticated");
  }

  const result = await AttemptService.createAttempt(invitationId, user!);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "attempt created successfully",
    data: result,
  });
});

const getAllAttempts = catchAsync(async (req: Request, res: Response) => {
  const quary = req.query;

  const result = await AttemptService.getAllAttempts(quary);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "all attempts retrieved successfully",
    data: result,
  });
});
const getSingleAttempt = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const user = req.user!;

  const result = await AttemptService.getSingleAttempt(id, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "single attempt retrieved successfully",
    data: result,
  });
});

const getMyAttempts = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;

  const result = await AttemptService.getMyAttempts(user);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "my attempts retrieved successfully",
    data: result,
  });
});

const getAttemptProblems = catchAsync(async (req: Request, res: Response) => {
  const attemptId = req.params.attemptId as string;
  const user = req.user!;

  const result = await AttemptService.getAttemptProblems(attemptId, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attempt problems retrieved successfully",
    data: result,
  });
});

const tabSwitch = catchAsync(async (req: Request, res: Response) => {
  const attemptId = req.params.attemptId as string;
  const user = req.user!;

  const result = await AttemptService.tabSwitch(attemptId, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tab switch count updated successfully",
    data: result,
  });
});

const submitAttempt = catchAsync(async (req: Request, res: Response) => {
  const attemptId = req.params.attemptId as string;
  const user = req.user!;

  const result = await AttemptService.submitAttempt(attemptId, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "attempt submitted successfully",
    data: result,
  });
});

const getMyResult = catchAsync(async (req: Request, res: Response) => {
  const attemptId = req.params.attemptId as string;
  const user = req.user!;

  const result = await AttemptService.getMyResult(attemptId, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My result retrieved successfully",
    data: result,
  });
});

export const attemptController = {
  createAttempt,
  getAllAttempts,
  getSingleAttempt,
  getMyAttempts,
  getAttemptProblems,
  tabSwitch,
  submitAttempt,
  getMyResult,
};
