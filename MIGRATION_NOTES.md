# Notas de Migración - Cédulas Catastrales

## Fecha: 2026-03-28

### 1. Nueva Tabla en Supabase

Se creó la tabla `codigos_cedula_catastral` para almacenar los códigos internos del municipio:

```sql
CREATE TABLE IF NOT EXISTS codigos_cedula_catastral (
  id BIGSERIAL PRIMARY KEY,
  clave_cata_completa VARCHAR(30) NOT NULL,
  clave_cata_corta VARCHAR(16) NOT NULL,
  codigo_interno INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cedula_clave_completa ON codigos_cedula_catastral(clave_cata_completa);
CREATE INDEX IF NOT EXISTS idx_cedula_clave_corta ON codigos_cedula_catastral(clave_cata_corta);
CREATE INDEX IF NOT EXISTS idx_cedula_codigo_interno ON codigos_cedula_catastral(codigo_interno);
```

### 2. Datos Importados

- **Fuente**: `C:\Users\Administrador\Documents\DATA_LOJA\indice_codigos_54656.json`
- **Total de registros**: 54,655 códigos internos
- **Claves únicas (16 caracteres)**: 53,124
- **Claves con prefijo 1101 (Loja)**: 52,872 (96.7%)

### 3. Relación con tabla predio_loja

La tabla se relaciona mediante:
```sql
LEFT JOIN codigos_cedula_catastral c
  ON predio_loja.clave_cata = c.clave_cata_corta
```

Aproximadamente el 82% de los predios en `predio_loja` tienen un código de cédula catastral disponible.

### 4. URL de Acceso

Los códigos permiten acceder a las cédulas catastrales oficiales del municipio:
```
https://www.loja.gob.ec/ktastro/code/{codigo_interno}
```

### 5. Scripts Utilizados

Los siguientes scripts fueron creados para la migración (no incluidos en el repo por su tamaño):

- `gen_migration.cjs` - Genera SQL desde JSON
- `load_cedulas_data.cjs` - Prepara batches para carga
- `migration_batches/` - 55 archivos SQL de 1,000 registros cada uno
- `combined_batches_upload/` - 6 archivos combinados de ~10,000 registros

### 6. Notas Técnicas

- Se detectó 1 clave con 28 caracteres (en lugar de 19)
- La columna `clave_cata_completa` se ajustó a VARCHAR(30) para acomodarla
- Migración aplicada manualmente vía Supabase Dashboard
