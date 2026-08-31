-- Create the messages table for quote requests
CREATE TABLE quote_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id uuid REFERENCES quote_requests(id) ON DELETE CASCADE NOT NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'admin', 'system')),
  sender_email text,
  body_text text NOT NULL,
  body_html text,
  email_message_id text UNIQUE,
  in_reply_to text,
  has_attachments boolean DEFAULT false NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX idx_quote_messages_quote_request_id ON quote_messages(quote_request_id);
CREATE INDEX idx_quote_messages_created_at ON quote_messages(created_at);
CREATE INDEX idx_quote_messages_email_message_id ON quote_messages(email_message_id);

-- Enable Row Level Security (RLS)
ALTER TABLE quote_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Public/anon gets no access by default (no policies for them)

-- Auth users (admins) can select all messages
CREATE POLICY "Auth users can read quote messages"
  ON quote_messages FOR SELECT USING (auth.role() = 'authenticated');

-- Auth users (admins) can insert messages (when they reply from the UI)
CREATE POLICY "Auth users can insert quote messages"
  ON quote_messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Auth users (admins) can update messages (only for marking as read)
CREATE POLICY "Auth users can update quote messages"
  ON quote_messages FOR UPDATE 
  USING (auth.role() = 'authenticated');
