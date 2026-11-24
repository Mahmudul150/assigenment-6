import { Prisma } from "../../../generated/prisma/client";
import { AttemptStatus } from "../../../generated/prisma/enums";

type TransactionClient = Prisma.TransactionClient;

export const finalizeAttempt = async (
  tx: TransactionClient,
  attemptId: string,
  submittedAt: Date = new Date(),
) => {
  const attempt = await tx.attempt.findUnique({
    where: { id: attemptId },
    include: {
      submissions: true,
      invitation: {
        include: {
          assessment: {
            include: {
              problems: {
                include: { problem: true },
              },
            },
          },
        },
      },
    },
  });

  if (!attempt || attempt.status !== AttemptStatus.IN_PROGRESS) {
    return attempt;
  }

  const problems = attempt.invitation.assessment.problems;
  const problemIds = problems.map((item) => item.problemId);

  const unansweredProblemIds = problemIds.filter(
    (problemId) =>
      !attempt.submissions.some(
        (submission) => submission.problemId === problemId,
      ),
  );

  if (unansweredProblemIds.length > 0) {
    await tx.submission.createMany({
      data: unansweredProblemIds.map((problemId) => ({
        attemptId,
        problemId,
        answer: Prisma.DbNull,
        score: 0,
        status: "EVALUATED",
        evaluatedAt: submittedAt,
      })),
      skipDuplicates: true,
    });
  }

  for (const submission of attempt.submissions) {
    if (submission.answer === null || submission.answer === undefined) {
      continue;
    }

    const problem = problems.find(
      (item) => item.problemId === submission.problemId,
    )?.problem;

    if (problem?.type !== "MCQ") {
      continue;
    }

    const isCorrect =
      JSON.stringify(submission.answer) ===
      JSON.stringify(problem.correctAnswer);

    await tx.submission.update({
      where: { id: submission.id },
      data: {
        score: isCorrect ? problem.points : 0,
        status: "EVALUATED",
        evaluatedAt: submittedAt,
      },
    });
  }

  await tx.submission.updateMany({
    where: { attemptId, status: "DRAFT" },
    data: { status: "SUBMITTED" },
  });

  const allSubmissions = await tx.submission.findMany({
    where: { attemptId },
  });
  const allEvaluated = allSubmissions.every(
    (submission) => submission.status === "EVALUATED",
  );
  const totalScore = allSubmissions.reduce(
    (sum, submission) => sum + (submission.score ?? 0),
    0,
  );

  return tx.attempt.update({
    where: { id: attemptId },
    data: {
      status: allEvaluated ? AttemptStatus.EVALUATED : AttemptStatus.SUBMITTED,
      submittedAt,
      totalScore: allEvaluated ? totalScore : undefined,
    },
  });
};
