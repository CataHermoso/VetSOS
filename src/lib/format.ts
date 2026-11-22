/** 25000 → "$ 25.000" */
export function formatARS(amount: number): string {
  const whole = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${whole}`;
}

/** 7 → "0:07", 45 → "0:45" */
export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.ceil(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
