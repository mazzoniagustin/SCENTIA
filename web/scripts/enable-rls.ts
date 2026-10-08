// Activa Row Level Security en TODAS las tablas del esquema public, sin políticas (deny-all para
// la API REST de Supabase con anon/authenticated). La app no se afecta: Prisma conecta como `postgres`,
// que ignora RLS, y Supabase solo se usa para autenticación.
//   npx tsx scripts/enable-rls.ts
// Idempotente. Volver a correrlo después de cada `prisma db push` que cree tablas nuevas.
// Reversión (por tabla): ALTER TABLE "<tabla>" DISABLE ROW LEVEL SECURITY;
import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true })

import pg from 'pg'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const { rows } = await client.query<{ relname: string; rls: boolean }>(
      `SELECT c.relname, c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1`,
    )
    for (const { relname, rls } of rows) {
      if (rls) { console.log(`  ya activado  ${relname}`); continue }
      // Los identificadores salen de pg_class (no de entrada externa); se citan igualmente.
      await client.query(`ALTER TABLE public."${relname.replace(/"/g, '""')}" ENABLE ROW LEVEL SECURITY`)
      console.log(`  ACTIVADO     ${relname}`)
    }
    const check = await client.query(
      `SELECT count(*) FILTER (WHERE c.relrowsecurity)::int AS con, count(*)::int AS total
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'`,
    )
    console.log(`RLS activo en ${check.rows[0].con} de ${check.rows[0].total} tablas`)
  } finally {
    await client.end()
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
