'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabase-client';
// Solo categorías de La Copa (el control de tiempos no incluye Copa Kids)
import { CATEGORIAS_CARRERA } from '@/lib/categorias';

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
    duracion_minutos: 40,
    vueltas_totales: 7,
    descripcion: '',
  });
  // Varias categorías pueden salir a la misma hora -> selección múltiple
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Marcar/desmarcar una categoría del selector múltiple
  const toggleCategoria = (cat: string) => {
    setCategoriasSeleccionadas((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };
  // Edición de un evento ya cargado
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Evento>>({});
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  // Carga por CSV de varios eventos
  const [subiendoCSV, setSubiendoCSV] = useState(false);
  const [resultadoCSV, setResultadoCSV] = useState<{
    insertados: number;
    filasInvalidas: number;
    total: number;
    errores: string[];
  } | null>(null);

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
    if (categoriasSeleccionadas.length === 0) {
      alert('Seleccioná al menos una categoría');
      return;
    }

    setGuardando(true);
    try {
      // Se crea un evento por cada categoría seleccionada, todos con la misma
      // fecha/hora/tipo (varias categorías pueden salir a la misma hora).
      const aInsertar = categoriasSeleccionadas.map((cat) => ({
        fecha: formulario.fecha,
        hora_salida: formulario.hora_salida,
        tipo: formulario.tipo,
        categoria: cat,
        descripcion: formulario.descripcion,
        duracion_minutos: formulario.tipo === 'XCC' ? formulario.duracion_minutos : null,
        vueltas_totales: formulario.tipo === 'XCO' ? formulario.vueltas_totales : null,
      }));

      const { data, error } = await supabaseClient
        .from('cronograma')
        .insert(aInsertar)
        .select();

      if (error) throw error;

      setEventos([...eventos, ...(data || [])]);
      setFormulario({
        fecha: new Date().toISOString().split('T')[0],
        tipo: 'XCC',
        hora_salida: '08:00',
        duracion_minutos: 40,
        vueltas_totales: 7,
        descripcion: '',
      });
      setCategoriasSeleccionadas([]);
      alert(
        (data?.length || 0) === 1
          ? 'Evento agregado correctamente'
          : `${data?.length || 0} eventos agregados (misma hora)`
      );
    } catch (err) {
      console.error('Error:', err);
      alert('Error al agregar evento');
    } finally {
      setGuardando(false);
    }
  };

  // Eliminar TODOS los eventos del cronograma (con doble confirmación)
  const eliminarTodos = async () => {
    if (eventos.length === 0) return;
    if (!confirm(`¿Eliminar TODOS los eventos del cronograma (${eventos.length})?\n\nEsto NO se puede deshacer.`)) return;
    if (!confirm('Confirmá otra vez: se borrarán todos los eventos programados.')) return;
    try {
      // Borrar todas las filas del cronograma
      const { error } = await supabaseClient
        .from('cronograma')
        .delete()
        .not('id', 'is', null);
      if (error) throw error;
      setEventos([]);
      alert('Se eliminaron todos los eventos del cronograma.');
    } catch (err) {
      console.error(err);
      alert('Error al eliminar los eventos');
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

  // Empezar a editar un evento: copiar sus datos al formulario de edición
  const iniciarEdicion = (evento: Evento) => {
    setEditandoId(evento.id);
    setEditForm({
      fecha: evento.fecha,
      tipo: evento.tipo,
      hora_salida: evento.hora_salida,
      categoria: evento.categoria,
      duracion_minutos: evento.duracion_minutos ?? 40,
      vueltas_totales: evento.vueltas_totales ?? 7,
    });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditForm({});
  };

  // Guardar cambios de un evento editado
  const guardarEdicionEvento = async () => {
    if (!editandoId) return;
    if (!editForm.categoria || !editForm.fecha || !editForm.hora_salida) {
      alert('Completá fecha, hora y categoría');
      return;
    }
    setGuardandoEdit(true);
    try {
      const campos = {
        fecha: editForm.fecha,
        tipo: editForm.tipo,
        hora_salida: editForm.hora_salida,
        categoria: editForm.categoria,
        duracion_minutos: editForm.tipo === 'XCC' ? editForm.duracion_minutos : null,
        vueltas_totales: editForm.tipo === 'XCO' ? editForm.vueltas_totales : null,
      };
      const { data, error } = await supabaseClient
        .from('cronograma')
        .update(campos)
        .eq('id', editandoId)
        .select()
        .single();
      if (error) throw error;

      setEventos((prev) =>
        prev
          .map((e) => (e.id === editandoId ? (data as Evento) : e))
          .sort((a, b) =>
            a.fecha === b.fecha
              ? a.hora_salida.localeCompare(b.hora_salida)
              : a.fecha.localeCompare(b.fecha)
          )
      );
      cancelarEdicion();
    } catch (err) {
      console.error(err);
      alert('Error al guardar los cambios');
    } finally {
      setGuardandoEdit(false);
    }
  };

  // Descargar plantilla CSV para cargar varios eventos de una vez.
  // Columnas: fecha ; hora_salida ; categoria ; tiempo_vueltas ; evento
  // tiempo_vueltas = minutos si evento es XCC, cantidad de vueltas si es XCO.
  const descargarPlantillaEventos = () => {
    const filasCsv = [
      'fecha;hora_salida;categoria;tiempo_vueltas;evento',
      '2026-10-31;08:00;Élite Masculino;40;XCC',
      '2026-11-01;09:30;Élite Masculino;7;XCO',
    ];
    const csv = filasCsv.join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_cronograma.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Parsea una línea CSV respetando comillas. Acepta separador ; o ,
  // Lee el archivo respetando su codificación (UTF-8 o Windows-1252 de Excel).
  // Si se lee UTF-8 un archivo Latin-1, los acentos/ñ salen como "�".
  const leerArchivoTexto = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    try {
      const txt = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return txt.charCodeAt(0) === 0xfeff ? txt.slice(1) : txt;
    } catch {
      const txt = new TextDecoder('windows-1252').decode(bytes);
      return txt.charCodeAt(0) === 0xfeff ? txt.slice(1) : txt;
    }
  };

  const parsearLineaCSV = (linea: string, sep: string): string[] => {
    const campos: string[] = [];
    let actual = '';
    let entreComillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') {
        if (entreComillas && linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else {
          entreComillas = !entreComillas;
        }
      } else if (c === sep && !entreComillas) {
        campos.push(actual);
        actual = '';
      } else {
        actual += c;
      }
    }
    campos.push(actual);
    return campos.map((s) => s.trim());
  };

  // Normaliza la fecha a formato ISO (AAAA-MM-DD). Acepta AAAA-MM-DD o DD/MM/AAAA.
  const normalizarFecha = (valor: string): string | null => {
    const v = valor.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const dd = m[1].padStart(2, '0');
      const mm = m[2].padStart(2, '0');
      return `${m[3]}-${mm}-${dd}`;
    }
    return null;
  };

  // Subir varios eventos del cronograma desde un CSV
  const subirEventosCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a subir el mismo archivo
    if (!file) return;

    setSubiendoCSV(true);
    setResultadoCSV(null);
    try {
      const texto = await leerArchivoTexto(file);

      const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
      if (lineas.length === 0) {
        alert('El archivo está vacío.');
        setSubiendoCSV(false);
        return;
      }

      // Detectar separador
      const primera = lineas[0];
      const sep = (primera.split(';').length - 1) >= (primera.split(',').length - 1) ? ';' : ',';

      // Detectar encabezado
      const primeraMin = primera.toLowerCase();
      const hayEncabezado =
        primeraMin.includes('fecha') ||
        primeraMin.includes('hora') ||
        primeraMin.includes('categoria') ||
        primeraMin.includes('categoría') ||
        primeraMin.includes('evento');
      const filasDatos = hayEncabezado ? lineas.slice(1) : lineas;

      // Construir eventos a insertar
      const aInsertar: Array<Record<string, unknown>> = [];
      const errores: string[] = [];
      let filasInvalidas = 0;

      filasDatos.forEach((linea, idx) => {
        const n = idx + 1; // número de fila de datos (para mensajes)
        const cols = parsearLineaCSV(linea, sep);
        const fechaRaw = cols[0] || '';
        const horaRaw = cols[1] || '';
        const categoria = cols[2] || '';
        const tiempoVueltasRaw = cols[3] || '';
        const eventoRaw = (cols[4] || '').toUpperCase().trim();

        const fecha = normalizarFecha(fechaRaw);
        const tipo = eventoRaw === 'XCC' || eventoRaw === 'XCO' ? eventoRaw : null;
        const tiempoVueltas = parseInt(tiempoVueltasRaw, 10);

        if (!fecha || !horaRaw || !categoria || !tipo || isNaN(tiempoVueltas)) {
          filasInvalidas++;
          errores.push(`Fila ${n}: datos incompletos o inválidos (fecha/hora/categoría/tiempo-vueltas/evento)`);
          return;
        }

        aInsertar.push({
          fecha,
          hora_salida: horaRaw,
          categoria,
          tipo,
          duracion_minutos: tipo === 'XCC' ? tiempoVueltas : null,
          vueltas_totales: tipo === 'XCO' ? tiempoVueltas : null,
          descripcion: '',
        });
      });

      if (aInsertar.length === 0) {
        setResultadoCSV({ insertados: 0, filasInvalidas, total: filasDatos.length, errores });
        setSubiendoCSV(false);
        return;
      }

      const { data, error } = await supabaseClient
        .from('cronograma')
        .insert(aInsertar)
        .select();

      if (error) {
        alert('Error al guardar en Supabase: ' + error.message);
        setSubiendoCSV(false);
        return;
      }

      setResultadoCSV({
        insertados: data?.length || 0,
        filasInvalidas,
        total: filasDatos.length,
        errores,
      });
      // Refrescar la lista
      cargarEventos();
    } catch (err) {
      console.error(err);
      alert('Error procesando el archivo: ' + (err instanceof Error ? err.message : 'desconocido'));
    } finally {
      setSubiendoCSV(false);
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
          <div className="flex gap-2 flex-wrap items-center">
            <label className={`bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 text-sm font-medium cursor-pointer ${subiendoCSV ? 'opacity-50 pointer-events-none' : ''}`}>
              {subiendoCSV ? 'Subiendo...' : '📋 Cargar eventos (CSV)'}
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={subirEventosCSV}
                disabled={subiendoCSV}
                className="hidden"
              />
            </label>
            <button
              onClick={descargarPlantillaEventos}
              className="bg-white text-amber-700 border border-amber-500 px-4 py-2 rounded-lg hover:bg-amber-50 text-sm"
            >
              Plantilla
            </button>
            <Link
              href="/"
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              ← Volver
            </Link>
          </div>
        </div>

        {/* Resultado de la carga CSV */}
        {resultadoCSV && (
          <div className="mb-6 bg-white rounded-xl shadow-md overflow-hidden border border-amber-200">
            <div className="bg-amber-500 text-white px-6 py-3 flex items-center justify-between">
              <h2 className="font-bold">Resultado de la carga CSV</h2>
              <button onClick={() => setResultadoCSV(null)} className="text-white hover:bg-white/20 rounded-lg w-7 h-7 flex items-center justify-center">&times;</button>
            </div>
            <div className="p-6 text-sm space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-700">{resultadoCSV.insertados}</p>
                  <p className="text-gray-600 text-xs">Eventos agregados</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-red-700">{resultadoCSV.filasInvalidas}</p>
                  <p className="text-gray-600 text-xs">Filas inválidas</p>
                </div>
                <div className="bg-gray-100 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-700">{resultadoCSV.total}</p>
                  <p className="text-gray-600 text-xs">Filas procesadas</p>
                </div>
              </div>
              {resultadoCSV.errores.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <ul className="list-disc list-inside text-red-800 space-y-0.5 text-xs">
                    {resultadoCSV.errores.map((er, i) => (
                      <li key={i}>{er}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categorías <span className="text-gray-400 font-normal">(podés elegir varias que salen a la misma hora)</span>
                </label>

                {/* Chips de las categorías elegidas */}
                {categoriasSeleccionadas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {categoriasSeleccionadas.map((cat) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1 bg-[#1a4f8b] text-white text-xs px-2 py-1 rounded-full"
                      >
                        {cat}
                        <button
                          type="button"
                          onClick={() => toggleCategoria(cat)}
                          className="hover:bg-white/20 rounded-full w-4 h-4 flex items-center justify-center leading-none"
                          aria-label={`Quitar ${cat}`}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Lista de categorías con checkboxes */}
                <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {CATEGORIAS_CARRERA.map((cat) => (
                    <label
                      key={cat}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={categoriasSeleccionadas.includes(cat)}
                        onChange={() => toggleCategoria(cat)}
                        className="rounded border-gray-300 text-[#1a4f8b] focus:ring-[#1a4f8b]"
                      />
                      <span>{cat}</span>
                    </label>
                  ))}
                </div>
                {categoriasSeleccionadas.length > 1 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Se crearán {categoriasSeleccionadas.length} eventos con la misma hora de salida.
                  </p>
                )}
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
                {guardando
                  ? 'Guardando...'
                  : categoriasSeleccionadas.length > 1
                    ? `+ Agregar ${categoriasSeleccionadas.length} eventos`
                    : '+ Agregar'}
              </button>
            </form>
          </div>

          {/* Listado */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-[#0d2240]">
                  Eventos programados ({eventos.length})
                </h2>
                {eventos.length > 0 && (
                  <button
                    onClick={eliminarTodos}
                    className="text-red-600 hover:text-white hover:bg-red-600 border border-red-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    🗑️ Eliminar todo
                  </button>
                )}
              </div>

              {cargando ? (
                <div className="p-6 text-center text-gray-600">Cargando...</div>
              ) : eventos.length === 0 ? (
                <div className="p-6 text-center text-gray-600">Sin eventos programados</div>
              ) : (
                <div className="divide-y">
                  {eventos.map((evento) => (
                    <div key={evento.id} className="p-6 hover:bg-gray-50">
                      {editandoId === evento.id ? (
                        /* ---- Modo edición inline ---- */
                        <div className="space-y-3">
                          <p className="font-bold text-[#0d2240] text-sm">Editando evento</p>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="text-xs text-gray-600">
                              Fecha
                              <input
                                type="date"
                                value={editForm.fecha || ''}
                                onChange={(e) => setEditForm({ ...editForm, fecha: e.target.value })}
                                className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                              />
                            </label>
                            <label className="text-xs text-gray-600">
                              Hora salida
                              <input
                                type="time"
                                value={editForm.hora_salida || ''}
                                onChange={(e) => setEditForm({ ...editForm, hora_salida: e.target.value })}
                                className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                              />
                            </label>
                            <label className="text-xs text-gray-600">
                              Tipo
                              <select
                                value={editForm.tipo || 'XCC'}
                                onChange={(e) => setEditForm({ ...editForm, tipo: e.target.value as 'XCC' | 'XCO' })}
                                className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                              >
                                <option value="XCC">XCC (Por tiempo)</option>
                                <option value="XCO">XCO (Por vueltas)</option>
                              </select>
                            </label>
                            {editForm.tipo === 'XCC' ? (
                              <label className="text-xs text-gray-600">
                                Duración (min)
                                <input
                                  type="number"
                                  value={editForm.duracion_minutos ?? 40}
                                  onChange={(e) => setEditForm({ ...editForm, duracion_minutos: parseInt(e.target.value) })}
                                  className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                                />
                              </label>
                            ) : (
                              <label className="text-xs text-gray-600">
                                Vueltas
                                <input
                                  type="number"
                                  value={editForm.vueltas_totales ?? 7}
                                  onChange={(e) => setEditForm({ ...editForm, vueltas_totales: parseInt(e.target.value) })}
                                  className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                                />
                              </label>
                            )}
                          </div>
                          <label className="text-xs text-gray-600 block">
                            Categoría
                            <select
                              value={editForm.categoria || ''}
                              onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value })}
                              className="w-full mt-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="">Seleccioná una categoría...</option>
                              {CATEGORIAS_CARRERA.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </label>
                          <div className="flex gap-2">
                            <button
                              onClick={guardarEdicionEvento}
                              disabled={guardandoEdit}
                              className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                            >
                              {guardandoEdit ? 'Guardando...' : '✓ Guardar'}
                            </button>
                            <button
                              onClick={cancelarEdicion}
                              className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-300 text-sm"
                            >
                              ✖ Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ---- Vista normal ---- */
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
                          <div className="flex gap-3 flex-shrink-0">
                            <button
                              onClick={() => iniciarEdicion(evento)}
                              className="text-[#1a4f8b] hover:text-[#0d2240] text-sm font-medium"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              onClick={() => eliminarEvento(evento.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              ✕ Eliminar
                            </button>
                          </div>
                        </div>
                      )}
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
