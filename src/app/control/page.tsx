'use client';

import { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '@/lib/supabase-client';

interface Carrera {
  id: string;
  tipo: 'XCC' | 'XCO';
  categoria: string;
  duracion_minutos?: number;
  vueltas_totales?: number;
  hora_salida: string;
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

export default function ControlPage() {
  const [carrera, setCarrera] = useState<Carrera | null>(null);
  const [pasos, setPasos] = useState<Paso[]>([]);
  const [cronometroMs, setCronometroMs] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [dorsal, setDorsal] = useState('');
  const [correorInput, setCorredorInput] = useState('');
  const [guardando, setGuardando] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Iniciar cronómetro
  const iniciarCarrera = async () => {
    if (!carrera) return;

    try {
      const { data, error } = await supabaseClient
        .from('carreras')
        .update({ estado: 'en_curso' })
        .eq('id', carrera.id)
        .select()
        .single();

      if (error) throw error;
      setCarrera(data);
      setCorriendo(true);
      setCronometroMs(0);
    } catch (err) {
      alert('Error al iniciar carrera');
    }
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
    if (!carrera || !dorsal.trim()) {
      alert('Ingresa el dorsal');
      return;
    }

    setGuardando(true);
    try {
      // Contar cuántos pasos tiene este dorsal (= número de vuelta)
      const vuelta = pasos.filter((p) => p.dorsal === dorsal.trim()).length + 1;

      const nuevoPaso = {
        carrera_id: carrera.id,
        dorsal: dorsal.trim(),
        vuelta: vuelta,
        tiempo_ms: cronometroMs,
        nombre: correorInput || 'Por definir',
        equipo: 'Por definir',
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

      // Auto-detección de cierre de vuelta (cuando repite dorsal)
      const mismaVuelta = pasos.filter((p) => p.vuelta === vuelта);
      if (mismaVuelta.some((p) => p.dorsal === dorsal.trim())) {
        // Cerró la vuelta, es la siguiente
        console.log('Vuelta cerrada, siguiente comenzó');
      }
    } catch (err) {
      console.error(err);
      alert('Error al registrar paso');
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
        <div className="bg-[#0d2240] text-white rounded-xl p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">Control de Carrera</h1>
          <p className="text-gray-300">XCC/XCO en vivo - La Copa</p>
        </div>

        {/* Si no hay carrera seleccionada */}
        {!carrera && (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <p className="text-gray-600 mb-4">Selecciona una carrera para comenzar</p>
            <button
              onClick={() => alert('Botón para seleccionar carrera (próximo paso)')}
              className="bg-[#1a4f8b] text-white px-6 py-2 rounded-lg hover:bg-[#0d2240]"
            >
              Seleccionar carrera
            </button>
          </div>
        )}

        {/* Si hay carrera activa */}
        {carrera && (
          <div className="space-y-6">
            {/* Info de carrera */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-600 text-sm">Tipo</p>
                  <p className="text-2xl font-bold text-[#0d2240]">{carrera.tipo}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Categoría</p>
                  <p className="text-2xl font-bold text-[#0d2240]">{carrera.categoria}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">
                    {carrera.tipo === 'XCC' ? 'Duración' : 'Vueltas'}
                  </p>
                  <p className="text-2xl font-bold text-[#0d2240]">
                    {carrera.tipo === 'XCC' ? `${carrera.duracion_minutos}min` : `${carrera.vueltas_totales}v`}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Estado</p>
                  <p className={`text-2xl font-bold ${corriendo ? 'text-green-600' : 'text-yellow-600'}`}>
                    {corriendo ? 'EN VIVO' : 'Pendiente'}
                  </p>
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
