-- Ge behörighet till roller för att läsa/skriva tabellen
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_notification_preferences TO service_role;
