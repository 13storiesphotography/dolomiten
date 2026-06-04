-- Bildauschnitt für Location-Vorschau (CSS background-position, z. B. "42.5% 60.0%")
ALTER TABLE locations ADD COLUMN IF NOT EXISTS image_focus text;

COMMENT ON COLUMN locations.image_focus IS 'Fokuspunkt für image_url-Vorschau (Prozent, z. B. 50% 50%)';
