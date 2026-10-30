import { Router } from "express";
import { companyCnontroller } from "./company.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";
import { zodValidate } from "../../middleware/zodValidation";
import { companyValidateSchema } from "./company.validation";

const router = Router()

router.post('/create',zodValidate(companyValidateSchema.createCompanyProfileSchema) ,companyCnontroller.createCompany)
router.post('/email-verified',companyCnontroller.verifyCompanyEmail)
router.patch('/approve',auth(Role.ADMIN),companyCnontroller.isApproved)
router.get('/get-allCompnay',auth(Role.ADMIN) , companyCnontroller.allCompanyget)
router.patch('/update-profile',auth(Role.COMPANY),zodValidate(companyValidateSchema.updateCompanyProfileSchema) , companyCnontroller.updatedProfile)

export const CompnayRoute = router