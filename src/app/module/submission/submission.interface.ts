import { Prisma } from "../../../../generated/prisma/client";

export interface ICreateSubmission {
 attemptId: string;
  problemId: string;
  answer: Prisma.InputJsonValue;
}
export interface IUpdateSubmission {
 attemptId: string;
  problemId: string;
  answer: Prisma.InputJsonValue;
}

export interface evaluateSubmissionPayload {
  score: number;
  feedback?: string;
}