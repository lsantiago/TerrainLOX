import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface Equipamiento {
  id: number
  categoria: string
  establecimiento: string
  descripcion: string
  estado: string
  ubicacion: string
  radio: number | null
  lat: number
  lng: number
  distancia: number
}

export interface EntornoData {
  equipamientos: Equipamiento[]
  centroid: { lat: number; lng: number } | null
  distancia: number
}

const DISTANCIAS = [200, 500, 1000, 1500]

const CATEGORIA_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  'Educación':              { color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    icon: '🎓' },
  'Salud':                  { color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200',     icon: '🏥' },
  'Seguridad':              { color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200',  icon: '🛡' },
  'Transporte':             { color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200',  icon: '🚌' },
  'Recreación y Deporte':   { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '⚽' },
  'Aprovisionamiento':      { color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: '🛒' },
  'Cultura':                { color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200',  icon: '🎭' },
  'Culto':                  { color: 'text-pink-700',    bg: 'bg-pink-50',    border: 'border-pink-200',    icon: '⛪' },
  'Administración Pública': { color: 'text-gray-700',    bg: 'bg-gray-50',    border: 'border-gray-200',    icon: '🏛' },
  'Infraestructura':        { color: 'text-slate-700',   bg: 'bg-slate-50',   border: 'border-slate-200',   icon: '⚡' },
  'Inclusión Social':       { color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200',    icon: '🤝' },
  'Servicios Funerarios':   { color: 'text-stone-700',   bg: 'bg-stone-50',   border: 'border-stone-200',   icon: '🕊' },
}

const DEFAULT_CONFIG = { color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200', icon: '📍' }

export const CATEGORIA_MARKER_COLORS: Record<string, string> = {
  'Educación': '#1d4ed8',
  'Salud': '#b91c1c',
  'Seguridad': '#3730a3',
  'Transporte': '#c2410c',
  'Recreación y Deporte': '#047857',
  'Aprovisionamiento': '#b45309',
  'Cultura': '#7e22ce',
  'Culto': '#be185d',
  'Administración Pública': '#374151',
  'Infraestructura': '#475569',
  'Inclusión Social': '#0f766e',
  'Servicios Funerarios': '#57534e',
}

interface EntornoProps {
  predioId: number
  onDataChange?: (data: EntornoData | null) => void
}

export default function EntornoPredio({ predioId, onDataChange }: EntornoProps) {
  const [distancia, setDistancia] = useState(500)
  const [equipamientos, setEquipamientos] = useState<Equipamiento[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async (dist: number) => {
    setLoading(true)

    const [eqRes, centRes] = await Promise.all([
      supabase.rpc('get_equipamiento_cercano', { p_id: predioId, distancia: dist }),
      supabase.rpc('get_predio_centroid', { p_id: predioId }),
    ])

    const eqs = (eqRes.data as Equipamiento[] | null) ?? []
    const centroid = centRes.data as { lat: number; lng: number } | null

    setEquipamientos(eqs)
    setLoading(false)
    onDataChange?.({ equipamientos: eqs, centroid, distancia: dist })
  }, [predioId, onDataChange])

  useEffect(() => {
    fetchData(distancia)
  }, [distancia, fetchData])

  // Group by category
  const grouped = equipamientos.reduce<Record<string, Equipamiento[]>>((acc, eq) => {
    if (!acc[eq.categoria]) acc[eq.categoria] = []
    acc[eq.categoria].push(eq)
    return acc
  }, {})

  const categorias = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length)
  const totalCategorias = categorias.length

  const toggleExpand = (cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Distance selector */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Radio de búsqueda</h4>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {DISTANCIAS.map(d => (
            <button
              key={d}
              onClick={() => setDistancia(d)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                distancia === d ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              {d >= 1000 ? `${d / 1000}km` : `${d}m`}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      )}

      {!loading && equipamientos.length === 0 && (
        <div className="bg-gray-50 text-gray-500 text-xs rounded-lg p-3 text-center">
          No se encontró equipamiento en un radio de {distancia}m
        </div>
      )}

      {!loading && equipamientos.length > 0 && (
        <>
          {/* Summary */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-emerald-800">
                {equipamientos.length} equipamiento{equipamientos.length !== 1 ? 's' : ''} en {distancia}m
              </span>
              <span className="text-[10px] text-emerald-600">
                {totalCategorias} de 12 categorías
              </span>
            </div>
            {/* Category pills */}
            <div className="flex flex-wrap gap-1">
              {categorias.map(cat => {
                const cfg = CATEGORIA_CONFIG[cat] || DEFAULT_CONFIG
                return (
                  <span key={cat} className={`text-[10px] px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} font-medium`}>
                    {cfg.icon} {grouped[cat].length}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Detailed list by category */}
          <div className="space-y-2">
            {categorias.map(cat => {
              const items = grouped[cat]
              const cfg = CATEGORIA_CONFIG[cat] || DEFAULT_CONFIG
              const isExpanded = expanded.has(cat)
              const existentes = items.filter(e => e.estado === 'Existente').length
              const propuestos = items.length - existentes

              return (
                <div key={cat} className={`rounded-lg border ${cfg.border} overflow-hidden`}>
                  <button
                    onClick={() => toggleExpand(cat)}
                    className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{cfg.icon}</span>
                      <span className={`text-xs font-semibold ${cfg.color}`}>{cat}</span>
                      <span className="text-[10px] text-gray-400">({items.length})</span>
                    </div>
                    <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className={`border-t ${cfg.border}`}>
                      {propuestos > 0 && (
                        <div className="px-3 py-1 bg-amber-50/50">
                          <span className="text-[10px] text-amber-600">{existentes} existente{existentes !== 1 ? 's' : ''}, {propuestos} propuesto{propuestos !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {items.map(eq => (
                        <div key={eq.id} className="flex items-start justify-between px-3 py-1.5 border-t border-gray-50 first:border-t-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-800 truncate">{eq.descripcion}</p>
                            <p className="text-[10px] text-gray-400">
                              {eq.establecimiento}
                              {eq.estado === 'Propuesto' && <span className="text-amber-500 ml-1">(Propuesto)</span>}
                            </p>
                          </div>
                          <span className="text-[10px] text-gray-400 shrink-0 ml-2">{eq.distancia}m</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
