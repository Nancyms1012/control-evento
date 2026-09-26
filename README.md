# Control de Evento - La Copa

Panel de control de carreras XCC (Short Track) y XCO (Cross-Country) en tiempo real.

## Funcionalidades

- **Control de Carrera:** Operadores digitando dorsales en tiempo real
- **Tracking en Vivo:** Coordinadores viendo posiciones en vivo
- **Cronograma:** Gestión de horas de salida y categorías
- **XCC (Sábado):** Control por tiempo con cutoff automático
- **XCO (Domingo):** Control por vueltas con contador

## Tech Stack

- Next.js 15+
- React 19+
- TypeScript
- Supabase (Realtime + Auth)
- Tailwind CSS

## Deployment

- URL: `control.raceclubhub.com`
- Plataforma: Cloudflare Pages
- Base de datos: Supabase (compartida)

## Setup

```bash
npm install
npm run dev
```

## Documentación

Ver `SPEC-control-evento.md` en la raíz del proyecto para detalles completos de funcionalidades y lógica.
