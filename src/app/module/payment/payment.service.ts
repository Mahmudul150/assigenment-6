import config from "../../config"
import { getBkashIdToken } from "../../lib/bkash"
import { prisma } from "../../lib/prisma"
import { AppError } from "../../middleware/appError"
import { RequestUser } from "../../middleware/auth"
import httpStats from 'http-status'

const paymentCreate = async(assessmentId: string, user:RequestUser)=>{
    
     const ASSESSMENT_FEE = 1500;

    const compnay = await prisma.companyProfile.findUnique({
        where:{
            userId:user.userId
        }
    })

    if(!compnay){
        throw new AppError(httpStats.NOT_FOUND,"CompanyProfile could not found")
    }

    if (compnay.isApproved !== true) {
        throw new AppError(httpStats.BAD_REQUEST,"Company is not Approved.")
    }

    const assesment = await prisma.assessment.findUnique({
        where:{
            id:assessmentId,
            companyId:compnay.id,
        }
    })

    if(!assesment){
        throw new AppError(httpStats.NOT_FOUND,"There is not found any Assesment .")
    }


    if(assesment.status !== "DRAFT"){
        throw new AppError(httpStats.BAD_REQUEST,"Company payment for Only DRFT assesment .")
    }

    if(assesment.durationMinutes < 0){
        throw new AppError(httpStats.NOT_FOUND,"This assesment must be a duration. .")
    }


     const existingPayment = await prisma.payment.findFirst({
        where: {
             assessmentId:assesment.id,
             status: "PAID",
    },
  });

    if(existingPayment){
        throw new AppError(httpStats.BAD_REQUEST,"Payment is already Paid for this assessment.")
    }



    const bkashIdToken = await getBkashIdToken();

    if (!bkashIdToken) {
    throw new AppError(httpStats.NOT_FOUND, "Unable to get bKash access token");
     }

     //bkash create
     const bkashResponse = await fetch(
    `${config.bkash_sendbase_url}/tokenized/checkout/create`,
     {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: bkashIdToken,
        "X-App-Key": config.bkash_app_key,
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: user.email,
        callbackURL: `${config.bkash_callback_url}/payments/bkash/callback`,
        amount: ASSESSMENT_FEE.toString(),
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber:assesment.id
      }),
    }
     );

     const bkashResult = await bkashResponse.json();


       // 10. Payment Record Create
      const payment = await prisma.payment.create({
         data: {
      companyId: compnay.id,
      assessmentId: assesment.id,
      amount: ASSESSMENT_FEE,
      bkashPaymentId: bkashResult.paymentID,
      merchantInvoiceNumber: bkashResult.merchantInvoiceNumber ,
      payerReference: user.email,
      getWayResponse: bkashResult,
      status: "PENDING",
    },
  });

}
const callback = async()=>{

}