'use client';

import { useState, useEffect, Fragment } from 'react';
import { supabaseClient } from '@/lib/supabase-client';

interface Paso {
  id: string;
  carrera_id: string;
  dorsal: string;
  vuelta: number;
  tiempo_ms: number;
  nombre: string;
  equipo: string;
  categoria?: string;
  timestamp?: string;
  es_rezagado: boolean;
}

interface VueltaDetalle {
  vuelta: number;
  acumulado: number;
  parcial: number;
  posicion: number;
}

interface Corredor {
  dorsal: string;
  nombre: string;
  equipo: string;
  vueltas: number;
  tiempo_ultima: number;
  detalle: VueltaDetalle[];
}

interface EventoTanda {
  id: string;
  categoria: string;
  tipo: string;
}

export default function VivoPage() {
  const [horaTanda, setHoraTanda] = useState<string>(''); // hora de salida de la tanda en curso
  const [eventosTanda, setEventosTanda] = useState<EventoTanda[]>([]); // categorías de esa tanda
  const [pasos, setPasos] = useState<Paso[]>([]); // pasos de TODA la tanda
  const [cargando, setCargando] = useState(true);
  const [expandida, setExpandida] = useState<string | null>(null); // "carreraId|dorsal"

  // Detecta la TANDA EN CURSO por la hora de salida del evento al que pertenece el
  // paso más reciente, y muestra TODAS las categorías de esa tanda (ej. las dos Élite).
  const cargar = async () => {
    try {
      // 1) Último paso registrado -> su carrera_id
      const { data: ultimo } = await supabaseClient
        .from('pasos_carrera')
        .select('carrera_id')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!ultimo || !ultimo.carrera_id) {
        setHoraTanda('');
        setEventosTanda([]);
        setPasos([]);
        return;
      }

      // 2) Fecha + hora de salida de ese evento (define la tanda)
      const { data: ev } = await supabaseClient
        .from('cronograma')
        .select('fecha, hora_salida')
        .eq('id', ultimo.carrera_id)
        .maybeSingle();
      if (!ev) return;

      // 3) Todos los eventos (categorías) de esa misma fecha+hora = la tanda completa
      const { data: evs } = await supabaseClient
        .from('cronograma')
        .select('id, categoria, tipo')
        .eq('fecha', ev.fecha)
        .eq('hora_salida', ev.hora_salida);
      const lista = (evs || []) as EventoTanda[];
      setEventosTanda(lista);
      setHoraTanda(ev.hora_salida);

      // 4) Pasos de todas las categorías de la tanda
      const ids = lista.map((e) => e.id);
      if (ids.length > 0) {
        const { data } = await supabaseClient
          .from('pasos_carrera')
          .select('*')
          .in('carrera_id', ids);
        setPasos((data || []) as Paso[]);
      } else {
        setPasos([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 5000); // auto-refresco cada 5 s
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clasificación de UNA categoría. La vuelta se RECALCULA por orden de tiempo
  // (ignora el campo 'vuelta' guardado, que puede quedar mal si se digita fuera de orden).
  const clasificacionDe = (carreraId: string): Corredor[] => {
    const ps = pasos.filter((p) => p.carrera_id === carreraId);
    if (ps.length === 0) return [];

    const porDorsal = new Map<string, Paso[]>();
    ps.forEach((p) => {
      if (!porDorsal.has(p.dorsal)) porDorsal.set(p.dorsal, []);
      porDorsal.get(p.dorsal)!.push(p);
    });

    // Acumulados por vuelta RECALCULADA (para la posición de pasada)
    const acumPorVuelta = new Map<number, number[]>();
    porDorsal.forEach((lista) => {
      const ord = [...lista].sort((a, b) => a.tiempo_ms - b.tiempo_ms);
      ord.forEach((p, i) => {
        const v = i + 1;
        if (!acumPorVuelta.has(v)) acumPorVuelta.set(v, []);
        acumPorVuelta.get(v)!.push(p.tiempo_ms);
      });
    });
    acumPorVuelta.forEach((arr) => arr.sort((a, b) => a - b));
    const posEnVuelta = (v: number, t: number) => (acumPorVuelta.get(v) || []).indexOf(t) + 1;

    const out: Corredor[] = [];
    porDorsal.forEach((lista, dorsal) => {
      const ordenados = [...lista].sort((a, b) => a.tiempo_ms - b.tiempo_ms);
      let anterior = 0;
      const detalle: VueltaDetalle[] = ordenados.map((p, i) => {
        const v = i + 1;
        const d = { vuelta: v, acumulado: p.tiempo_ms, parcial: p.tiempo_ms - anterior, posicion: posEnVuelta(v, p.tiempo_ms) };
        anterior = p.tiempo_ms;
        return d;
      });
      const ultimo = ordenados[ordenados.length - 1];
      out.push({
        dorsal,
        nombre: ultimo.nombre,
        equipo: ultimo.equipo,
        vueltas: ordenados.length,
        tiempo_ultima: ultimo.tiempo_ms,
        detalle,
      });
    });
    return out.sort((a, b) => {
      if (a.vueltas !== b.vueltas) return b.vueltas - a.vueltas;
      return a.tiempo_ultima - b.tiempo_ultima;
    });
  };

  const formatoTiempo = (ms: number) => {
    const totalSeg = Math.floor(ms / 1000);
    const horas = Math.floor(totalSeg / 3600);
    const min = Math.floor((totalSeg % 3600) / 60);
    const seg = totalSeg % 60;
    const cc = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
    const mm = min.toString().padStart(2, '0');
    const ss = seg.toString().padStart(2, '0');
    if (horas > 0) return `${horas}:${mm}:${ss}.${cc}`;
    return `${min}:${ss}.${cc}`;
  };

  const hayDatos = eventosTanda.length > 0;

  return (
    <div className="min-h-screen bg-[#0d2240] text-white p-4">
      <div className="max-w-5xl mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-6 pt-4">
          <p className="text-sm uppercase tracking-widest text-blue-300">VII Fecha Sarapiquí · La Copa · EN VIVO</p>
          {hayDatos ? (
            <h1 className="text-3xl md:text-4xl font-bold mt-2">
              Salida {horaTanda?.slice(0, 5)}
            </h1>
          ) : (
            <h1 className="text-3xl font-bold mt-2 text-blue-200">Esperando inicio de carrera…</h1>
          )}
        </div>

        {cargando ? (
          <p className="text-center text-blue-200">Cargando…</p>
        ) : !hayDatos ? (
          <p className="text-center text-blue-200 py-10">Aún no hay tiempos registrados.</p>
        ) : (
          <div className="space-y-6">
            {eventosTanda.map((ev) => {
              const clasif = clasificacionDe(ev.id);
              const vueltaActual = clasif.length > 0 ? Math.max(...clasif.map((c) => c.vueltas)) : 0;
              return (
                <div key={ev.id} className="bg-white text-gray-900 rounded-xl overflow-hidden shadow-2xl">
                  <div className="bg-[#1a4f8b] text-white px-4 py-3 flex items-center justify-between flex-wrap gap-1">
                    <h2 className="text-xl font-bold">
                      {ev.categoria} <span className="text-blue-200 text-sm font-normal">· {ev.tipo}</span>
                    </h2>
                    <span className="text-blue-200 text-sm">Vuelta {vueltaActual} · {clasif.length} corredores</span>
                  </div>
                  {clasif.length === 0 ? (
                    <p className="px-4 py-5 text-center text-gray-500 text-sm">Sin tiempos aún</p>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left font-bold text-gray-700">POS</th>
                          <th className="px-4 py-2 text-left font-bold text-gray-700">Dorsal</th>
                          <th className="px-4 py-2 text-left font-bold text-gray-700">Nombre</th>
                          <th className="px-4 py-2 text-left font-bold text-gray-700 hidden sm:table-cell">Equipo</th>
                          <th className="px-4 py-2 text-left font-bold text-gray-700">Vueltas</th>
                          <th className="px-4 py-2 text-left font-bold text-gray-700">Última vuelta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clasif.map((c, idx) => {
                          const claveFila = `${ev.id}|${c.dorsal}`;
                          const abierta = expandida === claveFila;
                          return (
                          <Fragment key={c.dorsal}>
                            <tr
                              onClick={() => setExpandida(abierta ? null : claveFila)}
                              className={`border-b border-gray-200 cursor-pointer hover:bg-blue-50 ${idx === 0 ? 'bg-yellow-50' : ''}`}
                            >
                              <td className="px-4 py-2 font-bold text-lg text-[#0d2240]">
                                {abierta ? '▾ ' : ''}{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                              </td>
                              <td className="px-4 py-2 font-bold text-lg">{c.dorsal}</td>
                              <td className="px-4 py-2">{c.nombre}</td>
                              <td className="px-4 py-2 text-gray-600 text-sm hidden sm:table-cell">{c.equipo}</td>
                              <td className="px-4 py-2 font-bold text-green-600">{c.vueltas}</td>
                              <td className="px-4 py-2 font-mono">{c.tiempo_ultima > 0 ? formatoTiempo(c.tiempo_ultima) : '-'}</td>
                            </tr>
                            {abierta && (
                              <tr className="bg-gray-50">
                                <td colSpan={6} className="px-6 py-3">
                                  <p className="text-xs font-semibold text-gray-600 mb-2">Desglose por vuelta · dorsal {c.dorsal}</p>
                                  <table className="w-full max-w-md text-xs">
                                    <thead>
                                      <tr className="text-gray-500">
                                        <th className="text-left py-1 pr-4">Vuelta</th>
                                        <th className="text-left py-1 pr-4">Pos</th>
                                        <th className="text-left py-1 pr-4">Acumulado</th>
                                        <th className="text-left py-1">Tiempo de la vuelta</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {c.detalle.map((v) => (
                                        <tr key={v.vuelta} className="border-t border-gray-200">
                                          <td className="py-1 pr-4 font-semibold text-[#0d2240]">{v.vuelta}</td>
                                          <td className="py-1 pr-4 font-bold text-green-700">{v.posicion}º</td>
                                          <td className="py-1 pr-4 font-mono">{formatoTiempo(v.acumulado)}</td>
                                          <td className="py-1 font-mono text-[#1a4f8b]">{formatoTiempo(v.parcial)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-blue-400 text-xs mt-4">Se actualiza automáticamente · mtbcostarica.org</p>
      </div>
    </div>
  );
}
