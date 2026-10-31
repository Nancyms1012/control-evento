'use client';

import { useState, useEffect, useRef } from 'react';
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

interface Corredor {
  dorsal: string;
  nombre: string;
  equipo: string;
  vueltas: number;
  tiempo_ultima: number;
  rezagado: boolean;
}

export default function TrackingPage() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [tandaClave, setTandaClave] = useState<string>(''); // "fecha|hora"
  const [pasos, setPasos] = useState<Paso[]>([]); // pasos de TODA la tanda seleccionada
  const [cargando, setCargando] = useState(true);
  const tandaRef = useRef<string>('');

  useEffect(() => {
    cargarCarreras();
    const channel = supabaseClient
      .channel('pasos_carrera_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pasos_carrera' }, () => {
        // Al cambiar algo en pasos, recargar los de la tanda actual
        if (tandaRef.current) cargarPasosTanda(tandaRef.current);
      })
      .subscribe();
    return () => {
      supabaseClient.removeChannel(channel);
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
        cargarPasosTanda(clave);
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
    tandaRef.current = clave;
    cargarPasosTanda(clave);
  };

  // Cargar los pasos de TODAS las categorías de la tanda
  const cargarPasosTanda = async (clave: string) => {
    const cs = tandas.get(clave)?.carreras || [];
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
    const maxV = Math.max(...pasosCat.map((p) => p.vuelta));
    const dorsales = new Map<string, Corredor>();
    pasosCat.forEach((paso) => {
      if (!dorsales.has(paso.dorsal)) {
        dorsales.set(paso.dorsal, {
          dorsal: paso.dorsal,
          nombre: paso.nombre,
          equipo: paso.equipo,
          vueltas: 0,
          tiempo_ultima: 0,
          rezagado: false,
        });
      }
      const e = dorsales.get(paso.dorsal)!;
      e.vueltas = Math.max(e.vueltas, paso.vuelta);
      if (paso.vuelta === maxV) e.tiempo_ultima = paso.tiempo_ms;
      if (paso.es_rezagado) e.rezagado = true;
    });
    return Array.from(dorsales.values()).sort((a, b) => {
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

        {/* Selector de tanda (hora de salida) */}
        <div className="mb-6">
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

        {cargando ? (
          <div className="text-center text-gray-600">Cargando...</div>
        ) : carrerasTanda.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <p className="text-gray-600">No hay carreras en esta salida</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Una tabla de clasificación POR CADA categoría de la tanda */}
            {carrerasTanda.map((c) => {
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
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">POS</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Dorsal</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Nombre</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Equipo</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Vueltas</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-700">Última vuelta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clasif.map((corredor, idx) => (
                            <tr
                              key={corredor.dorsal}
                              className={`border-b border-gray-200 hover:bg-gray-50 ${idx === 0 ? 'bg-yellow-50' : ''}`}
                            >
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
                          ))}
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
