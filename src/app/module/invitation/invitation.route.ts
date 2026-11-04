import { Router } from "express";
import { auth } from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";
import { zodValidate } from "../../middleware/zodValidation";
import { invitationController } from "./invitation.controller";
import { invitationSchema } from "./invitation.validation";

const router = Router();

router.post(
	"/",
	auth(Role.COMPANY),
	zodValidate(invitationSchema.createInvitationValidation),
	invitationController.createInvitation,
);

router.get("/", auth(Role.ADMIN), invitationController.getAllInvitation);

router.get(
	"/my",
	auth(Role.COMPANY, Role.CANDIDATE),
	invitationController.getMyInvitation,
);

router.get(
	"/:id",
	auth(Role.ADMIN, Role.COMPANY, Role.CANDIDATE),
	invitationController.getSingleInvitation,
);

router.patch(
	"/:id",
	auth(Role.CANDIDATE),
	zodValidate(invitationSchema.updateInvitationValidation),
	invitationController.updateInvitation,
);

router.delete(
	"/:invitationId",
	auth(Role.ADMIN, Role.COMPANY),
	invitationController.deleteInvitation,
);

export const invitationRoutes = router;
