-- Keep fee receipt numbering server-side.
-- Fee payments use the sequence inside the SECURITY DEFINER record_fee_payment RPC;
-- authenticated clients do not need direct sequence privileges.

BEGIN;

REVOKE ALL ON SEQUENCE public.fee_receipt_seq FROM PUBLIC, anon, authenticated;

COMMIT;
