-- quote_requests saknar explicit GRANT UPDATE/SELECT till authenticated.
-- RLS-policys för UPDATE och SELECT finns sedan 20260823170000_setup_rbac.sql
-- men PostgreSQL kräver också underliggande table privilege.
-- INSERT fanns sedan 20260814195603_grant_insert_authenticated.sql.
GRANT SELECT, UPDATE ON public.quote_requests TO authenticated;

-- quote_messages har redan GRANT från 20260819190001_grant_quote_messages_access.sql
-- men vi säkerställer det här också för tydlighet.
GRANT SELECT, INSERT ON public.quote_messages TO authenticated;
