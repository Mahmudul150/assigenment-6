import app from "./app";
import config from "./app/config";
import { deleteUnverifiedCompany, expireAttempt } from "./app/lib/cron-job";
import { transporter } from "./app/lib/nodemailer";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";
import { seedAdmin,  } from "./app/utils/seed";

const PORT = config.port;
const base = process.env.BKASH_SENDBASE_URL!
const root  = async() =>{
    try {

        await redisClient.connect()
		console.log('connected radis in successfully')

        await transporter.verify()
		console.log('connected transPorter successfully')

        await prisma.$connect()
        console.log("Connected to the database successfully.");

        await deleteUnverifiedCompany()
        await expireAttempt()
          await seedAdmin()
        //   await seedDemoData()

        const grant = await fetch(`${base}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: process.env.BKASH_USERNAME!,
      password: process.env.BKASH_PASSWORD!,
    },
    body: JSON.stringify({
      app_key: process.env.BKASH_APP_KEY,
      app_secret: process.env.BKASH_APP_SECRET,
    }),
  }).then((r) => r.json());

  const token = grant.id_token;
  console.log("token ok?", !!token);

  const urls = [
    "http://localhost:5000/api/v1/payments/bkash/callback",
    "https://assigenment-6-rho.vercel.app/api/v1/payments/bkash/callback",
    "https://developer-assesment-theta.vercel.app/payment/callback",
    "https://example.com/callback",
    "https://www.google.com",
  ];

  for (const [i, u] of urls.entries()) {
    const res = await fetch(`${base}/tokenized/checkout/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: token,
        "X-App-Key": process.env.BKASH_APP_KEY!,
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: "test",
        callbackURL: u,
        amount: "10",
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: `TEST-${Date.now()}-${i}`,
      }),
    }).then((r) => r.json());
    console.log(u, "=>", res.statusCode, res.statusMessage);
  }

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