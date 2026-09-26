'use client';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d2240] to-[#1a4f8b] flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Control de Evento</h1>
        <p className="text-gray-200 mb-8">Carreras XCC/XCO en tiempo real</p>
        <div className="space-y-4">
          <button className="block w-full bg-white text-[#0d2240] font-bold py-3 rounded-lg hover:bg-gray-100 transition">
            🎯 Control de Carrera
          </button>
          <button className="block w-full bg-[#1a7a3a] text-white font-bold py-3 rounded-lg hover:bg-green-700 transition">
            📊 Tracking en Vivo
          </button>
          <button className="block w-full bg-[#7a3a1a] text-white font-bold py-3 rounded-lg hover:bg-amber-700 transition">
            ⚙️ Cronograma
          </button>
        </div>
      </div>
    </div>
  );
}
