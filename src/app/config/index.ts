import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
	node_env: process.env.NODE_ENV,
	port: process.env.PORT,
	database_url: process.env.DATABASE_URL,
	bak_url: process.env.APP_URL,
	frontend_url: process.env.FRONTEND_URL,
	bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
	jwt_access_secret: process.env.JWT_ACCESS_SECRET!,
	jwt_refresh_secret: process.env.JWT_REFRESH_SECRET!,
	jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN!,
	jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN!,

	google_client_Id: process.env.GOOGLE_CLIENT_ID,

	admin_name:process.env.ADMIN_NAME!,
	admin_email:process.env.ADMIN_EMAIL!,
	admin_password:process.env.ADMIN_PASSWORD!,

	radis_username: process.env.RADIS_USER!,
	radis_password: process.env.RADIS_PASSWORD!,
	radis_host: process.env.RADIS_HOST!,
	radis_port: process.env.RADIS_PORT!,


	smtp_user: process.env.SMTP_USER!,
	smtp_email_sendr:process.env.EMAIL_SENDER!,
	smtp_password: process.env.SMTP_PASSWORD!,

	cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
	cloudinary_api_key: process.env.CLOUDINARY_API_KEY!,
	cloudinary_api_secret: process.env.CLOUDE_API_SECRET!,
};
