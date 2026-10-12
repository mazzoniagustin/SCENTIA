import { prisma } from './prisma';
import { assignInitialNickname } from './account/nickname-data';

// Forma mínima del error de Prisma que se inspecciona (código y restricción violada).
type PrismaErrorLike = {
  code?: string
  meta?: { target?: unknown; driverAdapterError?: { cause?: { constraint?: { index?: string } } } }
}

// `nickname` viene de user_metadata de Supabase, que controla el cliente: es un dato sin confiar y
// assignInitialNickname lo valida de nuevo antes de guardarlo. Es opcional para no romper a quienes
// llaman sin él (scripts de verificación).
export async function getOrCreateUser(supabaseSession: { user: { id: string; email: string; nickname?: unknown } }) {
  const { id: supabaseId, email, nickname } = supabaseSession.user;

  // 1. Intento directo y optimista por supabaseId
  const user = await prisma.user.findUnique({
    where: { supabaseId }
  });
  if (user) return user;

  // 2. Intentar crear el registro
  try {
    const created = await prisma.user.create({
      data: { email, supabaseId }
    });
    // Primer ingreso: solo quien gana la creación asigna el apodo.
    await assignInitialNickname(created.id, nickname);
    return created;
  } catch (caught: unknown) {
    const error = caught as PrismaErrorLike
    // Verificamos si es un error de violación de restricción única (P2002)
    const constraint = error.meta?.target || error.meta?.driverAdapterError?.cause?.constraint?.index;

    // Caso A: Carrera sobre supabaseId -> Otro proceso creó el usuario justo antes
    if (error.code === 'P2002' && (constraint === 'User_supabaseId_key' || (Array.isArray(error.meta?.target) && error.meta.target.includes('supabaseId')))) {
      return await prisma.user.findUniqueOrThrow({
        where: { supabaseId }
      });
    }

    // Caso B: Conflicto sobre email -> El usuario ya existía (sin supabaseId)
    // Vinculamos el supabaseId a la fila existente
    if (error.code === 'P2002' && (constraint === 'User_email_key' || (Array.isArray(error.meta?.target) && error.meta.target.includes('email')))) {
      const linked = await prisma.user.update({
        where: { email },
        data: { supabaseId }
      });
      // Primer ingreso con Supabase de una fila anterior: no pisa un apodo ya guardado.
      await assignInitialNickname(linked.id, nickname);
      return linked;
    }

    // Si es otro tipo de error o P2002 no esperado, re-lanzamos
    throw error;
  }
}
