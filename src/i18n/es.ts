/**
 * Every UI string (Spanish, es-MX). Components import from here; no inline UI text.
 */
export const es = {
  app: {
    name: 'SaludAIR',
    tagline: 'Monitor de PM2.5',
    skipToContent: 'Saltar al contenido',
    mainNav: 'Navegación principal',
    disclaimerLabel: 'Aviso',
  },
  nav: {
    live: 'En vivo',
    sessions: 'Sesiones',
    validation: 'Validación',
    settings: 'Configuración',
    info: 'Información',
  },
  disclaimer:
    'SaludAIR es un prototipo educativo. Sus lecturas son aproximadas y no sustituyen la indicación de un profesional de salud ni las estaciones oficiales de monitoreo.',
  levels: {
    low: 'Bajo',
    caution: 'Precaución',
    elevated: 'Elevado',
    estimated: 'estimado',
    insufficient: 'datos insuficientes',
    provisional: 'umbrales provisionales',
  },
  units: {
    pm: 'µg/m³',
    percent: '%',
    mv: 'mV',
    celsius: '°C',
  },
  pages: {
    live: {
      title: 'En vivo',
      intro: 'Lectura actual y nivel de exposición del dispositivo.',
      shortMean: 'Ahora, promedio 1 min',
      levelMean: 'Nivel, promedio 5 min',
    },
    sessions: { title: 'Sesiones', intro: 'Historial de mediciones guardadas en este navegador.' },
    sessionDetail: { title: 'Detalle de sesión', back: 'Volver a sesiones' },
    validation: { title: 'Validación', intro: 'Pruebas guiadas para medir qué tan bien funciona el prototipo.' },
    settings: { title: 'Configuración', intro: 'Umbrales, ventanas de promedio, alertas y datos.' },
    info: { title: 'Información', intro: 'Qué es PM2.5, qué significa cada nivel y límites del prototipo.' },
    notFound: { title: 'Página no encontrada', back: 'Ir a En vivo' },
  },
  placeholder: {
    comingInPhase: (phase: number) => `En construcción — se implementa en la fase ${phase}.`,
  },
  pwa: {
    offlineReady: 'La app está lista para usarse sin internet.',
    dismiss: 'Cerrar',
  },
} as const;

export type Strings = typeof es;
