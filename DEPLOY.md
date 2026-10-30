# Deploying: Vercel (frontend) and Render (backend)

Deploy the **backend first**, wait until it is live, then deploy the frontend. The new screens call new API endpoints.

## 0. Before you push to GitHub
Make sure no real data is uploaded. In the project folder run:
```
git ls-files | findstr /i "db.json .env uploads"
```
Only `.env.example` should appear. If `backend/data/db.json` or anything in `uploads` is listed, run `git rm --cached backend/data/db.json` (and the same for any other file listed), then commit. If it was already pushed earlier, tell me: the file holds password hashes and candidate details, so the passwords should be changed.

## 1. Render (backend)
Web Service settings:
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- Run exactly **one** instance (data is kept in a file).

Environment variables:
| Name | Value |
|---|---|
| `JWT_SECRET` | a long random string (required: without it everyone is signed out on every restart) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | your admin login (set a strong password) |
| `FRONTEND_ORIGIN` | your Vercel address, e.g. `https://your-app.vercel.app` |
| `BASE_URL` | the same Vercel address (used in password reset emails) |
| `DATA_DIR` | `/var/data` (needs a Render persistent disk mounted at `/var/data`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | your email provider, otherwise no email is sent |
| `INQUIRY_TO` | where Request Talent messages go |
| `MONGODB_URI`, `MONGODB_DB` | optional, MongoDB Atlas for the audit trail and consent records |
| `ANTHROPIC_API_KEY` | optional, for AI features (templates are used without it) |

**Important:** without a persistent disk, Render erases `db.json` and uploaded CVs on every redeploy and restart, so users and applications disappear.

## 2. Vercel (frontend)
- Root Directory: `frontend`
- Framework Preset: Other. No build command, no output directory.
- Before pushing, open `frontend/js/config.js` and set `MB_API_BASE` to your Render address.

## 3. After deploying
- Open `https://YOUR-RENDER-ADDRESS/api/health`. It should show `{"ok":true}`.
- Change or remove the demo accounts' passwords before real candidates use the site (the demo password is in the README on GitHub).
- On Render's free plan the service sleeps after inactivity, so the first request can take about a minute.
