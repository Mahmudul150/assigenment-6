import { Router } from "express";
import { Role } from "../../../../generated/prisma/client";
import { auth } from "../../middleware/auth";
import { submissionController } from "./submisseion.controller";
import { zodValidate } from "../../middleware/zodValidation";
import { SubmissionValidation } from "./submission.validation";

const router = Router();

router.post(
  "/",
  auth(Role.CANDIDATE),
  zodValidate(SubmissionValidation.createSubmissionValidationSchema),
  submissionController.createSubmission
);
router.get(
  "/",
  auth(Role.ADMIN , Role.COMPANY),
  submissionController.getAllSubmissions
);
router.get(
  "/my-submissions/:attemptId",
  auth(Role.CANDIDATE),
  submissionController.getMySubmissions
);
router.patch(
  "/:submissionId",
  auth(Role.CANDIDATE),
  zodValidate(SubmissionValidation.updateSubmissionValidationSchema),
  submissionController.updateSubmission
);

router.post(
  "/evaluate/:submissionId",
  auth(Role.COMPANY),
  submissionController.evaluateSubmission
);

export const SubmissionRouter = router;