# 📂 SQL Migrations - Avalúos y PUGS Integration

Scripts de migración para integración de avalúos catastrales y normativa PUGS en TerrainLOX.

## 📋 Índice de Migraciones

| # | Fase | Descripción | Script | Rollback | Estado |
|---|------|-------------|--------|----------|--------|
| 001 | Fase 1 | Crear `avaluos.valor_suelo_base` con datos Tabla 3 | [001_refactor_costos_manzana.sql](001_refactor_costos_manzana.sql) | [001_rollback.sql](001_rollback.sql) | ✅ Listo |
| 002 | Fase 2 | Mapping `codigo_sh` ↔ clave catastral | 002_create_codigo_sh_mapping.sql | 002_rollback.sql | ⏳ Pendiente |
| 003 | Fase 3 | Catálogo de factores (Tablas 4-13) | 003_create_factor_catalogo.sql | 003_rollback.sql | ⏳ Pendiente |
| 004 | Fase 3 | Valores de factores | 004_create_factor_valor.sql | 004_rollback.sql | ⏳ Pendiente |
| 005 | Fase 4 | Componentes de construcción (Tabla 14) | 005_create_construccion.sql | 005_rollback.sql | ⏳ Pendiente |
| 006 | Fase 4 | Depreciación (Tabla 15) | 006_create_depreciacion.sql | 006_rollback.sql | ⏳ Pendiente |
| 007 | Fase 5 | Normativa PUGS (Tablas 8-24) | 007_create_pugs_tables.sql | 007_rollback.sql | ⏳ Pendiente |
| 008-011 | Fase 6 | Población de datos (ETL) | 008_populate_*.sql | 008-011_rollback.sql | ⏳ Pendiente |
| 012 | Fase 7 | RPC `calculate_predio_valuation` | 012_rpc_calculate_predio_valuation.sql | 012_rollback.sql | ⏳ Pendiente |
| 013 | Fase 8 | RPC `get_pugs_pit_rules` | 013_rpc_get_pugs_pit_rules.sql | 013_rollback.sql | ⏳ Pendiente |

---

## 🚀 Cómo Ejecutar una Migración

### Pre-requisitos

1. **Backup completado**: Ver [informacion/backups/INSTRUCCIONES_BACKUP.md](../../informacion/backups/INSTRUCCIONES_BACKUP.md)
2. **Rama Git activa**: `feature/avaluos-pugs-integration`
3. **Acceso a Supabase Dashboard**: SQL Editor disponible

### Pasos de Ejecución

#### 1. Abrir SQL Editor en Supabase

1. Ir a: https://supabase.com/dashboard
2. Seleccionar proyecto: **TerrainLOX**
3. Menú lateral → **SQL Editor**
4. Click en **New Query**

#### 2. Copiar y Ejecutar Script

```sql
-- Abrir el archivo de migración (ej: 001_refactor_costos_manzana.sql)
-- Copiar TODO el contenido
-- Pegar en SQL Editor
-- Click en "Run" (o Ctrl+Enter)
```

#### 3. Validar Resultados

Los scripts incluyen mensajes de validación automáticos. Ejemplo:

```
NOTICE: ╔════════════════════════════════════════╗
NOTICE: ║   VALIDACIÓN DE MIGRACIÓN - FASE 1    ║
NOTICE: ╠════════════════════════════════════════╣
NOTICE: ║ Registros en costos_manzana:      304 ║
NOTICE: ║ Registros en valor_suelo_base:    304 ║
NOTICE: ╚════════════════════════════════════════╝
NOTICE: ✅ Validación completada exitosamente.
```

#### 4. Verificación Manual

Ejecutar query de prueba:

```sql
-- Verificar datos migrados
SELECT * FROM avaluos.valor_suelo_base 
ORDER BY codigo_sh 
LIMIT 10;

-- Contar registros
SELECT COUNT(*) FROM avaluos.valor_suelo_base;
-- Debe retornar: 304

-- Validar rangos
SELECT 
    MIN(codigo_sh) as min_codigo,
    MAX(codigo_sh) as max_codigo,
    MIN(valor_m2) as min_valor,
    MAX(valor_m2) as max_valor
FROM avaluos.valor_suelo_base;
-- Esperado: min=1, max=304, valores ~73-336
```

#### 5. Commit Git

```bash
git add sql/migrations/001_*.sql
git commit -m "feat(db): Fase 1 - Refactorizar costos_manzana a valor_suelo_base"
```

---

## 🔄 Cómo Revertir una Migración (Rollback)

### Opción A: Script de Rollback

```sql
-- En Supabase SQL Editor
-- Abrir archivo 001_rollback.sql
-- Copiar TODO el contenido
-- Pegar y ejecutar
```

### Opción B: Restaurar desde Backup CSV

Si el rollback falla:

1. Abrir Supabase Dashboard → **Table Editor**
2. Seleccionar tabla `costos_manzana`
3. Verificar que los 304 registros siguen intactos
4. Si `valor_suelo_base` está corrupta:
   ```sql
   DROP TABLE IF EXISTS avaluos.valor_suelo_base CASCADE;
   ```
5. Re-ejecutar migración desde backup

### Opción C: Rollback Git

```bash
# Ver commit de la migración
git log --oneline

# Revertir commit específico
git revert <commit-hash>

# O resetear rama completa
git reset --hard origin/main
```

---

## 📊 Validaciones Críticas por Fase

### Fase 1 (Actual)
- [ ] `SELECT COUNT(*) FROM avaluos.valor_suelo_base` = 304
- [ ] Sin valores NULL en `codigo_sh`, `valor_m2`
- [ ] Rango de valores: 73–336 USD/m²
- [ ] Schema `avaluos` creado correctamente

### Fase 2 (Próxima)
- [ ] `codigo_sh_a_manzana_catastral` con al menos 100 códigos mapeados
- [ ] FK hacia `valor_suelo_base` válida
- [ ] Test: Dado `clave_cata`, obtener `codigo_sh` correcto

### Fases 3-5
- [ ] Estructura de tablas creada sin errores FK
- [ ] Índices creados correctamente
- [ ] Sin datos aún (solo DDL)

### Fase 6 (Crítica)
- [ ] **Muestreo de 10 predios**: Avalúo manual vs. BD (diff < 0.5%)
- [ ] Todos los registros con FK válidas
- [ ] PDF vs. BD: spot-check de 20 filas por tabla

### Fases 7-8
- [ ] RPC ejecuta sin errores en 10 predios de prueba
- [ ] JSON response válido
- [ ] Performance < 1 seg por predio

### Fases 9-10
- [ ] Frontend muestra avalúo correcto
- [ ] RPCs existentes intactos (no regression)
- [ ] Mobile + Desktop rendering OK

---

## ⚠️ Troubleshooting

### Error: "relation avaluos.valor_suelo_base already exists"

**Causa:** Script ejecutado múltiples veces.

**Solución:** El script tiene protección con `ON CONFLICT DO NOTHING`. Si el error persiste:
```sql
-- Verificar datos existentes
SELECT COUNT(*) FROM avaluos.valor_suelo_base;

-- Si está OK (304 registros), continuar a siguiente fase
-- Si está corrupta o incompleta, ejecutar rollback y reintentar
```

### Error: "permission denied for schema avaluos"

**Causa:** Usuario actual no tiene permisos CREATE en schema.

**Solución:** Ejecutar como usuario admin de Supabase (postgres/service_role).

### Error: "constraint ... already exists"

**Causa:** Ejecución parcial previa.

**Solución:**
```sql
-- Ejecutar rollback completo
\i sql/migrations/001_rollback.sql

-- Re-ejecutar migración limpia
\i sql/migrations/001_refactor_costos_manzana.sql
```

### Warning: "Valores fuera de rango esperado"

**Causa:** Datos en `costos_manzana` con valores atípicos.

**Acción:** 
1. Investigar registros anómalos:
   ```sql
   SELECT * FROM avaluos.valor_suelo_base 
   WHERE valor_m2 < 50 OR valor_m2 > 500;
   ```
2. Validar contra PDF original (Tabla 3)
3. Corregir manualmente si es error de datos

---

## 📝 Convenciones

- **Nombres de archivo**: `{número}_descripción.sql`, `{número}_rollback.sql`
- **Numeración**: 001, 002, 003... (3 dígitos, con padding)
- **Commits Git**: `feat(db): Fase N - Descripción corta`
- **Comentarios**: Bloques con 80 columnas, ASCII art para secciones
- **Validación**: Todos los scripts incluyen bloque `DO $$ ... END $$` de validación

---

## 🔗 Enlaces Útiles

- [Documentación Supabase - SQL Editor](https://supabase.com/docs/guides/database/sql-editor)
- [PostGIS - Spatial Functions](https://postgis.net/docs/reference.html)
- [Ordenanza 0060-2023 (Avalúos)](../../informacion/ordenanza_0060_2023_predio_urbano_2024_v._01-signed.pdf)
- [Ordenanza PUGS 2023-2033](../../informacion/ordenanza_actualizacion_pdot_-_pugs_7-signed-signed-signed-signed-signed_1.pdf)

---

**Última actualización:** 2025-03-09  
**Versión:** 1.0  
**Contacto:** TerrainLOX Migration Team
