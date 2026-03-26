-- Playlist songs: couple's curated song list with moment/course tagging
CREATE TABLE IF NOT EXISTS playlist_songs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id   uuid NOT NULL,
  title       text NOT NULL,
  artist      text,
  moment      text,  -- 'entrance','first_dance','dinner','party','exit', etc.
  notes       text,
  sort_order  int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Playlist requests: guest song requests
CREATE TABLE IF NOT EXISTS playlist_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id    uuid NOT NULL,
  title        text NOT NULL,
  artist       text,
  requested_by text,
  approved     boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE playlist_songs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "couple owns playlist songs"
  ON playlist_songs FOR ALL
  USING (auth.uid() = couple_id)
  WITH CHECK (auth.uid() = couple_id);

CREATE POLICY "couple owns playlist requests"
  ON playlist_requests FOR ALL
  USING (auth.uid() = couple_id)
  WITH CHECK (auth.uid() = couple_id);
