# ATIS students and guardians staging migration — 2026-10-23

Source workbook: ATIS_ERP_PRODUCTION (read only).

Validated source counts:
- Total source student rows: 934
- Valid active students selected: 468
- Archived invalid-import remnants excluded: 466
- Duplicate admission-number groups among valid students: 0
- Duplicate person-fingerprint groups among valid students: 0
- Rebuilt unique guardians: 414
- Student–guardian links: 468

Expected active students by class:
- NURSERY ONE: 52
- NURSERY TWO / A: 46
- NURSERY TWO / B: 41
- KINDERGARTEN ONE: 54
- KINDERGARTEN TWO: 55
- BASIC ONE: 51
- BASIC TWO: 48
- BASIC THREE: 48
- BASIC FOUR: 37
- BASIC FIVE: 36

Run in Supabase SQL Editor, in order:
1. 0003_00_student_guardian_refinements.sql
2. 0003_01_import_students_part1.sql
3. 0003_02_import_students_part2.sql
4. 0003_03_import_guardians.sql
5. 0003_04_import_student_guardian_links.sql
6. 0003_05_verify_students_guardians.sql

Notes:
- Old student portal passwords are not migrated.
- Embedded base64 photos are not inserted into PostgreSQL; they are flagged for later Supabase Storage migration.
- Guardian records are rebuilt from valid student family fields, not copied blindly from ATIS_Guardians, because that legacy table also contains rows created during failed imports.
- Guardian Auth accounts are not created yet. Account provisioning will be handled separately after family data is verified.
