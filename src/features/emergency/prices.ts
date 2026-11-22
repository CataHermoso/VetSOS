import { config } from '@/config';

export type Prices = { base: number; homeExtra: number; nightExtra: number };
export type PriceLine = { label: string; amount: number };

export function isNight(date = new Date()) {
  const h = date.getHours();
  return h >= config.nightStartHour || h < config.nightEndHour;
}

/** Reference price: base + home visit extra (if going to the owner) + night surcharge (at night). */
export function priceLines(prices: Prices, place: 'clinic' | 'home', date = new Date()): { lines: PriceLine[]; total: number } {
  const lines: PriceLine[] = [
    { label: 'Consulta de urgencia', amount: prices.base },
    ...(place === 'home' && prices.homeExtra > 0 ? [{ label: 'Atención a domicilio', amount: prices.homeExtra }] : []),
    ...(isNight(date) && prices.nightExtra > 0 ? [{ label: 'Recargo nocturno', amount: prices.nightExtra }] : []),
  ];
  return { lines, total: lines.reduce((sum, l) => sum + l.amount, 0) };
}
