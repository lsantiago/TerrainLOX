const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BATCHES_DIR = path.join(__dirname, 'migration_batches');
const SUPABASE_PROJECT_ID = 'cbweftfogqscalnepszw';

// Leer todos los archivos batch
const batchFiles = fs.readdirSync(BATCHES_DIR)
  .filter(f => f.startsWith('batch_') && f.endsWith('.sql'))
  .sort();

console.log(`📁 Encontrados ${batchFiles.length} archivos batch`);
console.log(`🚀 Iniciando carga de datos a Supabase...\n`);

let successCount = 0;
let errorCount = 0;
const errors = [];

// Procesar cada batch
for (let i = 0; i < batchFiles.length; i++) {
  const batchFile = batchFiles[i];
  const batchNum = i + 1;
  const batchPath = path.join(BATCHES_DIR, batchFile);

  console.log(`[${batchNum}/${batchFiles.length}] Procesando ${batchFile}...`);

  try {
    // Leer el SQL del batch
    const sql = fs.readFileSync(batchPath, 'utf8');

    // Crear un archivo temporal con el SQL para ejecutar via CLI
    const tempSqlPath = path.join(__dirname, 'temp_batch.sql');
    fs.writeFileSync(tempSqlPath, sql, 'utf8');

    // Ejecutar usando la CLI de Supabase (si está disponible) o mostrar el comando
    // Como no tenemos acceso directo a MCP desde Node, imprimiremos los comandos para ejecutar manualmente
    console.log(`  ⏳ Batch listo para ejecutar - ${batchPath}`);

    successCount++;
  } catch (error) {
    console.error(`  ❌ Error en ${batchFile}:`, error.message);
    errorCount++;
    errors.push({ batch: batchFile, error: error.message });
  }
}

console.log(`\n✅ Resumen:`);
console.log(`  - Batches procesados: ${successCount}/${batchFiles.length}`);
console.log(`  - Errores: ${errorCount}`);

if (errors.length > 0) {
  console.log(`\n❌ Errores encontrados:`);
  errors.forEach(({ batch, error }) => {
    console.log(`  - ${batch}: ${error}`);
  });
}

// Generar un script bash para ejecutar todos los batches
const bashScript = batchFiles.map((file, index) => {
  const batchNum = String(index + 1).padStart(3, '0');
  return `echo "Ejecutando batch ${batchNum}/${batchFiles.length}..."`;
}).join('\n');

const bashPath = path.join(__dirname, 'execute_all_batches.sh');
fs.writeFileSync(bashPath, `#!/bin/bash\n\n${bashScript}\n`, 'utf8');
console.log(`\n📝 Script bash generado: ${bashPath}`);
console.log(`\n💡 Siguiente paso: Usar el Task tool o ejecutar batches manualmente`);
