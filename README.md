# Developer Assessment Platform

A backend-based technical assessment and recruitment management platform designed to help software companies create assessments, manage coding problems, invite candidates, evaluate submissions, and process payments.

## Project Overview

The Developer Assessment Platform simplifies the technical recruitment process by providing a centralized system for companies, candidates, and administrators.

Companies can create technical assessments, add coding problems, invite candidates, and manage payments. Candidates can participate in assessments and submit their answers. Administrators can manage users, approve company profiles, and monitor platform activities.

## Technologies Used

- **Runtime:** Node.js
- **Language:** TypeScript
- **Backend Framework:** Express.js
- **Database:** PostgreSQL
- **ORM:** Prisma ORM
- **Validation:** Zod
- **Authentication:** JWT Authentication
- **Social Authentication:** Google OAuth
- **Payment Gateway:** bKash Tokenized Checkout
- **File Upload:** Multer
- **Cloud Storage:** Cloudinary
- **Caching & OTP:** Redis
- **Email Service:** Nodemailer

## User Roles

The platform supports three primary roles:

### 1. ADMIN

- Manage users
- Approve or reject company profiles
- Access administrative resources
- Monitor platform activities
- Manage platform operations

### 2. COMPANY

- Manage company profile
- Create and manage assessments
- Create and manage coding problems
- Add problems to assessments
- Invite candidates
- Process assessment payments
- Publish assessments after successful payment verification

### 3. CANDIDATE

- Manage candidate profile
- View assessment invitations
- Participate in assessments
- Submit answers
- View submission results where permitted

## Core Features

### Authentication & Authorization
- Email and password authentication
- Google social authentication
- JWT-based authentication
- Role-Based Access Control (RBAC)
- Secure password hashing

### Company Management
- Company profile management
- Admin-based company approval
- Company-specific resource management

### Assessment Management
- Create and manage assessments
- Publish and close assessments
- Add coding problems to assessments
- Manage assessment duration and passing score

### Problem Management
- Create, update, retrieve, and delete coding problems
- Admin and company-based problem management
- Protected correct answers

### Candidate Management
- Candidate profile management
- Assessment invitation system
- Assessment attempt management
- Submission and evaluation

### Payment Integration
- bKash Tokenized Checkout integration
- Payment creation and verification
- Payment history management
- Assessment publishing after successful payment verification

### Additional Features
- Input validation using Zod
- Centralized error handling
- Soft deletion
- Audit logging
- Database transactions
- Database relationship management
- Rate limiting
- Security headers using Helmet
- CORS configuration
- Cloudinary file uploads

## Project Architecture

The application follows a modular architecture using a layered design pattern.

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

### Prerequisites

- Node.js
- npm
- PostgreSQL
- Git

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Navigate to the Project Directory

```bash
cd YOUR_PROJECT_FOLDER
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the project root directory.

Configure the following environment variables according to your project configuration.

```env
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=
DIRECT_URL=

# Frontend
FRONTEND_URL=

# JWT Authentication
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=10

# Google OAuth
GOOGLE_CLIENT_ID=

# Admin Configuration
ADMIN_NAME=
ADMIN_EMAIL=
ADMIN_PASSWORD=

# Redis Configuration
RADIS_USER=
RADIS_PASSWORD=
RADIS_HOST=
RADIS_PORT=

# Email Configuration
SMTP_USER=
EMAIL_SENDER=
SMTP_PASSWORD=

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDE_API_SECRET=

# bKash Payment Gateway
BKASH_SENDBASE_URL=
BKASH_USERNAME=
BKASH_PASSWORD=
BKASH_APP_KEY=
BKASH_APP_SECRET=
BKASH_CALLBACK_URL=

# Platform Configuration
PLATFROM_FEE=2000
```

**Important:**
- Never commit your actual `.env` file or secret credentials to GitHub.
- Use Vercel Environment Variables for production configuration.
- Use `.env.example` to share the required environment variable names without exposing sensitive values.

### 5. Run Database Migrations

```bash
npx prisma migrate deploy
```

For local development, use your project's configured development migration command.

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
| Invitation | Candidate invitation management |
| Attempt | Assessment attempt management |
| Submission | Answer submission and evaluation |
| Payment | Payment creation and verification |
| Admin | Administrative operations |
| AuditLog | Activity tracking |

## Payment Integration

The platform integrates with the **bKash Tokenized Checkout API** to process assessment payments.

### Payment Workflow

1. Company initiates a payment request.
2. Backend validates the assessment and payment eligibility.
3. Backend creates a payment session with bKash.
4. Company completes payment through the bKash gateway.
5. Backend receives the payment callback.
6. Backend verifies the payment with bKash.
7. Payment status is updated in the database.
8. Assessment can be published after successful payment verification.

## API Documentation

Complete API documentation is available through Postman.

**[View Published API Documentation](https://documenter.getpostman.com/view/50323079/2sBYHYtcot)**

The documentation includes:

- API endpoints and HTTP methods
- Request parameters and body examples
- Authentication requirements
- Sample API requests and responses

## API Testing

All API endpoints can be tested using **Postman**.

Authentication-protected endpoints require a valid JWT access token.

Role-based authorization ensures that users can access only the resources permitted for their roles.

## Deployment

The backend application is deployed on **Vercel**.

**Live API:**

[https://assigenment-6-rho.vercel.app/api/v1](https://assigenment-6-rho.vercel.app/api/v1)

**API Documentation:**

[Postman Documentation](https://documenter.getpostman.com/view/50323079/2sBYHYtcot)

## Author

**Mahmudul Hasan**

Backend Developer

GitHub: [Mahmudul150](https://github.com/Mahmudul150)

---

Thank you for checking out the Developer Assessment Platform!