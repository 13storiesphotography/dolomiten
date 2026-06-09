-- Optionaler Anzeigename (Listen); name = offizieller Ortsname
ALTER TABLE locations ADD COLUMN IF NOT EXISTS display_name text;

COMMENT ON COLUMN locations.display_name IS 'Optionaler eigener Name in Listen; leer = name';
