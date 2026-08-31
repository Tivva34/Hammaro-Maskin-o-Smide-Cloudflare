-- Lägger till 'category'-kolumnen.
-- Sätter default till 'other' så att befintliga maskiner får en standardkategori.
ALTER TABLE machines
ADD COLUMN category text NOT NULL DEFAULT 'other';
