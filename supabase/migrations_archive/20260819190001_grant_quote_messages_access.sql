-- Grant access to the quote_messages table for authenticated users and service_role
GRANT SELECT, INSERT, UPDATE ON quote_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON quote_messages TO service_role;
