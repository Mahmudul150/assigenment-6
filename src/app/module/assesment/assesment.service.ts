import { isAfter, isValid } from "date-fns"
import { prisma } from "../../lib/prisma"
import { AppError } from "../../middleware/appError"
import { RequestUser } from "../../middleware/auth"
import { ICreateAssessment, IUpdateAssessment } from "./assesment.interface"
import httpStatus from 'http-status'
import { IQuery } from "../../quaryInterface"
import { AssessmentWhereInput } from "../../../../generated/prisma/models"


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

  return result;
};

const assesmentPublished = async(assesmentId:string , user:RequestUser)=>{
   
    const company = await prisma.companyProfile.findUnique({
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

   const assessment = await prisma.assessment.findUnique({
    where: {
      id: assesmentId,
      companyId: company.id,
    },
  });

   if (!assessment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Assessment not found or you don't have permission"
    );
  }

   if (assessment.status !== "DRAFT") {
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

    const isStartDateValid = assessment.startsAt > now;
    const isEndDateValid = assessment.endsAt > assessment.startsAt;

    if (!isStartDateValid) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
    "Start date must be in the future"
     );
    }

    if (!isEndDateValid) {
    throw new AppError(
    httpStatus.BAD_REQUEST,
    "End date must be after start date"
    );
    }   

   const problemCount = await prisma.assessmentProblem.count({
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

  const result = await prisma.assessment.update({
    where: {
      id: assesmentId,
    },
    data: {
      status: "PUBLISHED",
    },
  });

  return result;

}


const deleteAssessment = async (
  assessmentId: string,
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
    existAssessment.status === "PUBLISHED" 
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This assessment cannot be updated"
    );
  }

  const result = await prisma.assessment.delete({
    where: {
      id: assessmentId,
    },
  });

  return result;
};







export const assesmentService = {
    createAssesment,
    getAllAssesment,
    getMyAssesment,
    updateAssessment,
    deleteAssessment
}