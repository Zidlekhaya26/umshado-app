-- ============================================================================
-- Migration 018: uMshado Community Feed
-- ============================================================================
-- Tables:
--   1. community_posts     — public posts by couples
--   2. community_likes     — per-user likes (deduplicated)
--   3. community_comments  — comments on posts
-- Storage:
--   community-images       — public bucket for compressed post images
-- ============================================================================

-- ============================================================================
-- TABLE 1: community_posts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.community_posts (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author         text        NOT NULL,
  category       text        NOT NULL DEFAULT 'general',
  content        text        NOT NULL,
  image_url      text,
  likes_count    integer     NOT NULL DEFAULT 0,
  comments_count integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all posts
DROP POLICY IF EXISTS "community_posts: anyone authenticated can read" ON public.community_posts;
CREATE POLICY "community_posts: anyone authenticated can read"
ON public.community_posts FOR SELECT
TO authenticated USING (true);

-- Users can only insert their own posts
DROP POLICY IF EXISTS "community_posts: authenticated insert own" ON public.community_posts;
CREATE POLICY "community_posts: authenticated insert own"
ON public.community_posts FOR INSERT
TO authenticated WITH CHECK (user_id = auth.uid());

-- Users can only delete their own posts
DROP POLICY IF EXISTS "community_posts: authenticated delete own" ON public.community_posts;
CREATE POLICY "community_posts: authenticated delete own"
ON public.community_posts FOR DELETE
TO authenticated USING (user_id = auth.uid());

-- System can update counts via triggers (using SECURITY DEFINER function)
DROP POLICY IF EXISTS "community_posts: authenticated update own" ON public.community_posts;
CREATE POLICY "community_posts: authenticated update own"
ON public.community_posts FOR UPDATE
TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- TABLE 2: community_likes
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.community_likes (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_likes: authenticated read all" ON public.community_likes;
CREATE POLICY "community_likes: authenticated read all"
ON public.community_likes FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "community_likes: authenticated insert own" ON public.community_likes;
CREATE POLICY "community_likes: authenticated insert own"
ON public.community_likes FOR INSERT
TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_likes: authenticated delete own" ON public.community_likes;
CREATE POLICY "community_likes: authenticated delete own"
ON public.community_likes FOR DELETE
TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- TABLE 3: community_comments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.community_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid        NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author     text        NOT NULL,
  content    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_comments: authenticated read all" ON public.community_comments;
CREATE POLICY "community_comments: authenticated read all"
ON public.community_comments FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "community_comments: authenticated insert own" ON public.community_comments;
CREATE POLICY "community_comments: authenticated insert own"
ON public.community_comments FOR INSERT
TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_comments: authenticated delete own" ON public.community_comments;
CREATE POLICY "community_comments: authenticated delete own"
ON public.community_comments FOR DELETE
TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- TRIGGERS: keep likes_count and comments_count in sync
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_community_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_likes_count ON public.community_likes;
CREATE TRIGGER trg_sync_likes_count
AFTER INSERT OR DELETE ON public.community_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_community_likes_count();

CREATE OR REPLACE FUNCTION public.sync_community_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts
    SET comments_count = comments_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts
    SET comments_count = GREATEST(0, comments_count - 1)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_comments_count ON public.community_comments;
CREATE TRIGGER trg_sync_comments_count
AFTER INSERT OR DELETE ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_community_comments_count();

-- ==========================================================================
-- Trigger: stamp authoritative author name from profiles + couples
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.set_community_author()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_full text;
  v_partner text;
BEGIN
  -- Try to fetch profile full_name and couple partner_name for this user
  SELECT p.full_name, c.partner_name
    INTO v_full, v_partner
    FROM public.profiles p
    LEFT JOIN public.couples c ON c.id = p.id
    WHERE p.id = COALESCE(NEW.user_id, NEW.user_id);

  IF v_full IS NULL THEN
    -- Fallback to simple placeholder
    NEW.author := COALESCE(NEW.author, 'Couple');
  ELSE
    IF v_partner IS NOT NULL AND v_partner <> '' THEN
      NEW.author := v_full || ' & ' || v_partner;
    ELSE
      NEW.author := v_full;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_author_posts ON public.community_posts;
CREATE TRIGGER trg_set_author_posts
BEFORE INSERT OR UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.set_community_author();

DROP TRIGGER IF EXISTS trg_set_author_comments ON public.community_comments;
CREATE TRIGGER trg_set_author_comments
BEFORE INSERT OR UPDATE ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.set_community_author();

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_community_posts_created
  ON public.community_posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_posts_user
  ON public.community_posts(user_id);

CREATE INDEX IF NOT EXISTS idx_community_posts_category
  ON public.community_posts(category);

CREATE INDEX IF NOT EXISTS idx_community_likes_post
  ON public.community_likes(post_id);

CREATE INDEX IF NOT EXISTS idx_community_likes_user
  ON public.community_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_community_comments_post
  ON public.community_comments(post_id, created_at);

-- ============================================================================
-- STORAGE BUCKET: community-images (public, images only, 5 MB max)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-images',
  'community-images',
  true,
  5242880,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to their own folder
DROP POLICY IF EXISTS "community-images: auth upload" ON storage.objects;
CREATE POLICY "community-images: auth upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'community-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Anyone (including anon) can view community images (public feed)
DROP POLICY IF EXISTS "community-images: public read" ON storage.objects;
CREATE POLICY "community-images: public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'community-images');

-- Users can delete their own images
DROP POLICY IF EXISTS "community-images: auth delete own" ON storage.objects;
CREATE POLICY "community-images: auth delete own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'community-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public'
--   AND tablename LIKE 'community_%';
-- -- Expected: community_posts, community_likes, community_comments
--
-- SELECT * FROM storage.buckets WHERE id = 'community-images';
-- ============================================================================
