'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabase-client';

interface Carrera {
  id: string;
  tipo: 'XCC' | 'XCO';
  categoria: string;
  duracion_minutos?: number;
  vueltas_totales?: number;
  estado: 'pendiente' | 'en_curso' | 'finalizada';
}

interface Paso {
  id: string;
  carrera_id: string;
  dorsal: string;
  vuelta: number;
  tiempo_ms: number;
  nombre: string;
  equipo: string;
  es_rezagado: boolean;
}

export default function TrackingPage() {
  const [carrera, setCarrera] = useState<Carrera | null>(null);
  const [pasos, setPasos] = useState<Paso[]>([]);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [cargando, setCargando] = useState(true);
  const [maxVuelta, setMaxVuelta] = useState(0);

  useEffect(() => {
    cargarCarreras();
    const channel = supabaseClient.channel('pasos_carrera_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pasos_carrera' }, () => {
        if (carrera) {
          cargarPasos(carrera.id);
        }
      })
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [carrera?.id]);

  const cargarCarreras = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('carreras')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setCarreras(data || []);
      if (data && data.length > 0) {
        seleccionarCarrera(data[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const seleccionarCarrera = async (c: Carrera) => {
    setCarrera(c);
    await cargarPasos(c.id);
  };

  const cargarPasos = async (carreraId: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('pasos_carrera')
        .select('*')
        .eq('carrera_id', carreraId)
        .order('vuelta', { ascending: false })
        .order('tiempo_ms', { ascending: false });

      if (error) throw error;
      setPasos(data || []);

      if (data && data.length > 0) {
        setMaxVuelta(Math.max(...data.map((p) => p.vuelta)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calcular clasificación actual
  const clasificacion = (() => {
    if (!carrera || pasos.length === 0) return [];

    // Agrupar por dorsal y contar vueltas
    const dorales = new Map<
      string,
      { dorsal: string; nombre: string; equipo: string; vueltas: number; tiempo_ultima: number; rezagado: boolean }
    >();

    pasos.forEach((paso) => {
      const key = paso.dorsal;
      if (!dorales.has(key)) {
        dorales.set(key, {
          dorsal: paso.dorsal,
          nombre: paso.nombre,
          equipo: paso.equipo,
          vueltas: 0,
          tiempo_ultima: 0,
          rezagado: false,
        });
      }
      const entry = dorales.get(key)!;
      entry.vueltas = Math.max(entry.vueltas, paso.vuelta);
      if (paso.vuelta === maxVuelta) {
        entry.tiempo_ultima = paso.tiempo_ms;
      }
      if (paso.es_rezagado) {
        entry.rezagado = true;
      }
    });

    return Array.from(dorales.values())
      .sort((a, b) => {
        // Primero por vueltas (descendente)
        if (a.vueltas !== b.vueltas) return b.vueltas - a.vueltas;
        // Luego por tiempo última vuelta (ascendente)
        return a.tiempo_ultima - b.tiempo_ultima;
      });
  })();

  const formatoTiempo = (ms: number) => {
    const totalSeg = Math.floor(ms / 1000);
    const min = Math.floor(totalSeg / 60);
    const seg = totalSeg % 60;
    const centesimas = Math.floor((ms % 1000) / 10);
    return `${min}:${seg.toString().padStart(2, '0')}.${centesimas.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#0d2240]">Tracking en Vivo</h1>
            <p className="text-gray-600">Posiciones en tiempo real</p>
          </div>
          <Link href="/" className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
            ← Volver
          </Link>
        </div>

        {/* Selector de carrera */}
        <div className="mb-6">
          <select
            value={carrera?.id || ''}
            onChange={(e) => {
              const c = carreras.find((cr) => cr.id === e.target.value);
              if (c) seleccionarCarrera(c);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a4f8b]"
          >
            <option value="">Seleccionar carrera...</option>
            {carreras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.tipo} - {c.categoria} ({c.estado})
              </option>
            ))}
          </select>
        </div>

        {cargando ? (
          <div className="text-center text-gray-600">Cargando...</div>
        ) : !carrera ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <p className="text-gray-600">No hay carreras activas</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Info carrera */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-gray-600 text-sm">Tipo</p>
                  <p className="text-2xl font-bold text-[#0d2240]">{carrera.tipo}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Categoría</p>
                  <p className="text-2xl font-bold text-[#0d2240]">{carrera.categoria}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Vuelta actual</p>
                  <p className="text-2xl font-bold text-green-600">{maxVuelta}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Corredores</p>
                  <p className="text-2xl font-bold text-[#0d2240]">{clasificacion.length}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Estado</p>
                  <p
                    className={`text-2xl font-bold ${
                      carrera.estado === 'en_curso' ? 'text-green-600' : 'text-gray-600'
                    }`}
                  >
                    {carrera.estado}
                  </p>
                </div>
              </div>
            </div>

            {/* Contador vueltas (XCO) */}
            {carrera.tipo === 'XCO' && (
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <p className="text-sm text-blue-700 font-medium mb-2">Progreso de vueltas</p>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {Array.from({ length: carrera.vueltas_totales || 7 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                          i < maxVuelta ? 'bg-green-600' : 'bg-gray-300'
                        }`}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <p className="ml-4 text-lg font-bold text-blue-900">
                    {maxVuelta} / {carrera.vueltas_totales} vueltas
                  </p>
                </div>
              </div>
            )}

            {/* Clasificación */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-bold text-[#0d2240]">Clasificación en vivo</h2>
              </div>
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
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clasificacion.map((corredor, idx) => (
                      <tr
                        key={corredor.dorsal}
                        className={`border-b border-gray-200 hover:bg-gray-50 ${
                          idx === 0 ? 'bg-yellow-50' : ''
                        }`}
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
                        <td className="px-4 py-3">
                          {corredor.rezagado ? (
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">
                              DNF
                            </span>
                          ) : (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                              ✓
                            </span>
                          )}
                        </td>
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
