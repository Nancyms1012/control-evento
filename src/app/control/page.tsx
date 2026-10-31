'use client';

import { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import Link from 'next/link';

interface Evento {
  id: string;
  tipo: 'XCC' | 'XCO';
  categoria: string;
  duracion_minutos?: number;
  vueltas_totales?: number;
  hora_salida: string;
  fecha: string;
}

interface Paso {
  id: string;
  carrera_id: string;
  dorsal: string;
  vuelta: number;
  tiempo_ms: number;
  nombre?: string;
  equipo?: string;
  categoria?: string;
  es_rezagado: boolean;
}

export default function ControlPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  // Tanda = conjunto de eventos (categorías) que salen a la misma fecha + hora
  const [tandaSeleccionada, setTandaSeleccionada] = useState<string | null>(null); // clave "fecha|hora"
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<string[]>([]);
  const [controlActivo, setControlActivo] = useState(false); // ya se eligió la tanda y se está cronometrando
  const [salidaCerrada, setSalidaCerrada] = useState(false); // la tanda abierta en pantalla está cerrada (solo lectura)
  const [pasos, setPasos] = useState<Paso[]>([]);
  // CRONÓMETRO POR HORA REAL (no por acumulación): así no se atrasa aunque se
  // bloquee la pantalla o la pestaña pase a segundo plano, y se recupera al recargar.
  // salidaAt = timestamp (ms) de cuándo se dio la salida (null = sin salida)
  // pausadoEn = tiempo transcurrido congelado (ms) cuando está en pausa; null = corriendo
  const [salidaAt, setSalidaAt] = useState<number | null>(null);
  const [pausadoEn, setPausadoEn] = useState<number | null>(null);
  const [cronometroMs, setCronometroMs] = useState(0); // solo para refrescar la pantalla
  const [dorsal, setDorsal] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const corriendo = salidaAt != null && pausadoEn == null;

  // Tiempo transcurrido actual en ms, calculado SIEMPRE contra el reloj real
  const calcularMs = () => {
    if (salidaAt == null) return 0;
    if (pausadoEn != null) return pausadoEn;
    return Date.now() - salidaAt;
  };

  useEffect(() => {
    cargarEventos();
  }, []);

  const cargarEventos = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('cronograma')
        .select('*')
        .order('fecha', { ascending: true })
        .order('hora_salida', { ascending: true });

      if (error) throw error;
      setEventos(data || []);
    } catch (err) {
      console.error('Error cargando eventos:', err);
    }
  };

  // Agrupar eventos por tanda (fecha|hora). Devuelve clave -> {fecha, hora, tipo, eventos[]}
  const tandas = (() => {
    const mapa = new Map<string, { fecha: string; hora: string; eventos: Evento[] }>();
    for (const ev of eventos) {
      const clave = `${ev.fecha}|${ev.hora_salida}`;
      if (!mapa.has(clave)) mapa.set(clave, { fecha: ev.fecha, hora: ev.hora_salida, eventos: [] });
      mapa.get(clave)!.eventos.push(ev);
    }
    return mapa;
  })();

  // Eventos de la tanda elegida
  const eventosTanda = tandaSeleccionada ? tandas.get(tandaSeleccionada)?.eventos || [] : [];
  // Eventos realmente activos (categorías marcadas)
  const eventosActivos = eventosTanda.filter((e) => categoriasSeleccionadas.includes(e.categoria));
  const idsActivos = eventosActivos.map((e) => e.id);

  // Cargar pasos de los eventos activos
  const cargarPasos = async (ids: string[]) => {
    if (ids.length === 0) {
      setPasos([]);
      return;
    }
    try {
      const { data, error } = await supabaseClient
        .from('pasos_carrera')
        .select('*')
        .in('carrera_id', ids)
        // Vuelta de mayor a menor; dentro de cada vuelta, por ORDEN DE PASO
        // (tiempo ascendente = 1º el que cruzó primero). Control por vuelta.
        .order('vuelta', { ascending: false })
        .order('tiempo_ms', { ascending: true });
      if (error) throw error;
      setPasos(data || []);
    } catch (err) {
      console.error('Error cargando pasos:', err);
    }
  };

  const toggleCategoria = (cat: string) => {
    setCategoriasSeleccionadas((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  // Al elegir una tanda, por defecto marca todas sus categorías
  const elegirTanda = (clave: string) => {
    setTandaSeleccionada(clave);
    const cats = (tandas.get(clave)?.eventos || []).map((e) => e.categoria);
    setCategoriasSeleccionadas(cats);
  };

  // ¿Esta tanda ya tiene salida dada (guardada)?
  const tandaYaSalio = (clave: string | null) => {
    if (!clave) return false;
    return leerSalidas()[clave] != null;
  };

  // Estado de una tanda: 'nueva' | 'en_curso' | 'cerrada'
  const estadoTanda = (clave: string): 'nueva' | 'en_curso' | 'cerrada' => {
    const s = leerSalidas()[clave];
    if (!s) return 'nueva';
    return s.cerrada ? 'cerrada' : 'en_curso';
  };

  // Estado de salidas por tanda guardado en localStorage (cada hora recuerda su propia
  // salida). Clave = "fecha|hora" -> { salidaAt, pausadoEn }. Sobrevive recargas/caídas.
  const LS_KEY = 'controlEvento_salidas';
  type SalidaLS = { salidaAt: number; pausadoEn: number | null; cerrada?: boolean };
  const leerSalidas = (): Record<string, SalidaLS> => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    } catch {
      return {};
    }
  };
  // Guardar/actualizar la salida de UNA tanda (sin borrar las demás)
  const guardarSalidaTanda = (clave: string, salida: number, pausa: number | null, cerrada = false) => {
    try {
      const todas = leerSalidas();
      todas[clave] = { salidaAt: salida, pausadoEn: pausa, cerrada };
      localStorage.setItem(LS_KEY, JSON.stringify(todas));
    } catch {}
  };

  // Comenzar el control de la tanda con las categorías marcadas.
  // "Dar salida": si la tanda NUNCA salió, da la salida ahora (crono nuevo en 0).
  // Si la tanda YA salió antes, la RETOMA con su hora y pasos originales (no reinicia).
  const comenzarControl = async () => {
    if (!tandaSeleccionada || categoriasSeleccionadas.length === 0) {
      alert('Seleccioná una tanda y al menos una categoría');
      return;
    }
    const guardadas = leerSalidas();
    const existente = guardadas[tandaSeleccionada];

    if (existente) {
      // Retomar/REABRIR una salida ya dada: mostrar su crono y sus pasos (y marcarla NO cerrada)
      setControlActivo(true);
      setSalidaCerrada(false);
      setSalidaAt(existente.salidaAt);
      setPausadoEn(existente.pausadoEn ?? null);
      setCronometroMs(0);
      guardarSalidaTanda(tandaSeleccionada, existente.salidaAt, existente.pausadoEn ?? null, false);
      cargarPasos(idsActivos);
    } else {
      // Salida nueva: arranca el crono al instante
      const ahora = Date.now();
      setControlActivo(true);
      setSalidaCerrada(false);
      setSalidaAt(ahora);
      setPausadoEn(null);
      setCronometroMs(0);
      guardarSalidaTanda(tandaSeleccionada, ahora, null);
      setPasos([]); // pantalla limpia para la nueva salida
      cargarPasos(idsActivos);
    }
  };

  // Cerrar la salida: detiene el crono, LIMPIA la pantalla y vuelve a la selección.
  // La salida queda GUARDADA (se puede volver a abrir esa hora y ver sus pasos).
  // Los tiempos registrados quedan en la base (Tracking los conserva todos).
  // Cerrar la salida: detiene el crono y deja la tanda en pantalla en modo SOLO LECTURA
  // (estado "Cerrada"). No vuelve a la selección; para eso está "Volver a salidas".
  const salirControl = () => {
    if (!confirm('¿Cerrar esta salida?\n\nEl cronómetro se detiene y la tanda queda cerrada (solo lectura).\nLos tiempos quedan guardados. Podés reabrirla después desde la lista de salidas.')) return;
    // Congelar el crono en el tiempo actual y marcar la tanda como CERRADA
    const ms = calcularMs();
    setPausadoEn(ms);
    setCronometroMs(ms);
    setSalidaCerrada(true);
    if (tandaSeleccionada && salidaAt != null) {
      guardarSalidaTanda(tandaSeleccionada, salidaAt, ms, true);
    }
  };

  // Volver a la lista de salidas (sin cerrar; solo sale de la pantalla de control)
  const volverASalidas = () => {
    setControlActivo(false);
    setSalidaCerrada(false);
    setSalidaAt(null);
    setPausadoEn(null);
    setCronometroMs(0);
    setPasos([]);
    setTandaSeleccionada(null);
    setCategoriasSeleccionadas([]);
  };

  // Pausar: congela el tiempo transcurrido actual.
  const pausarCrono = () => {
    const ms = calcularMs();
    setPausadoEn(ms);
    if (tandaSeleccionada && salidaAt != null) guardarSalidaTanda(tandaSeleccionada, salidaAt, ms);
  };

  // Reanudar: recalcula la salida para que el tiempo siga desde donde estaba.
  const reanudarCrono = () => {
    if (pausadoEn == null) return;
    const nuevaSalida = Date.now() - pausadoEn;
    setSalidaAt(nuevaSalida);
    setPausadoEn(null);
    if (tandaSeleccionada) guardarSalidaTanda(tandaSeleccionada, nuevaSalida, null);
  };

  // Refrescar la pantalla cada 100ms recalculando contra el reloj real.
  // (No acumula; aunque la pestaña se congele, al volver muestra el tiempo correcto.)
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCronometroMs(calcularMs());
    }, 100);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salidaAt, pausadoEn]);

  // Al cargar la página, recuperar una tanda en curso (si la hay) tras recargar/caída.
  // Nota: al cargar la página se entra por la pantalla de selección de tanda.
  // Como cada salida queda guardada por hora, al elegir una tanda que ya salió y
  // tocar "Dar salida" se retoma su crono y pasos (no se reinicia).

  // Registrar paso: busca la categoría del dorsal y lo asigna al evento correcto
  const registrarPaso = async () => {
    if (!dorsal.trim()) return;
    setAviso(null);
    setGuardando(true);
    try {
      const d = dorsal.trim();
      // Buscar al corredor por dorsal en inscripciones (trae su categoría y su evento de inscripción)
      const { data: inscritoData } = await supabaseClient
        .from('inscripciones')
        .select('nombre, primer_apellido, segundo_apellido, equipo, categoria, evento')
        .eq('dorsal', d)
        .limit(1)
        .maybeSingle();

      let nombre = 'Por definir';
      let equipo = 'Por definir';
      let categoria = '';

      if (inscritoData) {
        nombre =
          [inscritoData.nombre, inscritoData.primer_apellido, inscritoData.segundo_apellido]
            .filter(Boolean)
            .join(' ')
            .trim() || 'Por definir';
        equipo = inscritoData.equipo || 'Por definir';
        categoria = inscritoData.categoria || '';
      }

      // Match por CATEGORÍA: el paso va al evento activo cuya categoría coincida con la
      // del corredor. NO se valida el tipo (XCC/XCO) contra el evento de inscripción:
      // en pista manda la realidad (si el corredor está corriendo esta tanda, su tiempo
      // se registra en su categoría), sin importar en qué modalidad se inscribió.
      // Si la tanda tiene la misma categoría en XCC y XCO (raro), se prioriza el tipo de la tanda.
      let eventoDestino: Evento | undefined;
      if (categoria) {
        eventoDestino = eventosActivos.find((e) => e.categoria === categoria);
      }

      // REGLA CLAVE: el tiempo SIEMPRE se registra, aunque el dorsal no tenga datos.
      // Si no se puede determinar la categoría exacta, se registra en la primera
      // categoría activa de la tanda y se avisa para revisarlo/corregirlo luego.
      let avisoReg: string;
      if (eventoDestino) {
        avisoReg = `✓ Dorsal ${d} → ${eventoDestino.categoria} (${nombre})`;
      } else {
        eventoDestino = eventosActivos[0];
        avisoReg = `⚠️ Dorsal ${d} SIN datos (${categoria ? `categoría "${categoria}" no calza` : 'no está en inscripciones'}). Tiempo registrado en "${eventoDestino.categoria}" — revisá/corregí luego.`;
      }

      const vuelta = pasos.filter((p) => p.dorsal === d && p.carrera_id === eventoDestino!.id).length + 1;

      const nuevoPaso = {
        carrera_id: eventoDestino.id,
        dorsal: d,
        vuelta,
        tiempo_ms: calcularMs(), // tiempo exacto contra el reloj real en este instante
        nombre,
        equipo,
        categoria: eventoDestino.categoria,
        es_rezagado: false,
      };

      const { data, error } = await supabaseClient
        .from('pasos_carrera')
        .insert(nuevoPaso)
        .select()
        .single();

      if (error) throw error;

      // Insertar el nuevo paso manteniendo el orden: vuelta DESC, tiempo ASC (orden de paso)
      setPasos((prev) =>
        [data as Paso, ...prev].sort((a, b) =>
          a.vuelta !== b.vuelta ? b.vuelta - a.vuelta : a.tiempo_ms - b.tiempo_ms
        )
      );
      setDorsal('');
      setAviso(avisoReg);
    } catch (err) {
      console.error(err);
      alert('Error al registrar paso: ' + (err instanceof Error ? err.message : 'Desconocido'));
    } finally {
      setGuardando(false);
    }
  };

  // Editar el dorsal de un paso ya registrado (por si se tecleó mal).
  // Mantiene el tiempo y la vuelta, pero re-busca nombre/equipo/categoría del nuevo
  // dorsal y reasigna el paso a la categoría que corresponda (si está en la tanda).
  const editarDorsalPaso = async (paso: Paso) => {
    const nuevo = prompt(`Editar dorsal del paso (tiempo ${formatoTiempo(paso.tiempo_ms)}).\nDorsal actual: ${paso.dorsal}\n\nNuevo dorsal:`, paso.dorsal);
    if (nuevo == null) return;
    const d = nuevo.trim();
    if (!d || d === paso.dorsal) return;

    try {
      // Buscar al corredor del nuevo dorsal
      const { data: ins } = await supabaseClient
        .from('inscripciones')
        .select('nombre, primer_apellido, segundo_apellido, equipo, categoria')
        .eq('dorsal', d)
        .limit(1)
        .maybeSingle();

      let nombre = 'Por definir';
      let equipo = 'Por definir';
      let categoria = '';
      if (ins) {
        nombre = [ins.nombre, ins.primer_apellido, ins.segundo_apellido].filter(Boolean).join(' ').trim() || 'Por definir';
        equipo = ins.equipo || 'Por definir';
        categoria = ins.categoria || '';
      }

      // Decidir carrera_id según la categoría del nuevo dorsal (si calza en la tanda)
      let destino = eventosActivos.find((e) => e.categoria === categoria);
      let avisoTxt = '';
      if (destino) {
        avisoTxt = `✓ Dorsal corregido a ${d} → ${destino.categoria} (${nombre})`;
      } else {
        // Si no calza, se queda en la misma carrera del paso original
        destino = eventosActivos.find((e) => e.id === paso.carrera_id) || eventosActivos[0];
        avisoTxt = `⚠️ Dorsal corregido a ${d}, pero ${categoria ? `su categoría "${categoria}" no está en la tanda` : 'no está en inscripciones'}. Quedó en "${destino?.categoria}".`;
      }

      const { data, error } = await supabaseClient
        .from('pasos_carrera')
        .update({ dorsal: d, nombre, equipo, categoria: destino?.categoria, carrera_id: destino?.id })
        .eq('id', paso.id)
        .select()
        .single();
      if (error) throw error;

      setPasos((prev) => prev.map((p) => (p.id === paso.id ? (data as Paso) : p)));
      setAviso(avisoTxt);
    } catch (err) {
      console.error(err);
      alert('Error al editar el dorsal: ' + (err instanceof Error ? err.message : 'Desconocido'));
    }
  };

  // Borrar un paso (por si el juez tecleó mal un dorsal)
  const borrarPaso = async (paso: Paso) => {
    if (!confirm(`¿Borrar el paso del dorsal ${paso.dorsal} (${formatoTiempo(paso.tiempo_ms)})?`)) return;
    try {
      const { error } = await supabaseClient
        .from('pasos_carrera')
        .delete()
        .eq('id', paso.id);
      if (error) throw error;
      setPasos((prev) => prev.filter((p) => p.id !== paso.id));
      setAviso(`🗑️ Paso del dorsal ${paso.dorsal} borrado.`);
    } catch (err) {
      console.error(err);
      alert('Error al borrar el paso: ' + (err instanceof Error ? err.message : 'Desconocido'));
    }
  };

  const formatoTiempo = (ms: number) => {
    const totalSeg = Math.floor(ms / 1000);
    const min = Math.floor(totalSeg / 60);
    const seg = totalSeg % 60;
    const centesimas = Math.floor((ms % 1000) / 10);
    return `${min}:${seg.toString().padStart(2, '0')}.${centesimas.toString().padStart(2, '0')}`;
  };

  // Cálculo del 80% EN VIVO por categoría (indicador de solo lectura).
  // - ochentaPct = 80% del tiempo de la 1ª vuelta del LÍDER (fijo toda la carrera).
  // - corte = acumulado del líder en su última vuelta completada + ochentaPct (desde la 2ª vuelta).
  // "líder" = el primer corredor de la categoría en cruzar cada vuelta (menor tiempo en esa vuelta).
  const calculo80 = (carreraId: string): { ochentaPct: number | null; vueltaLider: number; corte: number | null } => {
    const ps = pasos.filter((p) => p.carrera_id === carreraId);
    if (ps.length === 0) return { ochentaPct: null, vueltaLider: 0, corte: null };

    // Primer corredor en cruzar la vuelta 1 = menor tiempo_ms en vuelta 1
    const vuelta1 = ps.filter((p) => p.vuelta === 1);
    if (vuelta1.length === 0) return { ochentaPct: null, vueltaLider: 0, corte: null };
    const tiempo1Lider = Math.min(...vuelta1.map((p) => p.tiempo_ms));
    const ochentaPct = Math.round(tiempo1Lider * 0.8);

    // Vuelta más alta ya cruzada por algún corredor (la del líder de la carrera)
    const vueltaLider = Math.max(...ps.map((p) => p.vuelta));

    // Desde la 2ª vuelta: acumulado del primero en cruzar la vuelta más alta + 80%
    let corte: number | null = null;
    if (vueltaLider >= 2) {
      const enVueltaMax = ps.filter((p) => p.vuelta === vueltaLider);
      const acumuladoLider = Math.min(...enVueltaMax.map((p) => p.tiempo_ms));
      corte = acumuladoLider + ochentaPct;
    }
    return { ochentaPct, vueltaLider, corte };
  };

  // Hora exacta a la que se dio la salida (banderazo), formato CR HH:MM:SS
  const horaSalidaStr = () => {
    if (salidaAt == null) return '—';
    return new Date(salidaAt).toLocaleTimeString('es-CR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'America/Costa_Rica',
    });
  };

  // Lista de tandas ordenada
  const listaTandas = Array.from(tandas.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-[#0d2240] text-white rounded-xl p-6 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Control de Carrera</h1>
            <p className="text-gray-300">VII Fecha Sarapiquí - La Copa</p>
          </div>
          <Link href="/" className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
            ← Volver
          </Link>
        </div>

        {/* PASO 1: elegir tanda (hora) y categorías */}
        {!controlActivo && (
          <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
            {eventos.length === 0 ? (
              <p className="text-sm text-gray-500 text-center">
                No hay eventos programados. Ve a Cronograma para crear uno.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Filtro por hora */}
                <div>
                  <h2 className="text-lg font-bold text-[#0d2240] mb-3">1. Hora de salida</h2>
                  <div className="space-y-2">
                    {listaTandas.map(([clave, t]) => (
                      <button
                        key={clave}
                        onClick={() => elegirTanda(clave)}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                          tandaSeleccionada === clave
                            ? 'border-[#1a4f8b] bg-blue-50 ring-2 ring-[#1a4f8b]'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className="font-bold text-[#0d2240]">{t.hora}</span>
                        <span className="text-gray-500 text-sm ml-2">{t.fecha}</span>
                        {estadoTanda(clave) === 'en_curso' && (
                          <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">▶️ en curso</span>
                        )}
                        {estadoTanda(clave) === 'cerrada' && (
                          <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">🏁 cerrada</span>
                        )}
                        <span className="block text-xs text-gray-500 mt-0.5">
                          {t.eventos.length} categoría{t.eventos.length !== 1 ? 's' : ''} · {t.eventos[0].tipo}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtro por categorías de la tanda */}
                <div>
                  <h2 className="text-lg font-bold text-[#0d2240] mb-3">2. Categorías</h2>
                  {!tandaSeleccionada ? (
                    <p className="text-sm text-gray-500">Elegí primero una hora de salida.</p>
                  ) : (
                    <>
                      <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-100">
                        {eventosTanda.map((ev) => (
                          <label
                            key={ev.id}
                            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={categoriasSeleccionadas.includes(ev.categoria)}
                              onChange={() => toggleCategoria(ev.categoria)}
                              className="rounded border-gray-300 text-[#1a4f8b] focus:ring-[#1a4f8b]"
                            />
                            <span>
                              {ev.categoria}{' '}
                              <span className="text-gray-400 text-xs">({ev.tipo})</span>
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {categoriasSeleccionadas.length} categoría(s) seleccionada(s). Todas se cronometran juntas.
                      </p>
                      <button
                        onClick={comenzarControl}
                        disabled={categoriasSeleccionadas.length === 0}
                        className={`mt-3 w-full text-white font-bold py-3 rounded-lg disabled:opacity-50 text-lg ${
                          tandaYaSalio(tandaSeleccionada) ? 'bg-[#1a4f8b] hover:bg-[#0d2240]' : 'bg-green-600 hover:bg-green-700'
                        }`}
                      >
                        {estadoTanda(tandaSeleccionada!) === 'cerrada'
                          ? '🔓 Reabrir salida'
                          : estadoTanda(tandaSeleccionada!) === 'en_curso'
                            ? '📂 Abrir salida (ya iniciada)'
                            : '▶️ Dar salida (inicia el crono)'}
                      </button>
                      <p className="text-xs text-gray-500 mt-1 text-center">
                        {estadoTanda(tandaSeleccionada!) === 'cerrada'
                          ? 'Esta salida está cerrada: reabrirla vuelve a activar el crono y muestra sus pasos.'
                          : estadoTanda(tandaSeleccionada!) === 'en_curso'
                            ? 'Esta salida ya fue dada: se retoma su crono y sus pasos (no se reinicia).'
                            : 'El cronómetro arranca al instante con este botón.'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASO 2: control en vivo */}
        {controlActivo && (
          <div className="space-y-6">
            {/* Info de la tanda */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-gray-600 text-sm">Tanda</p>
                  <p className="text-2xl font-bold text-[#0d2240]">
                    {tandas.get(tandaSeleccionada!)?.hora} · {tandas.get(tandaSeleccionada!)?.fecha}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Salida (banderazo)</p>
                  <p className="text-xl font-bold text-[#1a4f8b] font-mono">🚩 {horaSalidaStr()}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-600 text-sm">Estado</p>
                  <p className={`text-xl font-bold ${salidaCerrada ? 'text-gray-500' : corriendo ? 'text-green-600' : 'text-yellow-600'}`}>
                    {salidaCerrada ? '🏁 Cerrada' : corriendo ? 'EN VIVO' : 'Parado'}
                  </p>
                </div>
                {salidaCerrada ? (
                  <button onClick={volverASalidas} className="bg-gray-600 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 font-medium ml-4 text-sm whitespace-nowrap">
                    ← Volver a salidas
                  </button>
                ) : (
                  <button onClick={salirControl} className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium ml-4 text-sm whitespace-nowrap">
                    🏁 Cerrar salida
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mb-4">
                {eventosActivos.map((e) => (
                  <span key={e.id} className="bg-[#1a4f8b] text-white text-xs px-2 py-1 rounded-full">
                    {e.categoria} ({e.tipo})
                  </span>
                ))}
              </div>

              {/* Panel 80% en vivo por categoría */}
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Regla del 80% (por categoría)</p>
                <div className="space-y-1.5">
                  {eventosActivos.map((e) => {
                    const r = calculo80(e.id);
                    return (
                      <div key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm bg-gray-50 rounded-lg px-3 py-2">
                        <span className="font-semibold text-[#0d2240] min-w-[140px]">{e.categoria}</span>
                        {r.ochentaPct == null ? (
                          <span className="text-gray-400">Esperando 1ª vuelta…</span>
                        ) : (
                          <>
                            <span className="text-gray-600">80%: <span className="font-mono font-bold text-[#1a4f8b]">{formatoTiempo(r.ochentaPct)}</span></span>
                            {r.corte == null ? (
                              <span className="text-gray-400 text-xs">(corte desde la 2ª vuelta)</span>
                            ) : (
                              <span className="text-red-700 font-semibold">
                                ✂️ Sacar si pasa después de <span className="font-mono">{formatoTiempo(r.corte)}</span>
                                <span className="text-gray-400 font-normal text-xs ml-1">(vta {r.vueltaLider})</span>
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cronómetro y entrada */}
            <div className="bg-white rounded-xl shadow-md p-8">
              <div className="text-center mb-8">
                <p className="text-sm text-gray-500 mb-1">🚩 Salida: <span className="font-mono font-bold text-[#1a4f8b]">{horaSalidaStr()}</span></p>
                <div className="text-6xl font-bold text-[#0d2240] font-mono mb-4">
                  {formatoTiempo(cronometroMs)}
                </div>
                {!salidaCerrada && (
                  <button
                    onClick={corriendo ? pausarCrono : reanudarCrono}
                    className={`px-8 py-3 rounded-lg font-bold text-white text-lg ${
                      corriendo ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {corriendo ? '⏸️ Pausar' : '▶️ Reanudar'}
                  </button>
                )}
                {salidaCerrada && (
                  <p className="text-gray-500 font-semibold">Salida cerrada · tiempo final</p>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dorsal</label>
                  <input
                    type="text"
                    value={dorsal}
                    onChange={(e) => setDorsal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && registrarPaso()}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[#1a4f8b]"
                    placeholder="101"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    El sistema detecta la categoría del dorsal y registra el paso en la que corresponde.
                  </p>
                </div>

                <button
                  onClick={registrarPaso}
                  disabled={guardando || !corriendo || !dorsal.trim()}
                  className="w-full bg-[#1a4f8b] text-white font-bold py-3 rounded-lg hover:bg-[#0d2240] disabled:opacity-50"
                >
                  {guardando ? 'Registrando...' : '✓ Registrar paso'}
                </button>

                {aviso && (
                  <p
                    className={`text-sm rounded-lg p-2 ${
                      aviso.startsWith('⚠️')
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-green-50 text-green-800'
                    }`}
                  >
                    {aviso}
                  </p>
                )}
              </div>
            </div>

            {/* Últimos pasos */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-[#0d2240]">Últimos pasos ({pasos.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Vuelta</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Orden</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Dorsal</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Categoría</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Tiempo</th>
                      <th className="px-4 py-2 text-center font-semibold text-gray-700">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pasos.map((paso, idx) => {
                      // Orden de paso dentro de su vuelta (1º, 2º... los que cruzaron antes).
                      // Como los pasos vienen vuelta DESC + tiempo ASC, cuento los de la
                      // misma vuelta que van antes en la lista.
                      const mismaVuelta = pasos.filter((p) => p.vuelta === paso.vuelta);
                      const ordenEnVuelta = mismaVuelta.findIndex((p) => p.id === paso.id) + 1;
                      // Marcar el inicio de una vuelta nueva con una línea más gruesa
                      const esInicioVuelta = idx === 0 || pasos[idx - 1].vuelta !== paso.vuelta;
                      return (
                      <tr key={paso.id} className={`hover:bg-gray-50 ${esInicioVuelta ? 'border-t-4 border-t-[#1a4f8b]' : 'border-b border-gray-200'}`}>
                        <td className="px-4 py-2 font-semibold text-[#0d2240]">{paso.vuelta}</td>
                        <td className="px-4 py-2 text-gray-600">{ordenEnVuelta}º</td>
                        <td className="px-4 py-2 font-bold text-lg">{paso.dorsal}</td>
                        <td className="px-4 py-2 text-xs text-gray-600">{paso.categoria || '—'}</td>
                        <td className="px-4 py-2 font-mono">{formatoTiempo(paso.tiempo_ms)}</td>
                        <td className="px-4 py-2 text-center whitespace-nowrap">
                          <button
                            onClick={() => editarDorsalPaso(paso)}
                            className="text-[#1a4f8b] hover:text-[#0d2240] text-sm font-medium mr-3"
                            title="Editar el dorsal de este paso"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => borrarPaso(paso)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                            title="Borrar este paso"
                          >
                            🗑️ Borrar
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cerrar salida (solo si no está ya cerrada) */}
            {!salidaCerrada ? (
              <>
                <button
                  onClick={salirControl}
                  className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700"
                >
                  🏁 Cerrar salida
                </button>
                <p className="text-xs text-gray-500 text-center -mt-3">
                  Detiene el crono y marca la salida como cerrada. Los tiempos quedan guardados.
                </p>
              </>
            ) : (
              <button
                onClick={volverASalidas}
                className="w-full bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-700"
              >
                ← Volver a salidas
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
