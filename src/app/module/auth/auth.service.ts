import path from "path";
import {
  AuthProvider,
  Role,
  // Role,
  UserStatus,
} from "../../../../generated/prisma/enums";
import config from "../../config";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import {
  IAuthRegister,
  IForgotPasswordPayload,
  IGoogleLoginPayload,
  ILoginUserPayload,
  IRequestUser,
  IResetPasswordPayload,
  IVerifyEmailPayload,
} from "./auth.interface";
import bcrypt from "bcrypt";
import crypto from "crypto";
import ejs from "ejs";
import { AppError } from "../../middleware/appError";
import httpStatus from "http-status";
import { jwtUtils } from "../../utils/jwt";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import { googleClientId } from "../../lib/googleAuth";
import { TokenPayload } from "google-auth-library";
import { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary";
// import { cloudinary } from "../../lib/cloudinary";

const createUser = async (payload: IAuthRegister) => {
  const { name, password, role, candidate } = payload;
  const email = payload.email.trim().toLowerCase();

  if (role === Role.ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Admin registration is not allowed",
    );
  }

  if (role !== Role.CANDIDATE && role !== Role.COMPANY) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Role must be CANDIDATE or COMPANY",
    );
  }

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "User with this email already exists",
    );
  }

  const hashedPassword = await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));

 
  // radise a data temporary store for otp and send it to email
  const otpKey = `candidate-registration-email:${email}`;
  const otpValue = crypto.randomInt(100000, 1000000).toString();
  await redisClient.set(otpKey, otpValue, {
    expiration: {
      type: "EX",
      value: 5 * 60,
    },
  });

  const registationOnKey = `candidate-registation-data:${email}`;
  const rediseUserDataPayload = {
    name,
    email,
    role,
    password: hashedPassword,
    candidate: candidate,
  };
  await redisClient.set(
    registationOnKey,
    JSON.stringify(rediseUserDataPayload),
    {
      expiration: {
        type: "EX",
        value: 5 * 60,
      },
    },
  );

  const templetePath = path.join(
    process.cwd(),
    "src/app/module/template/registation_email_verification.ejs",
  );
  const html = await ejs.renderFile(templetePath, {
    name: name,
    email: email,
    otp: otpValue,
    expirationTime: 60 / 60,
  });

  await transporter.sendMail({
    from: config.smtp_email_sendr,
    to: email,
    subject: "email verification",
    html,
  });
};



const verifyUserEmail = async (payload: IVerifyEmailPayload) => {
  const { otp } = payload;
  const email = payload.email.trim().toLowerCase();

  const otpKey = `candidate-registration-email:${email}`;
  const redisOTP = await redisClient.get(otpKey);

  if (!redisOTP) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
  }

  if (redisOTP !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
  }

  const registrationKey = `candidate-registation-data:${email}`;
  const redisData = await redisClient.get(registrationKey);

  if (!redisData) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Registration data not found or expired",
    );
  }

  const userPayload = JSON.parse(redisData);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError(
      httpStatus.CONFLICT,
      "User with this email already exists",
    );
  }

  const createdUser = await prisma.user.create({
    data: {
      name: userPayload.name,
      email: userPayload.email,
      password: userPayload.password,
      role: userPayload.role,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      candidate: {
        create: {
          name: userPayload.name,
          bio: userPayload.candidate?.bio,
          phone: userPayload.candidate?.phone,
          skills: userPayload.candidate?.skills,
          experienceYears: userPayload.candidate?.experienceYears,
          githubUrl: userPayload.candidate?.githubUrl,
          linkedinUrl: userPayload.candidate?.linkedinUrl,
          resumeUrl: userPayload.candidate?.resumeUrl,
        },
      },
    },
    omit: { password: true },
    include: {
      candidate: true,
    },
  });

  await redisClient.del(otpKey);
  await redisClient.del(registrationKey);

  const templetePath = path.join(
    process.cwd(),
    "src/app/module/template/candidate_welcome.ejs",
  );
  const html = await ejs.renderFile(templetePath, {
    name: createdUser.name,
    email: email,
  });

  await transporter.sendMail({
    from: config.smtp_email_sendr,
    to: email,
    subject: "Wellcome our Developar codars Platfroms",
    html,
  });

  const { candidate, ...user } = createdUser;
  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    user,
    candidate,
    accessToken,
    refreshToken,
  };
};

const loginUser = async (payload: ILoginUserPayload) => {
  const { password } = payload;
  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: email },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new AppError(httpStatus.NOT_FOUND, "User is blocked");
  }

  if (user.isDeleted || user.status === UserStatus.INACTIVE) {
    throw new AppError(httpStatus.NOT_FOUND, "User is deleted");
  }

  if (user.password === null && user.googleId !== null) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "User already has an account Register with google. Try to login with google",
    );
  }

  const isPasswordMatched = await bcrypt.compare(
    password,
    user.password as string,
  );

  if (!isPasswordMatched) {
    throw new Error("Invalid credentials");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};


const refreshToken = async (token: string) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    token,
    config.jwt_refresh_secret,
  );

  if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      config.node_env === "development"
        ? verifiedRefreshToken.error
        : "Invalid refresh token",
    );
  }

  const data = verifiedRefreshToken.data as JwtPayload;

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
  });

  if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
    throw new AppError(httpStatus.NOT_FOUND, "User is inactive or not found");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};


const googleLogin = async (payload: IGoogleLoginPayload) => {
  let googleIdTokenPayload: TokenPayload | undefined | null = null;

  try {
    const ticket = await googleClientId.verifyIdToken({
      idToken: payload.idToken,
      audience: config.google_client_Id,
    });
    googleIdTokenPayload = ticket.getPayload();
  } catch (error) {
    console.log("Invalide google verifacition Id", error);
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Invalid or expired Google ID token",
    );
  }

  if (!googleIdTokenPayload) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Invalid or expired Google ID token",
    );
  }

  if (!googleIdTokenPayload.email) {
    throw new AppError(httpStatus.BAD_REQUEST, "Google email not found");
  }

  if (!googleIdTokenPayload.name) {
    throw new AppError(httpStatus.BAD_REQUEST, "Google name not found");
  }

  const ifUsertExistWithGoogle = await prisma.user.findUnique({
    where: {
      email: googleIdTokenPayload.email,
      role: Role.CANDIDATE,
      googleId: googleIdTokenPayload.sub,
    },
  });

  let user = ifUsertExistWithGoogle;

  if (!ifUsertExistWithGoogle) {
    const ifUserExistWithCreadential = await prisma.user.findUnique({
      where: {
        email: googleIdTokenPayload.email,
        role: Role.CANDIDATE,
        authProvider: AuthProvider.CREDENTIAL,
      },
    });

    if (ifUserExistWithCreadential) {
      if (!ifUserExistWithCreadential.emailVerified) {
        throw new AppError(httpStatus.FORBIDDEN, "Email not verified..!");
      }

      if (ifUserExistWithCreadential.status === UserStatus.BLOCKED) {
        throw new AppError(httpStatus.FORBIDDEN, "User is Blocked...!");
      }

      if (
        ifUserExistWithCreadential.isDeleted ||
        ifUserExistWithCreadential.status === UserStatus.INACTIVE
      ) {
        throw new AppError(httpStatus.FORBIDDEN, "User is Deleted...!");
      }
      user = await prisma.user.update({
        where: {
          id: ifUserExistWithCreadential.id,
        },
        data: {
          googleId: googleIdTokenPayload.sub,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: googleIdTokenPayload.name,
          email: googleIdTokenPayload.email,
          role: Role.CANDIDATE,
          googleId: googleIdTokenPayload.sub,
          authProvider: AuthProvider.GOOGLE,
          emailVerified: true,
          candidate: {
            create: {
              name: googleIdTokenPayload.name,
              // email: googleIdTokenPayload.email,
            },
          },
        },
      });

      const templetePath = path.join(
        process.cwd(),
        "src/app/module/template/welcome_template_for_googleLogin.ejs",
      );
      const html = await ejs.renderFile(templetePath, {
        name: user.name,
        email: user.email,
      });

      await transporter.sendMail({
        from: config.smtp_email_sendr,
        to: user.email,
        subject: "Wellcome to Ph-Helathcare Platfrom",
        html,
      });
    }
  }

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User Not Found...");
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "User is Blocked...!");
  }

  if (user.isDeleted || user.status === UserStatus.INACTIVE) {
    throw new AppError(httpStatus.FORBIDDEN, "User is Deleted...!");
  }

  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};

const getMe = async (user: IRequestUser) => {
  const isUserExists = await prisma.user.findUnique({
    where: {
      id: user.userId,
    },
    omit:{
        password:true
    }
  });

  if (!isUserExists) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }



  return isUserExists;
};

const forgotPasseord = async(payload:IForgotPasswordPayload)=>{
	const {email} = payload;

 	const isUserExist = await prisma.user.findUnique({
		where:{
			email
		}
	})

	if (!isUserExist) {
  throw new AppError(
    httpStatus.NOT_FOUND,
    "User does not exist!"
  );
}

if (isUserExist.status === UserStatus.BLOCKED) {
  throw new AppError(
    httpStatus.FORBIDDEN,
    "User is Blocked!"
  );
}

if (
  isUserExist.isDeleted ||
  isUserExist.status === UserStatus.INACTIVE
) {
  throw new AppError(
    httpStatus.FORBIDDEN,
    "User is Deleted!"
  );
}

if (!isUserExist.emailVerified) {
  throw new AppError(
    httpStatus.FORBIDDEN,
    "Your email is not verified"
  );
}

if (
  isUserExist.googleId ||
  isUserExist.authProvider !== "CREDENTIAL"
) {
  throw new AppError(
    httpStatus.BAD_REQUEST,
    "User account is logged in with Google"
  );
}

	const otp = crypto.randomInt(100000 , 1000000).toString()
	const key = `forget-password-email:${isUserExist.email}`
	await redisClient.set(key , otp,{
		expiration:{
			type:"EX",
			value: 60
		}
	})
	
	const templetePath = path.join(process.cwd(), "src/app/module/template/forgote_password.ejs")
	const html = await ejs.renderFile(templetePath , {
		name: isUserExist.name,
		otp,
		expirationTime: 60/60
	})

	await transporter.sendMail({
		from:config.smtp_email_sendr,
		to:isUserExist.email,
		subject:'Forgot Password',
		html
	})
	
}


const resetPassword = async(payload:IResetPasswordPayload)=>{
	const {email,otp,newPassword} = payload;

 	const isUserExist = await prisma.user.findUnique({
		where:{
			email
		}
	})

	if (!isUserExist) {
  throw new AppError(
    httpStatus.NOT_FOUND,
    "User does not exist!"
  );
}

if (isUserExist.status === UserStatus.BLOCKED) {
  throw new AppError(
    httpStatus.FORBIDDEN,
    "User is Blocked!"
  );
}

if (
  isUserExist.isDeleted ||
  isUserExist.status === UserStatus.INACTIVE
) {
  throw new AppError(
    httpStatus.FORBIDDEN,
    "User is Deleted!"
  );
}

if (!isUserExist.emailVerified) {
  throw new AppError(
    httpStatus.FORBIDDEN,
    "Your email is not verified"
  );
}

if (
  isUserExist.googleId ||
  isUserExist.authProvider !== "CREDENTIAL"
) {
  throw new AppError(
    httpStatus.BAD_REQUEST,
    "User account is registered with Google"
  );
}

	const key = `forget-password-email:${email}`
	const redisOTP = await redisClient.get(key)

	if (!redisOTP) {
		throw new Error('Invalide OTP')
	}

	if (redisOTP !== otp) {
		throw new Error('OTP dose not match')
	}

	const hashedNewPassword = await bcrypt.hash(newPassword , Number(config.bcrypt_salt_rounds))
	console.log({hashedNewPassword})
	await prisma.user.update({
		where:{
			email: isUserExist.email
		},
		data:{
			password:hashedNewPassword
		}
	})
	await redisClient.del([key])


		const templetePath = path.join(process.cwd(), "/src/app/module/template/reset_password_email.ejs")
		const html = await ejs.renderFile(templetePath , {
		name: isUserExist.name,
		
	})


	await transporter.sendMail({
		from:config.smtp_email_sendr,
		to:isUserExist.email,
		subject:'Password Changes',
		html
	})
}


const uploadImage = async(buffer: Buffer, userId: string)=>{
    const currentUser = await prisma.user.findUnique({
	    	where: {
		      	id: userId,
		  },
	    	select: {
          imagePublicId: true,
	      		imageUrl: true,
    		},
	      });



    const cloudinaryResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream(
					{
						resource_type: "auto",
					},

					async (error, result) => {
						if (error) {
               console.error("CLOUDINARY ERROR DETAILS:", error);
							return reject(error);
						}

						if (!result) {
							return reject(new Error("No result returned from Cloudinary"));
						}

						resolve(result);
					},
				)
				.end(buffer);
		},
	);

	const updatedUser = await prisma.user.update({
		where: {
			id: userId,
		},

		data: {
			imageUrl: cloudinaryResult.secure_url,
			imagePublicId: cloudinaryResult.public_id,
		},

		omit: {
			password: true,
		},
	});

	if (currentUser?.imagePublicId && currentUser.imageUrl) {
		await cloudinary.uploader.destroy(currentUser.imagePublicId);
	}

	return updatedUser;

}


export const AuthService = {
  createUser,
  verifyUserEmail,
  loginUser,
  refreshToken,
  googleLogin,
  forgotPasseord,
  getMe,
  resetPassword,
  uploadImage
};
