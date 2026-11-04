import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/appError";
import { RequestUser } from "../../middleware/auth";
import { ICreateInvitation, IUpdateInvitation } from "./invitation.interface";
import httpStatus from 'http-status'
import path from "node:path";
import ejs from 'ejs'
import config from "../../config";
import { transporter } from "../../lib/nodemailer";
import { IQuery } from "../../quaryInterface";
import { InvitationWhereInput } from "../../../../generated/prisma/models";
import { InvitationStatus } from "../../../../generated/prisma/enums";
import { AuditLogService } from "../auditlogs/auditLog.service";

const createInvitation = async (
  payload: ICreateInvitation,
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
      httpStatus.FORBIDDEN,
      "Your company is not approved"
    );
  }

  const assessment = await prisma.assessment.findFirst({
    where: {
      id: payload.assessmentId,
      companyId: company.id,
      status: "PUBLISHED",
      deletedAt: null,
    },
  });

  if (!assessment) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Published assessment not found"
    );
  }

  const existingInvitation =
    await prisma.invitation.findUnique({
      where: {
        assessmentId_email: {
          assessmentId: payload.assessmentId,
          email: payload.email,
        },
      },
    });

  if (existingInvitation) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Invitation already exists for this email"
    );
  }

  const token = randomBytes(32).toString("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invitation = await prisma.invitation.create({
    data: {
      assessmentId: payload.assessmentId,
      email: payload.email,
      token,
      expiresAt,
    },
  });

  try {
    const invitationLink =
      `${config.frontend_url}/invitations/${token}`;

    const templatePath = path.join(
      process.cwd(),
      "src/app/module/template/invitation_email.ejs"
    );

    const html = await ejs.renderFile(templatePath, {
      companyName: company.name,
      assessmentTitle: assessment.title,
      durationMinutes: assessment.durationMinutes,
      passingScore: assessment.passingScore,
      invitationLink,
      expirationDate:
        expiresAt.toLocaleDateString("en-GB"),
    });

    await transporter.sendMail({
      from: config.smtp_email_sendr,
      to: payload.email,
      subject: `Invitation to ${assessment.title}`,
      html,
    });
  } catch (error) {
    
    await prisma.invitation.delete({
      where: {
        id: invitation.id,
      },
    });

    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to send invitation email"
    );
  }

  return invitation;
};



const getAllInvitation = async (query: IQuery) => {
   const limit = query.limit ? Number(query.limit) : 10;
     const page = query.page ? Number(query.page) : 1;
     const skip = (page - 1) * limit;
     const sortBy = query.sortBy ? query.sortBy : "createdAt";
     const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: InvitationWhereInput[] = [
     {
    assessment: {
      deletedAt: null,
    },
  },
  ];

  if (query.searchTerm) {
    andConditions.push({
      email: {
        contains: query.searchTerm,
        mode: "insensitive",
      },
    });
  }

  if (query.email) {
    andConditions.push({
      email: {
        contains: query.email,
        mode: "insensitive",
      },
    });
  }

  if (query.status) {
    andConditions.push({
      status: query.status as InvitationStatus,
    });
  }

  const invitations =
    await prisma.invitation.findMany({
      where: {
        AND: andConditions,
      },

      skip,
      take: limit,

      orderBy: {
        [sortBy]: sortOrder,
      },

      include: {
        candidate: true,
        assessment: true,
      },
    });

  const total =
    await prisma.invitation.count({
      where: {
        AND: andConditions,
      },
    });

  return {
    data: invitations,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};


const getMyInvitation = async (
  user: RequestUser
) => {
  if (user.role === "CANDIDATE") {
    const candidate = await prisma.candidateProfile.findUnique({
        where: {
          userId: user.userId,
        },
      });

    if (!candidate) {
      throw new AppError(
        httpStatus.NOT_FOUND,
        "Candidate profile not found"
      );
    }

    const invitations =
      await prisma.invitation.findMany({
        where: {
          OR: [
            {
              candidateId: candidate.id,
            },
            {
              email: user.email,
            },
          ],
        },

        include: {
          assessment: true,
          candidate: true,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return invitations;
  }

  if (user.role === "COMPANY") {
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

    const invitations = await prisma.invitation.findMany({
        where: {
          assessment: {
            companyId: company.id,
            deletedAt: null,
          },
        },

        include: {
          assessment: true,
          candidate: true,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return invitations;
  }

  throw new AppError(
    httpStatus.FORBIDDEN,
    "You are not allowed to view invitations"
  );
};



const getSingleInvitation = async (
  id: string,
  user: RequestUser
) => {
  const invitation = await prisma.invitation.findUnique({
      where: {
        id,
          assessment: {
      deletedAt: null,
    },
      },

      include: {
        candidate: true,
        assessment: true,
      },
    });

  if (!invitation) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Invitation not found"
    );
  }

  if (user.role === "ADMIN") {
    return invitation;
  }

  if (user.role === "COMPANY") {
    const company = await prisma.companyProfile.findUnique({
        where: {
          userId: user.userId,
        },
      });

    if (
      !company ||
      invitation.assessment.companyId !== company.id
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to view this invitation"
      );
    }

    return invitation;
  }

 
  if (user.role === "CANDIDATE") {
    const candidate =  await prisma.candidateProfile.findUnique({
        where: {
          userId: user.userId,
        },
      });

    if (
      !candidate ||
      (
        invitation.candidateId !== candidate.id &&
        invitation.email !== user.email
      )
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You are not allowed to view this invitation"
      );
    }

    return invitation;
  }

  throw new AppError(
    httpStatus.FORBIDDEN,
    "You are not allowed to view this invitation"
  );
};



const updateInvitation = async (
  invitationId: string,
  payload: IUpdateInvitation,
  user: RequestUser
) => {
  if (user.role !== "CANDIDATE") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only candidates can respond to invitations"
    );
  }

  if (
    payload.status !== InvitationStatus.ACCEPTED &&
    payload.status !== InvitationStatus.DECLINED
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invalid invitation status"
    );
  }

  const candidate = await prisma.candidateProfile.findUnique({
      where: {
        userId: user.userId,
      },
    });

  if (!candidate) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Candidate profile not found"
    );
  }

  const invitation = await prisma.invitation.findFirst({
      where: {
        id: invitationId,
          assessment: {
      deletedAt: null,
    },
      },
    });

  if (!invitation) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Invitation not found"
    );
  }

  if (
    invitation.candidateId !== candidate.id &&
    invitation.email !== user.email
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to respond to this invitation"
    );
  }

  if (
    invitation.status !== InvitationStatus.PENDING
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invitation already responded"
    );
  }

  if (invitation.expiresAt < new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Invitation has expired"
    );
  }

  const result = await prisma.invitation.update({
  where: {
    id: invitationId,
  },
  data: {
    status: payload.status,
    candidateId: candidate.id,
  },
});

await AuditLogService.createAuditLog({
  userId: user.userId,
  action: "UPDATE",
  entityType: "Invitation",
  entityId: invitationId,
  metadata: {
    status: payload.status,
  },
});

return result;
};



const deleteInvitation = async ( invitationId: string,user: RequestUser) => {
  const invitation = await prisma.invitation.findUnique({
    where: {
      id: invitationId,
    },
    include: {
      assessment: true,
    },
  });

  if (!invitation) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Invitation not found"
    );
  }

  const attempt = await prisma.attempt.findFirst({
  where: {
    invitationId: invitationId,
  },
});

if (attempt) {
  throw new AppError(
    httpStatus.CONFLICT,
    "Cannot delete invitation because an attempt already exists"
  );
}

  if (user.role === "ADMIN") {
    return await prisma.invitation.delete({
      where: {
        id: invitationId,
      },
    });
  }

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

  if (invitation.assessment.companyId !== company.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You are not allowed to delete this invitation"
    );
  }

  return await prisma.invitation.delete({
    where: {
      id: invitationId,
    },
  });
};


export const InvitationService = {
  createInvitation,
  getAllInvitation,
  getMyInvitation,
  getSingleInvitation,
  updateInvitation,
  deleteInvitation,

}