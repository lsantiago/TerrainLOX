import { useEffect, useRef, useCallback, useState } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents, LayersControl } from 'react-leaflet'
import L from 'leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PredioProperties } from '../hooks/usePredios'
import { supabase } from '../lib/supabase'
import type { EntornoData } from './EntornoPredio'
import { CATEGORIA_MARKER_COLORS } from './EntornoPredio'
import type { ColorStop } from '../hooks/useValorM2'

const MIN_ZOOM_POLYGONS = 16
const canvasRenderer = L.canvas({ padding: 0.5 })

interface MapProps {
  geojson: FeatureCollection | null
  selectedPredioId: number | null
  onSelectPredio: (properties: PredioProperties) => void
  onBoundsChange: (minLng: number, minLat: number, maxLng: number, maxLat: number, zoom: number) => void
  flyTo: { lat: number; lng: number; zoom?: number } | null
  highlightFeature: Feature | null
  entornoData?: EntornoData | null
  showValorM2: boolean
  onToggleValorM2: () => void
  getValorColor: (valor?: number | null) => string
  colorStops: ColorStop[]
  barriosValor: FeatureCollection | null
}

function BoundsWatcher({ onBoundsChange }: { onBoundsChange: MapProps['onBoundsChange'] }) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(onBoundsChange)
  callbackRef.current = onBoundsChange

  const map = useMapEvents({
    moveend: () => fire(),
    zoomend: () => fire(),
  })

  const fire = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const bounds = map.getBounds()
      callbackRef.current(
        bounds.getWest(), bounds.getSouth(),
        bounds.getEast(), bounds.getNorth(),
        map.getZoom()
      )
    }, 300)
  }, [map])

  useEffect(() => {
    fire()
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [fire])

  return null
}

function FlyToHandler({ flyTo }: { flyTo: MapProps['flyTo'] }) {
  const map = useMap()
  useEffect(() => {
    if (!flyTo) return

    map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom ?? 17, { duration: 1.5 })

    // Pulse marker at destination, auto-removes after 3s
    const pulseIcon = L.divIcon({
      className: 'pulse-marker',
      html: '<div class="pulse-ring"></div><div class="pulse-dot"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })
    const marker = L.marker([flyTo.lat, flyTo.lng], { icon: pulseIcon, interactive: false })
    marker.addTo(map)

    const timer = setTimeout(() => {
      map.removeLayer(marker)
    }, 3000)

    return () => {
      clearTimeout(timer)
      if (map.hasLayer(marker)) map.removeLayer(marker)
    }
  }, [flyTo, map])
  return null
}

function HighlightLayer({ feature, onSelect }: { feature: Feature | null; onSelect: (props: PredioProperties) => void }) {
  const map = useMap()

  useEffect(() => {
    if (!feature) return

    const layer = L.geoJSON(feature, {
      style: {
        color: '#f59e0b',
        weight: 3,
        fillColor: '#fbbf24',
        fillOpacity: 0.4,
      },
      renderer: canvasRenderer,
    } as L.GeoJSONOptions)

    layer.addTo(map)
    const bounds = layer.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 })
    }
    onSelect(feature.properties as PredioProperties)

    return () => { map.removeLayer(layer) }
  }, [feature, map, onSelect])

  return null
}

function formatCompact(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return `$${Math.round(value)}`
}

function GeoJSONLayer({
  geojson,
  selectedPredioId,
  onSelectPredio,
  showValorM2,
  getValorColor,
}: {
  geojson: FeatureCollection | null
  selectedPredioId: number | null
  onSelectPredio: (properties: PredioProperties) => void
  showValorM2: boolean
  getValorColor: (valor?: number | null) => string
}) {
  const map = useMap()
  const layerRef = useRef<L.GeoJSON | null>(null)
  const labelsRef = useRef<L.LayerGroup | null>(null)
  const [zoom, setZoom] = useState(() => map.getZoom())

  // Refs para que los callbacks y props siempre usen el valor más reciente
  // sin necesitar reconstruir la capa
  const onSelectPredioRef = useRef(onSelectPredio)
  onSelectPredioRef.current = onSelectPredio
  const showValorM2Ref = useRef(showValorM2)
  showValorM2Ref.current = showValorM2
  const getValorColorRef = useRef(getValorColor)
  getValorColorRef.current = getValorColor
  const selectedPredioIdRef = useRef(selectedPredioId)
  selectedPredioIdRef.current = selectedPredioId

  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })

  // Construir la capa solo cuando cambia el dataset (geojson)
  // El estilo y handlers siempre leen de refs, nunca quedan stale
  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }

    if (!geojson || !geojson.features || geojson.features.length === 0) return

    const layer = L.geoJSON(geojson, {
      renderer: canvasRenderer,
      style: (feature) => {
        const isSelected = feature?.properties?.id === selectedPredioIdRef.current
        const valorM2 = showValorM2Ref.current
        if (valorM2) {
          const fill = getValorColorRef.current(feature?.properties?.valor_m2)
          return {
            color: isSelected ? '#059669' : '#555',
            weight: isSelected ? 3 : 1,
            fillColor: fill,
            fillOpacity: isSelected ? 0.8 : 0.6,
          }
        }
        return {
          color: isSelected ? '#059669' : '#3b82f6',
          weight: isSelected ? 3 : 1,
          fillColor: isSelected ? '#10b981' : '#60a5fa',
          fillOpacity: isSelected ? 0.4 : 0.15,
        }
      },
      onEachFeature: (feature, featureLayer) => {
        featureLayer.on({
          mouseover: (e: L.LeafletMouseEvent) => {
            const base = showValorM2Ref.current ? 0.6 : 0.15
            ;(e.target as L.Path).setStyle({ fillOpacity: base + 0.2, weight: 2 })
          },
          mouseout: (e: L.LeafletMouseEvent) => {
            if (feature.properties?.id !== selectedPredioIdRef.current) {
              const base = showValorM2Ref.current ? 0.6 : 0.15
              ;(e.target as L.Path).setStyle({ fillOpacity: base, weight: 1 })
            }
          },
          click: () => {
            const geom = feature.geometry
            let _lat: number | undefined, _lng: number | undefined
            if (geom.type === 'Polygon') {
              const coords = geom.coordinates[0]
              let cx = 0, cy = 0
              for (const c of coords) { cx += c[0]; cy += c[1] }
              _lng = cx / coords.length; _lat = cy / coords.length
            } else if (geom.type === 'MultiPolygon') {
              const coords = geom.coordinates[0][0]
              let cx = 0, cy = 0
              for (const c of coords) { cx += c[0]; cy += c[1] }
              _lng = cx / coords.length; _lat = cy / coords.length
            }
            onSelectPredioRef.current({ ...feature.properties, _lat, _lng } as PredioProperties)
          },
        })
        const p = feature.properties
        // El tooltip se actualiza dinámicamente al abrir (via openTooltip) —
        // para simplificar mostramos siempre clave + valor si existe
        const parts: string[] = []
        if (p?.clave_cata) parts.push(p.clave_cata)
        if (p?.valor_m2) parts.push(`$${p.valor_m2}/m²`)
        if (p?.avaluo_total) parts.push(`Avalúo: ${formatCompact(p.avaluo_total)}`)
        if (parts.length) {
          featureLayer.bindTooltip(parts.join(' · '), {
            sticky: true,
            className: 'text-xs',
          })
        }
      },
    } as L.GeoJSONOptions)

    layer.addTo(map)
    layerRef.current = layer

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [geojson, map])

  // Actualizar estilos sin reconstruir la capa cuando cambian showValorM2 o selectedPredioId
  useEffect(() => {
    if (!layerRef.current) return
    layerRef.current.setStyle((feature) => {
      const isSelected = feature?.properties?.id === selectedPredioId
      if (showValorM2) {
        const fill = getValorColor(feature?.properties?.valor_m2)
        return {
          color: isSelected ? '#059669' : '#555',
          weight: isSelected ? 3 : 1,
          fillColor: fill,
          fillOpacity: isSelected ? 0.8 : 0.6,
        }
      }
      return {
        color: isSelected ? '#059669' : '#3b82f6',
        weight: isSelected ? 3 : 1,
        fillColor: isSelected ? '#10b981' : '#60a5fa',
        fillOpacity: isSelected ? 0.4 : 0.15,
      }
    })
  }, [showValorM2, getValorColor, selectedPredioId])

  // Permanent labels at high zoom
  useEffect(() => {
    if (labelsRef.current) {
      map.removeLayer(labelsRef.current)
      labelsRef.current = null
    }

    if (!showValorM2 || zoom < 18 || !geojson?.features?.length) return

    const group = L.layerGroup()
    const bounds = map.getBounds()

    for (const feature of geojson.features) {
      const p = feature.properties
      if (!p?.valor_m2) continue

      // Get centroid for label placement
      const geom = feature.geometry
      let lat: number, lng: number
      if (geom.type === 'Polygon') {
        const coords = geom.coordinates[0]
        let cx = 0, cy = 0
        for (const c of coords) { cx += c[0]; cy += c[1] }
        lng = cx / coords.length
        lat = cy / coords.length
      } else if (geom.type === 'MultiPolygon') {
        const coords = geom.coordinates[0][0]
        let cx = 0, cy = 0
        for (const c of coords) { cx += c[0]; cy += c[1] }
        lng = cx / coords.length
        lat = cy / coords.length
      } else continue

      // Skip if outside current view
      if (!bounds.contains([lat, lng])) continue

      let labelText: string
      if (zoom >= 19 && p.avaluo_total) {
        labelText = `$${p.valor_m2}/m²\n${formatCompact(p.avaluo_total)}`
      } else {
        labelText = `$${p.valor_m2}`
      }

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'predio-valor-label',
          html: `<span>${labelText.replace('\n', '<br/>')}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        interactive: false,
      })
      marker.addTo(group)
    }

    group.addTo(map)
    labelsRef.current = group

    return () => {
      if (labelsRef.current) {
        map.removeLayer(labelsRef.current)
        labelsRef.current = null
      }
    }
  }, [geojson, showValorM2, zoom, map])

  return null
}

function ZoomMessage() {
  const [zoom, setZoom] = useState(14)
  const map = useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  })

  useEffect(() => { setZoom(map.getZoom()) }, [map])

  if (zoom >= MIN_ZOOM_POLYGONS) return null

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm shadow-lg rounded-lg px-3 py-1.5 pointer-events-none max-w-[90%]">
      <p className="text-[11px] sm:text-xs text-gray-600 font-medium text-center">
        Acércate más para ver los predios (zoom {zoom}/{MIN_ZOOM_POLYGONS})
      </p>
    </div>
  )
}

// Explicitly unbind tooltips and remove all sub-layers before removing from map
function cleanupLayer(map: L.Map, layer: L.Layer | null) {
  if (!layer) return
  if ('eachLayer' in layer && typeof (layer as L.LayerGroup).eachLayer === 'function') {
    (layer as L.LayerGroup).eachLayer(sub => {
      if ('unbindTooltip' in sub) (sub as L.Layer & { unbindTooltip: () => void }).unbindTooltip()
      if ('unbindPopup' in sub) (sub as L.Layer & { unbindPopup: () => void }).unbindPopup()
    })
  }
  map.removeLayer(layer)
}

// Palette of distinguishable colors for boundary polygons
const BOUNDARY_PALETTE = [
  '#8b5cf6', '#0d9488', '#e11d48', '#2563eb', '#d97706',
  '#7c3aed', '#059669', '#dc2626', '#4f46e5', '#ca8a04',
  '#9333ea', '#0891b2', '#c2410c', '#1d4ed8', '#a16207',
  '#6d28d9', '#0e7490', '#b91c1c', '#3b82f6', '#92400e',
  '#a855f7', '#14b8a6', '#f43f5e', '#6366f1', '#eab308',
  '#7e22ce', '#06b6d4', '#ef4444', '#818cf8', '#f59e0b',
  '#c084fc', '#2dd4bf', '#fb7185', '#a5b4fc', '#fbbf24',
]

function hashIndex(str: string, len: number): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return ((h % len) + len) % len
}

function BoundaryLayer({ visible, rpcName, labelProp, cssClass, subdued }: {
  visible: boolean
  rpcName: string
  labelProp: string
  cssClass: string
  subdued?: boolean
}) {
  const map = useMap()
  const layerRef = useRef<L.GeoJSON | null>(null)
  const dataRef = useRef<FeatureCollection | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!visible) {
      if (layerRef.current) {
        cleanupLayer(map, layerRef.current)
        layerRef.current = null
      }
      return
    }

    const show = (fc: FeatureCollection) => {
      if (layerRef.current) {
        cleanupLayer(map, layerRef.current)
      }
      const layer = L.geoJSON(fc, {
        interactive: false,
        renderer: canvasRenderer,
        style: (feature) => {
          const label = feature?.properties?.[labelProp] || ''
          const c = BOUNDARY_PALETTE[hashIndex(label, BOUNDARY_PALETTE.length)]
          if (subdued) {
            return {
              color: '#666',
              weight: 1.5,
              dashArray: '6 4',
              fillColor: 'transparent',
              fillOpacity: 0,
            }
          }
          return {
            color: c,
            weight: 2,
            dashArray: '6 4',
            fillColor: c,
            fillOpacity: 0.12,
          }
        },
        onEachFeature: (feature, featureLayer) => {
          const label = feature.properties?.[labelProp]
          if (label) {
            featureLayer.bindTooltip(label, {
              permanent: true,
              direction: 'center',
              className: `${cssClass} pointer-events-none`,
            })
          }
        },
      } as L.GeoJSONOptions)
      layer.addTo(map)
      layerRef.current = layer
    }

    if (dataRef.current) {
      show(dataRef.current)
      return
    }

    if (!loaded) {
      supabase.rpc(rpcName).then(({ data }) => {
        if (data) {
          dataRef.current = data as FeatureCollection
          show(data as FeatureCollection)
        }
        setLoaded(true)
      })
    }

    return () => {
      if (layerRef.current) {
        cleanupLayer(map, layerRef.current)
        layerRef.current = null
      }
    }
  }, [visible, map, loaded, rpcName, labelProp, cssClass, subdued])

  return null
}

const GEOSERVER_WMS_URL = window.location.protocol === 'https:'
  ? '/api/wms'
  : 'http://sil.loja.gob.ec/geoserver/pugs_2023_2033/wms'
const WMS_LAYER_NAME = 'pugs_2023_2033:aptitud_fisico_constructiva_del_suelo_2023_2033'

const APTITUD_CATEGORIES: { key: string; label: string; color: string; border: string }[] = [
  { key: 'APTO', label: 'Apto', color: '#FFEE00', border: '#d4c500' },
  { key: 'APTO CON MEDIANAS LIMITACIONES', label: 'Medianas limitaciones', color: '#51B7D3', border: '#3a9ab5' },
  { key: 'APTO CON EXTREMAS LIMITACIONES', label: 'Extremas limitaciones', color: '#6F20E6', border: '#5a1abf' },
  { key: 'NO APTO', label: 'No apto', color: '#FF0044', border: '#cc0036' },
]

function buildCqlFilter(active: Record<string, boolean>): string {
  const activeKeys = APTITUD_CATEGORIES.filter(c => active[c.key]).map(c => `'${c.key}'`)
  return `aptitud IN (${activeKeys.join(',')})`
}

function AptitudLayer({ visible, activeCategories }: { visible: boolean; activeCategories: Record<string, boolean> }) {
  const map = useMap()
  const layerRef = useRef<L.TileLayer.WMS | null>(null)

  useEffect(() => {
    const hasActive = visible && APTITUD_CATEGORIES.some(c => activeCategories[c.key])

    if (!hasActive) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
      return
    }

    // Ensure overlay pane exists
    if (!map.getPane('wmsOverlay')) {
      const pane = map.createPane('wmsOverlay')
      pane.style.zIndex = '450'
    }

    const allActive = APTITUD_CATEGORIES.every(c => activeCategories[c.key])
    const cqlFilter = allActive ? undefined : buildCqlFilter(activeCategories)

    // Remove previous before adding new (filter changes require new layer)
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
    }

    const wmsParams: any = {
      layers: WMS_LAYER_NAME,
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      opacity: 0.7,
      pane: 'wmsOverlay',
    }
    if (cqlFilter) {
      wmsParams.CQL_FILTER = cqlFilter
    }

    const wmsLayer = L.tileLayer.wms(GEOSERVER_WMS_URL, wmsParams)

    wmsLayer.addTo(map)
    layerRef.current = wmsLayer

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [visible, activeCategories, map])

  return null
}

function EntornoLayer({ data }: { data: EntornoData | null }) {
  const map = useMap()
  const layerGroupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (layerGroupRef.current) {
      cleanupLayer(map, layerGroupRef.current)
      layerGroupRef.current = null
    }

    if (!data || !data.centroid) return

    const group = L.layerGroup()

    // Buffer circle — solid fill to highlight the analysis area
    L.circle([data.centroid.lat, data.centroid.lng], {
      radius: data.distancia,
      color: '#0d9488',
      weight: 2.5,
      fillColor: '#ccfbf1',
      fillOpacity: 0.25,
      interactive: false,
      renderer: canvasRenderer,
    }).addTo(group)

    // Inner glow ring for emphasis
    L.circle([data.centroid.lat, data.centroid.lng], {
      radius: data.distancia * 0.02,
      color: '#0d9488',
      weight: 0,
      fillColor: '#0d9488',
      fillOpacity: 0.5,
      interactive: false,
      renderer: canvasRenderer,
    }).addTo(group)

    // Equipment markers — larger, with shadow ring for visibility
    data.equipamientos.forEach(eq => {
      const color = CATEGORIA_MARKER_COLORS[eq.categoria] || '#6b7280'
      // Outer shadow ring
      L.circleMarker([eq.lat, eq.lng], {
        radius: 10,
        color: 'transparent',
        weight: 0,
        fillColor: '#000',
        fillOpacity: 0.15,
        interactive: false,
        renderer: canvasRenderer,
      }).addTo(group)
      // Main marker
      L.circleMarker([eq.lat, eq.lng], {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
        renderer: canvasRenderer,
      })
        .bindTooltip(
          `<strong>${eq.descripcion}</strong><br/><span style="color:#666">${eq.categoria} · ${eq.distancia}m</span>`,
          { sticky: true, className: 'text-xs' }
        )
        .addTo(group)
    })

    group.addTo(map)
    layerGroupRef.current = group

    return () => {
      if (layerGroupRef.current) {
        cleanupLayer(map, layerGroupRef.current)
        layerGroupRef.current = null
      }
    }
  }, [data, map])

  return null
}

function BarriosValorLayer({ visible, data, getValorColor }: {
  visible: boolean
  data: FeatureCollection | null
  getValorColor: (valor?: number | null) => string
}) {
  const map = useMap()
  const layerRef = useRef<L.GeoJSON | null>(null)
  const [zoom, setZoom] = useState(13)

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  })
  useEffect(() => { setZoom(map.getZoom()) }, [map])

  // Opacity fades from 0.5 at zoom 13 to 0 at zoom 16
  const fillOpacity = Math.max(0, 0.5 - (zoom - 13) * 0.17)

  useEffect(() => {
    if (layerRef.current) {
      cleanupLayer(map, layerRef.current)
      layerRef.current = null
    }

    if (!visible || !data || !data.features?.length || fillOpacity <= 0) return

    const layer = L.geoJSON(data, {
      renderer: canvasRenderer,
      style: (feature) => {
        const avg = feature?.properties?.avg_valor_m2
        return {
          color: '#555',
          weight: Math.max(0.5, 1.5 - (zoom - 13) * 0.3),
          fillColor: getValorColor(avg),
          fillOpacity,
        }
      },
      onEachFeature: (feature, featureLayer) => {
        const p = feature.properties
        if (p?.barrio) {
          featureLayer.bindTooltip(
            `<strong>${p.barrio}</strong><br/>` +
            `Promedio: <b>$${p.avg_valor_m2}/m²</b><br/>` +
            `Rango: $${p.min_valor_m2} – $${p.max_valor_m2}<br/>` +
            `${p.predios} predios`,
            { sticky: true, className: 'text-xs' }
          )
        }
      },
    } as L.GeoJSONOptions)

    layer.addTo(map)
    layerRef.current = layer

    return () => {
      if (layerRef.current) {
        cleanupLayer(map, layerRef.current)
        layerRef.current = null
      }
    }
  }, [visible, data, map, getValorColor, fillOpacity, zoom])

  return null
}

const ELLIPSIS_WFS_URL = 'https://api.ellipsis-drive.com/v3/ogc/wfs/be70031f-3f4e-4c6a-8de8-d9565359c4bc'
const ELLIPSIS_TOKEN = 'epat_bpI06vrcoxSRHZKXC6ckQSM23nK1kh8QSPf4XoMJ1OQ5X6XXfz4oMyp2n58SnqLf'
const ELLIPSIS_LAYER = 'layerId_0ed5501a-4e21-4788-82d8-c2044d57614d'

// New WFS for Slopes (Pendientes)
const PENDIENTES_WFS_ROOT = 'https://api.ellipsis-drive.com/v3/ogc/wfs/1ae9d6a5-c824-456b-b2f9-a903bcbbe91e'
const PENDIENTES_TOKEN = 'epat_h5sBGBXxU3QnWv06jotT0cbvw9BvZOqiIn8hXgcf9PdTgznUP1fZuJKybq2qCHqL'
const PENDIENTES_LAYER = 'layerId_8a89c52f-4a18-44c0-ac40-60cad59392a3'

const PENDIENTES_SCALE = [
  { min: 0, max: 5, color: '#4d5d28', label: 'Plano (0-5°)' },
  { min: 5, max: 15, color: '#a39d2c', label: 'Suave (5-15°)' },
  { min: 15, max: 25, color: '#dc932e', label: 'Moderado (15-25°)' },
  { min: 25, max: 35, color: '#dc6b2e', label: 'Fuerte (25-35°)' },
  { min: 35, max: 100, color: '#d83c2e', label: 'Escarpado (35°+)' },
]

function getPendienteColor(val: number): string {
  for (const stop of PENDIENTES_SCALE) {
    if (val >= stop.min && val < stop.max) return stop.color
  }
  return val >= 100 ? '#d83c2e' : '#cbd5e1'
}

function MovimientosLaderaLayer({ visible }: { visible: boolean }) {
  const map = useMap()
  const layerRef = useRef<L.GeoJSON | null>(null)
  const dataRef = useRef<FeatureCollection | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!visible) {
      if (layerRef.current) {
        cleanupLayer(map, layerRef.current)
        layerRef.current = null
      }
      return
    }

    const show = (fc: FeatureCollection) => {
      if (layerRef.current) {
        cleanupLayer(map, layerRef.current)
      }
      const layer = L.geoJSON(fc, {
        renderer: canvasRenderer,
        style: () => ({
          color: '#dc2626',
          weight: 1.5,
          fillColor: '#ef4444',
          fillOpacity: 0.3,
        }),
        onEachFeature: (feature, featureLayer) => {
          const p = feature.properties
          const parts: string[] = []
          if (p?.tipo) parts.push(`<strong>${p.tipo}</strong>`)
          if (p?.area) parts.push(`Área: ${Number(p.area).toLocaleString('es-EC', { maximumFractionDigits: 1 })} m²`)
          if (parts.length) {
            featureLayer.bindTooltip(parts.join('<br/>'), { sticky: true, className: 'text-xs' })
          }
        },
      } as L.GeoJSONOptions)
      layer.addTo(map)
      layerRef.current = layer
    }

    if (dataRef.current) {
      show(dataRef.current)
      return
    }

    if (!loaded) {
      const url = `${ELLIPSIS_WFS_URL}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${ELLIPSIS_LAYER}&outputFormat=application/json&token=${ELLIPSIS_TOKEN}`
      fetch(url)
        .then(res => res.json())
        .then((data: FeatureCollection) => {
          dataRef.current = data
          show(data)
          setLoaded(true)
        })
        .catch(err => {
          console.error('Error cargando movimientos de ladera:', err)
          setLoaded(true)
        })
    }

    return () => {
      if (layerRef.current) {
        cleanupLayer(map, layerRef.current)
        layerRef.current = null
      }
    }
  }, [visible, map, loaded])

  return null
}

function PendientesLayer({ visible, onPendienteClick, onPendienteData }: {
  visible: boolean
  onPendienteClick: (clave_cata: string, pend_mean: number) => void
  onPendienteData: (clave_cata: string, pend_mean: number) => void
}) {
  const map = useMap()
  const layerRef = useRef<L.GeoJSON | null>(null)
  const rendererRef = useRef<L.Canvas | null>(null)
  const loadedIdsRef = useRef<Set<string>>(new Set())
  // Callback refs — evitan stale closures sin necesidad de reconstruir la capa
  const onPendienteClickRef = useRef(onPendienteClick)
  onPendienteClickRef.current = onPendienteClick
  const onPendienteDataRef = useRef(onPendienteData)
  onPendienteDataRef.current = onPendienteData

  const fetchAndAdd = useCallback(() => {
    if (!layerRef.current) return
    if (map.getZoom() < MIN_ZOOM_POLYGONS) return

    const bounds = map.getBounds()
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`
    const url = `${PENDIENTES_WFS_ROOT}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${PENDIENTES_LAYER}&outputFormat=application/json&token=${PENDIENTES_TOKEN}&bbox=${bbox}&count=10000`

    fetch(url)
      .then(res => res.json())
      .then((data: FeatureCollection) => {
        if (!layerRef.current || !data?.features) return
        // Solo agregar features nuevas — nunca destruir la capa
        const newFeatures = data.features.filter(f => f.id && !loadedIdsRef.current.has(String(f.id)))
        newFeatures.forEach(f => {
          loadedIdsRef.current.add(String(f.id))
          if (f.properties?.clave_cata && f.properties?.pend_mean !== undefined) {
            onPendienteDataRef.current(f.properties.clave_cata, f.properties.pend_mean)
          }
          layerRef.current!.addData(f as any)
        })
      })
      .catch(err => console.error('Error cargando pendientes:', err))
  }, [map])

  useEffect(() => {
    if (!visible) {
      if (layerRef.current) {
        cleanupLayer(map, layerRef.current)
        layerRef.current = null
      }
      if (rendererRef.current) {
        map.removeLayer(rendererRef.current)
        rendererRef.current = null
      }
      loadedIdsRef.current = new Set()
      return
    }

    // Pane dedicado con z-index superior al overlayPane (400)
    if (!map.getPane('pendientesPane')) {
      const pane = map.createPane('pendientesPane')
      pane.style.zIndex = '450'
    }
    const pendientesRenderer = L.canvas({ padding: 0.5, pane: 'pendientesPane' } as any)
    rendererRef.current = pendientesRenderer

    // Crear la capa una sola vez — nunca se reconstruye
    const layer = L.geoJSON(undefined, {
      renderer: pendientesRenderer,
      pane: 'pendientesPane',
      style: (feature) => {
        const val = feature?.properties?.pend_mean || 0
        return { color: '#fff', weight: 0.5, fillColor: getPendienteColor(val), fillOpacity: 0.7 }
      },
      onEachFeature: (feature, featureLayer) => {
        const p = feature.properties
        if (p) {
          featureLayer.bindTooltip(
            `<div class="p-1 space-y-0.5">` +
              `<div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background:${getPendienteColor(p.pend_mean)}"></span>` +
              `<strong class="text-sm">Pendiente: ${Number(p.pend_mean).toFixed(2)}°</strong></div>` +
              `<div class="text-[10px] text-gray-500 border-t border-gray-100 mt-1 pt-1">${p.barrio || 'Sin barrio'} · Clave: ${p.clave_cata}</div>` +
            `</div>`,
            { sticky: true, offset: [10, 0] }
          )
          featureLayer.on('click', () => onPendienteClickRef.current(p.clave_cata, p.pend_mean))
        }
      },
    } as L.GeoJSONOptions)
    layer.addTo(map)
    layerRef.current = layer

    fetchAndAdd()
    map.on('moveend', fetchAndAdd)

    return () => {
      map.off('moveend', fetchAndAdd)
      cleanupLayer(map, layer)
      layerRef.current = null
      loadedIdsRef.current = new Set()
      // Eliminar el renderer del mapa para que su <canvas> desaparezca del DOM.
      // Sin esto, el canvas vacío a z=450 bloquea todos los clics sobre los predios.
      if (rendererRef.current) {
        map.removeLayer(rendererRef.current)
        rendererRef.current = null
      }
    }
  }, [visible, map, fetchAndAdd])

  return null
}

function ValorM2Legend({ visible, colorStops }: { visible: boolean; colorStops: ColorStop[] }) {
  if (!visible) return null

  return (
    <div className="absolute bottom-20 sm:bottom-6 left-2 z-[1000] bg-white/90 backdrop-blur-sm shadow-lg rounded-lg px-3 py-2 space-y-1">
      <p className="font-semibold text-gray-700 text-[11px]">Valor m² (USD)</p>
      {colorStops.map((stop, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-3.5 h-3.5 rounded-sm shrink-0 border border-gray-300"
            style={{ backgroundColor: stop.color }}
          />
          <span className="text-[10px] text-gray-600">{stop.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function MapView({
  geojson,
  selectedPredioId,
  onSelectPredio,
  onBoundsChange,
  flyTo,
  highlightFeature,
  entornoData,
  showValorM2,
  onToggleValorM2,
  getValorColor,
  colorStops,
  barriosValor,
}: MapProps) {
  const [showBarrios, setShowBarrios] = useState(false)
  const [showParroquias, setShowParroquias] = useState(true)
  const [showAptitud, setShowAptitud] = useState(false)
  const [showMovimientos, setShowMovimientos] = useState(false)
  const [showPendientes, setShowPendientes] = useState(false)
  const [aptitudCategories, setAptitudCategories] = useState<Record<string, boolean>>(
    () => Object.fromEntries(APTITUD_CATEGORIES.map(c => [c.key, true]))
  )

  const toggleAptitudCategory = useCallback((key: string) => {
    setAptitudCategories(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Lookup de pendientes por clave_cata — se llena incrementalmente conforme carga la capa
  const pendientesByClaveRef = useRef<Record<string, number>>({})
  const handlePendienteData = useCallback((clave_cata: string, pend_mean: number) => {
    pendientesByClaveRef.current[clave_cata] = pend_mean
  }, [])

  // Selector unificado: siempre agrega pend_mean si está disponible, sin importar qué capa generó el clic
  const selectPredioWithPendiente = useCallback((properties: PredioProperties) => {
    const pend_mean = pendientesByClaveRef.current[properties.clave_cata]
    onSelectPredio(pend_mean !== undefined ? { ...properties, pend_mean } as any : properties)
  }, [onSelectPredio])

  // Cola para clics sobre pendientes cuando los predios aún no han cargado
  const pendingClaveRef = useRef<string | null>(null)

  const handlePendienteClick = useCallback((clave_cata: string, _pend_mean: number) => {
    const feature = geojson?.features?.find(f => f.properties?.clave_cata === clave_cata)
    if (feature?.properties) {
      selectPredioWithPendiente(feature.properties as PredioProperties)
    } else {
      pendingClaveRef.current = clave_cata
    }
  }, [geojson, selectPredioWithPendiente])

  // Procesar clic pendiente cuando el geojson se actualiza
  useEffect(() => {
    if (!pendingClaveRef.current || !geojson?.features?.length) return
    const feature = geojson.features.find(f => f.properties?.clave_cata === pendingClaveRef.current)
    if (feature?.properties) {
      pendingClaveRef.current = null
      selectPredioWithPendiente(feature.properties as PredioProperties)
    }
  }, [geojson, selectPredioWithPendiente])

  return (
    <MapContainer
      center={[-3.99, -79.20]}
      zoom={13}
      className="h-full w-full"
      zoomControl={true}
      preferCanvas={true}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer name="Mapa">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Topografico">
          <TileLayer
            attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            maxZoom={17}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer checked name="Satelite">
          <TileLayer
            attribution='&copy; Google'
            url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            maxZoom={20}
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      {/* Overlay toggle buttons — below LayersControl */}
      <div className="absolute top-28 sm:top-20 right-2 z-[999] flex flex-col gap-1.5">
        <button
          onClick={() => setShowBarrios(v => !v)}
          className={`bg-white shadow-md rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer border ${
            showBarrios
              ? 'border-violet-400 text-violet-700 bg-violet-50'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Barrios
        </button>
        <button
          onClick={() => setShowParroquias(v => !v)}
          className={`bg-white shadow-md rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer border ${
            showParroquias
              ? 'border-teal-400 text-teal-700 bg-teal-50'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Parroquias
        </button>
        <button
          onClick={() => setShowAptitud(v => !v)}
          className={`bg-white shadow-md rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer border ${
            showAptitud
              ? 'border-emerald-400 text-emerald-700 bg-emerald-50'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Aptitud
        </button>
        <button
          onClick={onToggleValorM2}
          className={`bg-white shadow-md rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer border ${
            showValorM2
              ? 'border-orange-400 text-orange-700 bg-orange-50'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Valor m²
        </button>
        <button
          onClick={() => setShowMovimientos(v => !v)}
          className={`bg-white shadow-md rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer border ${
            showMovimientos
              ? 'border-red-400 text-red-700 bg-red-50'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Deslizamientos
        </button>
        <button
          onClick={() => setShowPendientes(v => !v)}
          className={`bg-white shadow-md rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors cursor-pointer border ${
            showPendientes
              ? 'border-amber-500 text-amber-700 bg-amber-50'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Pendientes
        </button>
      </div>

      {/* Aptitud legend with category toggles */}
      {showAptitud && (
        <div className="absolute bottom-20 sm:bottom-6 right-2 z-[1000] bg-white/90 backdrop-blur-sm shadow-lg rounded-lg px-3 py-2 space-y-1.5">
          <p className="font-semibold text-gray-700 text-[11px]">Aptitud Constructiva</p>
          {APTITUD_CATEGORIES.map(cat => (
            <label key={cat.key} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aptitudCategories[cat.key]}
                onChange={() => toggleAptitudCategory(cat.key)}
                className="sr-only"
              />
              <span
                className="w-3.5 h-3.5 rounded-sm shrink-0 border-2 flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: aptitudCategories[cat.key] ? cat.color : 'transparent',
                  borderColor: cat.border,
                }}
              >
                {aptitudCategories[cat.key] && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="text-[11px] text-gray-600">{cat.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Pendientes Legend */}
      {showPendientes && (
        <div className="absolute bottom-20 sm:bottom-6 right-2 z-[1000] bg-white/90 backdrop-blur-sm shadow-lg rounded-lg px-3 py-2 space-y-1">
          <p className="font-semibold text-gray-700 text-[11px]">Rango de Pendientes</p>
          {PENDIENTES_SCALE.map((stop, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-sm shrink-0 border border-gray-300"
                style={{ backgroundColor: stop.color }}
              />
              <span className="text-[10px] text-gray-600 font-medium">{stop.label}</span>
            </div>
          ))}
        </div>
      )}

      <GeoJSONLayer
        geojson={geojson}
        selectedPredioId={selectedPredioId}
        onSelectPredio={selectPredioWithPendiente}
        showValorM2={showValorM2}
        getValorColor={getValorColor}
      />

      <AptitudLayer visible={showAptitud} activeCategories={aptitudCategories} />
      <BoundaryLayer visible={showBarrios} rpcName="get_limites_barriales_geojson" labelProp="barrio" cssClass="barrio-label" subdued={showValorM2} />
      <BoundaryLayer visible={showParroquias} rpcName="get_limites_parroquias_geojson" labelProp="parroquia" cssClass="parroquia-label" subdued={showValorM2} />
      <MovimientosLaderaLayer visible={showMovimientos} />
      <PendientesLayer visible={showPendientes} onPendienteClick={handlePendienteClick} onPendienteData={handlePendienteData} />
      <BarriosValorLayer visible={showValorM2} data={barriosValor} getValorColor={getValorColor} />
      <ValorM2Legend visible={showValorM2} colorStops={colorStops} />
      <ZoomMessage />
      <BoundsWatcher onBoundsChange={onBoundsChange} />
      <FlyToHandler flyTo={flyTo} />
      <HighlightLayer feature={highlightFeature} onSelect={onSelectPredio} />
      <EntornoLayer data={entornoData ?? null} />
    </MapContainer>
  )
}
