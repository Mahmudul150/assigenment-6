import { Request, Response } from "express";
import httpStatus from "http-status";
import { AdminService } from "./admin.service";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponseData";

const adminDasboard = catchAsync( async (req: Request, res: Response) => {
    const result = await AdminService.adminDasboard();

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Admin dashboard retrieved successfully",
      data: result,
    });
  }
);


const adminGetAllUser = catchAsync( async (req: Request, res: Response) => {
    const quary = req.query
    const result = await AdminService.adminGetAllUser(quary);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Admin All Users retrieved successfully",
      data: result,
    });
  }
);


const adminGetSingleUser = catchAsync(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const result = await AdminService.adminGetSingleUser(id);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Admin single User retrieved successfully",
      data: result,
    });
  }
);


const updateUserStatus = catchAsync(
  async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const payload = req.body;

    const result = await AdminService.adminUpdateUserStatus(id, payload);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Admin updated User status  successfully",
      data: result,
    });
  }
);

export const AdminController = {
  adminDasboard,
  adminGetAllUser,
  adminGetSingleUser,
  updateUserStatus,
};