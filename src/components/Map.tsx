import { useEffect, useRef, useCallback, useState } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { FeatureCollection, Feature } from 'geojson'
import type { PredioProperties } from '../hooks/usePredios'

const MIN_ZOOM_POLYGONS = 16
const canvasRenderer = L.canvas({ padding: 0.5 })

interface MapProps {
  geojson: FeatureCollection | null
  selectedPredioId: number | null
  onSelectPredio: (properties: PredioProperties) => void
  onBoundsChange: (minLng: number, minLat: number, maxLng: number, maxLat: number, zoom: number) => void
  flyTo: { lat: number; lng: number; zoom?: number } | null
  highlightFeature: Feature | null
}

function BoundsWatcher({ onBoundsChange }: { onBoundsChange: MapProps['onBoundsChange'] }) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const map = useMapEvents({
    moveend: () => fire(),
    zoomend: () => fire(),
  })

  const fire = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const bounds = map.getBounds()
      onBoundsChange(
        bounds.getWest(), bounds.getSouth(),
        bounds.getEast(), bounds.getNorth(),
        map.getZoom()
      )
    }, 300)
  }, [map, onBoundsChange])

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
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm shadow-lg rounded-lg px-4 py-2 pointer-events-none">
      <p className="text-xs text-gray-600 font-medium">
        Acercate mas para ver los predios (zoom {zoom}/{MIN_ZOOM_POLYGONS})
      </p>
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
}: MapProps) {
  return (
    <MapContainer
      center={[-3.99, -79.20]}
      zoom={14}
      className="h-full w-full"
      zoomControl={false}
      preferCanvas={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <GeoJSONLayer
        geojson={geojson}
        selectedPredioId={selectedPredioId}
        onSelectPredio={onSelectPredio}
      />

      <ZoomMessage />
      <BoundsWatcher onBoundsChange={onBoundsChange} />
      <FlyToHandler flyTo={flyTo} />
      <HighlightLayer feature={highlightFeature} onSelect={onSelectPredio} />
    </MapContainer>
  )
}
