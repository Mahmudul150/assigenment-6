import express, { Application, Request, Response } from 'express';
import cors from 'cors'
import config from './app/config';
import cookieParser from 'cookie-parser';
import httpStatus from 'http-status'
import { AuthRouter } from './app/module/auth/auth.router';
import { globalErrorHandler } from './app/middleware/globalErrorhandler';
import { CandidateRouter } from './app/module/users/candidate.route.';
import { CompnayRoute } from './app/module/company/company.router';
import { problemRouter } from './app/module/problem/problem.router';
import { assesmentRoute } from './app/module/assesment/assesment.router';
import { assesmentProblemRouter } from './app/module/assesmentProblems/assPbm.router';

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

//routing setup
app.use('/api/v1/auth',AuthRouter)
app.use('/api/v1/candidate',CandidateRouter)
app.use('/api/v1/company',CompnayRoute)
app.use('/api/v1/problem',problemRouter)
app.use('/api/v1/assesment',assesmentRoute)
app.use('/api/v1/assesmentproblem',assesmentProblemRouter)


app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to developers coders Backend",
	});
});

app.use(globalErrorHandler)

export default app