# Login & Session State Management System

A runnable React + Vite + Tailwind frontend and Express + MongoDB Atlas backend.
Includes bcrypt password hashing, JWT authentication, persisted sessions, lockout after failed logins,
protected routes, logout/revocation, session expiry, request audit logging, and an explicit FSM reducer.

## Requirements
- Node.js 18+
- MongoDB Atlas connection string (or local MongoDB)
- Two terminals

## 1. Configure backend
```bash
cd backend
cp .env.example .env
```
Edit `backend/.env` and set:
- `MONGODB_URI` to your Atlas URI, including database name `auth_state_db`
- `JWT_SECRET` to a long random secret (at least 32 characters)
- `CLIENT_ORIGIN=http://localhost:5173`

Install and run:
```bash
npm install
npm run dev
```
The API runs at http://localhost:5000. Check http://localhost:5000/api/health.

## 2. Configure frontend
Open a second terminal:
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Open http://localhost:5173.

## Demo flow
1. Register an account.
2. Log in and open Dashboard, Sessions, FSM, or Network Monitor.
3. Try an incorrect password three times to trigger a temporary lockout.
4. Log out; the session is revoked on the server.
5. Set `SESSION_TTL_SECONDS=90` in backend `.env` to demonstrate expiry quickly, then restart backend.

## API
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout` (Bearer token)
- `GET /api/auth/me` (Bearer token)
- `GET /api/sessions` (Bearer token)
- `DELETE /api/sessions/:id` (Bearer token)
- `GET /api/network/logs` (Bearer token)
- `GET /api/health`

## Notes
- Never commit `.env`; `.gitignore` excludes it.
- The frontend stores the demo bearer token in localStorage. For production, prefer secure,
  HttpOnly, SameSite cookies with CSRF protection and HTTPS.
- Configure Atlas Network Access appropriately. Avoid `0.0.0.0/0` in production.
