# Auditoría — Setup & Deployment Guide

## Prerequisites
- Node.js 20+
- npm
- Vercel account (free tier works)
- Vercel CLI: `npm i -g vercel`

---

## 1. Create a Vercel project & Neon database

```bash
# Link this directory to Vercel
vercel link

# Open Vercel Marketplace and add Neon PostgreSQL
# Go to: https://vercel.com/marketplace → Neon → Add Integration
# Then pull the connection string:
vercel env pull .env.local
```

The `.env.local` file should now contain `DATABASE_URL`.

---

## 2. Push the database schema

```bash
npm run db:push
```

This creates the tables:
- `tests` — questionnaire definitions
- `responses` — submitted answers
- `invitations` — email invite tracking
- `task_actions` — solution action board state
- `consultant_notes` — report consultant notes

---

## 3. Seed demo data

Open the app and click the gear icon (⚙) in the top right → **Restaurar datos** for each mode, or run:

```bash
# Seed all three demo modes via the API (once the app is deployed)
curl -X POST https://your-app.vercel.app/api/seed -H "Content-Type: application/json" -d '{"mode":"clientes"}'
curl -X POST https://your-app.vercel.app/api/seed -H "Content-Type: application/json" -d '{"mode":"tiendas"}'
curl -X POST https://your-app.vercel.app/api/seed -H "Content-Type: application/json" -d '{"mode":"empleados"}'
```

Or locally:
```bash
npm run dev
# Then visit http://localhost:3000 and use the gear menu to restore each mode
```

---

## 4. Run locally

```bash
npm run dev
# → http://localhost:3000
```

**Admin panel**: `http://localhost:3000`
**Public questionnaire**: `http://localhost:3000/q/{testId}`

---

## 5. Deploy to Vercel

```bash
vercel --prod
```

Or push to your GitHub repo and Vercel will auto-deploy.

---

## App structure

```
Admin routes (/)
├── Inicio        — KPI dashboard
├── Cuestionarios — test grid with tags and filters
├── Builder       — full test editor (topics, questions, solutions, branding, invites)
├── Respuestas    — analytics per test (personas, empresas/tiendas/empleados, análisis, invitaciones)
├── Clientes/Tiendas/Empleados — CRM entity view
├── Tablero       — cross-entity comparison dashboard + XLSX export
├── Soluciones    — action board (tiendas + empleados modes)
└── Reportes      — shareable client reports (clientes mode)

Public routes
└── /q/[testId]            — questionnaire
    └── /result/[responseId] — view a completed response
```

## Demo modes

Switch between three demo datasets using the gear icon (⚙):

| Mode | Use case | Entities |
|------|----------|---------|
| Clientes | Consulting firm evaluating client orgs | Organizations |
| Tiendas | Retail chain auditing stores | Stores / Departments |
| Empleados | HR talent evaluation | Employees |

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string (required) |
