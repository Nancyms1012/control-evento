-- ============================================================
-- FIX BUG CRÍTICO: registro de tiempos (error FK 23503)
-- ============================================================
-- Problema:
--   La tabla `pasos_carrera` tenía una llave foránea (carrera_id)
--   apuntando a la tabla `carreras` (que está vacía), pero la app
--   de Control inserta usando el id de un evento de `cronograma`.
--   Por eso al registrar un paso daba:
--     23503 ... Key (carrera_id) is not present in table "carreras"
--
-- Solución:
--   Mover la FK de pasos_carrera.carrera_id para que apunte a
--   `cronograma(id)` en lugar de `carreras(id)`.
--
-- Cómo correrlo:
--   Pegar TODO este bloque en Supabase → SQL Editor → Run.
--   Es seguro volver a correrlo (usa IF EXISTS / verificaciones).
-- ============================================================

-- 1) Quitar la FK vieja que apunta a `carreras` (si existe, sin importar su nombre)
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.pasos_carrera'::regclass
      AND contype = 'f'
      AND conname LIKE '%carrera_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.pasos_carrera DROP CONSTRAINT %I', con.conname);
    RAISE NOTICE 'Eliminada FK vieja: %', con.conname;
  END LOOP;
END $$;

-- 2) Crear la FK nueva apuntando a `cronograma(id)`
--    ON DELETE CASCADE: si se borra un evento del cronograma,
--    se borran también sus pasos (coherente con el borrado en Cronograma).
ALTER TABLE public.pasos_carrera
  ADD CONSTRAINT pasos_carrera_carrera_id_fkey
  FOREIGN KEY (carrera_id)
  REFERENCES public.cronograma(id)
  ON DELETE CASCADE;

-- 3) Asegurar que RLS queda deshabilitado (la app escribe con anon key desde el navegador)
ALTER TABLE public.pasos_carrera DISABLE ROW LEVEL SECURITY;

-- 4) Verificación: debe mostrar la FK apuntando a `cronograma`
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name  AS referencia_tabla,
  ccu.column_name AS referencia_columna
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'pasos_carrera'
  AND tc.constraint_type = 'FOREIGN KEY';
