// Categorías oficiales de La Copa para el cronograma de carreras.
// Lista con sufijo de género tal como aparecen en las inscripciones reales.
// Basado en la Guía Técnica (categorías por edad + Máster + especiales).

// Categorías de carrera (XCC / XCO / XCO+XCC)
export const CATEGORIAS_CARRERA: string[] = [
  'Preinfantil Masculino',
  'Preinfantil Femenino',
  'Infantil Masculino',
  'Infantil Femenino',
  'Prejuvenil Masculino',
  'Prejuvenil Femenino',
  'Juvenil Masculino',
  'Juvenil Femenino',
  'Sub 23 Masculino',
  'Sub 23 Femenino',
  'Élite Masculino',
  'Élite Femenino',
  'Máster A Masculino',
  'Máster A Femenino',
  'Máster B Masculino',
  'Máster B Femenino',
  'Máster C Masculino',
  'Máster D Masculino',
  'Máster E Masculino',
  'Open Masculino',
  'Open Femenino',
  'E-Bike Masculino',
  'E-Bike Femenino',
  'Pasados de línea Masculino',
  'Cyclocross Élite Masculino',
  'Cyclocross Élite Femenino',
  'Cyclocross Máster Masculino',
  'Cyclocross Máster Femenino',
];

// Categorías de Copa Kids
export const CATEGORIAS_KIDS: string[] = [
  'Balance (Niños A) Masculino',
  'Balance (Niños A) Femenino',
  '0 a 4 años (Niños A) Masculino',
  '0 a 4 años (Niños A) Femenino',
  '5 a 6 años (Niños B) Masculino',
  '5 a 6 años (Niños B) Femenino',
  '7 a 8 años (Niños C) Masculino',
  '7 a 8 años (Niños C) Femenino',
  '9 a 10 años (Niños D) Masculino',
  '9 a 10 años (Niños D) Femenino',
  '11 a 12 años (Preinfantil) Masculino',
  '11 a 12 años (Preinfantil) Femenino',
];

// Lista completa (carrera + kids) para el select del cronograma
export const TODAS_CATEGORIAS: string[] = [...CATEGORIAS_CARRERA, ...CATEGORIAS_KIDS];
