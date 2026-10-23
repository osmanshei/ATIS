# ATIS staging core migration snapshot — 2026-10-23

Source: `ATIS_ERP_PRODUCTION` (read only).

## Snapshot counts

- Staff/users: 21
- Classes: 10
- Master subjects: 11
- Class-subject rows: 65
- Teacher assignments: 8

## Deliberate transformations

- `NURSERY TWO A` / `NURSERY TWO B` are normalized to class name `NURSERY TWO` with Section `A` / `B`.
- `Classes.TotalStrength` is not imported; ATIS Web derives strength from active student rows.
- Old password hashes are not imported into Supabase Auth.
- Embedded base64 profile photos are not copied into PostgreSQL. They are marked for a later Supabase Storage migration.
- Ghana phone numbers stored by Sheets as 9-digit numerics are restored with a leading `0`.
- The populated legacy `Teacher_Assignments` table is used. `ATIS_Teacher_Assignments` is currently header-only.
- Existing manually-created staging administrator is enriched by matching email so the Supabase Auth link is preserved.

## Source-quality items kept visible

- Pass marks are preserved exactly as stored, including legacy zero values. The verification query lists them for review.
- Email values are preserved exactly; the verification query flags syntactically invalid addresses before staff login accounts are provisioned.

Run in Supabase SQL Editor in this order:

1. `0002_00_core_import_refinements.sql`
2. `0002_01_import_core_snapshot_2026_10_23.sql`
3. `0002_02_verify_core_snapshot.sql`
