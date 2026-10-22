# ATIS Web v0.1 staging setup checklist

1. Create a **separate Supabase development/staging project**. Do not use the Apps Script production sheet as the new database.
2. Run `supabase/migrations/0001_atis_core.sql` in Supabase SQL Editor.
3. Run `supabase/seed.sql`.
4. Copy `.env.example` to `.env.local` and enter the Supabase URL, publishable key and server-only secret key.
5. Set the bootstrap administrator values in `.env.local`.
6. Run `npm install`.
7. Run `npm run setup:admin`.
8. Run `npm run dev` and sign in at `http://localhost:3000`.
9. Test: create one class with a blank Section, create one subject, attach it to the class, then assign it to a teacher after test staff data exists.
10. Only after the schema/UI checks pass should we build the v1.0.10 data migration script.

## Do not do yet

- Do not delete or alter the production Google Sheet.
- Do not point staff/students to the new app yet.
- Do not migrate passwords directly from the old SHA-256 system into Supabase Auth. Existing users will receive temporary/reset credentials during the later cutover.
