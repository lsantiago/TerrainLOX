# Actualización de Funciones RPC en Supabase

## Funciones a Actualizar

Las siguientes funciones RPC en Supabase necesitan incluir el campo `codigo_interno` de la tabla `codigos_cedula_catastral`:

### 1. `get_predios_geojson`

**Modificación necesaria**: Agregar LEFT JOIN con `codigos_cedula_catastral`

```sql
-- En el SELECT, agregar:
SELECT
  p.*,
  c.codigo_interno,
  ST_AsGeoJSON(p.geom)::json as geometry
FROM predio_loja p
LEFT JOIN codigos_cedula_catastral c ON p.clave_cata = c.clave_cata_corta
WHERE ...
```

### 2. `get_predio_geojson`

**Modificación necesaria**: Igual que arriba

```sql
SELECT
  p.*,
  c.codigo_interno,
  ST_AsGeoJSON(p.geom)::json as geometry
FROM predio_loja p
LEFT JOIN codigos_cedula_catastral c ON p.clave_cata = c.clave_cata_corta
WHERE p.id = p_id
```

### 3. `search_predios_by_clave`

**Modificación necesaria**: Si existe, agregar el mismo LEFT JOIN

## Pasos para Actualizar

1. Ir a Supabase Dashboard → SQL Editor
2. Ejecutar `\df` o buscar las funciones en Database → Functions
3. Copiar la definición actual de cada función
4. Agregar el LEFT JOIN y el campo `codigo_interno` en el SELECT
5. Ejecutar `CREATE OR REPLACE FUNCTION ...` con el código actualizado

## Verificación

Después de actualizar, verificar que el GeoJSON incluya el campo:

```javascript
{
  "type": "Feature",
  "properties": {
    "id": 123,
    "clave_cata": "1101060303313001",
    "codigo_interno": 92983,  // ← Este campo debe aparecer
    ...
  },
  "geometry": {...}
}
```
