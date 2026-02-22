import { useEffect, useRef, useCallback, useState } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents, LayersControl } from 'react-leaflet'
import L from 'leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PredioProperties } from '../hooks/usePredios'
import { supabase } from '../lib/supabase'
import type { EntornoData } from './EntornoPredio'
import { CATEGORIA_MARKER_COLORS } from './EntornoPredio'

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
    if (flyTo) {
      map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom ?? 17, { duration: 1.5 })
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

function GeoJSONLayer({
  geojson,
  selectedPredioId,
  onSelectPredio,
}: {
  geojson: FeatureCollection | null
  selectedPredioId: number | null
  onSelectPredio: (properties: PredioProperties) => void
}) {
  const map = useMap()
  const layerRef = useRef<L.GeoJSON | null>(null)

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }

    if (!geojson || !geojson.features || geojson.features.length === 0) return

    const layer = L.geoJSON(geojson, {
      renderer: canvasRenderer,
      style: (feature) => {
        const isSelected = feature?.properties?.id === selectedPredioId
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
            (e.target as L.Path).setStyle({ fillOpacity: 0.45, weight: 2 })
          },
          mouseout: (e: L.LeafletMouseEvent) => {
            if (feature.properties?.id !== selectedPredioId) {
              (e.target as L.Path).setStyle({ fillOpacity: 0.15, weight: 1 })
            }
          },
          click: () => {
            onSelectPredio(feature.properties as PredioProperties)
          },
        })
        if (feature.properties?.clave_cata) {
          featureLayer.bindTooltip(feature.properties.clave_cata, {
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
  }, [geojson, selectedPredioId, onSelectPredio, map])

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

function BoundaryLayer({ visible, rpcName, labelProp, cssClass }: {
  visible: boolean
  rpcName: string
  labelProp: string
  cssClass: string
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
  }, [visible, map, loaded, rpcName, labelProp, cssClass])

  return null
}

const GEOSERVER_WMS_URL = 'http://sil.loja.gob.ec/geoserver/pugs_2023_2033/wms'
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

export default function MapView({
  geojson,
  selectedPredioId,
  onSelectPredio,
  onBoundsChange,
  flyTo,
  highlightFeature,
  entornoData,
}: MapProps) {
  const [showBarrios, setShowBarrios] = useState(false)
  const [showParroquias, setShowParroquias] = useState(false)
  const [showAptitud, setShowAptitud] = useState(false)
  const [aptitudCategories, setAptitudCategories] = useState<Record<string, boolean>>(
    () => Object.fromEntries(APTITUD_CATEGORIES.map(c => [c.key, true]))
  )

  const toggleAptitudCategory = useCallback((key: string) => {
    setAptitudCategories(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return (
    <MapContainer
      center={[-3.99, -79.20]}
      zoom={14}
      className="h-full w-full"
      zoomControl={true}
      preferCanvas={true}
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Mapa">
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
        <LayersControl.BaseLayer name="Satelite">
          <TileLayer
            attribution='&copy; Google'
            url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            maxZoom={20}
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      {/* Overlay toggle buttons */}
      <div className="absolute top-20 right-2 z-[1000] flex flex-col gap-1.5">
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
      </div>

      {/* Aptitud legend with category toggles */}
      {showAptitud && (
        <div className="absolute bottom-6 right-2 z-[1000] bg-white/90 backdrop-blur-sm shadow-lg rounded-lg px-3 py-2 space-y-1.5">
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

      <GeoJSONLayer
        geojson={geojson}
        selectedPredioId={selectedPredioId}
        onSelectPredio={onSelectPredio}
      />

      <AptitudLayer visible={showAptitud} activeCategories={aptitudCategories} />
      <BoundaryLayer visible={showBarrios} rpcName="get_limites_barriales_geojson" labelProp="barrio" cssClass="barrio-label" />
      <BoundaryLayer visible={showParroquias} rpcName="get_limites_parroquias_geojson" labelProp="parroquia" cssClass="parroquia-label" />
      <ZoomMessage />
      <BoundsWatcher onBoundsChange={onBoundsChange} />
      <FlyToHandler flyTo={flyTo} />
      <HighlightLayer feature={highlightFeature} onSelect={onSelectPredio} />
      <EntornoLayer data={entornoData ?? null} />
    </MapContainer>
  )
}
