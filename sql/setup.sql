-- ============================================
-- TERRAIN LOX - SQL Setup
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- 1. Tabla de favoritos
CREATE TABLE IF NOT EXISTS public.favoritos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  predio_id BIGINT NOT NULL REFERENCES public.predios_urbanos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, predio_id)
);

-- 2. Habilitar RLS en favoritos
ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

-- 3. Politicas RLS: cada usuario solo ve/modifica sus favoritos
CREATE POLICY "Users can view own favorites"
  ON public.favoritos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON public.favoritos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON public.favoritos FOR DELETE
  USING (auth.uid() = user_id);

-- 4. RPC: Obtener predios como GeoJSON dentro de un bounding box
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
        'id', p.id,
        'geometry', ST_AsGeoJSON(p.geom)::json,
        'properties', json_build_object(
          'id', p.id,
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
  FROM public.predios_urbanos p
  WHERE p.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326);
$$;

-- 5. RPC: Buscar predios por clave catastral
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
        'id', p.id,
        'geometry', ST_AsGeoJSON(p.geom)::json,
        'properties', json_build_object(
          'id', p.id,
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
  FROM public.predios_urbanos p
  WHERE p.clave_cata ILIKE '%' || clave || '%';
$$;

-- 6. RPC: Obtener un predio individual como GeoJSON (para zoom)
CREATE OR REPLACE FUNCTION public.get_predio_geojson(p_id BIGINT)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'type', 'Feature',
    'id', p.id,
    'geometry', ST_AsGeoJSON(p.geom)::json,
    'properties', json_build_object(
      'id', p.id,
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
  FROM public.predios_urbanos p
  WHERE p.id = p_id;
$$;

-- 7. Dar acceso a las funciones RPC para usuarios autenticados y anon
GRANT EXECUTE ON FUNCTION public.get_predios_geojson TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.search_predios_by_clave TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_predio_geojson TO authenticated, anon;

-- 8. Permisos en la tabla favoritos
GRANT SELECT, INSERT, DELETE ON public.favoritos TO authenticated;

-- 9. Permisos de lectura en predios_urbanos (si no estan ya)
GRANT SELECT ON public.predios_urbanos TO authenticated, anon;
