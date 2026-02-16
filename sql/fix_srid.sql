-- ============================================
-- Fix: SRID 0 -> 4326 (las coordenadas ya estan en WGS84)
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- 1. Asignar SRID 4326 a la columna geom de predio_loja
ALTER TABLE public.predio_loja
  ALTER COLUMN geom TYPE geometry(MultiPolygon, 4326)
  USING ST_SetSRID(geom, 4326);

-- 2. Recrear funciones RPC sin ST_Transform (ya no es necesario)
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
        'geometry', ST_AsGeoJSON(p.geom)::json,
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
  WHERE p.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326);
$$;

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
        'geometry', ST_AsGeoJSON(p.geom)::json,
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

CREATE OR REPLACE FUNCTION public.get_predio_geojson(p_id BIGINT)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'type', 'Feature',
    'id', p.gid,
    'geometry', ST_AsGeoJSON(p.geom)::json,
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

GRANT EXECUTE ON FUNCTION public.get_predios_geojson TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.search_predios_by_clave TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_predio_geojson TO authenticated, anon;
