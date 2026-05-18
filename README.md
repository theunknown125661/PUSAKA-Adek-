# School Present Reward

A production-ready attendance reward system for schools. Students check in using browser geolocation and a live selfie, teachers monitor and review submissions, and admins provide final verification before rewards are credited to student wallets.

## Features

### Student
- **Geolocation check-in** — GPS-verified attendance with distance display
- **Live selfie capture** — Camera proof using `getUserMedia` API
- **Attendance history** — View all submissions with status tracking
- **Wallet** — Track pending, available, and held balances
- **Withdrawals** — Weekly withdrawal requests
- **Gamification** — Streaks, badges, progress milestones

### Teacher
- **Class monitoring** — View daily attendance for assigned classes
- **Submission review** — Inspect selfie proof, location data, and timestamps
- **Notes & flags** — Add notes or flag suspicious submissions for admin

### Admin
- **Dashboard** — KPI overview (pending, flagged, approved, rejected)
- **Attendance review queue** — Approve/reject with full detail view
- **Withdrawal management** — Process student payout requests
- **Settings** — Configure school location, radius, reward amounts, time windows
- **User management** — View and manage all users by role

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Backend | Supabase (Auth, PostgreSQL, Storage) |
| Icons | Lucide React |
| Charts | Recharts |
| Utils | date-fns, Haversine formula |

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project ([database.new](https://database.new))

### 1. Clone & Install

```bash
cd "School Streak"
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Set Up Database

1. Open your Supabase project > **SQL Editor**
2. Run `supabase/schema.sql` — creates all tables, RLS policies, and functions
3. Create 3 test users in **Authentication > Users**:

| Email | Password | User Metadata |
|-------|----------|--------------|
| `admin@school.test` | `Test1234!` | `{"role": "admin", "full_name": "Admin Utama"}` |
| `teacher@school.test` | `Test1234!` | `{"role": "teacher", "full_name": "Ibu Sari"}` |
| `student@school.test` | `Test1234!` | `{"role": "student", "full_name": "Budi Santoso"}` |

4. Run `supabase/seed.sql` — inserts demo school, classes, enrollments, sample data

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and login with any demo account.

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@school.test | Test1234! |
| Teacher | teacher@school.test | Test1234! |
| Student | student@school.test | Test1234! |

## Project Structure

```
src/
├── app/
│   ├── login/           # Auth page
│   ├── student/          # Student dashboard, check-in, history, wallet
│   ├── teacher/          # Teacher dashboard, class detail, student monitor
│   └── admin/            # Admin dashboard, attendance review, withdrawals, settings, users
├── components/
│   ├── layout/           # Sidebar, AppShell
│   └── shared/           # StatusBadge, EmptyState
├── lib/
│   ├── supabase/         # Client, server, middleware helpers
│   ├── hooks/            # useGeolocation, useCamera, useUserRole
│   ├── utils/            # Haversine, geo, camera, format, fraud-flags
│   └── types/            # TypeScript interfaces
├── middleware.ts          # Auth + role-based route protection
supabase/
├── schema.sql            # Full DDL + RLS + functions
└── seed.sql              # Demo data
```

## Security

- **Row Level Security** on all tables
- **Role-based routing** via Next.js middleware
- **Secure database functions** (`SECURITY DEFINER`) for wallet operations
- **Storage policies** for selfie uploads (user-scoped folders)
- **HTTPS required** for geolocation and camera APIs in production

## Business Rules

1. Attendance starts as `pending_teacher_view`
2. Teacher reviews and forwards to `pending_admin_review`
3. Admin approves → wallet credited, streaks updated
4. Admin rejects → reason visible to student
5. Weekly withdrawal minimum cadence
6. Monthly hold earns 5% bonus on release

## Deployment

Deploy to Vercel:
```bash
npm run build
# Deploy via Vercel CLI or GitHub integration
```

Ensure your production domain is added to Supabase Auth > URL Configuration.

## License

MIT
