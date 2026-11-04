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
import { PaymentRouter } from './app/module/payment/payment.route';
import { invitationRoutes } from './app/module/invitation/invitation.route';
import { AttemptRouter } from './app/module/attampts/attampt.router';
import { SubmissionRouter } from './app/module/submission/submisseion.router';
import { AuditLogRoutes } from './app/module/auditlogs/auditLog.route';
import { AdminRoutes } from './app/module/admin/admin.router';
import { notFound } from './app/middleware/notfound';
import helmet from 'helmet';


const app: Application = express();
app.use(helmet())
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
app.use('/api/v1/payments',PaymentRouter)
app.use('/api/v1/invitation',invitationRoutes)
app.use('/api/v1/attempt',AttemptRouter)
app.use('/api/v1/submission',SubmissionRouter)
app.use('/api/v1/audit-logs',AuditLogRoutes)
app.use('/api/v1/admin',AdminRoutes)


app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to developers coders Backend",
	});
});

app.use(notFound)
app.use(globalErrorHandler)


export default app