-- v3 §3: a separate cover image per unit + an album of photos and videos.

ALTER TABLE units
  ADD COLUMN cover_path_base text,
  ADD COLUMN cover_width     int,
  ADD COLUMN cover_height    int,
  ADD COLUMN cover_color     text,
  ADD COLUMN cover_focal_x   real NOT NULL DEFAULT 50 CHECK (cover_focal_x BETWEEN 0 AND 100),
  ADD COLUMN cover_focal_y   real NOT NULL DEFAULT 50 CHECK (cover_focal_y BETWEEN 0 AND 100);

ALTER TABLE unit_media
  ADD COLUMN kind             text NOT NULL DEFAULT 'Image' CHECK (kind IN ('Image','Video')),
  ADD COLUMN status           text NOT NULL DEFAULT 'Ready' CHECK (status IN ('Processing','Ready','Failed')),
  ADD COLUMN caption          text CHECK (char_length(caption) <= 120),
  ADD COLUMN is_active        boolean NOT NULL DEFAULT true,
  ADD COLUMN color            text,
  ADD COLUMN video_path       text,          -- units/{id}/{key}-720.mp4 (and -1080.mp4 when the source is large enough)
  ADD COLUMN video_hd         boolean NOT NULL DEFAULT false,
  ADD COLUMN duration_seconds int,
  ADD COLUMN size_bytes       bigint;

-- Existing data: the old "is_cover" photo becomes the dedicated cover (it also stays in the album).
UPDATE units u SET cover_path_base = m.path_base, cover_width = m.width, cover_height = m.height
  FROM unit_media m WHERE m.unit_id = u.id AND m.is_cover AND u.cover_path_base IS NULL;
