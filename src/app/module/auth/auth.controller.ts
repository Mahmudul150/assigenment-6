import { catchAsync } from "../../utils/catchAsync"
import { sendResponse } from "../../utils/sendResponseData";
import type { CookieOptions, Request, Response } from "express";
import { AuthService } from "./auth.service";
import httpStatus from "http-status";
import { IRequestUser } from "./auth.interface";
import { AppError } from "../../middleware/appError";
import config from "../../config";

const getCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: config.node_env === "production",
  sameSite: config.node_env === "production" ? "none" : "lax",
});

const createUser = catchAsync(async(req: Request, res: Response)=>{
    const payload = req.body;

	const result = await AuthService.createUser(payload);

    sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "User registered successfully",
		data:result
	});
})

const verifyUserEmail = catchAsync(async  (req: Request, res: Response)=>{
	const payload = req.body;

	const result = await AuthService.verifyUserEmail(payload);

	const { accessToken, refreshToken, user, candidate } = result;

	res.cookie("accessToken", accessToken, {
  		...getCookieOptions(),
 		 maxAge: 1000 * 60 * 60 * 24,
		});

	res.cookie("refreshToken", refreshToken, {
 		 ...getCookieOptions(),
 		 maxAge: 1000 * 60 * 60 * 24 * 7,
		});

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Email verified successfully",
		data: {
			accessToken,
			refreshToken,
			user,
			candidate,
		},
		
	});
})

const loginUser = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const result = await AuthService.loginUser(payload);
	const { accessToken, refreshToken } = result;

	res.cookie("accessToken", accessToken, {
  		...getCookieOptions(),
  			maxAge: 1000 * 60 * 60 * 24,
		});

	res.cookie("refreshToken", refreshToken, {
 		 ...getCookieOptions(),
  			maxAge: 1000 * 60 * 60 * 24 * 7,
		});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged in successfully",
		data: {
			accessToken,
			refreshToken,
		},
	});
});




const refreshToken = catchAsync(async (req: Request, res: Response) => {
	if (!req.cookies.refreshToken) {
		throw new AppError(httpStatus.UNAUTHORIZED,"Refresh token is missing");
	}
	const result = await AuthService.refreshToken(req.cookies.refreshToken);
	const { accessToken, refreshToken: newRefreshToken } = result;

		res.cookie("accessToken", accessToken, {
 		 ...getCookieOptions(),
 			 maxAge: 1000 * 60 * 60 * 24,
			});

		res.cookie("refreshToken", newRefreshToken, {
 		 ...getCookieOptions(),
 			 maxAge: 1000 * 60 * 60 * 24 * 7,
			});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "New tokens generated successfully",
		data: {
			accessToken,
			refreshToken: newRefreshToken,
		},
	});
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await AuthService.googleLogin(payload);

	const { accessToken, refreshToken } = result;

	res.cookie("accessToken", accessToken, {
 			 ...getCookieOptions(),
  			maxAge: 1000 * 60 * 60 * 24,
		});

	res.cookie("refreshToken", refreshToken, {
		  ...getCookieOptions(),
 		 maxAge: 1000 * 60 * 60 * 24 * 7,
		});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "New tokens generated successfully",
		data: {
			accessToken,
			refreshToken,
		},
	});
});
const getMe = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as unknown as IRequestUser;

	if (!user) {
		throw new AppError(httpStatus.UNAUTHORIZED,"User information is missing in the request");
	}

	const result = await AuthService.getMe(user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile get successfully",
		data: result,
	});
});


const forgotPasseord = catchAsync( async(req: Request, res: Response)=>{
	const payload = req.body;

	const result = await AuthService.forgotPasseord(payload);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: `OTP send To email : ${payload.email}`,
		data: null
	});
})

const resetPassword = catchAsync( async(req: Request, res: Response)=>{
	const payload = req.body;

	const result = await AuthService.resetPassword(payload);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "password reset  successfully",
		data: result,
	});
})

const logout = catchAsync(async (req: Request, res: Response) => {
  res.clearCookie("accessToken", getCookieOptions());
  res.clearCookie("refreshToken", getCookieOptions());

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged out successfully",
    data: null,
  });
});



const uploadImage = catchAsync(async (req: Request, res: Response) => {
    const file = req.file?.buffer
	if (!file) {
		throw new AppError(httpStatus.BAD_REQUEST, "No File Provided.");
	}

	const userId = req.user?.userId;

	const result = await AuthService.uploadImage(file ,userId!,);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "uploaded  successfully",
		data: result,
	});
});

export const AuthController = {
    createUser,
	loginUser,
	verifyUserEmail,
	refreshToken,
	googleLogin,
	forgotPasseord,
	resetPassword,
	getMe,
	uploadImage,
	logout
}

