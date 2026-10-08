import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Hacer la inicialización perezosa para asegurar que las variables de entorno están cargadas
let prismaInstance: PrismaClient | undefined;

export const getPrisma = () => {
  if (prismaInstance) return prismaInstance;

  const adapter = new PrismaPg(process.env.DATABASE_URL as string);

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
