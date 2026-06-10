import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

interface ClienteJson {
  nombre: string;
  direccion?: string;
  razon_social?: string;
  departamento?: string;
  zona?: string;
  notas?: string;
  cuit?: string;
  telefono?: string;
  email?: string;
}

// Los JSON vienen con mojibake (UTF-8 leído como Latin-1). Lo corregimos.
function fixEncoding(s: string | undefined): string | undefined {
  if (!s) return s;
  try {
    return Buffer.from(s, 'latin1').toString('utf8');
  } catch {
    return s;
  }
}

async function main() {
  const filePath = path.join(__dirname, 'data', 'clientes_minimo.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const clientes: ClienteJson[] = JSON.parse(raw);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  let insertados = 0;
  let omitidos = 0;

  for (const c of clientes) {
    const nombre = fixEncoding(c.nombre)?.trim();
    if (!nombre) {
      omitidos++;
      continue;
    }
    const direccion = fixEncoding(c.direccion)?.trim() || '(sin definir)';
    const razon_social = fixEncoding(c.razon_social)?.trim() || null;
    const departamento = fixEncoding(c.departamento)?.trim() || null;
    const zona = fixEncoding(c.zona)?.trim() || null;
    const notas = fixEncoding(c.notas)?.trim() || null;
    const cuit = c.cuit?.trim() || null;
    const telefono = c.telefono?.trim() || null;
    const email = c.email?.trim() || null;

    await pool.query(
      `INSERT INTO clientes (nombre, direccion, razon_social, departamento, zona, notas, cuit, telefono, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [nombre, direccion, razon_social, departamento, zona, notas, cuit, telefono, email]
    );
    insertados++;
  }

  console.log(`Insertados: ${insertados}, omitidos: ${omitidos}, total: ${clientes.length}`);
  await pool.end();
}

main().catch((err) => {
  console.error('Error en la importación:', err);
  process.exit(1);
});
