const fs = require('fs');
const path = require('path');

// Ruta del JSON - usar la que funciona en Windows
const jsonPath = path.join('C:', 'Users', 'Administrador', 'Documents', 'DATA_LOJA', 'indice_codigos_54656.json');

console.log('📂 Leyendo JSON desde:', jsonPath);

// Leer JSON
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

// Preparar SQL header
const sqlHeader = `-- Migration: Carga de códigos de cédula catastral del municipio de Loja
-- Fecha: 2026-03-28
-- Fuente: indice_codigos_54656.json

-- Crear tabla
CREATE TABLE IF NOT EXISTS codigos_cedula_catastral (
  id BIGSERIAL PRIMARY KEY,
  clave_cata_completa VARCHAR(19) NOT NULL,
  clave_cata_corta VARCHAR(16) NOT NULL,
  codigo_interno INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_cedula_clave_completa ON codigos_cedula_catastral(clave_cata_completa);
CREATE INDEX IF NOT EXISTS idx_cedula_clave_corta ON codigos_cedula_catastral(clave_cata_corta);
CREATE INDEX IF NOT EXISTS idx_cedula_codigo_interno ON codigos_cedula_catastral(codigo_interno);

`;

// Procesar datos
console.log('🔄 Procesando datos...');
const values = [];
const entries = Object.entries(data);

for (const [clave, codigoInterno] of entries) {
  const claveCompleta = clave;
  const claveCorta = clave.substring(0, 16);
  const codigo = parseInt(codigoInterno);
  values.push(`('${claveCompleta}', '${claveCorta}', ${codigo})`);
}

console.log(`✅ ${values.length} registros procesados`);

// Generar SQL en chunks
console.log('📝 Generando SQL...');
const chunkSize = 1000;
const outputPath = path.join(__dirname, 'migration_cedulas.sql');
const writeStream = fs.createWriteStream(outputPath, { encoding: 'utf8' });

// Escribir header
writeStream.write(sqlHeader);

// Escribir inserts en chunks
for (let i = 0; i < values.length; i += chunkSize) {
  const chunk = values.slice(i, i + chunkSize);

  if (i === 0) {
    // Primer chunk
    writeStream.write('-- Insertar datos\nINSERT INTO codigos_cedula_catastral (clave_cata_completa, clave_cata_corta, codigo_interno) VALUES\n');
    writeStream.write(chunk.join(',\n'));
    writeStream.write(';\n\n');
  } else {
    // Chunks subsiguientes
    writeStream.write(`INSERT INTO codigos_cedula_catastral (clave_cata_completa, clave_cata_corta, codigo_interno) VALUES\n`);
    writeStream.write(chunk.join(',\n'));
    writeStream.write(';\n\n');
  }

  // Log progress cada 10 chunks
  if ((i / chunkSize) % 10 === 0) {
    console.log(`  Procesados ${i + chunk.length}/${values.length} registros...`);
  }
}

// Estadísticas
const claves16Unicas = new Set(entries.map(([k]) => k.substring(0, 16))).size;
const claves1101 = entries.filter(([k]) => k.startsWith('1101')).length;
const claves1130 = entries.filter(([k]) => k.startsWith('1130')).length;
const clavesOtras = entries.length - claves1101 - claves1130;

const estadisticas = `-- Estadísticas de carga
-- Total de registros: ${values.length}
-- Claves únicas de 16 caracteres: ${claves16Unicas}
-- Claves con prefijo 1101 (Loja): ${claves1101}
-- Claves con prefijo 1130: ${claves1130}
-- Claves con otros prefijos: ${clavesOtras}
`;

writeStream.write(estadisticas);
writeStream.end();

writeStream.on('finish', () => {
  console.log('✅ SQL generado correctamente');
  console.log('📁 Archivo guardado en:', outputPath);

  // Tamaño del archivo
  const stats = fs.statSync(outputPath);
  const fileSizeMB = stats.size / (1024 * 1024);
  console.log(`💾 Tamaño del archivo: ${fileSizeMB.toFixed(2)} MB`);
  console.log('\n📊 Estadísticas:');
  console.log(`  - Total registros: ${values.length}`);
  console.log(`  - Claves únicas (16 chars): ${claves16Unicas}`);
  console.log(`  - Prefijo 1101: ${claves1101}`);
  console.log(`  - Prefijo 1130: ${claves1130}`);
  console.log(`  - Otros prefijos: ${clavesOtras}`);
});

writeStream.on('error', (error) => {
  console.error('❌ Error al escribir SQL:', error.message);
  process.exit(1);
});
