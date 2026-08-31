-- 1. Lägg till nya fält i user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS job_role text DEFAULT 'Övrigt';

-- Uppdatera befintliga med default-yrkesroll om det saknas (onödigt pga DEFAULT 'Övrigt', men för säkerhets skull)
UPDATE user_profiles SET job_role = 'Övrigt' WHERE job_role IS NULL;

-- 2. Skapa tabellen för notifikationsinställningar
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  machine_inquiries boolean DEFAULT false NOT NULL,
  inventory_inquiries boolean DEFAULT false NOT NULL,
  workshop_inquiries boolean DEFAULT false NOT NULL,
  transport_inquiries boolean DEFAULT false NOT NULL,
  customer_replies boolean DEFAULT false NOT NULL,
  new_users boolean DEFAULT false NOT NULL,
  system_notifications boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- 3. RLS för user_notification_preferences
CREATE POLICY "Users can read own preferences"
  ON user_notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all preferences"
  ON user_notification_preferences FOR SELECT
  USING (has_role('superadmin') OR has_role('admin'));

CREATE POLICY "Users can update own preferences"
  ON user_notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update all preferences"
  ON user_notification_preferences FOR UPDATE
  USING (has_role('superadmin') OR has_role('admin'));

CREATE POLICY "Admins can insert preferences"
  ON user_notification_preferences FOR INSERT
  WITH CHECK (has_role('superadmin') OR has_role('admin'));

CREATE POLICY "Users can insert own preferences"
  ON user_notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Trigger för att skapa default-preferences när en användare skapas i user_profiles
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_preferences_on_user_profile_insert ON user_profiles;
CREATE TRIGGER create_preferences_on_user_profile_insert
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

-- 5. Se till att befintliga användare får preferences (för de som skapats före denna migration)
INSERT INTO user_notification_preferences (user_id)
SELECT id FROM user_profiles
ON CONFLICT (user_id) DO NOTHING;

-- 6. Skapa RPC för att uppdatera sin egen profil säkert
-- Uppdaterar job_role borttagen från signaturen (enl regel från användare) eller wait.
-- "En användare ska kunna redigera sin egen profil och sina egna notifikationsinställningar, men aldrig sin egen behörighetsroll."
-- Can a user edit their own JOB_ROLE? The instructions say "Admin/Superadmin ska kunna hantera andra användares yrkesroll...". But usually a user doesn't just change their own job title in a system unless authorized. Let's NOT allow them to change their own job_role in the self-update RPC, only admins can change job_roles.
CREATE OR REPLACE FUNCTION update_own_profile(
  p_first_name text,
  p_last_name text,
  p_name text,
  p_phone text
) RETURNS void AS $$
BEGIN
  UPDATE public.user_profiles
  SET 
    first_name = p_first_name,
    last_name = p_last_name,
    name = p_name,
    phone = p_phone,
    updated_at = now()
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
