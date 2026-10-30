import { AssessmentStatus } from "../../../../generated/prisma/enums";

export interface ICreateAssessment {
  title: string;
  description?: string;
  durationMinutes: number;
  passingScore: number;
  status?: AssessmentStatus;
  startsAt?: string;
  endsAt?: string;
}


export interface IUpdateAssessment {
  title?: string;
  description?: string;
  durationMinutes?: number;
  passingScore?: number;
  status?: AssessmentStatus;
  startsAt?: Date;
  endsAt?: Date;
}