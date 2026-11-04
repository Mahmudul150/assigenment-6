import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponseData";
import httpStatus from "http-status";
import { SubmissionService } from "./submisseion.service";

const createSubmission = catchAsync( async (req: Request, res: Response) => {
    const payload = req.body;
    const user = req.user!;

    const result = await SubmissionService.createSubmission( payload,user);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Answer submitted successfully",
      data: result,
    });
  }
);

const getAllSubmissions = catchAsync( async (req: Request, res: Response) => {
    const quary = req.query;
    const user = req.user!;
    const { data, meta } = await SubmissionService.getAllSubmissions( quary, user);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "All submissions retrieved successfully",
      data: {
        data,
        meta
      },
    });
  }
);
const getMySubmissions = catchAsync( async (req: Request, res: Response) => {
    const attemptId = req.params.attemptId as string;
    const user = req.user!;

    const result = await SubmissionService.getMySubmissions( attemptId, user);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "My submissions retrieved successfully",
      data: result,
    });
  }
);

const updateSubmission = catchAsync( async (req: Request, res: Response) => {
    const submissionId = req.params.submissionId as string;
    const payload = req.body;
    const user = req.user!;

    const result = await SubmissionService.updateSubmission( submissionId, payload, user);

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Submission updated successfully",
      data: result,
    });
  }
);


const evaluateSubmission = catchAsync( async (req: Request, res: Response) => {
    const submissionId = req.params.submissionId as string;
    const payload = req.body;
    const user = req.user!;

    const result = await SubmissionService.evaluateSubmission( submissionId, payload, user);
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Submission evaluated successfully",
      data: result,
    });
  }
);


export const submissionController = {
    createSubmission,
    getAllSubmissions,
    getMySubmissions,
    updateSubmission,
    evaluateSubmission
}