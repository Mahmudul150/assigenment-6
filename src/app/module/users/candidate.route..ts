import { Router } from "express";
import { Role } from "../../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";
import { CandidateProfileController } from "./candidate.controller";

const route = Router()

route.get("/candidate-profile",auth(Role.ADMIN, Role.CANDIDATE),CandidateProfileController.getCandidateProfile,
);

route.patch("/updated-profile",auth(Role.CANDIDATE),CandidateProfileController.updatedProfile,
);


export const CandidateRouter = route