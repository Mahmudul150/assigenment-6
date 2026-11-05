import { Router } from "express";
import { attemptController } from "./attemp.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";

const router = Router();

router.post(
  "/create-attempt/:invitationId",
  auth(Role.CANDIDATE),
  attemptController.createAttempt,
);
router.get("/getAll", auth(Role.ADMIN), attemptController.getAllAttempts);
router.get(
  "/single-attempt/:id",
  auth(Role.CANDIDATE),
  attemptController.getSingleAttempt,
);
router.get(
  "/my-attempts",
  auth(Role.CANDIDATE),
  attemptController.getMyAttempts,
);

router.get(
  "/get-attempt-problems/:attemptId",
  auth(Role.CANDIDATE),
  attemptController.getAttemptProblems,
);

router.patch(
  "/tab-switch/:attemptId",
  auth(Role.CANDIDATE),
  attemptController.tabSwitch,
);
router.post(
  "/attempt-submit/:attemptId",
  auth(Role.CANDIDATE),
  attemptController.submitAttempt,
);
router.get(
  "/attempt-result/:attemptId",
  auth(Role.CANDIDATE),
  attemptController.getMyResult,
);

export const AttemptRouter = router;
