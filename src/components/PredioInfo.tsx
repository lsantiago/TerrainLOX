import type { PredioProperties } from '../hooks/usePredios'

interface PredioInfoProps {
  predio: PredioProperties
  isFavorito: boolean
  onToggleFavorito: () => void
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

export default function PredioInfo({ predio, isFavorito, onToggleFavorito, onClose }: PredioInfoProps) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-800 text-sm">Información del Predio</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <button
        onClick={onToggleFavorito}
        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg mb-3 text-sm font-medium transition-colors cursor-pointer ${
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

      <div className="space-y-1">
        {Object.entries(fieldLabels).map(([key, label]) => {
          const value = predio[key as keyof PredioProperties]
          if (value === null || value === undefined || value === '') return null
          return (
            <div key={key} className="flex justify-between py-1.5 border-b border-gray-50">
              <span className="text-xs text-gray-500">{label}</span>
              <span className="text-xs font-medium text-gray-800 text-right max-w-[55%]">
                {typeof value === 'number' ? value.toLocaleString('es-EC', { maximumFractionDigits: 2 }) : String(value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
