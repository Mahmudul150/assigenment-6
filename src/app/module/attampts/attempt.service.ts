import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/appError";
import { RequestUser } from "../../middleware/auth";
import httpStatus from 'http-status'
import { IQuery } from "../../quaryInterface";
import { AttemptWhereInput } from "../../../../generated/prisma/models";
import { AttemptStatus } from "../../../../generated/prisma/enums";
import { evaluateSubmissionPayload } from "../submission/submission.interface";
import { AuditLogService } from "../auditlogs/auditLog.service";
import { Prisma } from "../../../../generated/prisma/client";

const createAttempt = async(invitationId:string, user:RequestUser)=>{
    const candidate = await prisma.candidateProfile.findUnique({
        where:{
            userId:user.userId
        },
        include:{
            user:true
        }
    })
    if (!candidate) {
         throw new AppError( httpStatus.NOT_FOUND, "Candidate profile not found");
    }

    const invitation = await prisma.invitation.findUnique({
        where:{
            id:invitationId
        },
         include: {
          assessment: true,
    },
    })

    if (!invitation) {
        throw new AppError(httpStatus.NOT_FOUND , "Invitation is not found")
    }

    if (invitation.email !==  candidate.user.email) {
        throw new AppError(httpStatus.NOT_FOUND , "Candidate email and invitation email dosen't match")
    }

     if (invitation.status !== "ACCEPTED") {
        throw new AppError(httpStatus.NOT_FOUND ,  "Please accept the invitation first")
    }
     if (invitation.assessment.status !== "PUBLISHED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Assessment is not published"
    );
  }
  
    if (invitation.expiresAt <= new Date()) {
        throw new AppError(httpStatus.NOT_FOUND , " Invitation time expired ")
    }

const currentDate = new Date();

const startsAt = invitation.assessment.startsAt;
const endsAt = invitation.assessment.endsAt;


if (startsAt && startsAt > currentDate) {
  throw new AppError(
    httpStatus.BAD_REQUEST,
    "Assessment has not started yet"
  );
}

if (endsAt && endsAt <= currentDate) {
  throw new AppError(
    httpStatus.BAD_REQUEST,
    "Assessment time has expired"
  );
}

    const attampt = await prisma.attempt.findUnique({
        where:{
            invitationId
        }
    })
     if (attampt) {
        throw new AppError(httpStatus.CONFLICT , "Attempt already exists for this invitation")
    }

     const deadlineAt = new Date(
      Date.now() + invitation.assessment.durationMinutes * 60 * 1000
    );

  const result = await prisma.attempt.create({
    data: {
      invitationId,
      deadlineAt,
      
    },
  })

  await AuditLogService.createAuditLog({
    userId: user.userId,
    action: "CREATE",
    entityType: "Attempt",
    entityId: result.id,
    metadata: {
      invitationId: invitationId,
      deadlineAt: deadlineAt.toISOString(),
    },
  });

    return result;
}


const getAllAttempts = async(query:IQuery)=>{
     const limit = query.limit ? Number(query.limit) : 10;
             const page = query.page ? Number(query.page) : 1;
             const skip = (page - 1) * limit;
             const sortBy = query.sortBy ? query.sortBy : "createdAt";
             const sortOrder = query.sortOrder ? query.sortOrder : "desc";
        
             const andConditions: AttemptWhereInput[] = [];
    
           
    
    
             if (query.status) {
             andConditions.push({
               status: query.status,
                     });
                    
                    }
          
    
        
        const attampt = await prisma.attempt.findMany({
            where: { AND: andConditions },
            take: limit,
            skip,
            orderBy: { [sortBy] : sortOrder },
            include: {
               invitation:true,
               submissions:true
                
            },
        });
    
        const total = await prisma.attempt.count({
            where: { AND: andConditions },
        });
    
        return {
            data: attampt,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    
}


const getSingleAttempt = async (id: string, user: RequestUser) => {
  const attempt = await prisma.attempt.findUnique({
    where: {
      id,
    },
    include: {
      invitation: {
        include: {
          candidate: true,
          assessment: {
            include: {
              company: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      submissions: true,
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
      "You are not allowed to view this attempt"
    );
  }

  return attempt;
};

const getAttemptProblems = async (
  attemptId: string,
  user: RequestUser
) => {
  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      invitation: {
        email: user.email,
      },
    },
    select: {
      id: true,
      status: true,
      deadlineAt: true,

      invitation: {
        select: {
          assessment: {
            select: {
              problems: {
                orderBy: {
                  order: "asc",
                },
                select: {
                  order: true,
                  problem: {
                    select: {
                      id: true,
                      title: true,
                      description: true,
                      type: true,
                      difficulty: true,
                      points: true,
                      options: true,
                    },
                  },
                },
              },
            },
          },
        },
      },

      submissions: {
        select: {
          id: true,
          problemId: true,
          answer: true,
          status: true,
        },
      },
    },
  });

  if (!attempt) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Attempt not found"
    );
  }

  if (
    attempt.status === "IN_PROGRESS" &&
    attempt.deadlineAt <= new Date()
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Attempt time has expired"
    );
  }

  return attempt;
};


const getMyAttempts = async (user: RequestUser) => {
  const candidate = await prisma.candidateProfile.findUnique({
    where: {
      userId: user.userId,
    },
  });

  if (!candidate) {
    throw new AppError(httpStatus.NOT_FOUND, "Candidate not found");
  }

  return prisma.attempt.findMany({
    where: {
      invitation: {
        email: user.email,
      },
    },
    include: {
      invitation: {
        include: {
          assessment: true,
        },
      },
      submissions: true,
    },
    orderBy: {
      startedAt: "desc",
    },
  });
};

const tabSwitch = async ( attemptId: string, user: RequestUser) => {
  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      invitation: {
        email: user.email,
      },
      status: "IN_PROGRESS",
    },
  });

  if (!attempt) {
    throw new AppError(httpStatus.NOT_FOUND, "Active attempt not found");
  }

  if (attempt.deadlineAt <= new Date()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Attempt time expired");
  }

  const tabIncriment = await prisma.attempt.update({
    where: {
      id: attemptId,
      status: "IN_PROGRESS",
      deadlineAt: {
        gt: new Date(),
      },
    },
    data: {
      tabSwitchCount: {
        increment: 1,
      },
    },
  });


  return tabIncriment;
};


/*
const submitAttempt = async (attemptId: string, user: RequestUser) => {
  if (user.role !== "CANDIDATE") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only candidates can submit attempts"
    );
  }

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      invitation: {
        email: user.email,
      },
    },
  });

  if (!attempt) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Attempt not found"
    );
  }

  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Attempt is already submitted"
    );
  }

  if (attempt.deadlineAt <= new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Attempt deadline has expired"
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.submission.updateMany({
      where: {
        attemptId,
        status: "DRAFT",
      },
      data: {
        status: "SUBMITTED",
      },
    });

    return tx.attempt.update({
      where: {
        id: attemptId,
      },
      data: {
        status: AttemptStatus.SUBMITTED,
        submittedAt: new Date(),
      },
      include: {
        submissions: true,
      },
    });
  });

  await AuditLogService.createAuditLog({
    userId: user.userId,
    action: "SUBMIT",
    entityType: "Attempt",
    entityId: attemptId,
    metadata: {
      submittedAt: new Date().toISOString(),
    },
  });

  return result;
};

*/

/*
// const submitAttempt = async (attemptId: string, user: RequestUser) => {
//   if (user.role !== "CANDIDATE") {
//     throw new AppError(
//       httpStatus.FORBIDDEN,
//       "Only candidates can submit attempts"
//     );
//   }

//   const submittedAt = new Date();

//   const result = await prisma.$transaction(async (tx) => {
//     const attempt = await tx.attempt.findFirst({
//       where: {
//         id: attemptId,
//         invitation: {
//           email: user.email,
//         },
//       },
//     });

//     if (!attempt) {
//       throw new AppError(
//         httpStatus.NOT_FOUND,
//         "Attempt not found"
//       );
//     }

//     if (attempt.status !== AttemptStatus.IN_PROGRESS) {
//       throw new AppError(
//         httpStatus.BAD_REQUEST,
//         "Attempt is already submitted"
//       );
//     }

//     const updatedAttempt = await tx.attempt.updateMany({
//       where: {
//         id: attemptId,
//         status: AttemptStatus.IN_PROGRESS,
//       },
//       data: {
//         status: AttemptStatus.SUBMITTED,
//         submittedAt,
//       },
//     });

//     if (updatedAttempt.count === 0) {
//       throw new AppError(
//         httpStatus.BAD_REQUEST,
//         "Attempt is already submitted"
//       );
//     }

//     await tx.submission.updateMany({
//       where: {
//         attemptId,
//         status: "DRAFT",
//       },
//       data: {
//         status: "SUBMITTED",
//       },
//     });

//     return tx.attempt.findUnique({
//       where: {
//         id: attemptId,
//       },
//       include: {
//         submissions: true,
//       },
//     });
//   });

//   await AuditLogService.createAuditLog({
//     userId: user.userId,
//     action: "SUBMIT",
//     entityType: "Attempt",
//     entityId: attemptId,
//     metadata: {
//       submittedAt: submittedAt.toISOString(),
//       autoSubmitted: result?.submittedAt
//         ? result.submittedAt <= result.deadlineAt
//         : false,
//     },
//   });

//   return result;
// };

*/

const submitAttempt = async (attemptId: string, user: RequestUser) => {
  if (user.role !== "CANDIDATE") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only candidates can submit attempts"
    );
  }

  const submittedAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const attempt = await tx.attempt.findFirst({
      where: {
        id: attemptId,
        invitation: {
          email: user.email,
        },
      },
      include: {
        submissions: true,
        invitation: {
          include: {
            assessment: {
              include: {
                problems: {
                  include: {
                    problem: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Attempt not found"
      );
    }

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Attempt is already submitted"
      );
    }

    // Assessment-এর সব problem ID
    const problems = attempt.invitation.assessment.problems;

    const problemIds = problems.map((item) => item.problemId);

    // Candidate যেসব প্রশ্নের উত্তর দিয়েছে
    const answeredSubmissions = attempt.submissions.filter(
      (item) => item.answer !== null
    );

    // Candidate যেসব প্রশ্নের উত্তর দেয়নি
    const unansweredProblemIds = problemIds.filter(
      (problemId) =>
        !attempt.submissions.some(
          (submission) => submission.problemId === problemId
        )
    );

    // MCQ answers automatically evaluate
    const mcqSubmissions = answeredSubmissions.filter(
      (submission) => problems.find( (item) => item.problemId === submission.problemId)?.problem.type === "MCQ"
    );

    // সব unanswered question-এর submission তৈরি
    if (unansweredProblemIds.length > 0) {
      await tx.submission.createMany({
        data: unansweredProblemIds.map((problemId) => ({
          attemptId,
          problemId,
          answer: Prisma.DbNull,
          score: 0,
          status: "EVALUATED",
        })),
        skipDuplicates: true,
      });
    }

    // MCQ score update
    await Promise.all(
      mcqSubmissions.map((submission) => {
        const problem = problems.find(
          (item) => item.problemId === submission.problemId
        )?.problem;

        const isCorrect =
          JSON.stringify(submission.answer) ===
          JSON.stringify(problem?.correctAnswer);

        return tx.submission.update({
          where: {
            id: submission.id,
          },
          data: {
            score: isCorrect ? problem!.points : 0,
            status: "EVALUATED",
            evaluatedAt: submittedAt,
          },
        });
      })
    );

    // Written answers SUBMITTED হবে
    await tx.submission.updateMany({
      where: {
        attemptId,
        status: "DRAFT",
      },
      data: {
        status: "SUBMITTED",
      },
    });

    // Attempt SUBMITTED হবে
    await tx.attempt.update({
      where: {
        id: attemptId,
      },
      data: {
        status: AttemptStatus.SUBMITTED,
        submittedAt,
      },
    });

    return tx.attempt.findUnique({
      where: {
        id: attemptId,
      },
      include: {
        submissions: true,
      },
    });
  });

  await AuditLogService.createAuditLog({
    userId: user.userId,
    action: "SUBMIT",
    entityType: "Attempt",
    entityId: attemptId,
    metadata: {
      submittedAt: submittedAt.toISOString(),
    },
  });

  return result;
};

const getMyResult = async ( attemptId: string, user: RequestUser) => {

    const candidate = await prisma.candidateProfile.findUnique({
      where: {
        userId: user.userId,
    },
    include: {
      user: true,
    },
  });

  if (!candidate) {
    throw new AppError(httpStatus.NOT_FOUND, "Candidate not found");
  }

  if (candidate.user.role !== user.role) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only candidate can view result"
    );
  }

  const attempt = await prisma.attempt.findFirst({
    where: {
      id: attemptId,
      invitation: {
        email: user.email,
      },
    },
    include: {
      invitation: {
        include: {
          assessment: true,
        },
      },
      submissions: {
        include: {
          problem: {
            select: {
              id: true,
              title: true,
              points: true,
            },
          },
        },
      },
    },
  });

  if (!attempt) {
    throw new AppError(httpStatus.NOT_FOUND, "Attempt not found");
  }

  if (attempt.status !== "EVALUATED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Your result is not published yet"
    );
  }

 const result = {
  assessment: attempt.invitation.assessment,
  totalScore: attempt.totalScore,
  status: attempt.status,
  submittedAt: attempt.submittedAt,
  submissions: attempt.submissions,
};

return result;
};





export const AttemptService = {
  createAttempt,
  getAllAttempts,
  getSingleAttempt,
  getAttemptProblems,
  submitAttempt,
   getMyAttempts,
    tabSwitch,
    getMyResult
};