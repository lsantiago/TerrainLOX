import { useState, useEffect } from 'react'
import { useZonificacion } from '../hooks/useZonificacion'
import type { ZonificacionData } from '../hooks/useZonificacion'

interface CalculadoraProps {
  predioId: number
  predioLabel: string
  area: number
  onClose: () => void
}

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('es-EC', { maximumFractionDigits: decimals })
}

function ProgressBar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-800">{fmt(value, 1)} {unit}</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function SetbackDiagram({ frontal, lateral, posterior }: { frontal: number; lateral: number; posterior: number }) {
  return (
    <div className="flex items-center justify-center py-3">
      <div className="relative w-48 h-40">
        {/* Outer lot */}
        <div className="absolute inset-0 border-2 border-dashed border-gray-300 rounded-lg" />
        {/* Inner buildable area */}
        <div
          className="absolute bg-emerald-50 border-2 border-emerald-400 rounded"
          style={{
            top: `${(frontal / (frontal + posterior + 20)) * 100}%`,
            left: `${(lateral / (lateral * 2 + 20)) * 100}%`,
            right: `${(lateral / (lateral * 2 + 20)) * 100}%`,
            bottom: `${(posterior / (frontal + posterior + 20)) * 100}%`,
          }}
        />
        {/* Labels */}
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 bg-white px-1">
          Frontal: {frontal}m
        </span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 bg-white px-1">
          Posterior: {posterior}m
        </span>
        <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 bg-white px-0.5 [writing-mode:vertical-lr] rotate-180">
          Lat: {lateral}m
        </span>
        <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 bg-white px-0.5 [writing-mode:vertical-lr]">
          Lat: {lateral}m
        </span>
        {/* Center label */}
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-medium text-emerald-700">
          Edificable
        </span>
      </div>
    </div>
  )
}

function UsosSection({ z }: { z: ZonificacionData }) {
  const usos = [
    { label: 'Principal', value: z.uso_principal, color: 'emerald' },
    { label: 'Complementario', value: z.uso_complementario, color: 'blue' },
    { label: 'Restringido', value: z.uso_restringido, color: 'amber' },
    { label: 'Prohibido', value: z.uso_prohibido, color: 'red' },
  ] as const

  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }

  return (
    <div className="space-y-2">
      {usos.map(u => {
        if (!u.value) return null
        return (
          <div key={u.label}>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{u.label}</span>
            <p className={`text-xs mt-0.5 px-2 py-1.5 rounded-lg border ${colorMap[u.color]}`}>
              {u.value}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function ModoSimple({ z, area }: { z: ZonificacionData; area: number }) {
  const cos = z.cos ?? 0
  const cus = z.cus ?? 0
  const pisos = z.n_pisos ?? 0
  const areaPlanta = area * (cos / 100)
  const areaTotal = area * (cus / 100)
  const deptos = areaTotal > 0 ? Math.floor(areaTotal / 120) : 0

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-emerald-800 mb-2">Resumen del terreno</h4>
        <div className="space-y-1.5 text-sm text-emerald-700">
          <p>Puedes construir hasta <strong>{pisos} pisos</strong></p>
          <p>Area en planta baja: <strong>{fmt(areaPlanta, 1)} m2</strong> ({cos}% del terreno)</p>
          <p>Area total edificable: <strong>{fmt(areaTotal, 1)} m2</strong> ({cus}% del terreno)</p>
          {deptos > 0 && (
            <p>Equivale a ~<strong>{deptos} departamentos</strong> de 120 m2</p>
          )}
        </div>
      </div>

      {/* Potencial constructivo */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 mb-3">Potencial Constructivo</h4>
        <div className="space-y-3">
          <ProgressBar label={`COS (${cos}%)`} value={areaPlanta} max={area} unit="m2" />
          <ProgressBar label={`CUS (${cus}%)`} value={areaTotal} max={area * pisos} unit="m2" />
        </div>
      </div>

      {/* Retiros */}
      {(z.retiro_frontal || z.retiro_lateral || z.retiro_posterior) && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-1">Retiros Obligatorios</h4>
          <SetbackDiagram
            frontal={z.retiro_frontal ?? 0}
            lateral={z.retiro_lateral ?? 0}
            posterior={z.retiro_posterior ?? 0}
          />
        </div>
      )}

      {/* Usos */}
      <div>
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Usos del Suelo</h4>
        <UsosSection z={z} />
      </div>

      {/* Explainer */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-gray-600 mb-1.5">Que significa esto?</h4>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          El <strong>COS</strong> (Coeficiente de Ocupacion del Suelo) indica que porcentaje del terreno puedes cubrir con construccion en planta baja.
          El <strong>CUS</strong> (Coeficiente de Utilizacion del Suelo) indica el area total construida permitida como porcentaje del terreno.
          Los <strong>retiros</strong> son las distancias minimas que debes dejar libres desde los limites del predio.
        </p>
      </div>
    </div>
  )
}

function ModoTecnico({ z, area }: { z: ZonificacionData; area: number }) {
  const rows: [string, string | number | null][] = [
    ['Area del terreno', `${fmt(area, 2)} m2`],
    ['Clasificacion', z.clasificacion],
    ['Subclasificacion', z.subclasificacion],
    ['Categoria', z.categoria],
    ['PIT', z.pit],
    ['Codigo PIT', z.cod_pit],
    ['COS (%)', z.cos],
    ['CUS (%)', z.cus],
    ['Numero de Pisos', z.n_pisos],
    ['Area planta baja', `${fmt((area * (z.cos ?? 0)) / 100, 2)} m2`],
    ['Area total edificable', `${fmt((area * (z.cus ?? 0)) / 100, 2)} m2`],
    ['Retiro Frontal (m)', z.retiro_frontal],
    ['Retiro Lateral (m)', z.retiro_lateral],
    ['Retiro Posterior (m)', z.retiro_posterior],
    ['Lote Minimo (m2)', z.lote_min],
    ['Frente Minimo (m)', z.frente_min],
    ['Fondo (m)', z.fondo],
    ['Implantacion', z.implantacion],
    ['Edificabilidad', z.edificabilidad],
    ['Tratamiento', z.tratamiento],
    ['Densidad Bruta', z.densidad_bruta],
    ['Densidad Neta', z.densidad_neta],
    ['Uso General', z.uso_general],
    ['Uso Principal', z.uso_principal],
    ['Uso Complementario', z.uso_complementario],
    ['Uso Restringido', z.uso_restringido],
    ['Uso Prohibido', z.uso_prohibido],
  ]

  return (
    <div className="space-y-1">
      {rows.map(([label, value]) => {
        if (value === null || value === undefined || value === '') return null
        return (
          <div key={label} className="flex justify-between py-1.5 border-b border-gray-50">
            <span className="text-xs text-gray-500">{label}</span>
            <span className="text-xs font-medium text-gray-800 text-right max-w-[55%]">
              {typeof value === 'number' ? fmt(value) : value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function CalculadoraEdificable({ predioId, predioLabel, area, onClose }: CalculadoraProps) {
  const [modo, setModo] = useState<'simple' | 'tecnico'>('simple')
  const { data, loading, error, getZonificacion } = useZonificacion()

  useEffect(() => {
    getZonificacion(predioId)
  }, [predioId, getZonificacion])

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-5 py-3 rounded-t-2xl flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-gray-800 text-sm">Potencial Edificable</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 cursor-pointer">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode toggle */}
        <div className="px-5 pt-3 pb-2 shrink-0">
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 font-medium mb-3">{predioLabel}</p>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setModo('simple')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                modo === 'simple' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              Simple
            </button>
            <button
              onClick={() => setModo('tecnico')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                modo === 'tecnico' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              Tecnico
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-xs rounded-lg p-3 mt-2">
              Error al obtener datos de zonificacion: {error}
            </div>
          )}

          {!loading && !error && !data && (
            <div className="bg-amber-50 text-amber-700 text-xs rounded-lg p-3 mt-2">
              No se encontro informacion de zonificacion para este predio. Es posible que el predio no este dentro de un area con clasificacion de suelo definida.
            </div>
          )}

          {!loading && data && (
            <div className="mt-3">
              {modo === 'simple' ? (
                <ModoSimple z={data} area={area} />
              ) : (
                <ModoTecnico z={data} area={area} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
