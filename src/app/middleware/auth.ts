import { NextFunction, Request, Response } from "express";
import { Role } from "../../../generated/prisma/enums";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";
import config from "../config";
import { JwtPayload } from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { AppError } from "./appError";
import httpstatus from 'http-status'

export interface RequestUser {
				email: string;
				name: string;
				userId: string;
				role: Role;
			};

declare global {
	namespace Express {
		interface Request {
			user?: RequestUser
		}
	}
}

export const auth = (...requiredRoles: Role[]) => {
	return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
		const token = req.cookies.accessToken
			? req.cookies.accessToken
			: req.headers.authorization?.startsWith("Bearer ")
				? req.headers.authorization?.split(" ")[1]
				: req.headers.authorization;

		if (!token) throw new AppError(httpstatus.UNAUTHORIZED, "You are not logged in");

		const verifiedToken = jwtUtils.verifyToken(token, config.jwt_access_secret);

		if (!verifiedToken.success) throw new AppError(httpstatus.UNAUTHORIZED, "Invalid or expired token");

		const { email, name, userId, role } = verifiedToken.data as JwtPayload;

		if (requiredRoles.length && !requiredRoles.includes(role)) {
			throw new AppError( httpstatus.FORBIDDEN,
				"Forbidden. You don't have permission to access this resource.",
			);
		}

		const user = await prisma.user.findUnique({
			where: {
				id: userId,
				email,
				name,
				role,
			},
		});

		if (!user) {
			throw new AppError(httpstatus.UNAUTHORIZED,"User not found. Please log in again.");
		}

		if (user.status === "BLOCKED") {
			throw new AppError(httpstatus.FORBIDDEN,"Your account has been blocked. Please contact support.");
		}

		req.user = {
			email,
			name,
			userId,
			role,
		};

		next();
	});
};
