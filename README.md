# ATIS Web v0.1.0 — Core Platform

This is the first hosted-web foundation for **AL-KHALIDIYA TECHNICAL ISLAMIC SCHOOL (ATIS)**. It is intentionally built in parallel with the Apps Script v1.0.10 system rather than replacing the live school system immediately.

## What is working in this starter

- Supabase/PostgreSQL core schema
- Supabase Auth with Next.js SSR cookies
- Username **or** email login
- Row-level security by ATIS role and school
- Dashboard
- Students roster
- Staff roster
- Classes with optional Sections
- Master Subjects + class-subject links
- Teacher subject/class assignments
- Derived class strength (no import-counter inflation)
- Academic year / term seed for 2026–2027
- Migration ID map and legacy payload fields

This is **not yet the production cutover build**. Admissions, bulk onboarding, attendance, assessments/results, finance, HR/contracts, documents, inventory and the remaining v1.0.10 modules come after the core data migration is reconciled.

## 1. Create a Supabase project

Create a new Supabase project for the ATIS **development/staging** environment. Do not point this starter at the live Google Sheet.

## 2. Apply the database schema

In Supabase SQL Editor, run:

1. `supabase/migrations/0001_atis_core.sql`
2. `supabase/seed.sql`

The seed creates the ATIS school row and the 2026–2027 academic year/terms.

## 3. Configure environment variables

Copy:

```bash
cp .env.example .env.local
```

Fill in the values from Supabase project settings. The `SUPABASE_SECRET_KEY` is **server-only** and must never be prefixed with `NEXT_PUBLIC_`.

## 4. Install and create the first administrator

```bash
npm install
npm run setup:admin
```

The bootstrap script creates the Supabase Auth account and corresponding ATIS `profiles` / `staff` rows.

## 5. Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## 6. Production deployment later

Once the staging database is populated and reconciled, the app can be pushed to GitHub and imported into Vercel. Environment variables are then configured in Vercel, and a separate production Supabase project can be used for the final cutover.

## Source reference

The core mapping in `docs/V1_0_10_MAPPING.md` was extracted from the actual ATIS F8 Custom Edition v1.0.10 package. `docs/ARCHITECTURE.md` describes the hosted design.

## Important data rule

`Classes.TotalStrength` from Sheets is not trusted as a database counter. ATIS Web calculates class strength by counting valid active rows in `students`. This permanently removes the class-count inflation problem caused by repeated/failed bulk onboarding attempts.
