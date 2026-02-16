-- ============================================
-- Migracion: Apuntar a predio_loja
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- 1. Recrear tabla favoritos apuntando a predio_loja
DROP TABLE IF EXISTS public.favoritos;

CREATE TABLE public.favoritos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  predio_id INTEGER NOT NULL REFERENCES public.predio_loja(gid) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, predio_id)
);

ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON public.favoritos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON public.favoritos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON public.favoritos FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.favoritos TO authenticated;

-- 2. Recrear funciones RPC apuntando a predio_loja (PK = gid)
CREATE OR REPLACE FUNCTION public.get_predios_geojson(
  min_lng DOUBLE PRECISION,
  min_lat DOUBLE PRECISION,
  max_lng DOUBLE PRECISION,
  max_lat DOUBLE PRECISION
)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(
      json_build_object(
        'type', 'Feature',
        'id', p.gid,
        'geometry', ST_AsGeoJSON(ST_Transform(p.geom, 4326))::json,
        'properties', json_build_object(
          'id', p.gid,
          'clave_cata', p.clave_cata,
          'prov_cant', p.prov_cant,
          'parroquia', p.parroquia,
          'zona', p.zona,
          'sector', p.sector,
          'manzana', p.manzana,
          'lote', p.lote,
          'area_grafi', p.area_grafi,
          'area_gim', p.area_gim,
          'tipo_pred', p.tipo_pred,
          'reg_prop', p.reg_prop,
          'ocup_gim', p.ocup_gim,
          'barrio', p.barrio,
          'cedula', p.cedula,
          'fecha', p.fecha,
          'observacio', p.observacio,
          'ante_gim', p.ante_gim,
          'clave_rura', p.clave_rura
        )
      )
    ), '[]'::json)
  )
  FROM public.predio_loja p
  WHERE ST_Transform(p.geom, 4326) && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326);
$$;

-- 3. Buscar por clave catastral
CREATE OR REPLACE FUNCTION public.search_predios_by_clave(clave TEXT)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(
      json_build_object(
        'type', 'Feature',
        'id', p.gid,
        'geometry', ST_AsGeoJSON(ST_Transform(p.geom, 4326))::json,
        'properties', json_build_object(
          'id', p.gid,
          'clave_cata', p.clave_cata,
          'prov_cant', p.prov_cant,
          'parroquia', p.parroquia,
          'zona', p.zona,
          'sector', p.sector,
          'manzana', p.manzana,
          'lote', p.lote,
          'area_grafi', p.area_grafi,
          'area_gim', p.area_gim,
          'tipo_pred', p.tipo_pred,
          'reg_prop', p.reg_prop,
          'ocup_gim', p.ocup_gim,
          'barrio', p.barrio,
          'cedula', p.cedula,
          'fecha', p.fecha,
          'observacio', p.observacio,
          'ante_gim', p.ante_gim,
          'clave_rura', p.clave_rura
        )
      )
    ), '[]'::json)
  )
  FROM public.predio_loja p
  WHERE p.clave_cata ILIKE '%' || clave || '%';
$$;

-- 4. Obtener un predio individual
CREATE OR REPLACE FUNCTION public.get_predio_geojson(p_id BIGINT)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'type', 'Feature',
    'id', p.gid,
    'geometry', ST_AsGeoJSON(ST_Transform(p.geom, 4326))::json,
    'properties', json_build_object(
      'id', p.gid,
      'clave_cata', p.clave_cata,
      'prov_cant', p.prov_cant,
      'parroquia', p.parroquia,
      'zona', p.zona,
      'sector', p.sector,
      'manzana', p.manzana,
      'lote', p.lote,
      'area_grafi', p.area_grafi,
      'area_gim', p.area_gim,
      'tipo_pred', p.tipo_pred,
      'reg_prop', p.reg_prop,
      'ocup_gim', p.ocup_gim,
      'barrio', p.barrio,
      'cedula', p.cedula,
      'fecha', p.fecha,
      'observacio', p.observacio,
      'ante_gim', p.ante_gim,
      'clave_rura', p.clave_rura
    )
  )
  FROM public.predio_loja p
  WHERE p.gid = p_id;
$$;

-- 5. Permisos
GRANT EXECUTE ON FUNCTION public.get_predios_geojson TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.search_predios_by_clave TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_predio_geojson TO authenticated, anon;
GRANT SELECT ON public.predio_loja TO authenticated, anon;
