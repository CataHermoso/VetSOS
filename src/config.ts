// App settings that are still open questions (see docs/SPEC.md §9).
// Change them here; nothing else needs to change.

export const config = {
  /** Show "Estás en X · Transporte: Sí" before searching, or search right away. */
  showConfirmScreen: true,

  /** Seconds a vet has to answer before we move on. */
  offerTimeoutSeconds: 45,

  /** Search radius: first value is the default, the rest are "Ampliar búsqueda" steps. */
  radiusStepsKm: [10, 30, 50],

  /** Night surcharge applies between these hours (24 h clock). */
  nightStartHour: 22,
  nightEndHour: 7,
} as const;
