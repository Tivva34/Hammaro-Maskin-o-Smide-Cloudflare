-- 1. Uppdatera befintliga traktorer
UPDATE machines
SET type = 'tractor'
WHERE category = 'tractor' AND type = 'Traktor';

-- 2. Uppdatera befintlig maskin som har type = 'Entreprenad'
UPDATE machines
SET category = 'construction', type = 'other'
WHERE category = 'other' AND type = 'Entreprenad';
