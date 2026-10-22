# ATIS Web architecture — v0.1

## Runtime

- **Web framework:** Next.js 16 App Router (TypeScript)
- **Authentication:** Supabase Auth with cookie-based SSR sessions
- **Database:** PostgreSQL on Supabase
- **Authorization:** PostgreSQL Row Level Security (RLS) plus server-side route checks
- **Storage:** Supabase Storage in later milestones
- **Hosting target:** Vercel

## Security model

The browser receives only the Supabase publishable key. `SUPABASE_SECRET_KEY` is server-only and is used only for administrative operations such as resolving a username to an email address and provisioning accounts.

RLS is enabled on every exposed core table. The policies isolate data by `school_id`, restrict management writes to the appropriate ATIS roles, allow teachers to read students only in classes they teach, and reserve audit/migration tables for privileged access.

## Normalized core relationships

```text
schools
  ├── profiles ── auth.users
  ├── staff ───── auth.users
  ├── academic_years ── terms
  ├── classes ───────── students
  │     └── class_subjects ── subject_catalogue
  │              └── teacher_assignments ── staff (teacher)
  └── guardians ── student_guardians ── students
```

## Migration principle

v1.0.10 remains the functional reference and temporary production system. The hosted app is built in parallel. Existing Google Sheet data is imported only into a development/staging database until counts and relationships reconcile exactly; the old system is not modified by the migration work.
