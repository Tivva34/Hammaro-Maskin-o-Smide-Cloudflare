-- Mappar befintliga maskiner av typen "Traktor" till den nya kategorin "tractor"
UPDATE machines
SET category = 'tractor'
WHERE type = 'Traktor';
