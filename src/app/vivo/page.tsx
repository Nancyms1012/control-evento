'use client';

import { useState, useEffect, useRef } from 'react';
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

interface Corredor {
  dorsal: string;
  nombre: string;
  equipo: string;
  vueltas: number;
  tiempo_ultima: number;
}

export default function VivoPage() {
  const [categoria, setCategoria] = useState<string>('');
  const [tipo, setTipo] = useState<string>('');
  const [pasos, setPasos] = useState<Paso[]>([]);
  const [cargando, setCargando] = useState(true);
  const dataRef = useRef<{ categoria: string }>({ categoria: '' });

  // Detecta la categoría EN CURSO = la del paso más reciente registrado, y carga
  // todos los pasos de esa categoría. Se refresca solo cada 5 s.
  const cargar = async () => {
    try {
      // Último paso registrado (define la categoría en curso)
      const { data: ultimo } = await supabaseClient
        .from('pasos_carrera')
        .select('carrera_id, categoria')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!ultimo || !ultimo.carrera_id) {
        setCategoria('');
        setPasos([]);
        return;
      }

      // Tipo (XCC/XCO) del evento en curso
      const { data: ev } = await supabaseClient
        .from('cronograma')
        .select('tipo, categoria')
        .eq('id', ultimo.carrera_id)
        .maybeSingle();

      setCategoria(ultimo.categoria || ev?.categoria || '');
      setTipo(ev?.tipo || '');
      dataRef.current.categoria = ultimo.categoria || '';

      // Todos los pasos de ese evento (categoría en curso)
      const { data } = await supabaseClient
        .from('pasos_carrera')
        .select('*')
        .eq('carrera_id', ultimo.carrera_id);
      setPasos((data || []) as Paso[]);
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

  // Clasificación de la categoría en curso
  const clasificacion: Corredor[] = (() => {
    if (pasos.length === 0) return [];
    const porDorsal = new Map<string, Paso[]>();
    pasos.forEach((p) => {
      if (!porDorsal.has(p.dorsal)) porDorsal.set(p.dorsal, []);
      porDorsal.get(p.dorsal)!.push(p);
    });
    const out: Corredor[] = [];
    porDorsal.forEach((lista, dorsal) => {
      const ordenados = [...lista].sort((a, b) => a.vuelta - b.vuelta);
      const ultimo = ordenados[ordenados.length - 1];
      out.push({
        dorsal,
        nombre: ultimo.nombre,
        equipo: ultimo.equipo,
        vueltas: ultimo.vuelta,
        tiempo_ultima: ultimo.tiempo_ms,
      });
    });
    return out.sort((a, b) => {
      if (a.vueltas !== b.vueltas) return b.vueltas - a.vueltas;
      return a.tiempo_ultima - b.tiempo_ultima;
    });
  })();

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

  const vueltaActual = clasificacion.length > 0 ? Math.max(...clasificacion.map((c) => c.vueltas)) : 0;

  return (
    <div className="min-h-screen bg-[#0d2240] text-white p-4">
      <div className="max-w-5xl mx-auto">
        {/* Encabezado */}
        <div className="text-center mb-6 pt-4">
          <p className="text-sm uppercase tracking-widest text-blue-300">VII Fecha Sarapiquí · La Copa · EN VIVO</p>
          {categoria ? (
            <h1 className="text-4xl md:text-5xl font-bold mt-2">
              {categoria} {tipo && <span className="text-blue-300 text-2xl">· {tipo}</span>}
            </h1>
          ) : (
            <h1 className="text-3xl font-bold mt-2 text-blue-200">Esperando inicio de carrera…</h1>
          )}
          {categoria && (
            <p className="text-blue-300 mt-1">Vuelta {vueltaActual} · {clasificacion.length} corredores</p>
          )}
        </div>

        {cargando ? (
          <p className="text-center text-blue-200">Cargando…</p>
        ) : clasificacion.length === 0 ? (
          <p className="text-center text-blue-200 py-10">Aún no hay tiempos registrados.</p>
        ) : (
          <div className="bg-white text-gray-900 rounded-xl overflow-hidden shadow-2xl">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">POS</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">Dorsal</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">Nombre</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700 hidden sm:table-cell">Equipo</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">Vueltas</th>
                  <th className="px-4 py-3 text-left font-bold text-gray-700">Última vuelta</th>
                </tr>
              </thead>
              <tbody>
                {clasificacion.map((c, idx) => (
                  <tr
                    key={c.dorsal}
                    className={`border-b border-gray-200 ${idx === 0 ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-bold text-xl text-[#0d2240]">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </td>
                    <td className="px-4 py-3 font-bold text-xl">{c.dorsal}</td>
                    <td className="px-4 py-3">{c.nombre}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm hidden sm:table-cell">{c.equipo}</td>
                    <td className="px-4 py-3 font-bold text-green-600 text-lg">{c.vueltas}</td>
                    <td className="px-4 py-3 font-mono">{c.tiempo_ultima > 0 ? formatoTiempo(c.tiempo_ultima) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-center text-blue-400 text-xs mt-4">Se actualiza automáticamente · mtbcostarica.org</p>
      </div>
    </div>
  );
}
