import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/appError";
import { RequestUser } from "../../middleware/auth";
import httpStatus from 'http-status'
import { evaluateSubmissionPayload, ICreateSubmission, IUpdateSubmission } from "./submission.interface";
import { SubmissionStatus } from "../../../../generated/prisma/enums";
import { SubmissionWhereInput } from "../../../../generated/prisma/models";
import { IQuery } from "../../quaryInterface";
import { AuditLogService } from "../auditlogs/auditLog.service";


const createSubmission = async (
  payload: ICreateSubmission,
  user: RequestUser
) => {


  const candidate = await prisma.candidateProfile.findUnique({
    where: {
      userId: user.userId,
    },
    include:{
        user:true
    }
  });

  
  if (!candidate) {
    throw new AppError(httpStatus.BAD_REQUEST, "Candidate profile not found");
  }

  if (candidate.user.role !== user.role) {
     throw new AppError(httpStatus.FORBIDDEN, "Only candidates can submit answers");
  }


  const attempt = await prisma.attempt.findFirst({
    where: {
      id: payload.attemptId,
      invitation: {
        email: user.email,
      },
    },
    include: {
      invitation: {
        include: {
          assessment: {
            include: {
              problems: true,
            },
          },
        },
      },
    },
  });


  if (!attempt) {
    throw new AppError(httpStatus.NOT_FOUND,  "Attempt not found");
  }

  if (
    attempt.invitation.candidateId !== candidate.id &&
    attempt.invitation.email !== user.email
  ) {
     throw new AppError(httpStatus.FORBIDDEN,   "You are not allowed to submit to this attempt");
  }

  if (attempt.status !== "IN_PROGRESS") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Attempt is not in progress"
    );
  }

  if (attempt.deadlineAt <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Attempt time has expired"
    );
  }

  const isProblemAssigned = attempt.invitation.assessment.problems.some(
      (item) => item.problemId === payload.problemId
    );

  if (!isProblemAssigned) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This problem is not assigned to this assessment"
    );
  }

  const existingSubmission =
    await prisma.submission.findUnique({
      where: {
        attemptId_problemId: {
          attemptId: payload.attemptId,
          problemId: payload.problemId,
        },
      },
    });

  if (existingSubmission) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Submission already exists. Please update your answer"
    );
  }

  const result = await prisma.submission.create({
    data: {
      attemptId: payload.attemptId,
      problemId: payload.problemId,
      answer: payload.answer,
    },
  });

  return result;
};


const getAllSubmissions = async (query: IQuery, user: RequestUser ) => {

  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;

  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder: "desc";



  const andConditions: SubmissionWhereInput[] = [];


   if (user.role !== "ADMIN" && user.role !== "COMPANY") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only admin and company can view submissions"
    );
  }
  if (user.role === "COMPANY") {

  const company = await prisma.companyProfile.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!company) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Company profile not found"
    );
  }

  andConditions.push({
    attempt: {
      invitation: {
        assessment: {
          companyId: company.id,
        },
      },
    },
  });
}


  if (query.status) {
  const validStatus = ["DRAFT", "SUBMITTED", "EVALUATED"];

  const status = query.status.toUpperCase();

  if (!validStatus.includes(status)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid status. Allowed values: DRAFT, SUBMITTED, EVALUATED"
    );
  }

  andConditions.push({
    status: status as SubmissionStatus,
  });
}

  if (query.attemptId) {
    andConditions.push({
      attemptId: query.attemptId,
    });
  }

  if (query.problemId) {
    andConditions.push({
      problemId: query.problemId,
    });
  }

  

  const allSubmissions = await prisma.submission.findMany({
    where: {
      AND: andConditions,
    },

    take: limit,
    skip: skip,

    orderBy: {
      [sortBy]: sortOrder,
    },

    include: {
      problem: {
        select: {
          id: true,
          title: true,
        },
      },

      attempt: {
        select: {
          id: true,
          status: true,
          invitation: {
            select: {
              id: true,
              email: true,
              assessmentId: true,
            },
          },
        },
      },
    },
  });

  

  const totalSubmissionCount = await prisma.submission.count({
      where: {
        AND: andConditions,
      },
    });

  return {
    data: allSubmissions,
    meta: {
      page: page,
      limit: limit,
      total: totalSubmissionCount,
      totalPages: Math.ceil(
        totalSubmissionCount / limit
      ),
    },
  };
};



const getMySubmissions = async (
  attemptId: string,
  user: RequestUser
) => {
   const candidate = await prisma.candidateProfile.findUnique({
    where: {
      userId: user.userId,
    },
    include:{
        user:true
    }
  });

  
  if (!candidate) {
    throw new AppError(httpStatus.BAD_REQUEST, "Candidate profile not found");
  }

  if (candidate.user.role !== user.role) {
     throw new AppError(httpStatus.FORBIDDEN, "Only candidates can submit answers");
  }

  const attempt = await prisma.attempt.findUnique({
    where: {
      id: attemptId,
    },
    include: {
      invitation: true,
    },
  });

  if (!attempt) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Attempt not found"
    );
  }

  if (attempt.invitation.email !== user.email) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to view these submissions"
    );
  }

  const result = await prisma.submission.findMany({
    where: {
      attemptId,
    },
    include: {
      problem: {
        select: {
      id: true,
      title: true,
      description: true,
      type: true,
      difficulty: true,
      points: true,
      options: true,
    }
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return result;
};



const updateSubmission = async (submissionId:string,payload: IUpdateSubmission, user: RequestUser) => {

    const candidate = await prisma.candidateProfile.findUnique({
    where: {
      userId: user.userId,
    },
    include:{
        user:true
    }
  });

  
  if (!candidate) {
    throw new AppError(httpStatus.BAD_REQUEST, "Candidate profile not found");
  }

  if (candidate.user.role !== user.role) {
     throw new AppError(httpStatus.FORBIDDEN, "Only candidates can submit answers");
  }



    const Submission = await prisma.submission.findUnique({
        where:{
            id:submissionId
        },
        include:{
            attempt:{
                include:{
                    invitation:true
                }
            }

        }
    })



     if (!Submission) {
    throw new AppError(httpStatus.NOT_FOUND, "Submission not found");
  }

  if (Submission.attempt.invitation.email !== user.email) {
    throw new AppError(httpStatus.FORBIDDEN,"You are not allowed to update this submission");
  }


   if (Submission.attempt.status !== "IN_PROGRESS") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This attempt is no longer active"
    );
  }

  if (Submission.status !== SubmissionStatus.DRAFT) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This submission can no longer be updated"
    );
  }

  if (Submission.attempt.deadlineAt < new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Attempt deadline has expired"
    );
  }

  const result = await prisma.submission.update({
    where: {
      id: submissionId,
    },
    data: {
      answer: payload.answer,
    },
  });


    await AuditLogService.createAuditLog({
    userId: user.userId,
    action: "UPDATE",
    entityType: "Submission",
    entityId: submissionId,
    metadata: {
      answer: payload.answer,
    },
  });

  return result;



}



const evaluateSubmission = async (
  submissionId: string,
  payload: evaluateSubmissionPayload,
  user: RequestUser
) => {
  

     const company = await prisma.companyProfile.findUnique({
    where: {
      userId: user.userId,
    },
    include:{
        user:true
    }
  });

  
  if (!company) {
    throw new AppError(httpStatus.BAD_REQUEST, "company profile not found");
  }

  if (company.user.role !== user.role) {
     throw new AppError(httpStatus.FORBIDDEN, "Only company can submit answers");
  }


  // 2. Submission খোঁজা
  const isSubmission = await prisma.submission.findUnique({
    where: {
      id: submissionId,
    },
    include: {
      attempt: {
        include: {
          invitation: {
            include:{
              assessment:true
            }
          },
        },
      },
      problem: true,
    },
  });

  if (!isSubmission) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Submission not found"
    );
  }
  if (isSubmission.attempt.invitation.assessment.companyId !== company.id){
    throw new AppError(httpStatus.FORBIDDEN, "You can't evaluate this submission");
    }
      

  if (isSubmission.status !== "SUBMITTED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Only submitted answers can be evaluated"
    );
  }

  if (payload.score > isSubmission.problem.points) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Score cannot exceed maximum points"
    );
  }
  
const result = await prisma.$transaction(async (tx) => {
  const submission = await tx.submission.update({
    where: {
      id: submissionId,
    },
    data: {
      score: payload.score,
      feedback: payload.feedback,
      status: "EVALUATED",
      evaluatedById: user.userId,
      evaluatedAt: new Date(),
    },
  });

  const submissions = await tx.submission.findMany({
    where: {
      attemptId: isSubmission.attemptId,
    },
  });

  const allEvaluated = submissions.every(
    (item) => item.status === "EVALUATED"
  );

  const totalScore = submissions.reduce(
    (total, item) => total + (item.score ?? 0),
    0
  );

  if (allEvaluated) {
    await tx.attempt.update({
      where: {
        id: isSubmission.attemptId,
      },
      data: {
        status: "EVALUATED",
        totalScore,
      },
    });
  }

  return submission;
});


    await AuditLogService.createAuditLog({
    userId: user.userId,
    action: "EVALUATE",
    entityType: "Submission",
    entityId: submissionId,
    metadata: {
      score: payload.score,
      feedback: payload.feedback,
    },
  });

  return result;
};



export const SubmissionService = {
  createSubmission,
  getAllSubmissions,
  getMySubmissions,
  updateSubmission,
  evaluateSubmission
};