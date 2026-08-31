-- Aktivera Supabase Realtime för quote_messages och quote_requests
ALTER PUBLICATION supabase_realtime ADD TABLE quote_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE quote_requests;
