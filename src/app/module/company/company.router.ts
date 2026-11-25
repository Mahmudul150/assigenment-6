import { Router } from "express";
import { companyCnontroller } from "./company.controller";
import { auth } from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";
import { zodValidate } from "../../middleware/zodValidation";
import { companyValidateSchema } from "./company.validation";
import { otpLimiter } from "../../lib/retLimitar";
import { upload } from "../../lib/multer";

const router = Router()

router.post('/create',otpLimiter,zodValidate(companyValidateSchema.createCompanyProfileSchema) ,companyCnontroller.createCompany)
router.post('/email-verified',otpLimiter,companyCnontroller.verifyCompanyEmail)
router.patch('/approve',auth(Role.ADMIN),zodValidate(companyValidateSchema.isApprovedValidationSchema),companyCnontroller.isApproved)
router.get('/get-allCompnay',auth(Role.ADMIN) , companyCnontroller.allCompanyget)
router.patch('/update-profile',auth(Role.COMPANY),upload.single("profileImage"),zodValidate(companyValidateSchema.updateCompanyProfileSchema) , companyCnontroller.updatedProfile)
router.get('/me',auth(Role.COMPANY),companyCnontroller.getMyCompany)
router.get('/dashboard-stats',auth(Role.COMPANY),companyCnontroller.getDashboardStats)

export const CompnayRoute = router