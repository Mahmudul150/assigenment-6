import app from "./app";
import config from "./app/config";
import { deleteUnverifiedCompany } from "./app/lib/cron-job";
import { transporter } from "./app/lib/nodemailer";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";
import { seedAdmin } from "./app/utils/seed";

const PORT = config.port;

const root  = async() =>{
    try {

        await redisClient.connect()
		console.log('connected radis in successfully')

        await transporter.verify()
		console.log('connected transPorter successfully')

        await prisma.$connect()
        console.log("Connected to the database successfully.");

        await deleteUnverifiedCompany()
         await seedAdmin()

        app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
		});
    } catch (error) {
        console.error("Error starting the server:", error);
		await prisma.$disconnect();
		process.exit(1);
    }
}

root()