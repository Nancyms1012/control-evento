'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabase-client';

interface Carrera {
  id: string;
  tipo: 'XCC' | 'XCO';
  categoria: string;
  fecha?: string;
  hora_salida?: string;
  duracion_minutos?: number;
  vueltas_totales?: number;
}

interface Paso {
  id: string;
  carrera_id: string;
  dorsal: string;
  vuelta: number;
  tiempo_ms: number;
  nombre: string;
  equipo: string;
  categoria?: string;
  es_rezagado: boolean;
}

interface VueltaDetalle {
  vuelta: number;
  acumulado: number; // tiempo del crono al cruzar esa vuelta
  parcial: number; // lo que tardó esa vuelta (acumulado - acumulado anterior)
}

interface Corredor {
  dorsal: string;
  nombre: string;
  equipo: string;
  vueltas: number;
  tiempo_ultima: number;
  rezagado: boolean;
  detalle: VueltaDetalle[];
}

export default function TrackingPage() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [tandaClave, setTandaClave] = useState<string>(''); // "fecha|hora"
  const [filtroCategoria, setFiltroCategoria] = useState<string>(''); // '' = todas
  const [pasos, setPasos] = useState<Paso[]>([]); // pasos de TODA la tanda seleccionada
  const [cargando, setCargando] = useState(true);
  // Fila expandida: clave "carreraId|dorsal" para mostrar el desglose por vuelta
  const [expandida, setExpandida] = useState<string | null>(null);
  const tandaRef = useRef<string>('');

  useEffect(() => {
    cargarCarreras();
    // Realtime de Supabase (si está habilitado en la tabla)
    const channel = supabaseClient
      .channel('pasos_carrera_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pasos_carrera' }, () => {
        if (tandaRef.current) cargarPasosTanda(tandaRef.current);
      })
      .subscribe();
    // Respaldo: refrescar cada 5 s aunque Realtime no esté activo (así no hay que refrescar a mano)
    const intervalo = setInterval(() => {
      if (tandaRef.current) cargarPasosTanda(tandaRef.current);
    }, 5000);
    return () => {
      supabaseClient.removeChannel(channel);
      clearInterval(intervalo);
    };
  }, []);

  const cargarCarreras = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('cronograma')
        .select('*')
        .order('fecha', { ascending: true })
        .order('hora_salida', { ascending: true });
      if (error) throw error;
      const lista = (data || []) as Carrera[];
      setCarreras(lista);
      // Seleccionar la primera tanda disponible
      if (lista.length > 0) {
        const clave = `${lista[0].fecha}|${lista[0].hora_salida}`;
        setTandaClave(clave);
        tandaRef.current = clave;
        // Pasar la lista recién traída (el estado 'carreras' aún no se actualizó)
        cargarPasosTanda(clave, lista);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  // Agrupar carreras por tanda (fecha|hora)
  const tandas = (() => {
    const mapa = new Map<string, { fecha: string; hora: string; carreras: Carrera[] }>();
    for (const c of carreras) {
      const clave = `${c.fecha}|${c.hora_salida}`;
      if (!mapa.has(clave)) mapa.set(clave, { fecha: c.fecha || '', hora: c.hora_salida || '', carreras: [] });
      mapa.get(clave)!.carreras.push(c);
    }
    return mapa;
  })();

  const carrerasTanda = tandaClave ? tandas.get(tandaClave)?.carreras || [] : [];

  const seleccionarTanda = (clave: string) => {
    setTandaClave(clave);
    setFiltroCategoria(''); // al cambiar de salida, mostrar todas las categorías
    tandaRef.current = clave;
    cargarPasosTanda(clave);
  };

  // Cargar los pasos de TODAS las categorías de la tanda.
  // `fuente` permite pasar la lista recién traída cuando el estado aún no se actualizó.
  const cargarPasosTanda = async (clave: string, fuente?: Carrera[]) => {
    const base = fuente || carreras;
    const [fecha, hora] = clave.split('|');
    const cs = base.filter((c) => c.fecha === fecha && c.hora_salida === hora);
    const ids = cs.map((c) => c.id);
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
      setPasos((data || []) as Paso[]);
    } catch (err) {
      console.error(err);
    }
  };

  // Clasificación de una categoría (carrera) concreta
  const clasificacionDe = (carreraId: string): Corredor[] => {
    const pasosCat = pasos.filter((p) => p.carrera_id === carreraId);
    if (pasosCat.length === 0) return [];
    // Agrupar los pasos por dorsal
    const porDorsal = new Map<string, Paso[]>();
    pasosCat.forEach((p) => {
      if (!porDorsal.has(p.dorsal)) porDorsal.set(p.dorsal, []);
      porDorsal.get(p.dorsal)!.push(p);
    });

    const corredores: Corredor[] = [];
    porDorsal.forEach((listaPasos, dorsal) => {
      // Ordenar las vueltas de este corredor ascendente
      const ordenados = [...listaPasos].sort((a, b) => a.vuelta - b.vuelta);
      // Construir el desglose por vuelta: acumulado y parcial (resta con la anterior)
      let anterior = 0;
      const detalle: VueltaDetalle[] = ordenados.map((p) => {
        const d = { vuelta: p.vuelta, acumulado: p.tiempo_ms, parcial: p.tiempo_ms - anterior };
        anterior = p.tiempo_ms;
        return d;
      });
      const ultimo = ordenados[ordenados.length - 1];
      corredores.push({
        dorsal,
        nombre: ultimo.nombre,
        equipo: ultimo.equipo,
        vueltas: ultimo.vuelta,
        tiempo_ultima: ultimo.tiempo_ms, // acumulado total en la última vuelta
        rezagado: ordenados.some((p) => p.es_rezagado),
        detalle,
      });
    });

    return corredores.sort((a, b) => {
      if (a.vueltas !== b.vueltas) return b.vueltas - a.vueltas;
      return a.tiempo_ultima - b.tiempo_ultima;
    });
  };

  const formatoTiempo = (ms: number) => {
    const totalSeg = Math.floor(ms / 1000);
    const min = Math.floor(totalSeg / 60);
    const seg = totalSeg % 60;
    const centesimas = Math.floor((ms % 1000) / 10);
    return `${min}:${seg.toString().padStart(2, '0')}.${centesimas.toString().padStart(2, '0')}`;
  };

  const listaTandas = Array.from(tandas.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#0d2240]">Tracking en Vivo</h1>
            <p className="text-gray-600">Posiciones en tiempo real · todas las categorías de la salida</p>
          </div>
          <Link href="/" className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
            ← Volver
          </Link>
        </div>

        {/* Selectores: salida (hora) + filtro por categoría */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salida (hora)</label>
            <select
              value={tandaClave}
              onChange={(e) => seleccionarTanda(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a4f8b]"
            >
              <option value="">Seleccionar salida...</option>
              {listaTandas.map(([clave, t]) => (
                <option key={clave} value={clave}>
                  {t.hora} · {t.fecha} ({t.carreras.length} categoría{t.carreras.length !== 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>
          {carrerasTanda.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a4f8b]"
              >
                <option value="">Todas las categorías</option>
                {carrerasTanda.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.categoria}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {cargando ? (
          <div className="text-center text-gray-600">Cargando...</div>
        ) : carrerasTanda.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <p className="text-gray-600">No hay carreras en esta salida</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Una tabla de clasificación por categoría (filtrada si se eligió una) */}
            {carrerasTanda
              .filter((c) => !filtroCategoria || c.id === filtroCategoria)
              .map((c) => {
              const clasif = clasificacionDe(c.id);
              const maxV = clasif.length > 0 ? Math.max(...clasif.map((x) => x.vueltas)) : 0;
              return (
                <div key={c.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-lg font-bold text-[#0d2240]">
                      {c.categoria} <span className="text-gray-400 text-sm font-normal">· {c.tipo}</span>
                    </h2>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-600">Vuelta: <strong className="text-green-600">{maxV}</strong></span>
                      <span className="text-gray-600">Corredores: <strong className="text-[#0d2240]">{clasif.length}</strong></span>
                      {c.tipo === 'XCO' && c.vueltas_totales ? (
                        <span className="text-gray-600">Meta: <strong>{c.vueltas_totales}v</strong></span>
                      ) : null}
                      {c.tipo === 'XCC' && c.duracion_minutos ? (
                        <span className="text-gray-600">Duración: <strong>{c.duracion_minutos}min</strong></span>
                      ) : null}
                    </div>
                  </div>
                  {clasif.length === 0 ? (
                    <p className="p-6 text-center text-gray-500 text-sm">Sin pasos registrados aún</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700 w-8"></th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">POS</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Dorsal</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Nombre</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Equipo</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Vueltas</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Última vuelta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clasif.map((corredor, idx) => {
                            const claveFila = `${c.id}|${corredor.dorsal}`;
                            const abierta = expandida === claveFila;
                            return (
                              <Fragment key={corredor.dorsal}>
                                <tr
                                  onClick={() => setExpandida(abierta ? null : claveFila)}
                                  className={`border-b border-gray-200 hover:bg-blue-50 cursor-pointer ${idx === 0 ? 'bg-yellow-50' : ''}`}
                                  title="Clic para ver el desglose por vuelta"
                                >
                                  <td className="px-4 py-3 text-gray-400 text-center">{abierta ? '▾' : '▸'}</td>
                                  <td className="px-4 py-3 font-bold text-lg text-[#0d2240]">
                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                  </td>
                                  <td className="px-4 py-3 font-bold text-lg">{corredor.dorsal}</td>
                                  <td className="px-4 py-3">{corredor.nombre}</td>
                                  <td className="px-4 py-3 text-gray-600 text-xs">{corredor.equipo}</td>
                                  <td className="px-4 py-3 font-bold text-green-600">{corredor.vueltas}</td>
                                  <td className="px-4 py-3 font-mono text-sm">
                                    {corredor.vueltas > 0 ? formatoTiempo(corredor.tiempo_ultima) : '-'}
                                  </td>
                                </tr>
                                {abierta && (
                                  <tr className="bg-gray-50">
                                    <td colSpan={7} className="px-6 py-3">
                                      <p className="text-xs font-semibold text-gray-600 mb-2">
                                        Desglose por vuelta · dorsal {corredor.dorsal}
                                      </p>
                                      <table className="w-full text-xs max-w-md">
                                        <thead>
                                          <tr className="text-gray-500">
                                            <th className="text-left py-1 pr-4">Vuelta</th>
                                            <th className="text-left py-1 pr-4">Acumulado</th>
                                            <th className="text-left py-1">Tiempo de la vuelta</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {corredor.detalle.map((v) => (
                                            <tr key={v.vuelta} className="border-t border-gray-200">
                                              <td className="py-1 pr-4 font-semibold text-[#0d2240]">{v.vuelta}</td>
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
