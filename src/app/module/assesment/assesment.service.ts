import { isAfter, isValid } from "date-fns"
import { prisma } from "../../lib/prisma"
import { AppError } from "../../middleware/appError"
import { RequestUser } from "../../middleware/auth"
import { ICreateAssessment, IUpdateAssessment } from "./assesment.interface"
import httpStatus from 'http-status'
import { IQuery } from "../../quaryInterface"
import { AssessmentWhereInput } from "../../../../generated/prisma/models"
import { AssessmentStatus, PaymentStatus } from "../../../../generated/prisma/enums"
import { AuditLogService } from "../auditlogs/auditLog.service"


const createAssesment = async(payload:ICreateAssessment , user:RequestUser)=>{
        const isExistCompnay = await prisma.companyProfile.findUnique({
            where:{
                userId:user.userId
            },
            include:{
                user:true
            }
        })


        if (!isExistCompnay) {
            throw new AppError(httpStatus.NOT_FOUND, "Company profile not found");
        }

         if (!isExistCompnay.isApproved) {
          throw new AppError(httpStatus.BAD_REQUEST, "Company is not approved yet");
            }
          
          if (isExistCompnay.user.role !== "COMPANY") {
             throw new AppError(httpStatus.BAD_REQUEST, "Role no Match. Only COMPANY Role can create a assesment ");
          }  

            const startsAt = payload.startsAt? new Date(payload.startsAt): null;

            const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;

            const now = new Date();

              if (startsAt && !isValid(startsAt)) {
                 throw new AppError(
                     httpStatus.BAD_REQUEST,
                     "Invalid start date"
                       );
                      }

             if (endsAt && !isValid(endsAt)) {
               throw new AppError(
                     httpStatus.BAD_REQUEST,
                   "Invalid end date"
                 );
                }

            if ( payload.status === "PUBLISHED" &&(!startsAt || !endsAt)) {
                          throw new AppError(
                             httpStatus.BAD_REQUEST,
                      "Published assessment requires start and end dates"
             );}

            if (startsAt && !isAfter(startsAt, now)) {
                         throw new AppError(
                          httpStatus.BAD_REQUEST,
                        "Start date must be in the future"
                      );
                    }
             

               if ( startsAt && endsAt && !isAfter(endsAt, startsAt)) {
                    throw new AppError(
                     httpStatus.BAD_REQUEST,
                     "End date must be after start date"
                );
                 }
                    

          const createAssesment = await prisma.assessment.create({
            data:{
                companyId:isExistCompnay.id,
                title:payload.title,
                description:payload.description,
                durationMinutes:payload.durationMinutes,
                passingScore:payload.passingScore,
                status:payload.status,
                startsAt:startsAt,
                endsAt:endsAt
            },
            include:{
                company:{
                    select:{
                        id:true,
                        name:true,

                    }
                }
            }
          })

          await AuditLogService.createAuditLog({
            userId: user.userId,
            action: "CREATE",
            entityType: "Assessment",
            entityId: createAssesment.id,
            metadata: {
              title: createAssesment.title,
              status: createAssesment.status,
            },
          });

          return createAssesment

}


const getAllAssesment = async(query:IQuery )=>{
         const limit = query.limit ? Number(query.limit) : 10;
         const page = query.page ? Number(query.page) : 1;
         const skip = (page - 1) * limit;
         const sortBy = query.sortBy ? query.sortBy : "createdAt";
         const sortOrder = query.sortOrder ? query.sortOrder : "desc";
    
         const andConditions: AssessmentWhereInput[] = [];

        if (query.searchTerm) {
          andConditions.push({
            OR: [
              {
                title: { contains: query.searchTerm  },
              },
            ],
          });
        }


        if (query.status) {
		andConditions.push({ status: query.status });
	    }

        if (query.companyId) {
		andConditions.push({ companyId: query.companyId });
	}


    
	const assesment = await prisma.assessment.findMany({
		where: { AND: andConditions },
		take: limit,
		skip,
		orderBy: { [sortBy] : sortOrder },
		include: {
			company: { select: { id: true, name: true } },
			payments: true,
            
		},
	});

    const total = await prisma.assessment.count({
		where: { AND: andConditions },
	});

	return {
		data: assesment,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};

}
const getMyAssesment = async(query:IQuery, user :RequestUser)=>{

    const myCompany = await prisma.companyProfile.findUnique({
        where:{
            userId:user.userId
        },
        include:{
            user:true,
        }
    })

     if (!myCompany) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Company profile not found"
    );
  }
  

    const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc"

    const andConditions: AssessmentWhereInput[] = [
         {companyId:myCompany.id}
    ];


      if (query.searchTerm) {
          andConditions.push({
            OR: [
              {
                title: { equals: query.searchTerm  },
              },
            ],
          });
        }


        if (query.status) {
		andConditions.push({ status: query.status });
	    }


    
	const assesment = await prisma.assessment.findMany({
		where: { AND: andConditions },
		take: limit,
		skip,
		orderBy: { [sortBy] : sortOrder },
		include: {
			company: true,
            problems:{
                include:{
                    problem:true
                }
            }
		},
	});

    const total = await prisma.assessment.count({
		where: { AND: andConditions },
	});

	return {
		data: assesment,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};

}


const updateAssessment = async (
  assessmentId: string,
  payload: IUpdateAssessment,
  user: RequestUser
) => {

  const existCompanyProfile = await prisma.companyProfile.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!existCompanyProfile) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Company profile not found"
    );
  }

  if (!existCompanyProfile.isApproved) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Company profile is not approved"
    );
  }

  const existAssessment = await prisma.assessment.findUnique({
    where: {
      id: assessmentId,
      companyId: existCompanyProfile.id,
    },
  });

  if (!existAssessment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Assessment not found or you don't have permission"
    );
  }

  if (
    existAssessment.status === "PUBLISHED" ||
    existAssessment.status === "CLOSED"
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This assessment cannot be updated"
    );
  }

  const result = await prisma.assessment.update({
    where: {
      id: assessmentId,
    },
    data: payload,
  });

  await AuditLogService.createAuditLog({
    userId: user.userId,
    action: "UPDATE",
    entityType: "Assessment",
    entityId: result.id,
    metadata: {
      ...payload
    },
  });

  return result;
};


const assesmentPublished = async (
  assesmentId: string,
  user: RequestUser
) => {
  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.companyProfile.findUnique({
      where: {
        userId: user.userId,
      },
    });

    if (!company) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Company profile not found"
      );
    }

    if (!company.isApproved) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Company is not approved yet"
      );
    }

    const assessment = await tx.assessment.findFirst({
      where: {
        id: assesmentId,
        companyId: company.id,
        deletedAt: null,
      },
    });

    if (!assessment) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Assessment not found"
      );
    }

    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Only DRAFT assessment can be published"
      );
    }

    if (!assessment.startsAt || !assessment.endsAt) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Start date and end date are required"
      );
    }

    const now = new Date();

    if (assessment.endsAt <= now) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Assessment end date has expired"
      );
    }

    if (assessment.endsAt <= assessment.startsAt) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "End date must be after start date"
      );
    }

    const problemCount = await tx.assessmentProblem.count({
      where: {
        assessmentId: assesmentId,
      },
    });

    if (problemCount === 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Please add at least one problem before publishing"
      );
    }

    const payment = await tx.payment.findFirst({
      where: {
        assessmentId: assesmentId,
        companyId: company.id,
        status: PaymentStatus.PAID,
      },
    });

    if (!payment) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Please complete payment before publishing assessment"
      );
    }

    const updatedAssessment = await tx.assessment.update({
      where: {
        id: assesmentId,
      },
      data: {
        status: AssessmentStatus.PUBLISHED,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "PUBLISH",
        entityType: "Assessment",
        entityId: assesmentId,
        metadata: {
          status: "PUBLISHED",
        },
      },
    });

    return updatedAssessment;
  });

  return result;
};


const getAllPublishedAssessments = async (query: any ,) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const andConditions: AssessmentWhereInput[] = [
    {
      status: "PUBLISHED",
      deletedAt: null,
    },
  ];

  if (query.searchTerm) {
    andConditions.push({
      title: {
        contains: query.searchTerm,
        mode: "insensitive",
      },
    });
  }


  if (query.companyId) {
    andConditions.push({
      companyId: query.companyId,
    });
  }

  const result = await prisma.assessment.findMany({
    where: {
      AND: andConditions,
    },
    take: limit,
    skip,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      company: true,
    },
  });

  const total = await prisma.assessment.count({
    where: {
      AND: andConditions,
    },
  });

 

  return {
    data: result,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};


const deleteAssessment = async (
  assessmentId: string,
  user: RequestUser
) => {
  const result = await prisma.$transaction(async (tx) => {
    const existCompanyProfile = await tx.companyProfile.findUnique({
      where: {
        userId: user.userId,
      },
    });

    if (!existCompanyProfile) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Company profile not found"
      );
    }

    if (!existCompanyProfile.isApproved) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Company profile is not approved"
      );
    }

    const existAssessment = await tx.assessment.findFirst({
      where: {
        id: assessmentId,
        companyId: existCompanyProfile.id,
        deletedAt: null,
      },
    });

    if (!existAssessment) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Assessment not found or you don't have permission"
      );
    }

    if (existAssessment.status !== AssessmentStatus.DRAFT) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Only DRAFT assessment can be deleted"
      );
    }

    const paidPayment = await tx.payment.findFirst({
      where: {
        assessmentId: assessmentId,
        companyId: existCompanyProfile.id,
        status: PaymentStatus.PAID,
      },
    });

    if (paidPayment) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Paid assessment cannot be deleted"
      );
    }

    const deletedAssessment = await tx.assessment.update({
      where: {
        id: assessmentId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "DELETE",
        entityType: "Assessment",
        entityId: assessmentId,
      },
    });

    return deletedAssessment;
  });

  return result;
};






export const assesmentService = {
    createAssesment,
    getAllAssesment,
    getMyAssesment,
    updateAssessment,
    deleteAssessment,
    assesmentPublished,
    getAllPublishedAssessments
}