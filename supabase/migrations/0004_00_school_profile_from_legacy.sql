-- Copy safe school-profile fields from the legacy ATIS settings.
-- The old embedded base64 logo is intentionally not migrated.
begin;

update public.schools
set
  name = 'AL-KHALIDIYA TECHNICAL ISLAMIC SCHOOL',
  short_name = 'ATIS',
  address = 'P.O. Box LL71, Bimbilla, Northern Region - Ghana',
  phone = '0242721179 / 0240992540 / 0549955439 / 0246418368',
  email = 'alkhalidiyatechnical@gmail.com',
  timezone = 'Africa/Accra',
  currency_code = 'GHS',
  updated_at = now()
where code = 'ATIS';

commit;
