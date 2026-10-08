import { prisma } from './prisma';

export async function getOrCreateUser(supabaseSession: { user: { id: string; email: string } }) {
  const { id: supabaseId, email } = supabaseSession.user;

  // 1. Intento directo y optimista por supabaseId
  let user = await prisma.user.findUnique({
    where: { supabaseId }
  });
  if (user) return user;

  // 2. Intentar crear el registro
  try {
    return await prisma.user.create({
      data: { email, supabaseId }
    });
  } catch (error: any) {
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
      return await prisma.user.update({
        where: { email },
        data: { supabaseId }
      });
    }

    // Si es otro tipo de error o P2002 no esperado, re-lanzamos
    throw error;
  }
}
