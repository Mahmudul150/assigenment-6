import { Router } from "express";
import { AuthController } from "./auth.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";
import { zodValidate } from "../../middleware/zodValidation";
import { authLoginSchema, UserValidaton } from "./auth.validation";
import { upload } from "../../lib/multer";

const route  = Router()

route.post('/register', zodValidate(UserValidaton.authRegisterSchema), AuthController.createUser)
route.post('/email-verify',AuthController.verifyUserEmail)
route.post('/login', zodValidate(authLoginSchema) ,AuthController.loginUser)

route.post("/refresh-token", AuthController.refreshToken);
route.post("/google", AuthController.googleLogin);
route.get("/me",auth(Role.ADMIN, Role.CANDIDATE, Role.COMPANY),AuthController.getMe,
);
route.post("/forgot-password",
	zodValidate(UserValidaton.ForgotPasswordZodSchema),
	AuthController.forgotPasseord);


route.post("/reset-password",
	zodValidate(UserValidaton.ResetPasswordZodSchema),
	 AuthController.resetPassword);    

route.post('/image-upload',
	upload.single("profileImage"),
	auth(Role.CANDIDATE, Role.COMPANY)
,AuthController.uploadImage)	 

route.post('/logout', AuthController.logout)	 

export const AuthRouter = route