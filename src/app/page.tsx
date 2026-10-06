'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d2240] to-[#1a4f8b]">
      {/* Header */}
      <div className="bg-[#0d2240] bg-opacity-50 backdrop-blur py-6 border-b border-white border-opacity-10">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-4xl font-bold text-white">Control de Evento</h1>
          <p className="text-gray-300">La Copa - VII Fecha Sarapiquí · 31 Oct - 01 Nov</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Control de Carrera */}
          <Link href="/control">
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-2xl transition-shadow cursor-pointer">
              <div className="text-5xl mb-4">🎯</div>
              <h2 className="text-2xl font-bold text-[#0d2240] mb-2">Control</h2>
              <p className="text-gray-600 text-sm mb-4">
                Operador: digita dorsales en tiempo real. Cronómetro, edición y registro automático de vueltas.
              </p>
              <div className="text-xs text-gray-500">
                ✓ Cronómetro en vivo
                <br />
                ✓ Registro de pasos
                <br />✓ Auto-cierre de vuelta
              </div>
            </div>
          </Link>

          {/* Tracking en Vivo */}
          <Link href="/tracking">
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-2xl transition-shadow cursor-pointer">
              <div className="text-5xl mb-4">📊</div>
              <h2 className="text-2xl font-bold text-[#0d2240] mb-2">Tracking</h2>
              <p className="text-gray-600 text-sm mb-4">
                Coordinador: ve posiciones en vivo, tabla clasificatoria, contador de vueltas.
              </p>
              <div className="text-xs text-gray-500">
                ✓ Tabla en vivo
                <br />
                ✓ Posiciones
                <br />✓ Contador vueltas
              </div>
            </div>
          </Link>

          {/* Cronograma */}
          <Link href="/cronograma">
            <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-2xl transition-shadow cursor-pointer">
              <div className="text-5xl mb-4">⚙️</div>
              <h2 className="text-2xl font-bold text-[#0d2240] mb-2">Cronograma</h2>
              <p className="text-gray-600 text-sm mb-4">
                Admin: gestiona horarios, categorías, duración de carreras y vueltas.
              </p>
              <div className="text-xs text-gray-500">
                ✓ Horas de salida
                <br />
                ✓ Categorías
                <br />✓ Duración/Vueltas
              </div>
            </div>
          </Link>
        </div>

        {/* Info Box */}
        <div className="mt-12 bg-white bg-opacity-10 backdrop-blur rounded-xl p-8 border border-white border-opacity-20">
          <h3 className="text-xl font-bold text-white mb-4">ℹ️ Cómo funciona</h3>
          <ul className="text-gray-200 space-y-2">
            <li className="flex items-start">
              <span className="mr-3">1️⃣</span>
              <span>
                <strong>Admin:</strong> Configura cronograma con horas, categorías y duración/vueltas
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-3">2️⃣</span>
              <span>
                <strong>Operador:</strong> Va a Control y digita dorsales conforme pasan. El cronómetro corre
                automáticamente
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-3">3️⃣</span>
              <span>
                <strong>Coordinador:</strong> Ve todo en vivo en Tracking. Posiciones, vueltas, rezagados
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-3">4️⃣</span>
              <span>
                <strong>Resultados:</strong> Al finalizar, se exporta y sube automáticamente a ANCM
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
