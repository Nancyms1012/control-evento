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
  es_rezagado: boolean;
}

export default function ControlPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<Evento | null>(null);
  const [pasos, setPasos] = useState<Paso[]>([]);
  const [cronometroMs, setCronometroMs] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [dorsal, setDorsal] = useState('');
  const [correorInput, setCorredorInput] = useState('');
  const [guardando, setGuardando] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cargar eventos del cronograma
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

  // Cargar pasos cuando se selecciona un evento
  useEffect(() => {
    if (!eventoSeleccionado) return;
    cargarPasos();
  }, [eventoSeleccionado]);

  const cargarPasos = async () => {
    if (!eventoSeleccionado) return;
    try {
      const { data, error } = await supabaseClient
        .from('pasos_carrera')
        .select('*')
        .eq('carrera_id', eventoSeleccionado.id)
        .order('vuelta', { ascending: false })
        .order('tiempo_ms', { ascending: false });

      if (error) throw error;
      setPasos(data || []);
    } catch (err) {
      console.error('Error cargando pasos:', err);
    }
  };

  // Iniciar cronómetro
  const iniciarCarrera = async () => {
    if (!eventoSeleccionado) return;
    setCorriendo(true);
    setCronometroMs(0);
  };

  // Crono
  useEffect(() => {
    if (!corriendo) return;

    timerRef.current = setInterval(() => {
      setCronometroMs((ms) => ms + 100);
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [corriendo]);

  // Registrar paso
  const registrarPaso = async () => {
    if (!eventoSeleccionado || !dorsal.trim()) {
      alert('Selecciona evento e ingresa dorsal');
      return;
    }

    setGuardando(true);
    try {
      // Buscar datos del dorsal en usuarios_evento
      const { data: usuarioData, error: usuarioError } = await supabaseClient
        .from('usuarios_evento')
        .select('*')
        .eq('evento', eventoSeleccionado.id)
        .eq('dorsal', dorsal.trim())
        .single();

      let nombre = 'Por definir';
      let equipo = 'Por definir';

      if (!usuarioError && usuarioData) {
        nombre = usuarioData.nombre || 'Por definir';
        equipo = usuarioData.equipo || 'Por definir';
      }

      // Contar cuántos pasos tiene este dorsal (= número de vuelta)
      const vuelta = pasos.filter((p) => p.dorsal === dorsal.trim()).length + 1;

      const nuevoPaso = {
        carrera_id: eventoSeleccionado.id,
        dorsal: dorsal.trim(),
        vuelta: vuelta,
        tiempo_ms: cronometroMs,
        nombre: nombre,
        equipo: equipo,
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
      setCorredorInput('');
    } catch (err) {
      console.error(err);
      alert('Error al registrar paso: ' + (err instanceof Error ? err.message : 'Desconocido'));
    } finally {
      setGuardando(false);
    }
  };

  // Formato de tiempo
  const formatoTiempo = (ms: number) => {
    const totalSeg = Math.floor(ms / 1000);
    const min = Math.floor(totalSeg / 60);
    const seg = totalSeg % 60;
    const centesimas = Math.floor((ms % 1000) / 10);
    return `${min}:${seg.toString().padStart(2, '0')}.${centesimas.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-[#0d2240] text-white rounded-xl p-6 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Control de Carrera</h1>
            <p className="text-gray-300">VII Fecha Sarapiquí - La Copa</p>
          </div>
          <Link
            href="/"
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            ← Volver
          </Link>
        </div>

        {/* Si no hay evento seleccionado */}
        {!eventoSeleccionado && (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <p className="text-gray-600 mb-4">Selecciona una carrera para comenzar</p>
            {eventos.length === 0 ? (
              <p className="text-sm text-gray-500 mb-4">No hay eventos programados. Ve a Cronograma para crear uno.</p>
            ) : (
              <div className="flex gap-2 flex-wrap justify-center">
                {eventos.map((evento) => (
                  <button
                    key={evento.id}
                    onClick={() => setEventoSeleccionado(evento)}
                    className="bg-[#1a4f8b] text-white px-4 py-2 rounded-lg hover:bg-[#0d2240]"
                  >
                    {evento.categoria} - {evento.tipo}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Si hay evento seleccionado */}
        {eventoSeleccionado && (
          <div className="space-y-6">
            {/* Info de evento */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-gray-600 text-sm">Tipo</p>
                  <p className="text-2xl font-bold text-[#0d2240]">{eventoSeleccionado.tipo}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Categoría</p>
                  <p className="text-2xl font-bold text-[#0d2240]">{eventoSeleccionado.categoria}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">
                    {eventoSeleccionado.tipo === 'XCC' ? 'Duración' : 'Vueltas'}
                  </p>
                  <p className="text-2xl font-bold text-[#0d2240]">
                    {eventoSeleccionado.tipo === 'XCC' ? `${eventoSeleccionado.duracion_minutos}min` : `${eventoSeleccionado.vueltas_totales}v`}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Estado</p>
                  <p className={`text-2xl font-bold ${corriendo ? 'text-green-600' : 'text-yellow-600'}`}>
                    {corriendo ? 'EN VIVO' : 'Parado'}
                  </p>
                </div>
                <div>
                  <button
                    onClick={() => setEventoSeleccionado(null)}
                    className="text-red-600 hover:text-red-800 font-medium"
                  >
                    ✕ Cambiar
                  </button>
                </div>
              </div>
            </div>

            {/* Cronómetro y entrada */}
            <div className="bg-white rounded-xl shadow-md p-8">
              {/* Cronómetro grande */}
              <div className="text-center mb-8">
                <div className="text-6xl font-bold text-[#0d2240] font-mono mb-4">
                  {formatoTiempo(cronometroMs)}
                </div>
                <button
                  onClick={corriendo ? () => setCorriendo(false) : iniciarCarrera}
                  className={`px-8 py-3 rounded-lg font-bold text-white text-lg ${
                    corriendo
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {corriendo ? '⏸️ Pausar' : '▶️ Iniciar'}
                </button>
              </div>

              {/* Entrada de dorsal */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dorsal
                  </label>
                  <input
                    type="text"
                    value={dorsal}
                    onChange={(e) => setDorsal(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && registrarPaso()}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-[#1a4f8b]"
                    placeholder="101"
                    autoFocus
                  />
                </div>

                <button
                  onClick={registrarPaso}
                  disabled={guardando || !corriendo || !dorsal.trim()}
                  className="w-full bg-[#1a4f8b] text-white font-bold py-3 rounded-lg hover:bg-[#0d2240] disabled:opacity-50"
                >
                  {guardando ? 'Registrando...' : '✓ Registrar paso'}
                </button>
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
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Tiempo</th>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pasos.slice(0, 10).map((paso) => (
                      <tr key={paso.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-2 font-semibold text-[#0d2240]">{paso.vuelta}</td>
                        <td className="px-4 py-2 font-bold text-lg">{paso.dorsal}</td>
                        <td className="px-4 py-2 font-mono">{formatoTiempo(paso.tiempo_ms)}</td>
                        <td className="px-4 py-2">
                          {paso.es_rezagado ? (
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">
                              Rezagado
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
