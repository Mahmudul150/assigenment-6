import { Router } from "express";
import { AssesmentProblemController } from "./assPbm.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";
import { zodValidate } from "../../middleware/zodValidation";
import { assessmentProblemValidation } from "./assPbm.validation";


const router = Router();

router.post(
  "/:assessmentId/problems",
  zodValidate(
    assessmentProblemValidation.addProblemsToAssessmentValidation
  ),
auth(Role.COMPANY),
  AssesmentProblemController.createProblemsToAssessment
);

router.get(
  "/:assessmentId/problems",
auth(Role.COMPANY),
  AssesmentProblemController.getProblemsToAssessment
);


router.delete(
  "/:assessmentId/problems/:problemId",
  auth(Role.COMPANY),
  AssesmentProblemController.deleteProblemFromAssessment
);



export const assesmentProblemRouter = router