import cron from 'node-cron';
import { prisma } from './prisma';
import { AttemptStatus, Role } from '../../../generated/prisma/enums';
import { finalizeAttempt } from '../utils/finalizeAttempt';

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
        const expiredAttempts = await tx.attempt.findMany({
          where: {
            status: AttemptStatus.IN_PROGRESS,
            deadlineAt: {
              lte: currentDate,
            },
          },
          select: { id: true },
        });

        for (const attempt of expiredAttempts) {
          await finalizeAttempt(tx, attempt.id, currentDate);
        }

        if (expiredAttempts.length > 0) {
          console.log(
            `Cron: Auto finalized ${expiredAttempts.length} expired attempts`
          );
        }
      });
    } catch (error) {
      console.log("Cron: Failed to auto submit expired attempts", error);
    }
  });
};