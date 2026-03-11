-- =============================================================================
-- ROLLBACK FASE 1: Revertir creación de avaluos.valor_suelo_base
-- =============================================================================
-- Objetivo: Eliminar tabla avaluos.valor_suelo_base y schema avaluos
--           (si está vacío), restaurando al estado pre-migración.
-- 
-- IMPORTANTE: 
--   - Este script elimina completamente la tabla y sus datos
--   - Si hay datos en otras tablas del schema avaluos, el DROP SCHEMA fallará
--     (comportamiento esperado para evitar pérdida de datos)
--
-- Uso:
--   Ejecutar en Supabase SQL Editor si necesitas revertir Fase 1
--
-- Fecha: 2025-03-09
-- Autor: TerrainLOX Migration Team
-- Versión: 1.1
-- =============================================================================

BEGIN;

DO $$
DECLARE
    v_count_before INTEGER;
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '🔄 INICIANDO ROLLBACK DE FASE 1';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    
    -- Verificar si la tabla existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'avaluos' AND table_name = 'valor_suelo_base'
    ) THEN
        -- Contar registros antes de eliminar
        SELECT COUNT(*) INTO v_count_before FROM avaluos.valor_suelo_base;
        RAISE NOTICE '📊 Registros en valor_suelo_base: %', v_count_before;
        
        -- Eliminar tabla
        DROP TABLE IF EXISTS avaluos.valor_suelo_base CASCADE;
        RAISE NOTICE '✅ Tabla avaluos.valor_suelo_base eliminada';
    ELSE
        RAISE NOTICE '⚠️  Tabla avaluos.valor_suelo_base no existe (nada que revertir)';
    END IF;
    
    -- Intentar eliminar schema (solo si está vacío)
    IF EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = 'avaluos'
    ) THEN
        BEGIN
            DROP SCHEMA avaluos;
            RAISE NOTICE '✅ Schema avaluos eliminado (estaba vacío)';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '⚠️  Schema avaluos NO eliminado (contiene otras tablas o dependencias)';
            RAISE NOTICE '   Esto es normal si ya ejecutaste Fase 2+. Schema se mantendrá.';
        END;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ ROLLBACK FASE 1 COMPLETADO';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Estado actual:';
    RAISE NOTICE '   - Tabla avaluos.valor_suelo_base: ELIMINADA';
    RAISE NOTICE '   - Base de datos restaurada al estado inicial';
    RAISE NOTICE '';
    RAISE NOTICE '♻️  Si necesitas re-ejecutar Fase 1:';
    RAISE NOTICE '   Ejecuta nuevamente: sql/migrations/001_refactor_costos_manzana.sql';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

COMMIT;
