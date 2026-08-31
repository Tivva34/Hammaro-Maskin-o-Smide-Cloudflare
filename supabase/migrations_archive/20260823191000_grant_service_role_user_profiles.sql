-- Ge service_role nödvändiga behörigheter för att kunna hantera user_profiles via Edge Functions
-- SELECT krävs för profiluppslag
-- INSERT krävs för auto-repair och invite-upserts
-- UPDATE krävs för uppdatering av roll, behörigheter och status
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO service_role;
