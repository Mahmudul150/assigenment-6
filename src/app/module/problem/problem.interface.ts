import { Prisma } from "../../../../generated/prisma/client";
import { Difficulty, ProblemType } from "../../../../generated/prisma/enums";

export interface ICreateProblem {
  title: string;
  description: string;
  type: ProblemType;
  difficulty: Difficulty;
  points?: number;
  options?: Prisma.InputJsonValue;
  correctAnswer?: string;
  testCases?: Prisma.InputJsonValue;
}



export interface IUpdateProblem {
  title?: string;
  description?: string;
  type?: ProblemType;
  difficulty?: Difficulty;
  points?: number;
  options?: Prisma.InputJsonValue;
  correctAnswer?: string;
  testCases?: Prisma.InputJsonValue;
}