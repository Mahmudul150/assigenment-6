import { Router } from "express";
import { auth } from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";
import { assesmentController } from "./assesment.controller";
import { zodValidate } from "../../middleware/zodValidation";
import { assessmentSchema } from "./assesment.validation";
// import { assesmentSchema } from "./assesment.validation";

const router = Router()

router.post('/create-assesment', auth(Role.COMPANY), zodValidate(assessmentSchema.createAssessmentValidation) , assesmentController.createAssesment)
router.get('/all-assesment', auth(Role.ADMIN) , assesmentController.getAllAssesment)
router.get('/my-assesment', auth(Role.COMPANY) , assesmentController.getMYAssesment)

router.patch(
  "/:assessmentId",
  zodValidate(assessmentSchema.updateAssessmentValidation),
  auth(Role.COMPANY),
  assesmentController.updateAssesment
);

router.delete(
  "/:assessmentId",
  auth(Role.COMPANY),
  assesmentController.deleteAssesment
);

export const assesmentRoute = router