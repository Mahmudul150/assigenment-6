export interface IAddProblemsToAssessment {
  problems: {
    problemId: string;
    order: number;
  }[];
}