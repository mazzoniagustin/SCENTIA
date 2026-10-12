import { prisma } from '@/lib/prisma'
import { logServerError } from '@/lib/log'
import { generateTemporaryNickname, isNicknameConflict, validateNickname } from './nickname'

// Apodo público de la persona. La unicidad sin distinguir mayúsculas la garantiza el índice sobre
// lower("nickname") (prisma/sql/2026-10-12-user-nickname.sql): cada escritura captura la violación en
// lugar de "chequear y después insertar".

/** Solo para avisar antes de enviar el correo de registro; los apodos son públicos. */
export async function isNicknameTaken(key: string): Promise<boolean> {
  const row = await prisma.userProfile.findFirst({
    where: { nickname: { equals: key, mode: 'insensitive' } },
    select: { userId: true },
  })
  return row !== null
}

async function writeNickname(userId: string, nickname: string, isTemporary: boolean) {
  const data = { nickname, nicknameIsTemporary: isTemporary }
  await prisma.userProfile.upsert({ where: { userId }, update: data, create: { userId, ...data } })
}

/** Cambio de apodo desde Cuenta. `raw` ya pasó por validateNickname. */
export async function saveNickname(userId: string, nickname: string): Promise<'ok' | 'taken'> {
  try {
    await writeNickname(userId, nickname, false)
    return 'ok'
  } catch (caught) {
    if (isNicknameConflict(caught)) return 'taken'
    throw caught
  }
}

const TEMPORARY_ATTEMPTS = 5

/**
 * Primer ingreso: guarda el apodo que vino en los metadatos de Supabase, que controla el cliente, así que se
 * vuelve a validar acá. Si es inválido, está reservado o ya está tomado, asigna uno temporal (Cuenta avisa).
 * No pisa un apodo existente y nunca lanza: el ingreso no puede fallar por el apodo.
 */
export async function assignInitialNickname(userId: string, rawNickname: unknown): Promise<void> {
  try {
    const existing = await prisma.userProfile.findUnique({ where: { userId }, select: { nickname: true } })
    if (existing?.nickname) return

    const validated = validateNickname(rawNickname)
    if (validated.ok) {
      try {
        await writeNickname(userId, validated.nickname, false)
        return
      } catch (caught) {
        if (!isNicknameConflict(caught)) throw caught
      }
    }

    for (let attempt = 0; attempt < TEMPORARY_ATTEMPTS; attempt++) {
      try {
        await writeNickname(userId, generateTemporaryNickname(), true)
        return
      } catch (caught) {
        if (!isNicknameConflict(caught)) throw caught
      }
    }
  } catch (caught) {
    logServerError('assignInitialNickname', caught)
  }
}
