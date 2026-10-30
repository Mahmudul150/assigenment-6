import { Role, UserStatus } from "../../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/appError";
import httpStatus from 'http-status'
import crypto from 'crypto'
import config from "../../config";
import { redisClient } from "../../lib/redis";
import path from "path";
import ejs from 'ejs'
import bcrypt from "bcrypt";

import { transporter } from "../../lib/nodemailer";
import { RequestUser } from "../../middleware/auth";
import { IApproveCompany, IcreateCompanyProfile, IUpdateCompanyProfile, IVerifyCompanyEmailPayload } from "./company.interface";
import { IQuery } from "../../quaryInterface";
import { CompanyProfileWhereInput } from "../../../../generated/prisma/models";



// const createAsACompany = async(payload:IcreateCompanyProfile)=>{
//     const {password}= payload.user
//     const hashedPassword = await bcrypt.hash(password, 8);

//   const email = payload.user.email.trim().toLowerCase();  

//   const isExistCompany = await prisma.user.findUnique({
//         where:{
//             email:email
//         }
//     })

//       if (isExistCompany) {
//          throw new AppError(
//        httpStatus.CONFLICT,
//       "User Already Exists With This Email",
//     );
//   }

//   const createCompany = await prisma.user.create({
//     data:{
//         ...payload.user,
//         role: Role.COMPANY,
//       needPasswordChange: true,
//       password:hashedPassword,
//       company:{
//         create: {
//           name: payload.company.name,
//           website: payload.company.website,
//           industry: payload.company.industry,
//           description: payload.company.description,
//           logoUrl: payload.company.logoUrl,
//         },
//       }
//       },
//       omit:{
//         password:true
//       },
//       include:{
//         company:true
//       }
//   })


//   const expirationSeconds = 60 * 60;

//   const otpKey = `company-otp:${payload.user.email}`;
//   const otpValue = crypto.randomInt(100000, 1000000).toString();

//   if (config.node_env === "development")
//     console.log(
//       `[dev] Compnay  OTP for ${payload.user.email}: ${otpValue}`,
//     );

//   await redisClient.set(otpKey, otpValue, {
//     expiration: {
//       type: "EX",
//       value: expirationSeconds,
//     },
//   });

//   const tempatePath = path.join(
//     process.cwd(),
//     "/src/app/module/template/registation_email_verification.ejs",
//   );

//   const templateData = {
//     name: payload.user.name,
//     email: payload.user.email,
//     otp: otpValue,
//     expirationMinutes: expirationSeconds / 60,
//   };

//   const html = await ejs.renderFile(tempatePath, templateData);

//   await transporter.sendMail({
//     from: config.smtp_email_sendr,
//     to: payload.user.email,
//     subject: "Company - Email Verification",
//     html,
//   });

//   return createCompany;


// }



const createAsACompany = async (payload: IcreateCompanyProfile) => {
  const { name, email, password, company } = payload
  const emaiL = email.trim().toLowerCase();

  const isExistCompany = await prisma.user.findUnique({
    where: {
      email: emaiL,
    },
  });

  if (isExistCompany) {
    throw new AppError(
      httpStatus.CONFLICT,
      "User Already Exists With This Email"
    );
  }

  
  const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));

  const createCompany = await prisma.user.create({
    data: {
      name,
      email: emaiL,
      password: hashedPassword,
      role: Role.COMPANY,
      needPasswordChange: true,

      company: {
        create: {
          name: company.name,
          website: company.website,
          industry: company.industry,
          description: company.description,
          logoUrl: company.logoUrl,
        },
      },
    },
    omit: {
      password: true,
    },
    include: {
      company: true,
    },
  });

  const expirationSeconds = 60 * 60;
  const otpKey = `company-otp:${emaiL}`;
  const otpValue = crypto.randomInt(100000, 1000000).toString();

  if (config.node_env === "development") {
    console.log(`[dev] Company OTP for ${emaiL}: ${otpValue}`);
  }

  await redisClient.set(otpKey, otpValue, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });

  const templatePath = path.join(
    process.cwd(),
    "src/app/module/template/registation_email_verification.ejs"
  );

  const html = await ejs.renderFile(templatePath, {
    name,
    email: emaiL,
    otp: otpValue,
    expirationMinutes: expirationSeconds / 60,
  });

  await transporter.sendMail({
    from: config.smtp_email_sendr,
    to: emaiL,
    subject: "Company - Email Verification",
    html,
  });

  return createCompany;
};




const verifyCompanyEmail = async (payload: IVerifyCompanyEmailPayload) => {
  const otp = payload.otp;
  const email = payload.email.trim().toLowerCase();

  const existingCompanyEamilr = await prisma.user.findUnique({
    where: { email, role: Role.COMPANY },
  });

  if (!existingCompanyEamilr) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Compnay Email Not Found. Please Apply Again.",
    );
  }

  if (existingCompanyEamilr.emailVerified) {
    throw new AppError(httpStatus.CONFLICT, "Email Already Verified");
  }

  const otpKey = `company-otp:${email}`;

  const redisOtp = await redisClient.get(otpKey);

  if (!redisOtp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "OTP Expired. Your Application Window Has Closed, Please Apply Again.",
    );
  }

  if (redisOtp !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP Does Not Match");
  }

  await redisClient.del(otpKey);

  const verifiedCompanyEmail = await prisma.user.update({
    where: { id: existingCompanyEamilr.id },
    data: { emailVerified: true },
    omit: { password: true },
    include: { company: true },
  });

  return verifiedCompanyEmail;
};

const isApproved = async(payload:IApproveCompany, Admin:RequestUser)=>{
    const {companyId ,isApproved} = payload

    const existCompany = await prisma.companyProfile.findUnique({
        where:{
            id:companyId
        },
        include:{
            user:true
        }
    })
    
    if (!existCompany) {
         throw new AppError(httpStatus.NOT_FOUND, "This companyProfile is Not Found");
    }
    if (existCompany.isApproved === true) {
        throw new AppError(
    httpStatus.FORBIDDEN,
    "Your company is Already Approved"
    );
    }

     if (!existCompany.user.emailVerified) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Company Has Not Verified Their Email Yet. Application Cannot Be Reviewed.",
    );
  }

  const approvedCompany = await prisma.companyProfile.update({
        where:{
            id:companyId
        },
        data:{
            isApproved: true
        },
        include:{
            user:{
           omit:{
            password:true
        }

            }
        },
  })

  return approvedCompany

}

const getAllCompany = async (query:IQuery)=>{
     const limit = query.limit ? Number(query.limit) : 10;
     const page = query.page ? Number(query.page) : 1;
     const skip = (page - 1) * limit;
     const sortBy = query.sortBy ? query.sortBy : "createdAt";
     const sortOrder = query.sortOrder ? query.sortOrder : "desc";

     const andConditions: CompanyProfileWhereInput[] = [];

      if (query.searchTerm) {
       andConditions.push({
      OR: [
        {
          name: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          website: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          industry: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
      ],
    });
  }

     if (query.industry) {
         andConditions.push({
          industry: {
           contains: query.industry,
              mode: "insensitive",
      },
    });
  }

  

  const allCompany = await prisma.companyProfile.findMany({
    where:{
        AND:andConditions
    },
    take: limit,
    skip: skip,

    orderBy: {
      [sortBy]: sortOrder,
    },
      include: {
      user: {
        omit: {
          password: true,
        },
      },
    }
  })

    const totalCompanyCount = await prisma.companyProfile.count({
    where: {
      AND: andConditions,
    },
  });

   return {
    data: allCompany,
    meta: {
      page: page,
      limit: limit,
      total: totalCompanyCount,
      totalPages: Math.ceil(totalCompanyCount / limit),
    },
  };

}

const updateCompanyProfile  = async(payload:IUpdateCompanyProfile ,user:RequestUser)=>{
    const existCompany = await prisma.companyProfile.findUnique({
        where:{
          userId:user.userId
        }
    })

    if (!existCompany) {
        throw new AppError(
       httpStatus.CONFLICT,
      "User dosen't  Exists With This id",)
    }


    const updatedCompnayProfile = await prisma.companyProfile.update({
        where:{
            id:existCompany.id
        },
        data:payload
    })

    return updatedCompnayProfile

}



export const companyService = {
    createAsACompany,
    verifyCompanyEmail,
    getAllCompany,
    updateCompanyProfile,
    isApproved
}