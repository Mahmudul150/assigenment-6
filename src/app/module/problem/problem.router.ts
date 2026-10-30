import { Router } from "express";
import { problemCOntroller } from "./problem.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";
import { zodValidate } from "../../middleware/zodValidation";
import { problemValidationSchema } from "./problem.validate";

const router = Router()

router.post('/create-problem', zodValidate(problemValidationSchema.createProblemSchema) , auth(Role.COMPANY) , problemCOntroller.problemCreate)
router.get('/all-problems', auth(Role.ADMIN) , problemCOntroller.getAllProblems)
router.get('/my-problems', auth(Role.COMPANY) , problemCOntroller.getMyProblems)
router.get("/:problemid", problemCOntroller.getProblemById);
router.patch(
  "/:problemId",
  auth(Role.COMPANY),
  zodValidate(problemValidationSchema.updateProblemSchema),
  problemCOntroller.updateProblemById
);

router.delete(
  "/:problemId",
  auth(Role.COMPANY),
  problemCOntroller.deleteProblemById
);

export const problemRouter = router