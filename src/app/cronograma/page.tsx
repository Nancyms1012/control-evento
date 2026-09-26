'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabase-client';

interface Evento {
  id: string;
  fecha: string;
  tipo: 'XCC' | 'XCO';
  hora_salida: string;
  categoria: string;
  duracion_minutos?: number;
  vueltas_totales?: number;
  descripcion?: string;
}

export default function CronogramaPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [formulario, setFormulario] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tipo: 'XCC' as 'XCC' | 'XCO',
    hora_salida: '08:00',
    categoria: '',
    duracion_minutos: 40,
    vueltas_totales: 7,
    descripcion: '',
  });
  const [guardando, setGuardando] = useState(false);

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
      console.error('Error cargando cronograma:', err);
      alert('Error al cargar el cronograma');
    } finally {
      setCargando(false);
    }
  };

  const agregarEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formulario.categoria.trim()) {
      alert('Ingresa la categoría');
      return;
    }

    setGuardando(true);
    try {
      const { data, error } = await supabaseClient
        .from('cronograma')
        .insert({
          ...formulario,
          duracion_minutos: formulario.tipo === 'XCC' ? formulario.duracion_minutos : null,
          vueltas_totales: formulario.tipo === 'XCO' ? formulario.vueltas_totales : null,
        })
        .select()
        .single();

      if (error) throw error;

      setEventos([...eventos, data]);
      setFormulario({
        fecha: new Date().toISOString().split('T')[0],
        tipo: 'XCC',
        hora_salida: '08:00',
        categoria: '',
        duracion_minutos: 40,
        vueltas_totales: 7,
        descripcion: '',
      });
      alert('Evento agregado correctamente');
    } catch (err) {
      console.error('Error:', err);
      alert('Error al agregar evento');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarEvento = async (id: string) => {
    if (!confirm('¿Eliminar este evento?')) return;

    try {
      const { error } = await supabaseClient
        .from('cronograma')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setEventos(eventos.filter((e) => e.id !== id));
    } catch (err) {
      alert('Error al eliminar');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#0d2240]">Cronograma de Carreras</h1>
            <p className="text-gray-600">Gestión de horarios y categorías</p>
          </div>
          <Link
            href="/"
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            ← Volver
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-bold text-[#0d2240] mb-4">Agregar evento</h2>

            <form onSubmit={agregarEvento} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={formulario.fecha}
                  onChange={(e) => setFormulario({ ...formulario, fecha: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a4f8b]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={formulario.tipo}
                  onChange={(e) => setFormulario({ ...formulario, tipo: e.target.value as 'XCC' | 'XCO' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a4f8b]"
                >
                  <option value="XCC">XCC (Por tiempo)</option>
                  <option value="XCO">XCO (Por vueltas)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora salida</label>
                <input
                  type="time"
                  value={formulario.hora_salida}
                  onChange={(e) => setFormulario({ ...formulario, hora_salida: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a4f8b]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <input
                  type="text"
                  value={formulario.categoria}
                  onChange={(e) => setFormulario({ ...formulario, categoria: e.target.value })}
                  placeholder="Élite"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a4f8b]"
                />
              </div>

              {formulario.tipo === 'XCC' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duración (min)</label>
                  <input
                    type="number"
                    value={formulario.duracion_minutos}
                    onChange={(e) =>
                      setFormulario({ ...formulario, duracion_minutos: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a4f8b]"
                  />
                </div>
              )}

              {formulario.tipo === 'XCO' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vueltas totales</label>
                  <input
                    type="number"
                    value={formulario.vueltas_totales}
                    onChange={(e) =>
                      setFormulario({ ...formulario, vueltas_totales: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a4f8b]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={guardando}
                className="w-full bg-[#1a4f8b] text-white font-bold py-2 rounded-lg hover:bg-[#0d2240] disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : '+ Agregar'}
              </button>
            </form>
          </div>

          {/* Listado */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-[#0d2240]">
                  Eventos programados ({eventos.length})
                </h2>
              </div>

              {cargando ? (
                <div className="p-6 text-center text-gray-600">Cargando...</div>
              ) : eventos.length === 0 ? (
                <div className="p-6 text-center text-gray-600">Sin eventos programados</div>
              ) : (
                <div className="divide-y">
                  {eventos.map((evento) => (
                    <div key={evento.id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">
                              {evento.tipo === 'XCC' ? '⏱️' : '🔄'}
                            </span>
                            <div>
                              <p className="font-bold text-[#0d2240]">
                                {evento.categoria} - {evento.tipo}
                              </p>
                              <p className="text-sm text-gray-600">
                                {evento.fecha} a las {evento.hora_salida}
                              </p>
                            </div>
                          </div>
                          {evento.tipo === 'XCC' && (
                            <p className="text-sm text-gray-600">
                              ⏱️ Duración: {evento.duracion_minutos} minutos
                            </p>
                          )}
                          {evento.tipo === 'XCO' && (
                            <p className="text-sm text-gray-600">
                              🔄 Vueltas: {evento.vueltas_totales}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => eliminarEvento(evento.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          ✕ Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
