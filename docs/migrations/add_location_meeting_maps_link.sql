-- Eigener Google-Maps-Link für abweichenden Treffpunkt (Location-Bibliothek)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS meeting_maps_link text;

COMMENT ON COLUMN locations.meeting_maps_link IS 'Maps-Link nur für Treffpunkt, wenn abweichend von locations.maps_link';
