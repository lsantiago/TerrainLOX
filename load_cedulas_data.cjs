const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuración de Supabase
const SUPABASE_PROJECT_ID = 'cbweftfogqscalnepszw';
const BATCH_SIZE = 1000;

// Leer el archivo JSON
const jsonPath = path.join('C:', 'Users', 'Administrador', 'Documents', 'DATA_LOJA', 'indice_codigos_54656.json');

console.log('📂 Leyendo JSON desde:', jsonPath);

let data;
try {
  const jsonContent = fs.readFileSync(jsonPath, 'utf8');
  data = JSON.parse(jsonContent);
  console.log('✅ JSON cargado correctamente');
  console.log('📊 Total de entradas:', Object.keys(data).length);
} catch (error) {
  console.error('❌ Error al leer JSON:', error.message);
  process.exit(1);
}

// Procesar datos
const entries = Object.entries(data);
const totalBatches = Math.ceil(entries.length / BATCH_SIZE);

console.log(`\n🔄 Procesando ${entries.length} registros en ${totalBatches} batches de ${BATCH_SIZE}`);

// Crear batches de SQL
const batches = [];
for (let i = 0; i < entries.length; i += BATCH_SIZE) {
  const batchEntries = entries.slice(i, i + BATCH_SIZE);
  const values = batchEntries.map(([clave, codigoInterno]) => {
    const claveCompleta = clave;
    const claveCorta = clave.substring(0, 16);
    const codigo = parseInt(codigoInterno);
    return `('${claveCompleta}', '${claveCorta}', ${codigo})`;
  });

  const sql = `INSERT INTO codigos_cedula_catastral (clave_cata_completa, clave_cata_corta, codigo_interno) VALUES ${values.join(',\n')};`;
  batches.push(sql);
}

console.log(`✅ ${batches.length} batches preparados`);

// Guardar batches en archivos separados
const batchesDir = path.join(__dirname, 'migration_batches');
if (!fs.existsSync(batchesDir)) {
  fs.mkdirSync(batchesDir);
}

batches.forEach((sql, index) => {
  const batchNum = index + 1;
  const filename = `batch_${String(batchNum).padStart(3, '0')}.sql`;
  const filepath = path.join(batchesDir, filename);
  fs.writeFileSync(filepath, sql, 'utf8');

  if (batchNum % 10 === 0 || batchNum === batches.length) {
    console.log(`  Guardado batch ${batchNum}/${batches.length}`);
  }
});

console.log(`\n✅ Todos los batches guardados en: ${batchesDir}`);
console.log('\n📋 Siguientes pasos:');
console.log('1. Revisar los archivos SQL en migration_batches/');
console.log('2. Ejecutar cada batch usando mcp__supabase__execute_sql');
console.log('3. O combinar todos los batches y ejecutar de una vez');

// También crear un archivo con todos los batches combinados
const allBatchesPath = path.join(__dirname, 'all_batches_combined.sql');
fs.writeFileSync(allBatchesPath, batches.join('\n\n'), 'utf8');
console.log(`\n💾 También se creó: ${allBatchesPath}`);

const stats = fs.statSync(allBatchesPath);
console.log(`   Tamaño: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
