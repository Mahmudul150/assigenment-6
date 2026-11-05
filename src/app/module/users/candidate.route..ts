import { Router } from "express";
import { Role } from "../../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { CandidateProfileController } from "./candidate.controller";
import { zodValidate } from "../../middleware/zodValidation";
import { CandidateProfileValidation } from "./candidate.validation";

const route = Router()

route.get("/candidate-profile",auth(Role.ADMIN, Role.CANDIDATE),CandidateProfileController.getCandidateProfile,
);

route.patch("/updated-profile",auth(Role.CANDIDATE),zodValidate(CandidateProfileValidation.updatedProfileValidationSchema),CandidateProfileController.updatedProfile,
);


export const CandidateRouter = route