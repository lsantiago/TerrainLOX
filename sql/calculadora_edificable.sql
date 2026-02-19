-- Calculadora Edificable: Fix SRID + RPC functions
-- Run this in Supabase SQL Editor

-- ============================================
-- Fix SRID 0 -> 4326 on clasificacion_suelo and limites_barriales
-- (same issue that predio_loja had before fix_srid.sql)
-- ============================================

-- clasificacion_suelo has Z dimension (3D), strip it with ST_Force2D
ALTER TABLE public.clasificacion_suelo
  ALTER COLUMN geom TYPE geometry(MultiPolygon, 4326)
  USING ST_SetSRID(ST_Force2D(geom), 4326);

ALTER TABLE public.limites_barriales
  ALTER COLUMN geom TYPE geometry(MultiPolygon, 4326)
  USING ST_SetSRID(geom, 4326);

-- ============================================
-- RPC Functions
-- ============================================

-- 1) Get zoning data for a predio by intersecting with clasificacion_suelo
CREATE OR REPLACE FUNCTION get_zonificacion_predio(p_id integer)
RETURNS json AS $$
  SELECT json_build_object(
    'clasificacion', cs.clasificac,
    'subclasificacion', cs.subclasifi,
    'categoria', cs.categoria,
    'pit', cs.pit,
    'cod_pit', cs.cod_pit,
    'cos', cs.cos,
    'cus', cs.cus,
    'n_pisos', cs.n_pisos,
    'retiro_frontal', cs.retiro_fro,
    'retiro_lateral', cs.retiro_lat,
    'retiro_posterior', cs.retiro_pos,
    'lote_min', cs.lote_min,
    'frente_min', cs.frente_min,
    'implantacion', cs.implantaci,
    'edificabilidad', cs.edificabil,
    'uso_general', cs.uso_genera,
    'uso_principal', cs.uso_princi,
    'uso_complementario', cs.uso_comple,
    'uso_restringido', cs.uso_restri,
    'uso_prohibido', cs.uso_prohib,
    'tratamiento', cs.tratamient,
    'densidad_bruta', cs.densidad_b,
    'densidad_neta', cs.densidad_n,
    'fondo', cs.fondo
  )
  FROM predio_loja p
  JOIN clasificacion_suelo cs ON ST_Intersects(p.geom, cs.geom)
  WHERE p.gid = p_id
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- 2) Get limites_barriales as GeoJSON FeatureCollection
CREATE OR REPLACE FUNCTION get_limites_barriales_geojson()
RETURNS json AS $$
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(
      json_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(lb.geom)::json,
        'properties', json_build_object(
          'id', lb.gid,
          'barrio', lb.barrio,
          'parroquia', lb.parroquia,
          'clasificacion', lb.clasificac,
          'poblacion', lb.poblacion,
          'densidad', lb.densidad
        )
      )
    ), '[]'::json)
  )
  FROM limites_barriales lb;
$$ LANGUAGE sql STABLE;

-- 3) Get aptitud fisico constructiva for a predio
-- Strip Z dimension (3D -> 2D) first time only:
-- ALTER TABLE public.aptitud_fisico_constructiva
--   ALTER COLUMN geom TYPE geometry(MultiPolygon, 4326)
--   USING ST_SetSRID(ST_Force2D(geom), 4326);

CREATE OR REPLACE FUNCTION get_aptitud_predio(p_id integer)
RETURNS json AS $$
  SELECT json_build_object(
    'aptitud', afc.aptitud,
    'amenazas', afc.amenazas,
    'estudios', afc.estudios,
    'observacion_1', afc.observac_1,
    'observacion_2', afc.observac_2
  )
  FROM predio_loja p
  JOIN aptitud_fisico_constructiva afc ON ST_Intersects(p.geom, afc.geom)
  WHERE p.gid = p_id
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- 4) Get limites_parroquias as GeoJSON FeatureCollection
-- Strip Z/M dimension and fix SRID first time only:
-- ALTER TABLE public.limites_parroquias
--   ALTER COLUMN geom TYPE geometry(MultiPolygon, 4326)
--   USING ST_SetSRID(ST_Force2D(geom), 4326);

CREATE OR REPLACE FUNCTION get_limites_parroquias_geojson()
RETURNS json AS $$
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(
      json_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(lp.geom)::json,
        'properties', json_build_object(
          'id', lp.gid,
          'parroquia', lp.parroquia,
          'subclasificacion', lp.subclasifi
        )
      )
    ), '[]'::json)
  )
  FROM limites_parroquias lp;
$$ LANGUAGE sql STABLE;

-- 5) Get parroquia name for a predio by spatial intersection
CREATE OR REPLACE FUNCTION get_parroquia_predio(p_id integer)
RETURNS json AS $$
  SELECT json_build_object(
    'parroquia', lp.parroquia,
    'subclasificacion', lp.subclasifi
  )
  FROM predio_loja p
  JOIN limites_parroquias lp ON ST_Intersects(p.geom, lp.geom)
  WHERE p.gid = p_id
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Grant access
GRANT EXECUTE ON FUNCTION public.get_zonificacion_predio TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_limites_barriales_geojson TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_aptitud_predio TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_limites_parroquias_geojson TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_parroquia_predio TO authenticated, anon;
