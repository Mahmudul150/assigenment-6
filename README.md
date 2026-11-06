# Developer Assessment Platform

A backend-based technical assessment and recruitment management platform designed to help software companies create assessments, manage coding problems, invite candidates, evaluate submissions, and process payments.

## Project Overview

The Developer Assessment Platform simplifies the technical recruitment process by providing a centralized system for companies, candidates, and administrators.

Companies can create technical assessments, add coding problems, invite candidates, and manage payments. Candidates can participate in assessments and submit their answers. Administrators can manage users and approve company profiles.

## Technologies Used

- Node.js
- TypeScript
- Express.js
- PostgreSQL
- Prisma ORM
- Zod
- JWT Authentication
- Google OAuth
- bKash Payment Gateway
- Redis (if configured)
- Nodemailer (if configured)

## User Roles

The platform supports three primary roles:

### 1. ADMIN
- Manage users
- Approve or reject company profiles
- Access administrative resources
- Monitor platform activities

### 2. COMPANY
- Manage company profile
- Create and manage assessments
- Create and manage coding problems
- Add problems to assessments
- Invite candidates
- Process assessment payments
- Publish assessments after successful payment

### 3. CANDIDATE
- Manage candidate profile
- View assessment invitations
- Participate in assessments
- Submit answers
- View submission results (where permitted)

## Core Features

- Email and password authentication
- Google social authentication
- JWT-based authorization
- Role-based access control (RBAC)
- Company profile approval
- Assessment management
- Problem management
- Assessment problem management
- Candidate invitation system
- Assessment attempt management
- Submission and evaluation
- Payment integration with bKash
- Input validation using Zod
- Centralized error handling
- Soft deletion
- Audit logging
- Database relationship management

## Project Architecture

The application follows a modular architecture.

```text
Client (Postman / Frontend)
          |
          v
       Routes
          |
          v
     Middleware
          |
          v
     Controllers
          |
          v
       Services
          |
          v
      Prisma ORM
          |
          v
      PostgreSQL
```

## Installation and Setup

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Navigate to the Project

```bash
cd YOUR_PROJECT_FOLDER
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the project root.

Configure the required environment variables according to your project setup.

```env
NODE_ENV=development
PORT=5000

DATABASE_URL=
DIRECT_URL=

JWT_SECRET=
JWT_EXPIRES_IN=

GOOGLE_CLIENT_ID=

BKASH_BASE_URL=
BKASH_USERNAME=
BKASH_PASSWORD=
BKASH_APP_KEY=
BKASH_APP_SECRET=

REDIS_URL=
```

Add any other environment variables required by your implementation.

**Important:** Never commit your actual `.env` file or secret credentials to GitHub.

### 5. Run Database Migration

```bash
npx prisma migrate deploy
```

Use your project's configured Prisma commands if they differ.

### 6. Start the Development Server

```bash
npm run dev
```

### 7. Build the Project

```bash
npm run build
```

## API Base URL

**Production API:**

```text
https://assigenment-6-rho.vercel.app/api/v1
```

## API Modules

| Module | Description |
|---|---|
| Auth | Registration, Login, Google Login |
| User | User management |
| Candidate | Candidate profile management |
| Company | Company profile and approval |
| Problem | Coding problem management |
| Assessment | Assessment management |
| AssessmentProblem | Manage problems in assessments |
| Invitation | Candidate invitations |
| Attempt | Assessment attempts |
| Submission | Answer submission and evaluation |
| Payment | Payment creation and verification |
| Admin | Administrative operations |
| AuditLog | Activity tracking |

## Payment Integration

The platform integrates with the bKash payment gateway.

Payment workflow:

1. Company initiates a payment.
2. Backend creates a payment session.
3. User completes the payment through the gateway.
4. Backend receives the payment callback.
5. Backend verifies the payment with bKash.
6. Payment status is updated in the database.
7. Assessment can be published after successful payment verification.

## API Testing

All API endpoints can be tested using:

- Postman

Authentication-protected endpoints require a valid JWT access token.

Role-based authorization ensures that users can access only the resources permitted for their roles.

## Deployment

The backend application is deployed on Vercel.

**Live API:**

https://assigenment-6-rho.vercel.app/api/v1

**API Documentation:**

https://documenter.getpostman.com/view/50323079/2sBYHYtcot

## Author

**Mahmudul Hasan**

Backend Developer

GitHub: https://github.com/Mahmudul150

---

Thank you for checking out the Developer Assessment Platform!