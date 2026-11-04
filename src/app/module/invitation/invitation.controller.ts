import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponseData";
import { InvitationService } from "./invitation.service";
import type { IQuery } from "../../quaryInterface";

const createInvitation = catchAsync(async (req: Request, res: Response) => {
	const result = await InvitationService.createInvitation(
		req.body,
		req.user!,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Invitation created successfully",
		data: result,
	});
});

const getAllInvitation = catchAsync(async (req: Request, res: Response) => {
	const result = await InvitationService.getAllInvitation(
		req.query as IQuery,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Invitations retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getMyInvitation = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!
	const result = await InvitationService.getMyInvitation(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My invitations retrieved successfully",
		data: result
	});
});

const getSingleInvitation = catchAsync(async (req: Request, res: Response) => {

  const user = req.user!
  const id = req.params.id as string

	const result = await InvitationService.getSingleInvitation(id , user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Invitation retrieved successfully",
		data: result,
	});
});

const updateInvitation = catchAsync(async (req: Request, res: Response) => {

  const invitationId = req.params.id as string;
	const payload =	req.body;
	const user =	req.user!

	const result = await InvitationService.updateInvitation(invitationId , payload , user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Invitation updated successfully",
		data: result,
	});
});

const deleteInvitation = catchAsync(async (req: Request, res: Response) => {

  const invitationId = req.params.invitationId as string
  const user = req.user!

	const result = await InvitationService.deleteInvitation(invitationId , user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Invitation deleted successfully",
		data: result,
	});
});

export const invitationController = {
	createInvitation,
	getAllInvitation,
	getMyInvitation,
	getSingleInvitation,
	updateInvitation,
	deleteInvitation,
};
