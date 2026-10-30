import cron from 'node-cron';
import { prisma } from './prisma';
import { Role } from '../../../generated/prisma/enums';

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