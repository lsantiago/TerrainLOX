import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { PredioProperties } from '../hooks/usePredios'
import type { AptitudData } from '../hooks/useZonificacion'

import EntornoPredio from './EntornoPredio'
import type { EntornoData } from './EntornoPredio'
import TopografiaModal from './TopografiaModal'
import CompartirModal from './CompartirModal'

interface PredioInfoProps {
  predio: PredioProperties
  isFavorito: boolean
  onToggleFavorito: () => void
  onOpenCalculadora: () => void
  onEntornoChange: (data: EntornoData | null) => void
  onFlyTo?: (lat: number, lng: number, label: string) => void
  onCompartir?: (predioId: number, toEmail: string, nota: string) => Promise<{ error: string | null }>
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
  return value.toLocaleString('es-EC', { maximumFractionDigits: 2 }) + ' m²'
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

export default function PredioInfo({ predio, isFavorito, onToggleFavorito, onOpenCalculadora, onEntornoChange, onFlyTo, onCompartir, onClose }: PredioInfoProps) {
  const [parroquiaNombre, setParroquiaNombre] = useState<string | null>(null)
  const [ficha, setFicha] = useState<FichaData | null>(null)
  const [fichaLoading, setFichaLoading] = useState(true)
  const [showEntorno, setShowEntorno] = useState(false)
  const [showTopografiaModal, setShowTopografiaModal] = useState(false)
  const [showCompartirModal, setShowCompartirModal] = useState(false)
  const [showTecnicos, setShowTecnicos] = useState(false)
  const [aptitud, setAptitud] = useState<AptitudData | null>(null)
  const [pendMean, setPendMean] = useState<number | null>(null)
  const [pendLoading, setPendLoading] = useState(false)
  const [barrioAvg, setBarrioAvg] = useState<number | null>(null)

  useEffect(() => {
    setParroquiaNombre(null)
    setFicha(null)
    setFichaLoading(true)
    setShowEntorno(false)
    setShowTecnicos(false)
    setAptitud(null)
    setPendMean(null)
    setBarrioAvg(null)
    onEntornoChange(null)

    supabase.rpc('get_parroquia_predio', { p_id: predio.id }).then(({ data }) => {
      if (data?.parroquia) setParroquiaNombre(data.parroquia)
    })

    supabase.rpc('get_ficha_predio', { p_id: predio.id }).then(({ data }) => {
      setFicha(data as FichaData | null)
      setFichaLoading(false)
    })

    if (predio.barrio) {
      supabase
        .from('barrios_valor_m2')
        .select('avg_valor_m2')
        .ilike('barrio', predio.barrio)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.avg_valor_m2) setBarrioAvg(data.avg_valor_m2)
        })
    }

    supabase.rpc('get_aptitud_predio', { p_id: predio.id }).then(({ data }) => {
      setAptitud(data as AptitudData | null)
    })


    // Si ya viene en los props (clic desde capa de pendientes) usarlo directamente,
    // si no, fetchear del WFS por bbox del predio
    const existingPend = (predio as any).pend_mean
    if (existingPend !== undefined) {
      setPendMean(Number(existingPend))
    } else {
      setPendLoading(true)
      supabase.rpc('get_predio_geojson', { p_id: predio.id }).then(({ data: feat }) => {
        if (!feat) { setPendLoading(false); return }
        // Calcular bbox manualmente sin importar turf en este componente
        const geom = (feat as any)?.geometry
        const ring = geom?.type === 'Polygon' ? geom.coordinates[0]
          : geom?.type === 'MultiPolygon' ? geom.coordinates[0][0] : null
        if (!ring) { setPendLoading(false); return }
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
        for (const [lng, lat] of ring) {
          if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng
          if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat
        }
        const bboxStr = `${minLat},${minLng},${maxLat},${maxLng}`
        const url = `https://api.ellipsis-drive.com/v3/ogc/wfs/1ae9d6a5-c824-456b-b2f9-a903bcbbe91e?service=WFS&version=2.0.0&request=GetFeature&typeNames=layerId_8a89c52f-4a18-44c0-ac40-60cad59392a3&outputFormat=application/json&token=epat_h5sBGBXxU3QnWv06jotT0cbvw9BvZOqiIn8hXgcf9PdTgznUP1fZuJKybq2qCHqL&bbox=${bboxStr}&count=20`
        fetch(url)
          .then(r => r.json())
          .then(wfs => {
            const match = wfs?.features?.find((f: any) => f.properties?.clave_cata === predio.clave_cata)
              ?? wfs?.features?.[0]
            if (match?.properties?.pend_mean !== undefined) {
              setPendMean(Number(match.properties.pend_mean))
            }
          })
          .catch(() => {/* pendiente es dato opcional, fallo silencioso */})
          .finally(() => setPendLoading(false))
      })
    }
  }, [predio.id, predio.clave_cata, onEntornoChange])

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

      {/* 1. Header: clave catastral + tipo + acciones */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {tipoBadge && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${tipoBadge.cls}`}>
                {tipoBadge.text}
              </span>
            )}
            <p className="text-sm font-bold text-gray-800 font-mono mt-0.5">{predio.clave_cata}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Clave Catastral</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {predio.codigo_interno && (
              <a
                href={`https://www.loja.gob.ec/ktastro/code/${predio.codigo_interno}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver c&eacute;dula catastral oficial"
                className="w-7 h-7 flex items-center justify-center rounded-full text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </a>
            )}
            {predio._lat !== undefined && predio._lng !== undefined && (
              <a
                href={`https://www.google.com/maps?q=${predio._lat.toFixed(6)},${predio._lng.toFixed(6)}&z=18`}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver en Google Maps"
                className="w-7 h-7 flex items-center justify-center rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </a>
            )}
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
            {onCompartir && (
              <button
                onClick={() => setShowCompartirModal(true)}
                title="Compartir predio"
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            )}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Ubicaci&oacute;n */}
      <div className="space-y-1">
        <SectionHeader>Ubicaci&oacute;n</SectionHeader>
        <div className={`grid ${ficha?.direccion ? 'grid-cols-3' : 'grid-cols-2'} gap-1 pt-1`}>
          {[
            { label: 'Parroquia', value: parroquia },
            { label: 'Barrio', value: predio.barrio },
            ...(ficha?.direccion ? [{ label: 'Dirección', value: ficha.direccion }] : []),
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

      {/* 3. Propietario */}
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

      {/* 4. Terreno + Servicios */}
      <div className="space-y-2">
        <SectionHeader>Terreno</SectionHeader>
        {fichaLoading ? <Skeleton /> : (
          <div className="space-y-1">
            {areaOficial > 0 && <Row label="&Aacute;rea oficial" value={formatArea(areaOficial)} />}
            <Row label="&Aacute;rea gr&aacute;fica (GIS)" value={predio.area_grafi ? formatArea(predio.area_grafi) : null} />
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
            {ficha ? (
              ficha.area_construccion !== null && ficha.area_construccion > 0 ? (
                <>
                  <Row label="&Aacute;rea construcci&oacute;n" value={formatArea(ficha.area_construccion)} />
                  {pctConstruccion !== null && pctConstruccion > 0.1 && (
                    <Row label="Ocupaci&oacute;n del terreno" value={`${pctConstruccion.toFixed(1)}%`} />
                  )}
                </>
              ) : (
                <div className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-xs text-gray-500">Construcci&oacute;n</span>
                  <span className="text-[11px] font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    Bald&iacute;o / Sin construcci&oacute;n
                  </span>
                </div>
              )
            ) : null}
            {ficha && (
              <div className="flex items-center justify-between pt-1.5">
                <span className="text-xs text-gray-500">Servicios</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex flex-wrap gap-1">
                    <ServiceBadge label="Agua" active={ficha.servicio_agua} />
                    <ServiceBadge label="Luz" active={ficha.servicio_luz} />
                    <ServiceBadge label="Alcant." active={ficha.servicio_alcantarillado} />
                    <ServiceBadge label="Tel." active={ficha.servicio_telefonia} />
                  </div>
                  {(() => {
                    const { count, total } = getServicioScore(ficha)
                    if (total === 0) return null
                    const color = count === total ? 'text-emerald-600' : count >= total / 2 ? 'text-amber-600' : 'text-red-500'
                    return <span className={`text-[11px] font-bold ${color} ml-1`}>{count}/{total}</span>
                  })()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Aval&uacute;o Catastral */}
      <div className="space-y-2">
        <SectionHeader>Aval&uacute;o Catastral</SectionHeader>
        {fichaLoading ? <Skeleton /> : ficha ? (
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
            {ficha.valor_m2 && barrioAvg && (() => {
              const diff = ficha.valor_m2! - barrioAvg
              const pct = (diff / barrioAvg) * 100
              const above = pct >= 0
              return (
                <div className="mt-2.5 pt-2 border-t border-amber-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-amber-700">vs. promedio del barrio</span>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${above ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {above ? '+' : ''}{pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-amber-600">
                    <span>Este predio: <span className="font-semibold text-amber-800">${ficha.valor_m2}/m²</span></span>
                    <span className="text-amber-300">·</span>
                    <span>Barrio: <span className="font-semibold text-amber-800">${barrioAvg}/m²</span></span>
                  </div>
                </div>
              )
            })()}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">Sin datos de avalúo disponibles</p>
        )}
      </div>

      {/* 6. Potencial Edificable */}
      <div className="bg-sky-50 rounded-lg p-3 border border-sky-100 flex flex-col items-center">
        <h3 className="text-xs font-semibold text-sky-800 mb-2 flex items-center justify-center gap-1.5 w-full">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Potencial Edificable
        </h3>
        <p className="text-[11px] text-gray-500 mb-2 text-center px-2">
          Zonificación, usos del suelo, retiros y coeficientes de edificabilidad.
        </p>
        {aptitud?.aptitud && aptitud.aptitud.toLowerCase() !== 'apto' && (
          <div className={`w-full rounded-md px-2.5 py-1.5 mb-2 flex items-center gap-2 ${
            aptitud.aptitud.toLowerCase().includes('no apto')
              ? 'bg-red-100 border border-red-200'
              : aptitud.aptitud.toLowerCase().includes('extremas')
                ? 'bg-orange-100 border border-orange-200'
                : 'bg-amber-100 border border-amber-200'
          }`}>
            <svg className={`w-4 h-4 shrink-0 ${
              aptitud.aptitud.toLowerCase().includes('no apto')
                ? 'text-red-600'
                : aptitud.aptitud.toLowerCase().includes('extremas')
                  ? 'text-orange-600'
                  : 'text-amber-600'
            }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className={`text-[11px] font-semibold ${
                aptitud.aptitud.toLowerCase().includes('no apto')
                  ? 'text-red-700'
                  : aptitud.aptitud.toLowerCase().includes('extremas')
                    ? 'text-orange-700'
                    : 'text-amber-700'
              }`}>{aptitud.aptitud}</p>
              {aptitud.amenazas && (
                <p className="text-[10px] text-gray-600 mt-0.5">{aptitud.amenazas}</p>
              )}
            </div>
          </div>
        )}
        <button
          onClick={onOpenCalculadora}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-sm cursor-pointer"
        >
          Ver Detalle Completo
        </button>
      </div>

      {/* 7. Herramientas de Análisis */}
      <div className="space-y-2">
        <SectionHeader>Análisis</SectionHeader>

        {/* Topografía */}
        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
          <h3 className="text-xs font-semibold text-emerald-800 mb-2 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
            Topografía
          </h3>
          {pendLoading ? (
            <div className="flex items-center gap-2 mb-2 animate-pulse">
              <div className="h-3 bg-emerald-200 rounded w-1/2" />
              <div className="h-3 bg-emerald-200 rounded w-1/4" />
            </div>
          ) : pendMean !== null ? (() => {
            const cat = pendMean >= 35 ? { label: 'Escarpado', color: '#d83c2e', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' }
              : pendMean >= 25 ? { label: 'Fuerte', color: '#dc6b2e', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' }
              : pendMean >= 15 ? { label: 'Moderado', color: '#dc932e', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' }
              : pendMean >= 5  ? { label: 'Suave', color: '#a39d2c', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' }
              : { label: 'Plano', color: '#4d5d28', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' }
            return (
              <div className={`flex items-center justify-between mb-2 px-2.5 py-1.5 rounded-md border ${cat.bg} ${cat.border}`}>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-[11px] text-gray-600">Pendiente media</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${cat.text}`}>{pendMean.toFixed(1)}&deg;</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cat.bg} ${cat.text} border ${cat.border}`}>{cat.label}</span>
                </div>
              </div>
            )
          })() : (
            <p className="text-[11px] text-gray-400 mb-2">Sin datos de pendiente disponibles</p>
          )}
          <button
            onClick={() => setShowTopografiaModal(true)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
          >
            Ver perfil de elevación
          </button>
        </div>

        {/* Entorno del Predio */}
        {!showEntorno ? (
          <div className="bg-teal-50 rounded-lg p-3 border border-teal-100">
            <h3 className="text-xs font-semibold text-teal-800 mb-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Entorno
            </h3>
            <p className="text-[11px] text-gray-500 mb-2">
              Equipamientos cercanos: educación, salud, transporte, seguridad y más.
            </p>
            <button
              onClick={() => setShowEntorno(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm cursor-pointer"
            >
              Explorar Entorno
            </button>
          </div>
        ) : (
          <div className="bg-teal-50 rounded-lg border border-teal-100 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2">
              <h3 className="text-xs font-semibold text-teal-800 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Entorno
              </h3>
              <button
                onClick={() => { setShowEntorno(false); onEntornoChange(null) }}
                className="w-6 h-6 flex items-center justify-center rounded-full text-teal-600 hover:bg-teal-100 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-3 pb-3">
              <EntornoPredio predioId={predio.id} onDataChange={onEntornoChange} onLocate={onFlyTo} />
            </div>
          </div>
        )}
      </div>

      {/* 8. Datos técnicos - accordion colapsado */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowTecnicos(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Datos Técnicos
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
            <Row label="Provincia/Cantón" value={predio.prov_cant} />
            <Row label="Tipo de Predio" value={predio.tipo_pred} />
            <Row label="Registro Propiedad" value={predio.reg_prop} />
            <Row label="Ocupación GIM" value={predio.ocup_gim} />
            <Row label="Fecha" value={predio.fecha} />
            <Row label="Observaciones" value={predio.observacio} />
            <Row label="Antecedente GIM" value={predio.ante_gim} />
            <Row label="Clave Rural" value={predio.clave_rura} />
          </div>
        )}
      </div>

      {/* Modales locales */}
      {showTopografiaModal && (
        <TopografiaModal
          predioId={predio.id}
          predioLabel={predio.clave_cata || `Predio #${predio.id}`}
          pendMean={pendMean ?? undefined}
          onClose={() => setShowTopografiaModal(false)}
        />
      )}
      {showCompartirModal && onCompartir && (
        <CompartirModal
          predioId={predio.id}
          claveCata={predio.clave_cata}
          onCompartir={(toEmail, nota) => onCompartir(predio.id, toEmail, nota)}
          onClose={() => setShowCompartirModal(false)}
        />
      )}
    </div>
  )
}
