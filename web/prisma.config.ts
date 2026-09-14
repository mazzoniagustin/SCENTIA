import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

// Prisma 7 no carga archivos .env automáticamente. La URL de conexión vive en
// .env.local (convención de Next.js), por eso se carga explícitamente antes de
// que `env()` la resuelva.
config({ path: '.env.local' })

// Prisma 7 mueve la URL de conexión fuera del schema.prisma: el datasource
// solo declara el provider y la URL se resuelve aquí, desde el entorno.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
})