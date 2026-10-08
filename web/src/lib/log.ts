// Registro de errores del servidor. Los endpoints responden con mensajes genéricos (nunca el error
// interno) y el detalle queda acá, en los logs de la plataforma. Solo nombre y mensaje, acotados.

export function logServerError(scope: string, error: unknown) {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : 'error desconocido'
  console.error(`[${scope}] ${detail.slice(0, 500)}`)
}
