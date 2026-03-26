-- Wedding menu planner: couple's menu items per course
CREATE TABLE IF NOT EXISTS wedding_menu (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id      uuid NOT NULL,
  course         text NOT NULL,  -- 'starter','main','dessert','drinks','kids','dietary'
  name           text NOT NULL,
  description    text,
  dietary_notes  text,
  sort_order     int DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE wedding_menu ENABLE ROW LEVEL SECURITY;

CREATE POLICY "couple owns wedding menu"
  ON wedding_menu FOR ALL
  USING (auth.uid() = couple_id)
  WITH CHECK (auth.uid() = couple_id);
