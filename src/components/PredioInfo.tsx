import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { PredioProperties } from '../hooks/usePredios'

import EntornoPredio from './EntornoPredio'
import type { EntornoData } from './EntornoPredio'
import TopografiaModal from './TopografiaModal'

interface PredioInfoProps {
  predio: PredioProperties
  isFavorito: boolean
  onToggleFavorito: () => void
  onOpenCalculadora: () => void
  onEntornoChange: (data: EntornoData | null) => void
  onClose: () => void
}

interface FichaData {
  direccion: string | null
  area_terreno: number | null
  area_construccion: number | null
  avaluo_terreno: number | null
  avaluo_construccion: number | null
  avaluo_total: number | null
  valor_m2: number | null
  servicio_agua: boolean | null
  servicio_alcantarillado: boolean | null
  servicio_luz: boolean | null
  servicio_telefonia: boolean | null
  propietario_nombres: string | null
  propietario_apellidos: string | null
  propietario_cedula: string | null
}

function formatMoney(value: number): string {
  return '$' + value.toLocaleString('es-EC', { maximumFractionDigits: 2 })
}

function formatArea(value: number): string {
  return value.toLocaleString('es-EC', { maximumFractionDigits: 2 }) + ' m\u00B2'
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null
  const display = typeof value === 'number'
    ? value.toLocaleString('es-EC', { maximumFractionDigits: 2 })
    : String(value)
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-50">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-800 text-right max-w-[55%]">{display}</span>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{children}</h3>
  )
}

function ServiceBadge({ label, active }: { label: string; active: boolean | null }) {
  if (active === null) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-medium ${
      active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
    }`}>
      {active ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {label}
    </span>
  )
}

function Skeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
      <div className="h-3 bg-gray-200 rounded w-2/3" />
    </div>
  )
}

function getServicioScore(ficha: FichaData): { count: number; total: number } {
  const servicios = [ficha.servicio_agua, ficha.servicio_luz, ficha.servicio_alcantarillado, ficha.servicio_telefonia]
  const total = servicios.filter(s => s !== null).length
  const count = servicios.filter(s => s === true).length
  return { count, total }
}

function tipoPredioLabel(tipo: string | undefined | null): { text: string; cls: string } | null {
  if (!tipo) return null
  const t = tipo.trim().toUpperCase()
  if (t === 'U' || t.startsWith('URBAN')) return { text: 'Urbano', cls: 'bg-emerald-100 text-emerald-700' }
  if (t === 'R' || t.startsWith('RURAL')) return { text: 'Rural', cls: 'bg-orange-100 text-orange-700' }
  return { text: tipo, cls: 'bg-gray-100 text-gray-600' }
}

export default function PredioInfo({ predio, isFavorito, onToggleFavorito, onOpenCalculadora, onEntornoChange, onClose }: PredioInfoProps) {
  const [parroquiaNombre, setParroquiaNombre] = useState<string | null>(null)
  const [ficha, setFicha] = useState<FichaData | null>(null)
  const [fichaLoading, setFichaLoading] = useState(true)
  const [showEntorno, setShowEntorno] = useState(false)
  const [showTopografiaModal, setShowTopografiaModal] = useState(false)
  const [showTecnicos, setShowTecnicos] = useState(false)

  useEffect(() => {
    setParroquiaNombre(null)
    setFicha(null)
    setFichaLoading(true)
    setShowEntorno(false)
    setShowTecnicos(false)
    onEntornoChange(null)

    supabase.rpc('get_parroquia_predio', { p_id: predio.id }).then(({ data }) => {
      if (data?.parroquia) setParroquiaNombre(data.parroquia)
    })

    supabase.rpc('get_ficha_predio', { p_id: predio.id }).then(({ data }) => {
      setFicha(data as FichaData | null)
      setFichaLoading(false)
    })
  }, [predio.id, onEntornoChange])

  const parroquia = parroquiaNombre || predio.parroquia
  const tipoBadge = tipoPredioLabel(predio.tipo_pred)

  // Datos derivados
  const areaOficial = predio.area_gim || 0
  const pctConstruccion = ficha?.area_construccion && areaOficial > 0
    ? (ficha.area_construccion / areaOficial) * 100
    : null
  const discrepanciaAreas = areaOficial && predio.area_grafi
    ? Math.abs(areaOficial - predio.area_grafi)
    : null
  const discrepanciaPct = areaOficial && predio.area_grafi && areaOficial > 0
    ? (discrepanciaAreas! / areaOficial) * 100
    : null

  return (
    <div className="p-4 space-y-4">
      {/* Header con favorito */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 text-sm">Informaci&oacute;n del Predio</h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleFavorito}
            title={isFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              isFavorito
                ? 'text-red-500 bg-red-50 hover:bg-red-100'
                : 'text-gray-400 hover:text-red-400 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" fill={isFavorito ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 1. Ubicaci&oacute;n */}
      <div className="space-y-1">
        <SectionHeader>Ubicaci&oacute;n</SectionHeader>
        {/* Clave + tipo badge + link c&eacute;dula oficial */}
        <div className="flex justify-between py-1.5 border-b border-gray-50">
          <span className="text-xs text-gray-500">Clave Catastral</span>
          <span className="flex items-center gap-1.5">
            {tipoBadge && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tipoBadge.cls}`}>
                {tipoBadge.text}
              </span>
            )}
            <span className="text-xs font-medium text-gray-800">{predio.clave_cata}</span>
            {predio.codigo_interno && (
              <a
                href={`https://www.loja.gob.ec/ktastro/code/${predio.codigo_interno}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver c&eacute;dula catastral oficial"
                className="text-blue-500 hover:text-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </a>
            )}
          </span>
        </div>
        <div className={`grid ${ficha?.direccion ? 'grid-cols-3' : 'grid-cols-2'} gap-1 pt-1`}>
          {[
            { label: 'Parroquia', value: parroquia },
            { label: 'Barrio', value: predio.barrio },
            ...(ficha?.direccion ? [{ label: 'Direcci\u00f3n', value: ficha.direccion }] : []),
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center">
              <span className="text-[11px] font-semibold text-gray-800 text-center leading-tight">{value || '-'}</span>
              <span className="text-[9px] text-gray-400 border-t border-gray-300 mt-0.5 pt-0.5 w-full text-center">{label}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1 pt-1">
          {[
            { label: 'Zona', value: predio.zona },
            { label: 'Sector', value: predio.sector },
            { label: 'Manzana', value: predio.manzana },
            { label: 'Lote', value: predio.lote },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center">
              <span className="text-sm font-bold text-gray-800">{value || '-'}</span>
              <span className="text-[9px] text-gray-400 border-t border-gray-300 mt-0.5 pt-0.5 w-full text-center">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Propietario */}
      {ficha && ficha.propietario_nombres && (() => {
        const nombres = ficha.propietario_nombres || ''
        const apellidos = ficha.propietario_apellidos && ficha.propietario_apellidos !== nombres ? ficha.propietario_apellidos : ''
        const fullName = [nombres, apellidos].filter(Boolean).join(' ')
        return (
          <div className="flex items-start gap-2.5 bg-slate-50 rounded-lg p-3 border border-slate-200">
            <svg className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 leading-tight">{fullName}</p>
              {ficha.propietario_cedula && (
                <p className="text-[11px] text-slate-500 mt-0.5">CI: {ficha.propietario_cedula}</p>
              )}
            </div>
          </div>
        )
      })()}

      {/* 3. Aval&uacute;o Catastral */}
      <div className="space-y-2">
        <SectionHeader>Aval&uacute;o Catastral</SectionHeader>
        {fichaLoading ? <Skeleton /> : ficha ? (
          <>
            {/* Aval&uacute;o total destacado */}
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-amber-700">Aval&uacute;o Total</span>
                {ficha.valor_m2 && (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                    ${ficha.valor_m2}/m&sup2;
                  </span>
                )}
              </div>
              <p className="text-xl font-bold text-amber-900 mt-1">
                {ficha.avaluo_total !== null ? formatMoney(ficha.avaluo_total) : '-'}
              </p>
              {/* Desglose */}
              <div className="flex gap-4 mt-2 text-[11px]">
                <div>
                  <span className="text-amber-600">Terreno: </span>
                  <span className="font-semibold text-amber-800">
                    {ficha.avaluo_terreno !== null ? formatMoney(ficha.avaluo_terreno) : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-amber-600">Construcci&oacute;n: </span>
                  <span className="font-semibold text-amber-800">
                    {ficha.avaluo_construccion !== null ? formatMoney(ficha.avaluo_construccion) : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* &Aacute;reas comparativas */}
            <div className="space-y-1">
              {areaOficial > 0 && <Row label="&Aacute;rea terreno (oficial)" value={formatArea(areaOficial)} />}
              <Row label="&Aacute;rea gr&aacute;fica (GIS)" value={predio.area_grafi ? formatArea(predio.area_grafi) : null} />
              {/* Alerta de discrepancia */}
              {discrepanciaPct !== null && discrepanciaPct > 5 && (
                <div className="flex items-center gap-1.5 py-1 px-2 rounded bg-yellow-50 border border-yellow-100">
                  <svg className="w-3.5 h-3.5 text-yellow-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-[10px] text-yellow-700">
                    Diferencia de {formatArea(discrepanciaAreas!)} ({discrepanciaPct.toFixed(1)}%) entre &aacute;rea oficial y GIS
                  </span>
                </div>
              )}
              {ficha.area_construccion !== null && ficha.area_construccion > 0 ? (
                <>
                  <Row label="&Aacute;rea construcci&oacute;n" value={formatArea(ficha.area_construccion)} />
                  {pctConstruccion !== null && pctConstruccion > 0.1 && (
                    <Row label="Ocupaci&oacute;n del terreno" value={`${pctConstruccion.toFixed(1)}%`} />
                  )}
                </>
              ) : (
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-xs text-gray-500">&Aacute;rea construcci&oacute;n</span>
                  <span className="text-[11px] font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    Bald&iacute;o / Sin construcci&oacute;n
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-400 italic">Sin datos de aval&uacute;o disponibles</p>
        )}
      </div>

      {/* 3. Servicios B&aacute;sicos */}
      {ficha && !fichaLoading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionHeader>Servicios B&aacute;sicos</SectionHeader>
            {(() => {
              const { count, total } = getServicioScore(ficha)
              if (total === 0) return null
              const color = count === total ? 'text-emerald-600' : count >= total / 2 ? 'text-amber-600' : 'text-red-500'
              return <span className={`text-[11px] font-bold ${color}`}>{count}/{total}</span>
            })()}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <ServiceBadge label="Agua" active={ficha.servicio_agua} />
            <ServiceBadge label="Luz" active={ficha.servicio_luz} />
            <ServiceBadge label="Alcantarillado" active={ficha.servicio_alcantarillado} />
            <ServiceBadge label="Telefon&iacute;a" active={ficha.servicio_telefonia} />
          </div>
        </div>
      )}


      {/* 5. Topograf&iacute;a Modal Trigger */}
      <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 flex flex-col items-center">
        <h3 className="text-xs font-semibold text-emerald-800 mb-2 flex items-center justify-center gap-1.5 w-full">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
          </svg>
          An&aacute;lisis Topogr&aacute;fico Exhaustivo
        </h3>
        <p className="text-[11px] text-gray-500 mb-3 text-center px-2">
          Haga clic para cargar el modelo 3D con c&aacute;lculos de pendiente y altimetr&iacute;a en vivo.
        </p>
        <button
          onClick={() => setShowTopografiaModal(true)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
        >
          Visualizar Modal 3D
        </button>
      </div>

      {/* 6. Entorno del Predio — accordion */}
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

      {/* 7. Datos t&eacute;cnicos — accordion colapsado */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowTecnicos(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Datos T&eacute;cnicos
          </span>
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showTecnicos ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showTecnicos && (
          <div className="px-3 py-2 border-t border-gray-200 space-y-1">
            <Row label="Provincia/Cant&oacute;n" value={predio.prov_cant} />
            <Row label="Tipo de Predio" value={predio.tipo_pred} />
            <Row label="Registro Propiedad" value={predio.reg_prop} />
            <Row label="Ocupaci&oacute;n GIM" value={predio.ocup_gim} />

            <Row label="Fecha" value={predio.fecha} />
            <Row label="Observaciones" value={predio.observacio} />
            <Row label="Antecedente GIM" value={predio.ante_gim} />
            <Row label="Clave Rural" value={predio.clave_rura} />
          </div>
        )}
      </div>

      {/* 8. Potencial Edificable */}
      <button
        onClick={onOpenCalculadora}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        Ver Potencial Edificable
      </button>

      {/* Modales locales */}
      {showTopografiaModal && (
        <TopografiaModal
          predioId={predio.id}
          predioLabel={predio.clave_cata || `Predio #${predio.id}`}
          onClose={() => setShowTopografiaModal(false)}
        />
      )}
    </div>
  )
}
