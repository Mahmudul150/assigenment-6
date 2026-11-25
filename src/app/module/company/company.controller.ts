import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { companyService } from "./compay.service";
import { sendResponse } from "../../utils/sendResponseData";
import httpStatus from "http-status";
import { AuthService } from "../auth/auth.service";

const createCompany = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const result = await companyService.createAsACompany(payload);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Applied As Company Successfuly",
    data: result,
  });
});

const verifyCompanyEmail = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  const result = await companyService.verifyCompanyEmail(payload);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Company Email Verified Successfully",
    data: result,
  });
});

const isApproved = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const Admin = req.user!;
  const result = await companyService.isApproved(payload, Admin);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin approved the company profile  Successfully",
    data: result,
  });
});

const updatedProfile = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const user = req.user!;
  const file = req.file?.buffer;

  if (file) {
    await AuthService.uploadImage(file, user.userId);
  }

  const result = await companyService.updateCompanyProfile(payload, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Company updated her profile  Successfully",
    data: result,
  });
});

const allCompanyget = catchAsync(async (req: Request, res: Response) => {
  const query = req.query;
  const { data, meta } = await companyService.getAllCompany(query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin All Company Successfully",
    data: {
      data,
      meta,
    },
  });
});

const getMyCompany = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;

  const result = await companyService.getMyCompany(user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Company profile retrieved successfully",
    data: result,
  });
});

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;

  const result = await companyService.getDashboardStats(user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Company dashboard stats retrieved successfully",
    data: result,
  });
});

export const companyCnontroller = {
  createCompany,
  verifyCompanyEmail,
  updatedProfile,
  allCompanyget,
  isApproved,
  getMyCompany,
  getDashboardStats,
};
