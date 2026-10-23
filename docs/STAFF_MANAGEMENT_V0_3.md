# ATIS Web v0.3.0 — Staff & Teacher Management

This milestone ports the staff workflows that were previously handled in Apps Script.

## New hosted features

- Staff / teacher bulk onboarding from CSV
- Only Full Name, Phone Number and Email are required
- Automatic Employee Code when omitted
- Automatic Supabase Auth account creation
- Automatic username and temporary password generation
- Duplicate protection using Email, Phone and Employee Code
- Teaching roles: Teacher, Supervisor, Clerk, Accountant
- Restricted non-teaching Staff role with position/duty preserved
- Supported duties include Cleaner, Cook, Caretaker, Security Guard, Watchman,
  Driver, Nurse, Matron, Storekeeper, Librarian, Lab Attendant, Groundskeeper,
  Gardener, Maintenance Staff, Kitchen Staff, Office Assistant and Porter
- Administrator accounts are never bulk-created
- Staff Accounts can Create / Reset / Send Login Details
- SMS delivery through SMS Online Ghana when configured
- Optional email delivery through Resend when configured
- Delivery logs never store temporary passwords
- Staff Appointments & Contracts
- Draft / Active appointments, probation and fixed-term validation
- Printable Appointment Letters for activated appointments
- My Account / Change Password

## Supabase migrations

Run these in order after v0.2:

1. \`0005_01_staff_contracts.sql\`
2. \`0005_02_staff_onboarding_helpers.sql\`
3. \`0005_03_account_self_service.sql\`

## Vercel environment variables for login delivery

SMS:

- \`SMS_ONLINE_GHANA_API_KEY\`
- \`SMS_ONLINE_GHANA_BASE_URL=https://api.smsonlinegh.com/v5\`
- \`SMS_ONLINE_GHANA_GENERAL_SENDER=ATIS_GH\`

Email is optional:

- \`RESEND_API_KEY\`
- \`ATIS_EMAIL_FROM\`

The application automatically uses the Vercel production URL in staff login messages. \`NEXT_PUBLIC_APP_URL\` can be set if a custom domain should be used instead.

## Security

Temporary passwords are returned only to the administrator immediately after generation and may be sent directly to the staff member. They are never written to ATIS database logs. Supabase Auth stores the password securely.
