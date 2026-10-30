import { tr } from "zod/locales";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/appError";
import { ICandidateProfileUpdated, IRequestUser } from "./candidate.interface";
import httpStatus from 'http-status'
import { RequestUser } from "../../middleware/auth";
import { Role, UserStatus } from "../../../../generated/prisma/enums";

const getCandidateProfile = async (user: IRequestUser) => {
  const isCandidateExists = await prisma.candidateProfile.findUnique({
    where: {
      userId:user.userId,
    },
    include:{
      user:{
        select:{
        id:true,
        name:true,
        email:true,
        status:true,
        imageUrl:true
        }
      }
    },
    
  });

  if (!isCandidateExists) {
    throw new AppError(httpStatus.NOT_FOUND, "candidate profile not found");
  }



  return isCandidateExists;
};

const imageUpload = async()=>{
  
}

const updatedProfile = async(payload:ICandidateProfileUpdated , user:RequestUser)=>{
  const existCandidate = await prisma.user.findUnique({
    where:{
      id:user.userId
    }
  })

  if (!existCandidate) {
    throw new AppError(httpStatus.NOT_FOUND, "candidate profile not found");
  }
  if (existCandidate.role !== Role.CANDIDATE ) {
        throw new AppError(httpStatus.BAD_REQUEST, "Candidate Role Mitchmatch");

  }

  const updateProfile = await prisma.candidateProfile.update({
    where:{
      userId:user.userId
    },
    data:{
      name:payload.name,
      bio:payload.bio,
      phone:payload.phone,
      location:payload.location,
      skills:payload.skills,
      experienceYears:payload.experienceYears,
      githubUrl:payload.githubUrl,
      linkedinUrl:payload.linkedinUrl
    }
  })

  return updateProfile 
}



export const candidateProfileService = {
    getCandidateProfile,
    updatedProfile
}