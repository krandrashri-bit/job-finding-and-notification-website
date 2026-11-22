# Domainly — Domain-Based Job Availability & Notification System

A responsive React and Express application for browsing jobs by career domain. Job seekers can register, choose multiple domains, and opt into email and/or SMS notifications. The all-jobs page is intentionally a browse-only view; domain alerts are offered only on individual domain pages.

## Requirements

- Node.js 18 or newer
- XAMPP with MySQL running
- phpMyAdmin (included with XAMPP)

## Setup on Windows

If Node.js is installed but PowerShell says `node` or `npm` is not recognized, add its default install folder to the current terminal's `PATH` before running the commands below:

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
```

Repeat this in each terminal window you use for the backend or frontend.

1. Start **MySQL** in the XAMPP Control Panel.
2. Open `http://localhost/phpmyadmin`, choose **Import**, select `database/domain_job_system.sql`, and run the import.
3. In a terminal, open `backend` and install packages:

   ```powershell
   cd "C:\job finder\backend"
   npm install
   Copy-Item .env.example .env
   ```

4. Edit `backend/.env`. Set a long random `JWT_SECRET`, a private `ADMIN_EMAIL` and `ADMIN_PASSWORD`, and your MySQL credentials. The first API startup creates that administrator with a bcrypt-hashed password. Do not use the example admin password outside local development.
5. Start the API:

   ```powershell
   npm run dev
   ```

6. In a second terminal, install and start the frontend:

   ```powershell
   cd "C:\job finder\frontend"
   npm install
   npm run dev
   ```

7. Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The API health check is at `http://localhost:5000/api/health`.

## Administrator access

Choose **Admin sign in** from the site footer or the regular login page. Only accounts with the `admin` role can sign in through this page. After authentication, the admin dashboard lets you publish jobs by domain; publishing also creates alerts for opted-in users following that domain.

## Notifications

- On each domain page, a signed-in job seeker can follow/unfollow that domain. Registering also lets the user choose domains and notification channels.
- When a seeker registers or logs in, existing published jobs in their followed domains are backfilled once; later matching jobs are sent as they are published. Duplicate job/channel notifications are prevented.
- In the notification center, users choose domains (or select all), update their mobile number, and opt into email and/or SMS. A user with no selected domains receives no domain alerts; the all-jobs page does not subscribe users.
- Publishing a job from the admin panel creates notification records for opted-in users following that job's domain. No users from other domains are notified.
- Configure SMTP values in `backend/.env` to send email (for Gmail, use `smtp.gmail.com`, port `587`, and an app password as `SMTP_PASSWORD`). Without SMTP, email alerts are recorded as `pending`.
- SMS delivery is optional and uses Twilio REST credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`). Without Twilio configuration, SMS alerts are recorded as `pending`.
- Pending email/SMS messages are retried on the next login or notification-center visit after provider credentials are configured. Provider delivery errors are logged and saved with a `failed` status.

## Accounts and privacy

- New registrations create job-seeker accounts; only the configured bootstrap account receives the administrator role.
- The admin user list shows account contact information, role, joined date, and chosen domains. It never returns password hashes.
- Passwords are hashed with bcrypt. API routes use signed JWTs, admin routes enforce the admin role, and SQL uses parameterized statements.

## Included features and current scope

Implemented: registration/login, domain preferences, all-jobs browse/search/filter, domain-specific job lists and alerts, admin dashboard, job publishing, user/job/notification views, and email/SMS dispatch hooks.

This starter does not yet include employer self-service, applications, resumes, skills matching, or password reset. These should be added as separate modules before using the system as a production recruitment platform. Future enhancements: semantic resume matching, mobile push notifications, WhatsApp messaging, interview scheduling, and skill assessments.
