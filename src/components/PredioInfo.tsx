import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { PredioProperties } from '../hooks/usePredios'
import EntornoPredio from './EntornoPredio'
import type { EntornoData } from './EntornoPredio'

interface PredioInfoProps {
  predio: PredioProperties
  isFavorito: boolean
  onToggleFavorito: () => void
  onOpenCalculadora: () => void
  onEntornoChange: (data: EntornoData | null) => void
  onClose: () => void
}

const fieldLabels: Record<string, string> = {
  clave_cata: 'Clave Catastral',
  prov_cant: 'Provincia/Cantón',
  parroquia: 'Parroquia',
  barrio: 'Barrio',
  zona: 'Zona',
  sector: 'Sector',
  manzana: 'Manzana',
  lote: 'Lote',
  area_grafi: 'Área Gráfica (m²)',
  area_gim: 'Área GIM (m²)',
  tipo_pred: 'Tipo de Predio',
  reg_prop: 'Registro Propiedad',
  ocup_gim: 'Ocupación GIM',
  cedula: 'Cédula',
  fecha: 'Fecha',
  observacio: 'Observaciones',
  ante_gim: 'Antecedente GIM',
  clave_rura: 'Clave Rural',
}

export default function PredioInfo({ predio, isFavorito, onToggleFavorito, onOpenCalculadora, onEntornoChange, onClose }: PredioInfoProps) {
  const [parroquiaNombre, setParroquiaNombre] = useState<string | null>(null)
  const [showEntorno, setShowEntorno] = useState(false)

  useEffect(() => {
    setParroquiaNombre(null)
    setShowEntorno(false)
    onEntornoChange(null)
    supabase.rpc('get_parroquia_predio', { p_id: predio.id }).then(({ data }) => {
      if (data?.parroquia) setParroquiaNombre(data.parroquia)
    })
  }, [predio.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const getDisplayValue = (key: string, value: string | number) => {
    if (key === 'parroquia' && parroquiaNombre) return parroquiaNombre
    if (typeof value === 'number') return value.toLocaleString('es-EC', { maximumFractionDigits: 2 })
    return String(value)
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 text-sm">Información del Predio</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 1. Datos catastrales */}
      <div className="space-y-1">
        {Object.entries(fieldLabels).map(([key, label]) => {
          const raw = predio[key as keyof PredioProperties]
          if (raw === null || raw === undefined || raw === '') return null
          return (
            <div key={key} className="flex justify-between py-1.5 border-b border-gray-50">
              <span className="text-xs text-gray-500">{label}</span>
              <span className="text-xs font-medium text-gray-800 text-right max-w-[55%]">
                {getDisplayValue(key, raw)}
              </span>
            </div>
          )
        })}
      </div>

      {/* 2. Entorno del Predio — accordion */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => {
            const next = !showEntorno
            setShowEntorno(next)
            if (!next) onEntornoChange(null)
          }}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Ver Entorno del Predio
          </span>
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showEntorno ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showEntorno && (
          <div className="px-3 py-3 border-t border-gray-200">
            <EntornoPredio predioId={predio.id} onDataChange={onEntornoChange} />
          </div>
        )}
      </div>

      {/* 3. Potencial Edificable */}
      <button
        onClick={onOpenCalculadora}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        Ver Potencial Edificable
      </button>

      {/* 4. Favoritos — acción final de decisión */}
      <button
        onClick={onToggleFavorito}
        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
          isFavorito
            ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
        }`}
      >
        <svg className="w-4 h-4" fill={isFavorito ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        {isFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      </button>
    </div>
  )
}
