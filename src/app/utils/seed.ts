import { Role } from "../../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/appError";
import httpStatus from 'http-status'
import bcrypt from "bcrypt";


export const seedAdmin = async () => {
	try {
		const isAdminExist = await prisma.user.findFirst({
			where: {
				role: Role.ADMIN,
			},
		});

		if (isAdminExist) {
			console.log("Admin Already Exists!");
			return;
		}

		const name = config.admin_name;
		const email = config.admin_email;
		const password = config.admin_password;

		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Super Admin Name , Email, Password Missing In Env File!!!",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const admin = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.ADMIN,
				needPasswordChange: false,
				emailVerified: true,
			},
		});

		console.log("Admin Created : ", admin);
	} catch (error) {
		console.log("Error Seeding Admin : ", error);

		await prisma.user.delete({
			where: {
				email: config.admin_email,
			},
		});
	}
};