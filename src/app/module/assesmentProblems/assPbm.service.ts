import { AssessmentProblemWhereInput } from "../../../../generated/prisma/models";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/appError";
import { RequestUser } from "../../middleware/auth";
import { IQuery } from "../../quaryInterface";
import { IAddProblemsToAssessment } from "./assPbm.interface";
import httpStatus from "http-status";


const createProblemsToAssessment = async (
  assessmentId: string,
  payload: IAddProblemsToAssessment,
  user: RequestUser
) => {

    const company = await prisma.companyProfile.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!company || !company.isApproved) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Company not found or not approved"
    );
  }

  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      companyId: company.id,
    },
  });

  if (!assessment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Assessment not found"
    );
  }

   if (assessment.status !== "DRAFT") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only draft assessment can be modified"
    );
  }

  const problemIds = payload.problems.map(
    (item) => item.problemId
  );

  const problems = await prisma.problem.findMany({
    where: {
      id: {
        in: problemIds,
      },
      companyId: company.id,
    },
  });

  if (problems.length !== problemIds.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid problem ID"
    );
  }

  const alreadyAdded = await prisma.assessmentProblem.findMany({
    where: {
      assessmentId,
      problemId: {
        in: problemIds,
      },
    },
  });

  if (alreadyAdded.length > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Problem already added"
    );
  }

  const result = await prisma.assessmentProblem.createMany({
    data: payload.problems.map((item) => ({
      assessmentId,
      problemId: item.problemId,
      order: item.order,
    })),
  });

  return result;
};



const getProblemsToAssessmen = async (
    query:IQuery,
  assessmentId: string,
  user: RequestUser
) => {
  const companyProfile = await prisma.companyProfile.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!companyProfile) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Company profile not found"
    );
  }

  const assessment = await prisma.assessment.findUnique({
    where: {
      id: assessmentId,
      companyId: companyProfile.id,
    },
  });

  if (!assessment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Assessment not found"
    );
  }


     const limit = query.limit ? Number(query.limit) : 10;
           const page = query.page ? Number(query.page) : 1;
           const skip = (page - 1) * limit;
           const sortBy = query.sortBy ? query.sortBy : "order";
           const sortOrder = query.sortOrder ? query.sortOrder : "desc";
      
           const andConditions: AssessmentProblemWhereInput[] = [
            {assessmentId}
           ];


    
    	const assesmentProblem = await prisma.assessmentProblem.findMany({
		where: { AND: andConditions },
		take: limit,
		skip,
		orderBy: { [sortBy] : sortOrder },
		include: {
            assessment:true
		},
	});

    const total = await prisma.assessmentProblem.count({
		where: { AND: andConditions },
	});

	return {
		data: assesmentProblem,
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};

  
};


const deleteProblemFromAssessment = async (
  assessmentId: string,
  problemId: string,
  user: RequestUser
) => {
  const companyProfile = await prisma.companyProfile.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!companyProfile) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Company profile not found"
    );
  }

  if (!companyProfile.isApproved) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Company is not approved"
    );
  }

 

  const assessment = await prisma.assessment.findUnique({
    where: {
      id: assessmentId,
      companyId: companyProfile.id,
    },
  });

  console.log("ASSESSMENT ID:", assessmentId);
console.log("ASSESSMENT DATA:", JSON.stringify(assessment, null, 2));

  if (!assessment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Assessment not found"
    );
  }

  console.log("Assessment Company ID:", assessment.companyId);
console.log("Logged-in Company ID:", companyProfile.id);


  if (assessment.status !== "DRAFT") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only draft assessment can be modified"
    );
  }

  const existProblem = await prisma.assessmentProblem.findUnique({
    where: {
      assessmentId_problemId: {
        assessmentId,
        problemId,
      },
    },
  });

  if (!existProblem) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Problem not found in this assessment"
    );
  }

  const result = await prisma.assessmentProblem.delete({
    where: {
      assessmentId_problemId: {
        assessmentId,
        problemId,
      },
    },
  });

  return result;
};


export const assesmentProblems = {
    createProblemsToAssessment,
    getProblemsToAssessmen,
    deleteProblemFromAssessment
}