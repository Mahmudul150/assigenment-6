import { Difficulty, ProblemType } from "../../../../generated/prisma/enums"
import { ProblemWhereInput } from "../../../../generated/prisma/models"
import { prisma } from "../../lib/prisma"
import { AppError } from "../../middleware/appError"
import { RequestUser } from "../../middleware/auth"
import { IQuery } from "../../quaryInterface"
import { AuditLogService } from "../auditlogs/auditLog.service"
import { ICreateProblem, IUpdateProblem } from "./problem.interface"
import httpStatus from 'http-status'


const createProblem = async (
  payload: ICreateProblem,
  user: RequestUser
) => {
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
      "Company profile is not approved"
    );
  }

  if (
    payload.type === ProblemType.MCQ &&
    (!payload.options || !payload.correctAnswer)
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "MCQ options and correct answer are required"
    );
  }


  if (
    payload.type === ProblemType.CODING &&
    !payload.testCases
  ) {
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

  const problemCreate = await prisma.problem.create({
    data: {
      companyId: company.id,
      title: payload.title,
      description: payload.description,
      type: payload.type,
      difficulty: payload.difficulty,
      points: payload.points,
      options: payload.options,
      testCases: payload.testCases,
      correctAnswer: payload.correctAnswer,
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

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "CREATE",
        entityType: "Problem",
        entityId: problemCreate.id,
        metadata: {
          title: problemCreate.title,
          type: problemCreate.type,
          difficulty: problemCreate.difficulty,
          points: problemCreate.points,
        },
      },
    });
  });

  return problemCreate;
};


const getALlProblem = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: ProblemWhereInput[] = [
    {
      deletedAt: null,
    },
  ];


  if (query.searchTerm) {
    andConditions.push({
      OR: [
        {
          title: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  // Filter by Problem Type
  if (
    query.type &&
    Object.values(ProblemType).includes(query.type as ProblemType)
  ) {
    andConditions.push({
      type: query.type as ProblemType,
    });
  }

  // Filter by Difficulty
  if (
    query.difficulty &&
    Object.values(Difficulty).includes(query.difficulty as Difficulty)
  ) {
    andConditions.push({
      difficulty: query.difficulty as Difficulty,
    });
  }

  // Filter by Company ID
  if (query.companyId) {
    andConditions.push({
      companyId: query.companyId,
    });
  }

  // Filter by Points
  if (query.points) {
    andConditions.push({
      points: Number(query.points),
    });
  }

  const allProblem = await prisma.problem.findMany({
    where: {
      AND: andConditions,
    },
    take: limit,
    skip: skip,
    orderBy: {
      [sortBy]: sortOrder,
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
};



const getMyProblems = async (
  query: IQuery,
  user: RequestUser
) => {
  // 1. Company Profile খুঁজে বের করা
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

  // 2. Pagination
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: ProblemWhereInput[] = [
    {
      companyId: company.id,
    },
    {
      deletedAt: null,
    },
  ];

  // 3. Search by title and description
  if (query.searchTerm) {
    andConditions.push({
      OR: [
        {
          title: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  // 4. Filter by Problem Type
  if (
    query.type &&
    Object.values(ProblemType).includes(query.type as ProblemType)
  ) {
    andConditions.push({
      type: query.type as ProblemType,
    });
  }

  // 5. Filter by Difficulty
  if (
    query.difficulty &&
    Object.values(Difficulty).includes(query.difficulty as Difficulty)
  ) {
    andConditions.push({
      difficulty: query.difficulty as Difficulty,
    });
  }

  // 6. Filter by Points
  if (query.points) {
    andConditions.push({
      points: Number(query.points),
    });
  }

  // 7. Get Problems
  const allProblem = await prisma.problem.findMany({
    where: {
      AND: andConditions,
    },
    take: limit,
    skip: skip,
    orderBy: {
      [sortBy]: sortOrder,
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

  // 8. Total Count
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
};




const getProblemById = async (
  problemId: string,
  user: RequestUser
) => {
  // 1. Problem খুঁজে বের করা
  const problem = await prisma.problem.findFirst({
    where: {
      id: problemId,
      deletedAt: null,
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

  // 2. Company হলে Ownership check
  if (user.role === "COMPANY") {
    const company = await prisma.companyProfile.findUnique({
      where: {
        userId: user.userId,
      },
    });

    if (!company || problem.companyId !== company.id) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You can't view this problem"
      );
    }
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
      deletedAt:null
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

    await AuditLogService.createAuditLog({
    userId: user.userId,
    action: "UPDATE",
    entityType: "Problem",
    entityId: updatedProblem.id,
    metadata: {
      ...payload
    },
  });

  return updatedProblem

}



const deleteProblemById = async (
  problemId: string,
  user: RequestUser
) => {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Company Profile খুঁজে বের করা
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

    // 2. Company approved কি না check
    if (!existCompanyProfile.isApproved) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Company profile is not approved. You can't delete this problem"
      );
    }

    // 3. Problem খুঁজে বের করা
    const existProblem = await tx.problem.findFirst({
      where: {
        id: problemId,
        companyId: existCompanyProfile.id,
        deletedAt: null,
      },
    });

    if (!existProblem) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Problem not found or you don't have permission to delete it"
      );
    }

    // 4. Soft Delete করা
    const deletedProblem = await tx.problem.update({
      where: {
        id: existProblem.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    // 5. Audit Log তৈরি করা
    await tx.auditLog.create({
      data: {
        userId: user.userId,
        action: "DELETE",
        entityType: "Problem",
        entityId: deletedProblem.id,
      },
    });

    return deletedProblem;
  });

  return result;
};


export const problemService = {
    createProblem,
getALlProblem,
getMyProblems,
getProblemById,
updateProblemById,
deleteProblemById
}