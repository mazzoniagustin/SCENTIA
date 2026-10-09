'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireUser } from '@/lib/auth/require-user'
import { logWearToday } from '@/lib/wear/data'

// Registra el perfume que la persona usa hoy. Las Server Actions son endpoints públicos: se valida todo
// en el servidor y el perfume debe estar en la colección de quien tiene la sesión.
export async function logWearAction(formData: FormData) {
  const user = await requireUser()
  const result = await logWearToday(user.id, formData.get('perfumeId'))

  revalidatePath('/')
  revalidatePath('/mi-coleccion')
  // El ancla (#racha) lleva a la tarjeta de la racha, donde se ve el mensaje de resultado (sin ella la página volvía arriba de todo).
  redirect(result.ok ? '/?racha=ok#racha' : '/?racha=error#racha')
}
