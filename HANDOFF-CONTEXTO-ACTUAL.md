# 🔄 HANDOFF — Contexto para continuar en otro chat

**Fecha de este handoff:** 27 Oct 2026
**Usuaria:** Nancy (Nancyms1012)
**Motivo:** El chat actual está lento, se transfiere el contexto.

---

## 👤 PERFIL DE LA USUARIA

- Nancy trabaja en gestión de eventos de ciclismo de montaña (ANCM / La Copa) y triatlón (XTERRA Costa Rica).
- GitHub: **Nancyms1012**. Dominio: **raceclubhub.com**.
- **NO puede instalar software** en su máquina de trabajo → todo deploy es por git push / dashboard web.
- Prefiere **UI y comunicación en español**.
- **IMPORTANTE:** su máquina guarda CSV con separador **`;`** (punto y coma), por configuración regional de Costa Rica. Cualquier parser CSV debe aceptar **tanto `,` como `;`**.

---

## 🚴 PROYECTO: La Copa — VII Fecha Sarapiquí (31 Oct – 01 Nov 2026)

Sistema de gestión de carreras MTB repartido en varios repos/apps, todas en **Cloudflare Pages + Supabase**.

### Supabase (compartida entre apps)
- **URL:** https://ijqalxopeqyqfzwpfmfj.supabase.co
- **Anon key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqcWFseG9wZXF5cWZ6d3BmbWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2OTk3ODksImV4cCI6MjEwMTI3NTc4OX0.aBusNxkym2JqjXRaKtgHPA-K1cywsb4CqK9NCRvpRw0`
- RLS deshabilitado en todas las tablas (acceso anónimo desde navegador).

### Apps y repos
| App | Repo | URL | Rol |
|-----|------|-----|-----|
| formulario-inscripciones | Nancyms1012/formulario-inscripciones | inscripciones.raceclubhub.com | Formulario + Admin + Check-in + Boxes |
| control-evento | Nancyms1012/control-evento | control.raceclubhub.com | Control de tiempos el día del evento |
| admin-central | Nancyms1012/admin-central | admin-central-1u1.pages.dev | Panel central (dorsales/boxes) |

---

## ⚠️ NOTA CRÍTICA SOBRE EL REPO LOCAL (formulario-inscripciones)

El repo local de `formulario-inscripciones` en el sandbox está **CORRUPTO** (bad object / unable to read tree). **NO se puede commitear desde él.**

**Método que SÍ funciona para pushear cambios:**
1. Editar los archivos en `/projects/sandbox/formulario-inscripciones/` (para tener la versión correcta)
2. Clonar fresco: `cd /projects/sandbox && REMOTE=$(cd formulario-inscripciones && git remote get-url origin) && git clone "$REMOTE" fi-fresh`
3. Copiar los archivos editados a `fi-fresh/`
4. `cd fi-fresh && git add <archivos> && git commit -m "..." && git push origin main`
5. `rm -rf fi-fresh` al terminar

El remote usa un gateway autenticado: `https://us-east-1.gateway.connections.autonomous-agents.kiro.dev/github/Nancyms1012/formulario-inscripciones.git`
(control-evento y admin-central SÍ se pueden commitear normal desde su carpeta.)

---

## ✅ TRABAJO YA COMPLETADO (VII Fecha Sarapiquí)

Todos estos cambios ya están deployados en producción:

1. **Fecha actualizada** a "VII Fecha Sarapiquí · 31 Oct - 01 Nov" en las 3 apps.
2. **Evento nuevo XCO+XCC+Cyclocross**:
   - Internamente usa el valor `XCO+XCC+XCE` (XCE = sigla de Cyclocross). Al usuario se le muestra "XCO+XCC+Cyclocross".
   - Precio = precio de XCO+XCC + ₡7.000 de Cyclocross: Élite/Sub23 = ₡35.000, Juvenil = ₡27.000, Máster A-E = ₡30.000.
   - **SIN pago por tarjeta** (url de pago vacía) → solo SINPE/Efectivo. La opción Tarjeta se oculta para este evento.
   - `getAvailableCategories` ahora filtra categorías que tengan link de pago configurado.
   - IMPORTANTE: en el admin aparece como "XCO+XCC+XCE" (nombre interno). Nancy ya sabe que esos inscritos SON los de Cyclocross. Decidió DEJARLO ASÍ (no cambiar la etiqueta del admin). Hay 4 inscritos reales ahí: Jeffrey Herrera (Máster D), Elber Herrera (Máster B), Enrique Artavia (Máster A), Ean Sunsin (Sub 23).
3. **Categorías Cyclocross** Élite (19-34) y Máster (35+), ambos géneros, en XCO/XCC/XCO+XCC.
4. **"Ligas menores" desactivada** (comentada en CATEGORIAS_ESPECIALES).
5. **Talla de camiseta en Copa Kids** → se agregó y luego Nancy pidió QUITARLA. Ya está quitada del formulario, del guardado y del CSV admin. (La columna `talla_camiseta` sigue en la tabla Supabase, sin usarse.)
6. **Cupo Copa Kids cambiado de 150 → 130** (constante CUPO_MAXIMO_KIDS + textos).
7. **Botón "Reenviar correo" siempre disponible** por fila en el admin (columna Acciones, junto a Ver/Eliminar). Antes solo aparecía si el correo estaba pendiente; ahora está siempre, para reenviar a correos corregidos. El correo incluye el QR (vía /api/email que usa Resend).
8. **Guía Técnica (PDF)** nueva — Nancy la subió manualmente a `public/guia-tecnica.pdf` por GitHub web (677 KB). Enlace "Ver Guía Técnica" ya apunta a ella.
9. **Inscripciones abiertas** (copa y kids). Datos de la fecha pasada (367 inscripciones) fueron borrados tras backup.
10. **admin-central fix:** la sesión ahora persiste con localStorage + Link de Next (antes el botón "Volver" expulsaba al login).

### Datos actuales en Supabase (conteo inscritos al 27 oct):
- Copa Kids: 121
- XCC: 2
- XCO: 35
- XCO+XCC: 163
- XCO+XCC+XCE (Cyclocross combinado): 4

---

## 🔧 ARQUITECTURA DE EMAIL (importante)

- `formulario-inscripciones` corre como **servidor Next.js** (NO static export). `next.config.ts` NO tiene `output: export`.
- Tiene rutas API en `src/app/api/`: `email/route.ts`, `inscripciones/route.ts`, `checkin/route.ts`.
- `/api/email` envía el correo de confirmación con QR vía **Resend** (`RESEND_API_KEY` en env). El QR se genera con `api.qrserver.com` y enlaza a `/mi-inscripcion?codigo=XXX`.
- Función `enviarCorreoConfirmacion` en `src/lib/inscripcion-client.ts` llama a `/api/email` y marca `email_enviado` en Supabase.
- HISTÓRICO: hubo intentos fallidos de convertir a static export que rompieron el build (openNext, etc.). Se revirtió todo al commit bueno del 26 sept. **NO volver a poner `output: export`** sin resolver primero el tema de las rutas API.

---

## 🏁 TAREA EN CURSO (lo que estábamos haciendo) — control-evento

### Estado de la app control-evento (probada en vivo):
- **Home, Cronograma, Control** funcionan. **Tracking** lee de tabla equivocada.
- **BUG CRÍTICO SIN RESOLVER:** al registrar un tiempo (paso) en Control, falla con error FK 23503:
  `insert or update on table "pasos_carrera" violates foreign key constraint — Key (carrera_id) is not present in table "carreras"`
  **Causa:** hay 3 tablas descoordinadas:
  - Eventos se crean en tabla `cronograma`
  - `pasos_carrera` tiene FK apuntando a tabla `carreras` (no a cronograma)
  - Tracking lee de `carreras` (vacía), no de `cronograma`
  - Además `usuarios_evento` NO tiene columnas dorsal/evento/equipo (solo id, nombre, email, rol) → el lookup de dorsal del Control falla (error 400). Los dorsales reales de corredores están en la tabla `inscripciones`.
  - **Solución propuesta (pendiente de aprobar/ejecutar):** cambiar FK de `pasos_carrera` → `cronograma`; que Tracking lea de `cronograma`; que Control busque el dorsal en `inscripciones`. Requiere SQL en Supabase + cambios de código.

### MEJORA QUE ESTÁBAMOS IMPLEMENTANDO en Cronograma (control-evento):
Nancy pidió 2 cosas en la página **Cronograma** (`control-evento/src/app/cronograma/page.tsx`):

1. **Select de categorías** (en vez del campo de texto libre actual). 
   - YA CREÉ el archivo `control-evento/src/lib/categorias.ts` con las listas:
     - `CATEGORIAS_CARRERA` (todas con género: Preinfantil, Infantil, Prejuvenil, Juvenil, Sub 23, Élite, Máster A-E, Open, E-Bike, Pasados de línea, Cyclocross Élite/Máster)
     - `CATEGORIAS_KIDS`
     - `TODAS_CATEGORIAS` (combinada)
   - Nancy confirmó que esta lista está perfecta.

2. **Carga por CSV** de varios eventos de una vez. Columnas confirmadas por Nancy:
   - `hora_salida`, `categoria`, `tiempo_vueltas` (minutos si XCC / vueltas si XCO), `evento` (tipo XCC o XCO)
   - El parser debe aceptar **separador `,` Y `;`** (su Excel usa `;`).
   - Formato: **CSV** (no Excel).
   - Incluir una **plantilla CSV descargable**.

### ⏳ ÚNICA DECISIÓN PENDIENTE antes de implementar: LA FECHA
El CSV no trae columna de fecha. Falta que Nancy elija cómo asignarla:
- **(A)** Campo de fecha arriba; todos los eventos del CSV usan esa fecha (RECOMENDADA por el agente)
- **(B)** Deducir por tipo: XCC → 31 oct, XCO → 01 nov
- **(C)** Agregar columna `fecha` al CSV

Una vez que Nancy responda, implementar: select de categorías + carga CSV (con parser `,`/`;`) + plantilla descargable, en `control-evento/src/app/cronograma/page.tsx`, importando de `src/lib/categorias.ts`.

---

## 📂 Estructura tablas Supabase relevantes (control-evento)
- `cronograma`: id, fecha, tipo (XCC/XCO), hora_salida, categoria, duracion_minutos, vueltas_totales, descripcion, created_at, updated_at. ← eventos se crean aquí
- `carreras`: vacía, estructura aparte. ← tracking lee de aquí (BUG)
- `pasos_carrera`: FK a `carreras` (BUG). Campos: carrera_id, dorsal, vuelta, tiempo_ms, nombre, equipo, es_rezagado
- `usuarios_evento`: solo id, nombre, email, rol (NO tiene dorsales)
- `inscripciones`: acá están los corredores reales con dorsal, nombre, evento, categoria, etc.

---

## 📋 PENDIENTES FUTUROS (control-evento, mencionados antes)
- Página `/resultados` (rankings UCI-style con tabla de puntos XCC/XCO de la Guía Técnica)
- **Lógica XCC: regla del 80%, cierre de vuelta, DNF — ESPECIFICACIÓN DETALLADA (confirmada con Nancy, 30 oct 2026):**
  - **El cálculo es POR CATEGORÍA, no por tanda.** En el Control, a una misma hora pueden salir
    varias categorías juntas (ej. 17:15 → Máster A, Máster B, Open) con un solo cronómetro, pero
    **cada categoría tiene su propio líder y su propio tiempo de 1ª vuelta** → son cálculos
    independientes. Esto YA es posible porque cada paso se guarda con su `categoria` en `pasos_carrera`.
  - **Regla del 80% / cierre de vuelta:** tomar el **tiempo de la 1ª vuelta del LÍDER DE ESA CATEGORÍA**
    (el primer corredor de esa categoría en completar la vuelta 1); con ese tiempo calcular cuántas
    vueltas entran en la `duracion_minutos` del evento → definir la **última vuelta (campana)** de esa
    categoría. Mostrar aviso de "última vuelta" por categoría.
  - **Marca "-X lap" para los sacados por 80%:** a un corredor que se saca porque va a ser doblado
    NO se le pone DNF genérico, sino **-X lap**. FÓRMULA EXACTA (confirmada por Nancy con ejemplo):
    **X = (vueltas TOTALES que dio el líder de la categoría) − (vueltas COMPLETADAS por el corredor sacado).**
    - Cuentan las **vueltas COMPLETADAS** (cruzadas por meta = pasos registrados en esa categoría),
      NO la vuelta "en la que iba".
    - Ejemplo de Nancy: el líder dio 5 vueltas; al corredor lo sacan **antes de terminar la 3ª**
      (o sea tenía 2 vueltas completadas) → X = 5 − 2 = **3 → queda "-3 lap"**.
    - En términos de datos: vueltas del corredor = nº de pasos de ese dorsal en esa categoría;
      vueltas del líder = máximo de pasos entre los corredores de esa categoría.
  - **Orden en la clasificación final:** primero los que terminaron completos (por tiempo); después
    los sacados ordenados por menos vueltas perdidas (los -1 lap antes que los -2 lap, etc.).
  - ⚠️ DECISIÓN 30 oct: NO se implementó antes de la carrera (se tocaría el Control a minutos de usarlo
    en vivo = riesgo). Para la VII Fecha se registran los pasos y los jueces aplican el 80% a criterio.
    Implementar con calma DESPUÉS del evento y probar bien.
  - **EL 80% ES APP APARTE (lo maneja otra persona) + TAMBIÉN se muestra EN VIVO en Control** (indicador
    de solo lectura, por categoría). Mecánica confirmada con Nancy (ejemplo real):
    - 80% de la categoría = **80% del tiempo de la 1ª vuelta del líder** (FIJO toda la carrera).
      Ej: #100 Máster A 1ª vuelta 2:02.77 → 80% = 1:37 (fijo).
    - A partir de la 2ª vuelta: **límite de corte = acumulado del líder en su última vuelta + 80% fijo**.
      Ej: líder 2ª vuelta acumulado 4:11 → corte = 4:11 + 1:37 = 5:48. Los que crucen DESPUÉS se sacan.
    - "Líder" = el PRIMER corredor de esa categoría en cruzar esa vuelta (puede cambiar de dorsal).
    - Aplica por categoría (Máster A, B, C... cada una con sus tiempos).
- Pasos editables + audit trail
- Export CSV/PDF de resultados
- Integración ANCM (envío automático de resultados)

---

**Para retomar en el chat nuevo:** empezar preguntando a Nancy la decisión de la FECHA (A/B/C) para el CSV del cronograma, o si prefiere que primero se arregle el bug crítico de registro de tiempos.
