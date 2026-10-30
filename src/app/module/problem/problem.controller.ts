import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponseData";
import httpStatus from 'http-status'
import { problemService } from "./problem.service";

const problemCreate =  catchAsync(async (req: Request, res: Response) => {

    const payload = req.body;
    const user = req.user!
	const result = await problemService.createProblem (payload,user )

    sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "company create a problem Successfully",
		data: result,
	});
})


const getAllProblems = catchAsync(async (req: Request, res: Response) => {
    const query = req.query
    const {data,meta} = await problemService.getALlProblem(query)
    sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Get all problem retrived  Successfully",
		data: {
            data,
            meta
        },
	});
})
const getMyProblems = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!
    const query = req.query
    const {data,meta} = await problemService.getMyProblems(query , user)
    sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Get My problem retrived  Successfully",
		data: {
            data,
            meta
        },
	});
})


const getProblemById = catchAsync(
  async (req: Request, res: Response) => {
const id = req.params.problemid as string;
    const result = await problemService.getProblemById(id);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Problem retrieved successfully",
      data: result,
    });
  }
);


const updateProblemById = catchAsync(
  async (req: Request, res: Response) => {
    const  problemId  = req.params.problemId as string;
    const user = req.user!;
    const payload = req.body;

    const result = await problemService.updateProblemById(
      problemId,
      payload,
      user
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Problem updated successfully",
      data: result,
    });
  }
);


const deleteProblemById = catchAsync(
  async (req: Request, res: Response) => {
    const problemId = req.params.problemId as string;
    const user = req.user!;

    const result = await problemService.deleteProblemById(
      problemId,
      user
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Problem deleted successfully",
      data: result,
    });
  }
);

export const problemCOntroller = {
    problemCreate,
    getAllProblems,
    getMyProblems,
    getProblemById,
    updateProblemById,
deleteProblemById


}