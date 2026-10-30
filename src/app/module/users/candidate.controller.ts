import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { IRequestUser } from "./candidate.interface";
import { sendResponse } from "../../utils/sendResponseData";
import httpStatus from 'http-status'
import { candidateProfileService } from "./candidate.service";

const getCandidateProfile = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as unknown as IRequestUser;

	if (!user) {
		throw new Error("User information is missing in the request");
	}

	const result = await candidateProfileService.getCandidateProfile(user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile get successfully",
		data: result,
	});
});

const updatedProfile = catchAsync(async (req: Request, res: Response) => {

	const payload = req.body;
	const user = req.user!

	const result = await candidateProfileService.updatedProfile(payload,user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "candidate profile Updated successfully",
		data: result,
	});
});


export const CandidateProfileController = {
    getCandidateProfile,
	updatedProfile
}