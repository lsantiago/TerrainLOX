-- Migration: add rich metadata columns to favoritos
ALTER TABLE public.favoritos
  ADD COLUMN IF NOT EXISTS precio          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS telefono        TEXT,
  ADD COLUMN IF NOT EXISTS contacto        TEXT,
  ADD COLUMN IF NOT EXISTS email_contacto  TEXT,
  ADD COLUMN IF NOT EXISTS notas           TEXT,
  ADD COLUMN IF NOT EXISTS servicios       TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS caracteristicas TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estado          TEXT DEFAULT 'Consultado',
  ADD COLUMN IF NOT EXISTS calificacion    SMALLINT CHECK (calificacion BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS ultima_visita   DATE;

-- Add UPDATE policy (was missing)
CREATE POLICY "Users can update own favorites"
  ON public.favoritos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
