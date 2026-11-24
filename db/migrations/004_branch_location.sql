-- v3 §4: branch coordinates for the map section (filled from a Google Maps link or typed in).
ALTER TABLE branches
  ADD COLUMN lat     double precision CHECK (lat BETWEEN -90 AND 90),
  ADD COLUMN lng     double precision CHECK (lng BETWEEN -180 AND 180),
  ADD COLUMN address text CHECK (char_length(address) <= 200);
