import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { assesmentService } from "../assesment/assesment.service";
import { assesmentProblems } from "./assPbm.service";
import { sendResponse } from "../../utils/sendResponseData";


const createProblemsToAssessment = catchAsync( async (req: Request, res: Response) => {

    const assessmentId = req.params.assessmentId as string
    const payload = req.body
    const user = req.user!

    const result =  await assesmentProblems.createProblemsToAssessment(assessmentId , payload, user );

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Problems added to assessment successfully",
      data: result,
    });
  }
);


const getProblemsToAssessment =  catchAsync(async(req: Request, res: Response) =>{
    const query = req.query
    const assessmentId = req.params.assessmentId as string
    const user = req.user!

    const result =  await assesmentProblems.getProblemsToAssessmen(query, assessmentId , user );

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Assessment problems retrieved successfully",
      data: result,
    });
  } )
const deleteProblemFromAssessment =  catchAsync(async(req: Request, res: Response) =>{
    const assessmentId = req.params.assessmentId as string
    const problemId = req.params.problemId as string
    const user = req.user!

    const result =  await assesmentProblems.deleteProblemFromAssessment( assessmentId,problemId , user );

    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: "Assessment problems retrieved successfully",
      data: result,
    });
  } )


export const  AssesmentProblemController = {
    createProblemsToAssessment,
    getProblemsToAssessment,
    deleteProblemFromAssessment
}