import { Router } from "express";
import { AuthController } from "./auth.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";
import { zodValidate } from "../../middleware/zodValidation";
import { authLoginSchema, UserValidaton } from "./auth.validation";
import { upload } from "../../lib/multer";
import { loginLimiter, otpLimiter } from "../../lib/retLimitar";

const route = Router();

route.post(
  "/register",
  otpLimiter,
  zodValidate(UserValidaton.authRegisterSchema),
  AuthController.createUser,
);
route.post("/email-verify", otpLimiter, AuthController.verifyUserEmail);
route.post(
  "/login",
  loginLimiter,
  zodValidate(authLoginSchema),
  AuthController.loginUser,
);

route.post("/refresh-token", AuthController.refreshToken);
route.post("/google", AuthController.googleLogin);
route.get(
  "/me",
  auth(Role.ADMIN, Role.CANDIDATE, Role.COMPANY),
  AuthController.getMe,
);
route.post(
  "/forgot-password",
  otpLimiter,
  zodValidate(UserValidaton.ForgotPasswordZodSchema),
  AuthController.forgotPasseord,
);

route.post(
  "/reset-password",
  otpLimiter,
  zodValidate(UserValidaton.ResetPasswordZodSchema),
  AuthController.resetPassword,
);

route.post(
  "/image-upload",
  auth(Role.CANDIDATE, Role.COMPANY,Role.ADMIN),
  upload.single("profileImage"),
  
  AuthController.uploadImage,
);

route.post("/logout", AuthController.logout);

export const AuthRouter = route;
