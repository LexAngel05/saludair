/**
 * Every UI string (Spanish, es-MX). Components import from here; no inline UI text.
 */
export const es = {
  app: {
    name: 'SaludAIR',
    nameStart: 'Salud',
    nameEnd: 'AIR',
    tagline: 'Monitor de PM2.5',
    skipToContent: 'Saltar al contenido',
    mainNav: 'Navegación principal',
    disclaimerLabel: 'Aviso',
    prototypeChip: 'Prototipo educativo · CETYS',
  },
  nav: {
    live: 'En vivo',
    sessions: 'Sesiones',
    validation: 'Validación',
    settings: 'Configuración',
    info: 'Información',
  },
  theme: {
    label: 'Tema',
    system: 'Tema: automático',
    light: 'Tema: claro',
    dark: 'Tema: oscuro',
  },
  disclaimer:
    'SaludAIR es un prototipo educativo. Sus lecturas son aproximadas y no sustituyen la indicación de un profesional de salud ni las estaciones oficiales de monitoreo.',
  levels: {
    low: 'Bajo',
    caution: 'Precaución',
    elevated: 'Elevado',
    none: 'Sin datos',
    estimated: 'estimado',
    insufficient: 'datos insuficientes',
    provisional: 'Umbrales provisionales',
    approved: 'Umbrales aprobados',
    scaleLabel: 'Escala de niveles de exposición (promedio 5 min de PM2.5)',
    rangeBelow: (v: number) => `menos de ${v}`,
    rangeBetween: (a: number, b: number) => `${a} a menos de ${b}`,
    rangeAbove: (v: number) => `${v} o más`,
    meaning: {
      low: 'Exposición baja. Actividades normales.',
      caution: 'Considera reducir la actividad intensa al aire libre.',
      elevated: 'Aléjate de la fuente o busca un lugar cerrado.',
    },
  },
  units: {
    pm: 'µg/m³',
    percent: '%',
    mv: 'mV',
    celsius: '°C',
  },
  status: {
    disconnected: 'Desconectado',
    noValue: '—',
  },
  pages: {
    live: {
      title: 'En vivo',
      intro: 'Lectura actual y nivel de exposición del dispositivo.',
      shortMean: 'Ahora, promedio 1 min',
      levelMean: 'Nivel, promedio 5 min',
      waiting: 'Conecta el dispositivo o el simulador para ver lecturas.',
      connectTitle: 'Conexión',
      connectBle: 'Bluetooth',
      connectUsb: 'USB',
      connectSim: 'Simulador',
      connectSoon: 'Los botones de conexión se activan en las siguientes fases.',
      tiles: {
        updated: 'Última lectura',
        humidity: 'Humedad',
        battery: 'Batería',
        loss: 'Paquetes perdidos',
      },
      trendTitle: 'Últimos 10 minutos',
      trendEmpty: 'Aquí aparecerá la tendencia de PM2.5 con las bandas de cada nivel.',
    },
    sessions: {
      title: 'Sesiones',
      intro: 'Historial de mediciones guardadas en este navegador.',
      emptyTitle: 'Aún no hay sesiones',
      emptyText:
        'Cuando inicies una sesión en «En vivo», aparecerá aquí con su resumen, gráfica y exportación a CSV.',
    },
    sessionDetail: { title: 'Detalle de sesión', back: 'Volver a sesiones' },
    validation: {
      title: 'Validación',
      intro: 'Pruebas guiadas para medir qué tan bien funciona el prototipo. Cada prueba se guarda como sesión y se exporta a CSV.',
      soon: 'Guía paso a paso disponible en la fase 6.',
      tests: [
        { key: 'environment', title: 'Ambientes', text: 'Interior, exterior, fuente controlada y recorrido. Media, mediana, P95 y minutos por nivel.' },
        { key: 'repeatability', title: 'Repetibilidad', text: 'Mismo lugar, ≥ 10 min, ≥ 3 corridas. Media, desviación estándar y CV %.' },
        { key: 'reference', title: 'Comparación con referencia', text: 'Importa datos de una estación oficial. Sesgo, MAE, RMSE, r y ajuste lineal.' },
        { key: 'battery', title: 'Batería', text: 'Carga completa hasta que se apague. Duración y curva de voltaje.' },
        { key: 'ble-range', title: 'Alcance Bluetooth', text: 'Pasos de 1 m. Pérdida de paquetes por distancia y tiempo de reconexión.' },
        { key: 'led-vs-dashboard', title: 'LED vs dashboard', text: 'Verifica que los umbrales del firmware coincidan con los del dashboard.' },
      ],
    },
    settings: {
      title: 'Configuración',
      intro: 'Umbrales, ventanas de promedio, alertas y datos.',
      soon: 'Los controles de configuración llegan en la fase 4. Mientras tanto se usan estos valores:',
      current: {
        thresholds: 'Umbrales (Precaución / Elevado)',
        levelWindow: 'Ventana del nivel',
        persistence: 'Persistencia para alertar',
        cooldown: 'Espera entre avisos',
        warmup: 'Calentamiento del sensor',
        stale: 'Lectura desactualizada después de',
      },
      minutes: (n: number) => `${n} min`,
      seconds: (n: number) => `${n} s`,
    },
    info: {
      title: 'Información',
      intro: 'Qué es PM2.5, qué significa cada nivel y límites del prototipo.',
      levelsTitle: 'Qué significa cada nivel',
      levelsNote:
        'Indicadores orientativos de exposición (OMS 2021 y red comunitaria de Imperial County). No son el Índice AIRE Y SALUD oficial.',
      soon: 'Más contenido (qué es PM2.5, LED vs dashboard, limitaciones) en la fase 7.',
    },
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
