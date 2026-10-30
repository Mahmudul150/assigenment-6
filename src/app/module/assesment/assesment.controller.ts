import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponseData";
import httpStatus from 'http-status'
import { assesmentService } from "./assesment.service";

const createAssesment = catchAsync(async (req: Request, res: Response) => {
	
const payload = req.body;
 const  user = req.user!
	const result = await assesmentService.createAssesment(payload,user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile get successfully",
		data: result,
	});
});

const getAllAssesment = catchAsync(async (req: Request, res: Response) => {
	
	const quary = req.query

	const {data,meta} = await assesmentService.getAllAssesment(quary);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Admin  get all assesment  successfully that is created by the company",
		data: {
			data,
			meta
		},
	});
});

const getMYAssesment = catchAsync(async (req: Request, res: Response) => {
	
	const quary = req.query
	const user = req.user!

	const {data,meta} = await assesmentService.getMyAssesment(quary,user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Company get all assesment thats created by the company",
		data: {
			data,
			meta
		},
	});
});

const updateAssesment = catchAsync(async (req: Request, res: Response) => {
	
	const user = req.user!
	const assessmentId = req.params.assessmentId as string
	const payload = req.body

	const result = await assesmentService.updateAssessment(assessmentId, payload, user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "company updated her assesment data successfully",
		data: result,
	});
});


const deleteAssesment = catchAsync(async (req: Request, res: Response) => {
	
	const user = req.user!
	const assessmentId = req.params.assessmentId as string

	const result = await assesmentService.deleteAssessment(assessmentId, user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Assesment deleted  successfully",
		data: result,
	});
});


export const assesmentController = {
    createAssesment,
    getAllAssesment,
    getMYAssesment,
	updateAssesment,
	deleteAssesment
    
}