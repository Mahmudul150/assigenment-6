import cron from 'node-cron';
import { prisma } from './prisma';
import { AttemptStatus, Role } from '../../../generated/prisma/enums';

export const deleteUnverifiedCompany = async () => {
    cron.schedule('0 * * * *', async () => {

       try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
           const deleteFalseEmail = await prisma.user.deleteMany({
               where: {
                   role: Role.COMPANY,
                   emailVerified: false,
                   createdAt: { lt: oneHourAgo },
                 
               }
           });


           if (deleteFalseEmail.count > 0) {
               console.log(`
                Cron: Deleted ${deleteFalseEmail.count} unverified email companyProfile older than 1 hour
                `);
           }
       } catch (error) {

            console.log("Cron: Failed to delete unverified compamy prfoile ", error);
       }

       console.log("Unverified email  Delete cron job bey companyProfile (every 1 hours)");
    });
}

export const expireAttempt = async () => {
  cron.schedule("* * * * *", async () => {
    try {
      const currentDate = new Date();

      await prisma.$transaction(async (tx) => {
        const expiredAttempts = await tx.attempt.updateMany({
          where: {
            status: AttemptStatus.IN_PROGRESS,
            deadlineAt: {
              lte: currentDate,
            },
          },
          data: {
            status: AttemptStatus.SUBMITTED,
            submittedAt: currentDate,
          },
        });

        if (expiredAttempts.count > 0) {
          await tx.submission.updateMany({
            where: {
              attempt: {
                status: AttemptStatus.SUBMITTED,
                submittedAt: currentDate,
              },
              status: "DRAFT",
            },
            data: {
              status: "SUBMITTED",
            },
          });

          console.log(
            `Cron: Auto submitted ${expiredAttempts.count} expired attempts`
          );
        }
      });
    } catch (error) {
      console.log("Cron: Failed to auto submit expired attempts", error);
    }
  });
};