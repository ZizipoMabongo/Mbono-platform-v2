# Mbono Professional Services – Recruitment Platform (Beta)

Design follows the Mbono Career Goals page (mbono.co.za/career-goals): focus-area cards, call-to-action band and company footer. Colours are CSS variables at the top of `frontend/css/styles.css` (`--nav`, `--gold`) so you can match the exact brand colours.

Full-stack beta: a Node.js + Express API (backend) and a plain HTML/CSS/JS app (frontend).
Data is saved in a JSON file, so you do not need to install a database yet.

## Run it
You need Node.js 18 or newer.

```
cd backend
npm install
npm start
```
Open http://localhost:3000 for the landing page. The platform itself is at http://localhost:3000/app.html. The backend serves the frontend too, so that is all.
(Optional) Copy `.env.example` to `.env` and set your own `JWT_SECRET`.

If you prefer VS Code Live Server for the frontend, run the backend as above and open `frontend/index.html`
with Live Server. It calls the API at http://localhost:3000 automatically.

## Sign in
The app opens on a sign-in page. Candidates can create an account, and use "Forgot password?" to reset. Without email (SMTP) settings, emails (including reset links) are printed in the server terminal and saved to `backend/data/outbox.log`.

## Demo accounts (password for all: Demo@123)
| Role | Email |
|---|---|
| Candidate | candidate@mbono.demo |
| Recruiter | recruiter@mbono.demo |
| Hiring Manager | manager@mbono.demo |

The sign-in page has one-click buttons for these three accounts. The Admin account is hidden: it is not listed in the app and has no demo button. Its password is set with `ADMIN_PASSWORD` in `backend/.env` (wrap it in double quotes, e.g. `ADMIN_PASSWORD="My#Password1"`, because anything after a # is otherwise ignored), or generated and printed once in the terminal the first time the server starts (delete `backend/data/db.json` to start fresh). To reset the demo data, stop the server and delete `backend/data/db.json`.

## Project layout
```
backend/server.js, data/seed.json   API (auth, vacancies, applications, CV upload, POPIA, audit)
frontend/index.html                 public landing page (hero, core sectors, sign-in pop-up)
frontend/app.html                   the portal (vacancies, candidate, recruiter, hiring manager, admin)
frontend/css/theme.css              colours and shared styling (sage and deep green)
frontend/js/auth.js                 sign-in pop-up with the role drop-down
frontend/img/                       emblem and logo, plus hero/ for the moving background
```

## Replace the placeholder background photos
The moving hero background cycles through `frontend/img/hero/hero-1.jpg`, `hero-2.jpg` and `hero-3.jpg` with a slow zoom, behind a drifting emblem watermark. The three supplied images are plain placeholders. Save Mbono's own photos over them using the same names (about 1600 x 900 works well). For a video background, add a short MP4 (under 10 MB) such as `frontend/img/hero/hero.mp4`, then set `MB_VIDEO='img/hero/hero.mp4'` at the top of `frontend/js/auth.js`. It is off by default so the browser console stays free of 404 errors.

## Themes and the background video
Three bright green themes (Fresh green, Meadow, Emerald night) are in `frontend/css/theme.css`. Visitors switch with the three dots at the bottom-left; the choice is remembered. To change colours, edit the variables at the top of that file.
A soft watermark video plays behind every page (`frontend/js/watermark.js`). Replace `frontend/img/hero/hero.mp4` (and `hero.webm`, used by browsers without H.264) to change it.

## How the admin signs in
Admin is not listed in the Sign in as drop-down. The admin chooses Portal Login, leaves the drop-down on any role, and types the admin email and password. The email is `ADMIN_EMAIL` (default `admin@mbono.demo`). The password is `ADMIN_PASSWORD` in `backend/.env`, or a random one printed once in the terminal the first time the server starts.

## AI features and the chatbot
Interview questions, scorecards, drafted messages and the chatbot work out of the box with built-in templates. To use Claude instead, set `ANTHROPIC_API_KEY` in `backend/.env`. Only job details and skill lists are sent to the AI, never names, contact details or CV text.

## MongoDB for the audit trail and consent records
Set `MONGODB_URI` (and optionally `MONGODB_DB`) in `backend/.env`. The audit trail and the versioned, timestamped consent records are then stored in MongoDB. Without it they use the JSON file. If MongoDB cannot be reached, the server says so and falls back to the file.

## API (all under /api, JWT bearer token except login)
| Method and path | Who |
|---|---|
| POST /auth/login | anyone |
| GET, PUT /me | any signed-in user |
| GET /jobs | everyone (candidates see open vacancies only) |
| POST /jobs, POST /jobs/:id/duplicate | Recruiter, Admin |
| PATCH /jobs/:id (status) | Recruiter can close; Hiring Manager and Admin approve, request changes, close |
| GET /applications | candidates see their own, staff see all |
| POST, DELETE /applications | Candidate |
| PATCH /applications/:id (stage, rate, fb), POST /applications/:id/notes | Recruiter, Hiring Manager, Admin |
| GET /users, GET /audit | Admin |

## What is included
- Landing page, sign-in pop-up with role drop-down, sign-up, password reset, Request Talent form
- Candidate: vacancies with sector pictures, CV upload with automatic profile fill, one-click apply with source and POPIA consent, dashboard, chatbot, data download and account deletion
- Recruiter: pipeline, vacancies (post, edit after changes are requested, duplicate, close), interview invitations with calendar files, ATS screening, AI interview questions and scorecards, auto-generated messages, reports
- Hiring manager: approvals with a required reason when asking for changes, candidate review, scorecards
- Admin: users, audit trail, consent records, reports
- Reports: time to hire, vacancy aging, source of hire, recruiter performance, applications and hires by month, conversion by stage

## Not built yet
- A SQL database (PostgreSQL or SQL Server) for vacancies, applications and users (only the audit trail and consent records can use MongoDB)
- Microsoft Entra ID sign-in and automatic Teams meetings (needs an Azure app registration)
- SMS alerts, two-step login, retention rules that delete old data automatically
