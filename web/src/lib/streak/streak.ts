// Racha de uso: días consecutivos con un perfume registrado. Lógica pura (sin base de datos ni red).
// Un "día" es la clave "YYYY-MM-DD" en la zona horaria de la aplicación (ver `dayKey` en daily.ts).

export type StreakSummary = {
  /** Días consecutivos hasta hoy; sigue viva si el último registro fue hoy o ayer (el día en curso aún no terminó). */
  current: number
  /** Mejor racha histórica. */
  best: number
  /** Ya registró un perfume hoy. */
  loggedToday: boolean
  /** Total de días registrados. */
  total: number
}

/** Suma `delta` días a una clave "YYYY-MM-DD" (calendario, sin zonas horarias de por medio). */
export function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10)
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

export function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && DAY_KEY.test(value) && shiftDay(value, 0) === value
}

export type DayDot = { day: string; logged: boolean; isToday: boolean; /** 0 = domingo … 6 = sábado */ weekday: number }

/** Los últimos `count` días hasta hoy (del más viejo al más nuevo), marcando en cuáles hubo registro. */
export function lastDays(days: readonly string[], today: string, count = 7): DayDot[] {
  if (!isDayKey(today)) return []
  const logged = new Set(days.filter(isDayKey))
  return Array.from({ length: count }, (_, i) => {
    const day = shiftDay(today, i - (count - 1))
    return { day, logged: logged.has(day), isToday: day === today, weekday: new Date(`${day}T12:00:00Z`).getUTCDay() }
  })
}

export function summarizeStreak(days: readonly string[], today: string): StreakSummary {
  const unique = [...new Set(days.filter(isDayKey))].sort()
  const set = new Set(unique)

  let best = 0
  let run = 0
  let prev: string | null = null
  for (const day of unique) {
    run = prev !== null && shiftDay(prev, 1) === day ? run + 1 : 1
    if (run > best) best = run
    prev = day
  }

  const loggedToday = set.has(today)
  // La racha cuenta hacia atrás desde hoy (si ya registró) o desde ayer (si todavía puede registrar hoy).
  let cursor = loggedToday ? today : shiftDay(today, -1)
  let current = 0
  while (set.has(cursor)) {
    current += 1
    cursor = shiftDay(cursor, -1)
  }

  return { current, best, loggedToday, total: unique.length }
}
