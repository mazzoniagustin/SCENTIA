import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Hacer la inicialización perezosa para asegurar que las variables de entorno están cargadas
let prismaInstance: PrismaClient | undefined;

export const getPrisma = () => {
  if (prismaInstance) return prismaInstance;

  // Pool chico: en serverless cada instancia abre su propio pool y el pooler de Supabase tiene un tope de conexiones.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL as string,
    max: Number(process.env.DATABASE_POOL_MAX) || 5,
  });

  prismaInstance = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  return prismaInstance;
};

export const prisma = new Proxy({} as PrismaClient, {
  get: (target, prop, receiver) => {
    return Reflect.get(getPrisma(), prop, receiver);
  },
});
