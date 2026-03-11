# INSTRUCCIONES DE BACKUP - FASE 0

## ⚠️ IMPORTANTE: Ejecutar ANTES de aplicar migraciones

### Estado Actual de Backups

✅ **YA COMPLETADO:**
- `favoritos`: Respaldado como CSV
- `predio_loja`: Datos originales en Supabase (no requiere backup adicional)
- `clasificacion_suelo`: Datos originales en Supabase (no requiere backup adicional)

**NOTA:** La tabla `costos_manzana` NO existe actualmente en Supabase.
           Los datos (304 sectores) se cargarán directamente desde `sql/costos_manzanas_loja.sql`.

---

### 1. Validación Rápida (Opcional pero Recomendado)

Solo necesitas **verificar el estado actual** antes de la migración:

### 1. Validación Rápida (Opcional pero Recomendado)

Solo necesitas **verificar el estado actual** antes de la migración:

Ejecuta en **Supabase SQL Editor**:

```sql
-- Contar registros existentes
SELECT 
  'predio_loja' as tabla, COUNT(*) as registros FROM predio_loja
UNION ALL
SELECT 'clasificacion_suelo', COUNT(*) FROM clasificacion_suelo
UNION ALL
SELECT 'favoritos', COUNT(*) FROM favoritos;

-- Verificar que NO existe tabla costos_manzana (correcto)
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'costos_manzana'
) as costos_manzana_existe;
-- Resultado esperado: false

-- Verificar que NO existe schema avaluos (correcto)
SELECT EXISTS (
  SELECT FROM information_schema.schemata 
  WHERE schema_name = 'avaluos'
) as avaluos_existe;
-- Resultado esperado: false
```

**Resultados esperados:**
- predio_loja: ~30,000 registros ✅
- clasificacion_suelo: ~200 registros ✅
- favoritos: variable (ya respaldado) ✅
- costos_manzana_existe: **false** ✅
- avaluos_existe: **false** ✅

---

### 2. Registro de Validación (Checklist Rápido)

- [x] Backup de favoritos completado (CSV existente)
- [x] predio_loja con datos originales en Supabase
- [x] clasificacion_suelo con datos originales en Supabase
- [ ] Validación SQL ejecutada: conteo de registros OK
- [ ] Confirmado: schema `avaluos` NO existe (estado limpio)
- [x] Rama Git `feature/avaluos-pugs-integration` activa
- [x] Carpetas `sql/migrations/` e `informacion/backups/` creadas

**Fecha de validación:** _____________

**Conteo real:**
- predio_loja: _____________
- clasificacion_suelo: _____________
- favoritos: _____________ (respaldado)

---

## ✅ LISTO PARA MIGRACIÓN

Ya tienes todo preparado:
- ✅ Backups necesarios completados (favoritos)
- ✅ Datos originales verificados en Supabase (predio_loja, clasificacion_suelo)
- ✅ Rama Git activa: `feature/avaluos-pugs-integration`
- ✅ Scripts de migración listos

**Puedes proceder directamente a ejecutar:**
📄 `sql/migrations/001_refactor_costos_manzana.sql` en Supabase SQL Editor

---

## 🔄 Restauración si algo sale mal

Si necesitas revertir Fase 1:

1. Ejecuta el script de rollback: `sql/migrations/001_rollback.sql`
2. Esto eliminará completamente la tabla `avaluos.valor_suelo_base`
3. Para volver al estado inicial:
   - No hay datos que restaurar (costos_manzana nunca existió)
   - Las tablas `predio_loja`, `clasificacion_suelo`, `favoritos` permanecen intactas

---

**Última actualización:** 2025-03-09
