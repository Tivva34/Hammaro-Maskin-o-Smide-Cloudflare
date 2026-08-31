-- ====== QUOTE MESSAGES UPDATE POLICY ======
-- Saknades från den tidigare RBAC-setupen. Möjliggör att frontend kan markera meddelanden som lästa.
CREATE POLICY "RBAC Update quote messages"
  ON quote_messages FOR UPDATE 
  USING (has_role('superadmin') OR has_role('admin') OR has_permission('quotes:write'));
