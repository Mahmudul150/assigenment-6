import { Difficulty, ProblemType } from "../../../../generated/prisma/enums"
import { ProblemWhereInput } from "../../../../generated/prisma/models"
import { prisma } from "../../lib/prisma"
import { AppError } from "../../middleware/appError"
import { RequestUser } from "../../middleware/auth"
import { IQuery } from "../../quaryInterface"
import { ICreateProblem, IUpdateProblem } from "./problem.interface"
import httpStatus from 'http-status'


const createProblem = async(payload:ICreateProblem , user:RequestUser)=>{
    const company = await prisma.companyProfile.findUnique({
        where:{
            userId:user.userId
        },
        include:{
               problems:true 
        }
    })

     if (!company) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Company profile not found"
    );
  }

  if (company.isApproved !== true) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Company profile is not Approved"
    );
  }

    if (payload.type === ProblemType.MCQ && !payload.options) {
        throw new AppError(
        httpStatus.BAD_REQUEST,
        "MCQ options are required"
      );
      
    }

      if (payload.type === "CODING" && !payload.testCases) {
     throw new AppError(
      httpStatus.BAD_REQUEST,
      "Test cases are required for coding problems"
    );
  }

      if (payload.points !== undefined && payload.points < 0) {
     throw new AppError(
       httpStatus.BAD_REQUEST,
      "Points cannot be negative"
      );
     }
  
  const provlemCreate = await prisma.problem.create({
    data:{
        companyId:company.id,
        title:payload.title,
    description:payload.description,
    type:payload.type,
    difficulty:payload.difficulty,
    points: payload.points ,
    options: payload.options,
    testCases: payload.testCases,
    correctAnswer:payload.correctAnswer
    },
    include:{
        company:{
            select:{
                id:true,
                name:true,
                industry:true
            }
        }
    }
  })


  return provlemCreate

}

const getALlProblem = async(query:IQuery)=>{
      const limit = query.limit ? Number(query.limit) : 10;
     const page = query.page ? Number(query.page) : 1;
     const skip = (page - 1) * limit;
     const sortBy = query.sortBy ? query.sortBy : "createdAt";
     const sortOrder = query.sortOrder ? query.sortOrder : "desc";

     const andConditions: ProblemWhereInput[] = [];

  if (query.searchTerm) {
  andConditions.push({
    OR: [
      {
        type: {
          equals: query.searchTerm.toUpperCase() as ProblemType,
        },
      },
      {
        difficulty: {
          equals: query.searchTerm.toUpperCase() as Difficulty,
        },
      },
    ],
  });
}


if (query.type) {
  andConditions.push({
    type: query.type,
  });
}

if (query.difficulty) {
  andConditions.push({
    difficulty: query.difficulty,
  });
}
if (query.companyId) {
  andConditions.push({
    companyId: query.companyId,
  });
}

if (query.points) {
  andConditions.push({
    points: Number(query.points),
  });
}


const allProblem = await prisma.problem.findMany({
    where:{
        AND:andConditions
    },
    take: limit,
    skip: skip,

    orderBy: {
      [sortBy]: sortOrder,
    },
      include: {
      company: {
        select:{
            id:true,
            name:true,
            industry:true
        }
      },
    }
  })

    const totalProblemCount = await prisma.problem.count({
    where: {
      AND: andConditions,
    },
  });

   return {
    data: allProblem,
    meta: {
      page: page,
      limit: limit,
      total: totalProblemCount,
      totalPages: Math.ceil(totalProblemCount / limit),
    },
  };


}

const getMyProblems= async(query:IQuery , user:RequestUser )=>{

    const company = await prisma.companyProfile.findUnique({
        where:{
            userId:user.userId
        }
    })

     if (!company) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Company profile not found"
    );
  }
      const limit = query.limit ? Number(query.limit) : 10;
     const page = query.page ? Number(query.page) : 1;
     const skip = (page - 1) * limit;
     const sortBy = query.sortBy ? query.sortBy : "createdAt";
     const sortOrder = query.sortOrder ? query.sortOrder : "desc";

     const andConditions: ProblemWhereInput[] = [
        {companyId:company.id}
     ];

  if (query.searchTerm) {
  andConditions.push({
    OR: [
      {
        type: {
          equals: query.searchTerm.toUpperCase() as ProblemType,
        },
      },
      {
        difficulty: {
          equals: query.searchTerm.toUpperCase() as Difficulty,
        },
      },
    ],
  });
}


if (query.companyId) {
  andConditions.push({
    companyId: query.companyId,
  });
}

if (query.points) {
  andConditions.push({
    points: Number(query.points),
  });
}


const allProblem = await prisma.problem.findMany({
    where:{
        AND:andConditions
    },
    take: limit,
    skip: skip,

    orderBy: {
      [sortBy]: sortOrder,
    },
      include: {
      company: {
        select:{
            id:true,
            name:true,
            industry:true
        }
      },
    }
  })

    const totalProblemCount = await prisma.problem.count({
    where: {
      AND: andConditions,
    },
  });

   return {
    data: allProblem,
    meta: {
      page: page,
      limit: limit,
      total: totalProblemCount,
      totalPages: Math.ceil(totalProblemCount / limit),
    },
  };


}


const getProblemById = async (problemId: string) => {
  const problem = await prisma.problem.findUnique({
    where: {
      id: problemId,
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          industry: true,
        },
      },
    },
  });

  if (!problem) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Problem not found"
    );
  }

  return problem;
};

const updateProblemById = async(  problemId: string, payload:IUpdateProblem, user:RequestUser )=>{
    const existCompnayProfile = await prisma.companyProfile.findUnique({
        where:{
            userId:user.userId
        }
    })

      if (!existCompnayProfile) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Company profile not found"
    );
  }

     if (existCompnayProfile.isApproved !== true) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Company profile is not Approved..you can't to update this prblem"
    );
  }

    const existProblem = await prisma.problem.findFirst({
    where: {
      id: problemId,
      companyId: existCompnayProfile.id,
    },
  });

    if (!existProblem) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Problem not found or you don't have permission to update it"
    );
  }


 const updatedProblem = await prisma.problem.update({
    where: {
      id: existProblem.id,
    },
    data: {
      ...payload,
    },
  });

  return updatedProblem

}


const deleteProblemById = async (
  problemId: string,
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
      "Company profile is not approved. You can't delete this problem"
    );
  }

  const existProblem = await prisma.problem.findUnique({
    where: {
      id: problemId,
      companyId: existCompanyProfile.id,
      deletedAt:null
    },
  });

  if (!existProblem) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Problem not found or you don't have permission to delete it"
    );
  }

  const deletedProblem = await prisma.problem.delete({
    where: {
      id: existProblem.id,
    },
  });

  return deletedProblem;
};

export const problemService = {
    createProblem,
getALlProblem,
getMyProblems,
getProblemById,
updateProblemById,
deleteProblemById
}