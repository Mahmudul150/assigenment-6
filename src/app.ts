import express, { Application, Request, Response } from 'express';
import cors from 'cors'
import config from './app/config';
import cookieParser from 'cookie-parser';
import httpStatus from 'http-status'

const app: Application = express();

app.use(
    cors({
        origin: config.frontend_url,
		credentials: true,
    })
)

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to developers coders Backend",
	});
});

export default app