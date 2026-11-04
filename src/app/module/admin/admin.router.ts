import { Router } from "express";
import { AdminController } from "./admin.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";
import { zodValidate } from "../../middleware/zodValidation";
import { AdminValidation } from "./admin.validation";

const router = Router();

router.get("/dashboard", auth(Role.ADMIN), AdminController.adminDasboard);

router.get("/users", auth(Role.ADMIN), AdminController.adminGetAllUser);

router.get("/users/:id", auth(Role.ADMIN), AdminController.adminGetSingleUser);

router.patch(
  "/users/:id/status",
  auth(Role.ADMIN),
  zodValidate(AdminValidation.adminUpdateUserStatusValidationSchema),
  AdminController.updateUserStatus,
);

export const AdminRoutes = router;
