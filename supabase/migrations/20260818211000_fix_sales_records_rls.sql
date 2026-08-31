-- 1. Grant table privileges to authenticated roles
GRANT SELECT, INSERT, UPDATE ON sales_records TO authenticated;


-- 2. Drop the overly broad existing policy
DROP POLICY IF EXISTS "Auth users can manage sales_records" ON sales_records;

-- 3. Create explicit policies for authenticated users
CREATE POLICY "authenticated_select_sales" 
  ON sales_records FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "authenticated_insert_sales" 
  ON sales_records FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "authenticated_update_sales" 
  ON sales_records FOR UPDATE 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- 4. Ensure anon users are explicitly denied by omission (no policies for anon)
