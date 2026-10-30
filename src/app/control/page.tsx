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
  const [pasos, setPasos] = useState<Paso[]>([]);
  const [cronometroMs, setCronometroMs] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [dorsal, setDorsal] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
        .order('vuelta', { ascending: false })
        .order('tiempo_ms', { ascending: false });
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

  // Comenzar el control de la tanda con las categorías marcadas
  const comenzarControl = async () => {
    if (!tandaSeleccionada || categoriasSeleccionadas.length === 0) {
      alert('Seleccioná una tanda y al menos una categoría');
      return;
    }
    setControlActivo(true);
    await cargarPasos(idsActivos);
  };

  const salirControl = () => {
    setControlActivo(false);
    setCorriendo(false);
    setCronometroMs(0);
    setPasos([]);
    setTandaSeleccionada(null);
    setCategoriasSeleccionadas([]);
  };

  const iniciarCarrera = () => {
    setCorriendo(true);
    setCronometroMs(0);
  };

  useEffect(() => {
    if (!corriendo) return;
    timerRef.current = setInterval(() => {
      setCronometroMs((ms) => ms + 100);
    }, 100);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [corriendo]);

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
      let eventoInscripcion = ''; // "XCO" | "XCC" | "XCO+XCC" | "XCO+XCC+XCE"

      if (inscritoData) {
        nombre =
          [inscritoData.nombre, inscritoData.primer_apellido, inscritoData.segundo_apellido]
            .filter(Boolean)
            .join(' ')
            .trim() || 'Por definir';
        equipo = inscritoData.equipo || 'Por definir';
        categoria = inscritoData.categoria || '';
        eventoInscripcion = (inscritoData.evento || '').toUpperCase();
      }

      // Match por DORSAL + EVENTO: el paso va al evento activo cuya categoría coincida
      // y cuyo tipo (XCC/XCO) esté incluido en el evento de inscripción del corredor
      // (ej. un inscrito en "XCO+XCC" participa tanto en tandas XCC como XCO).
      let eventoDestino: Evento | undefined;
      if (categoria) {
        eventoDestino = eventosActivos.find(
          (e) => e.categoria === categoria && eventoInscripcion.includes(e.tipo)
        );
      }
      // Si no calza por categoría + evento:
      if (!eventoDestino) {
        if (eventosActivos.length === 1) {
          // Solo hay una categoría en control -> asignar ahí igual, con aviso
          eventoDestino = eventosActivos[0];
          setAviso(
            `Dorsal ${d}: ${categoria ? `categoría "${categoria}"${eventoInscripcion ? ` / evento "${eventoInscripcion}"` : ''} no calza con la tanda, ` : 'sin datos en inscripciones, '}se registró en "${eventoDestino.categoria}" (${eventoDestino.tipo}).`
          );
        } else {
          setAviso(
            `⚠️ Dorsal ${d}: ${categoria ? `su categoría "${categoria}" / evento "${eventoInscripcion}" no coincide con ninguna tanda activa` : 'no se encontró en inscripciones'}. No se registró. Revisá el dorsal o la selección.`
          );
          setGuardando(false);
          return;
        }
      }

      const vuelta = pasos.filter((p) => p.dorsal === d && p.carrera_id === eventoDestino!.id).length + 1;

      const nuevoPaso = {
        carrera_id: eventoDestino.id,
        dorsal: d,
        vuelta,
        tiempo_ms: cronometroMs,
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

      setPasos([data, ...pasos]);
      setDorsal('');
      if (!aviso) {
        setAviso(`✓ Dorsal ${d} → ${eventoDestino.categoria} (${nombre})`);
      }
    } catch (err) {
      console.error(err);
      alert('Error al registrar paso: ' + (err instanceof Error ? err.message : 'Desconocido'));
    } finally {
      setGuardando(false);
    }
  };

  const formatoTiempo = (ms: number) => {
    const totalSeg = Math.floor(ms / 1000);
    const min = Math.floor(totalSeg / 60);
    const seg = totalSeg % 60;
    const centesimas = Math.floor((ms % 1000) / 10);
    return `${min}:${seg.toString().padStart(2, '0')}.${centesimas.toString().padStart(2, '0')}`;
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
                        className="mt-3 w-full bg-[#1a4f8b] text-white font-bold py-3 rounded-lg hover:bg-[#0d2240] disabled:opacity-50"
                      >
                        Comenzar control →
                      </button>
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
                <div className="text-right">
                  <p className="text-gray-600 text-sm">Estado</p>
                  <p className={`text-xl font-bold ${corriendo ? 'text-green-600' : 'text-yellow-600'}`}>
                    {corriendo ? 'EN VIVO' : 'Parado'}
                  </p>
                </div>
                <button onClick={salirControl} className="text-red-600 hover:text-red-800 font-medium ml-4">
                  ✕ Cambiar
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {eventosActivos.map((e) => (
                  <span key={e.id} className="bg-[#1a4f8b] text-white text-xs px-2 py-1 rounded-full">
                    {e.categoria} ({e.tipo})
                  </span>
                ))}
              </div>
            </div>

            {/* Cronómetro y entrada */}
            <div className="bg-white rounded-xl shadow-md p-8">
              <div className="text-center mb-8">
                <div className="text-6xl font-bold text-[#0d2240] font-mono mb-4">
                  {formatoTiempo(cronometroMs)}
                </div>
                <button
                  onClick={corriendo ? () => setCorriendo(false) : iniciarCarrera}
                  className={`px-8 py-3 rounded-lg font-bold text-white text-lg ${
                    corriendo ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {corriendo ? '⏸️ Pausar' : '▶️ Iniciar'}
                </button>
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
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Dorsal</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Categoría</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Tiempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pasos.slice(0, 15).map((paso) => (
                      <tr key={paso.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-2 font-semibold text-[#0d2240]">{paso.vuelta}</td>
                        <td className="px-4 py-2 font-bold text-lg">{paso.dorsal}</td>
                        <td className="px-4 py-2 text-xs text-gray-600">{paso.categoria || '—'}</td>
                        <td className="px-4 py-2 font-mono">{formatoTiempo(paso.tiempo_ms)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
