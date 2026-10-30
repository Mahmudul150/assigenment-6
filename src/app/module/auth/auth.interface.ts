import { Role } from "../../../../generated/prisma/enums";

export interface IAuthRegister {
    name:string,
  email: string;
  password: string;
  role?:Role;
  candidate?:{
     phone? :string,
      bio?:string,
      skills:string[],
      experienceYears:number,
      githubUrl?:string   ,
      linkedinUrl:string,
      resumeUrl?:string          
  }
}

export interface IVerifyEmailPayload {
  email: string;
  otp: string;
}

export interface ILoginUserPayload {
	email: string;
	password: string;
}

export interface IRequestUser {
	userId: string;
	email: string;
	name: string;
	role: Role;
}

export interface IGoogleLoginPayload {
	idToken: string;
}

export interface IForgotPasswordPayload {
	email:string
}

export interface IResetPasswordPayload {
	email:string,
	newPassword: string,
	otp: string
}