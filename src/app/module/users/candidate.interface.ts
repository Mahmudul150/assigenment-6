import { Role } from "../../../../generated/prisma/enums";

export interface IRequestUser {
    userId: string;
    email: string;
    name: string;
    role: Role;
}
export interface ICandidateProfileUpdated {
  name?: string;
  phone?: string;
  bio?: string;
  location?: string;
  skills?: string[];
  experienceYears?: number;
  githubUrl?: string;
  linkedinUrl?: string;
}

