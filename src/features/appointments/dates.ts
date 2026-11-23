// Dates for appointments, in the phone's local time (Argentina).

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** "2026-11-25" in local time, to group things by day. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Hoy", "Mañana", or "Jueves 27/11". */
export function dayLabel(d: Date, now = new Date()): string {
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const key = dayKey(d);
  if (key === today) return 'Hoy';
  if (key === tomorrow) return 'Mañana';
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

/** Short version for chips: "Hoy", "Mañana", "Jue 27". */
export function dayChip(d: Date, now = new Date()): string {
  const label = dayLabel(d, now);
  return label === 'Hoy' || label === 'Mañana' ? label : `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()}`;
}

/** "9:00", "09:00", "9" → "09:00"; anything else → null. */
export function parseHHMM(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? '0');
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** The next `count` days starting today, at local midnight. */
export function nextDays(count: number, now = new Date()): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
}
