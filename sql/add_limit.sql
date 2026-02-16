-- Agregar LIMIT a get_predios_geojson para evitar sobrecarga
-- Ejecutar en el SQL Editor de Supabase

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
    'features', COALESCE(json_agg(f.feature), '[]'::json)
  )
  FROM (
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
    ) AS feature
    FROM public.predio_loja p
    WHERE p.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    LIMIT 1500
  ) f;
$$;
