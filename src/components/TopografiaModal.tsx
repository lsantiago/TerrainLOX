import { useState, useEffect, useMemo, useRef } from 'react'
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { bbox, distance, along, lineString } from '@turf/turf'
import type { Feature } from 'geojson'
import { createPortal } from 'react-dom'
import { usePredios } from '../hooks/usePredios'

export interface TopografiaModalProps {
  predioId: number
  predioLabel: string
  onClose: () => void
}

export interface ProfilePoint {
  dist: number
  elev: number
  lat: number
  lng: number
}

export type CutDirection = 'SW-NE' | 'NW-SE' | 'N-S' | 'W-E' | 'CUSTOM';

const mapStyle = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
      tileSize: 256,
      attribution: 'Google'
    },
    terrainSource: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15
    }
  },
  layers: [
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'satellite',
      minzoom: 0,
      maxzoom: 22
    }
  ],
  terrain: {
    source: 'terrainSource',
    exaggeration: 1.1
  }
};

export default function TopografiaModal({ predioId, predioLabel, onClose }: TopografiaModalProps) {
  const [profile, setProfile] = useState<ProfilePoint[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoverPoint, setHoverPoint] = useState<ProfilePoint | null>(null)
  const [cutDirection, setCutDirection] = useState<CutDirection>('SW-NE')
  const [customPoints, setCustomPoints] = useState<[number, number][]>([])
  const { getPredioById } = usePredios()
  const [featureGeo, setFeatureGeo] = useState<Feature | null>(null)
  const mapRef = useRef<MapRef>(null)
  const [coordsData, setCoordsData] = useState<{coords: number[][], dists: number[]}|null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Cargar geometría UNA vez
  useEffect(() => {
    let mounted = true
    const fetchFeature = async () => {
      try {
        setLoading(true)
        const feature = await getPredioById(predioId)
        if (!feature && mounted) {
          setError("No se pudo cargar la geometría del predio.")
          setLoading(false)
          return
        }
        if (mounted) {
          setFeatureGeo(feature!)
          setError(null)
        }
      } catch (e: any) {
        if (mounted) {
           setError(e.message || "Error al cargar la geometría del predio")
           setLoading(false)
        }
      }
    }
    fetchFeature()
    return () => { mounted = false }
  }, [predioId, getPredioById])

  // Recalcular trayecto de corte si cambia la dirección o puntos personalizados
  useEffect(() => {
    if (!featureGeo) return;
    
    try {
      setLoading(true)
      const box = bbox(featureGeo)
        const minLng = box[0], minLat = box[1], maxLng = box[2], maxLat = box[3]
        
        let p1: number[], p2: number[];
        
        if (cutDirection === 'CUSTOM') {
          if (customPoints.length < 2) {
            setLoading(false)
            setCoordsData(null)
            return
          }
          p1 = customPoints[0]
          p2 = customPoints[1]
        } else if (cutDirection === 'SW-NE') {
           p1 = [minLng, minLat]
           p2 = [maxLng, maxLat]
        } else if (cutDirection === 'NW-SE') {
           p1 = [minLng, maxLat]
           p2 = [maxLng, minLat]
        } else if (cutDirection === 'N-S') {
           const midLng = (minLng + maxLng) / 2
           p1 = [midLng, maxLat]
           p2 = [midLng, minLat]
        } else { // W-E
           const midLat = (minLat + maxLat) / 2
           p1 = [minLng, midLat]
           p2 = [maxLng, midLat]
        }
        const totalDist = distance(p1, p2, { units: 'meters' })
        
        if (totalDist < 0.1) {
          setError("La distancia de corte es demasiado corta para generar un perfil.")
          setLoading(false)
          return
        }

        const line = lineString([p1, p2])
        const numPoints = 80 // Al no depender de una API, podemos triplicar la fidelidad del perfil
        const step = totalDist / (numPoints - 1)
        const coords: number[][] = []
        const dists: number[] = []
        
        for(let i = 0; i < numPoints; i++) {
          const pt = along(line, i * step, { units: 'meters' })
          coords.push(pt.geometry.coordinates)
          dists.push(Math.round(i * step * 10) / 10)
        }
        
        setCoordsData({ coords, dists })

      } catch (e: any) {
        setError(e.message || "Error al trazar área de corte")
        setLoading(false)
      }
  }, [featureGeo, cutDirection, customPoints])

  // Consultar elevaciones al mapa en 3D
  useEffect(() => {
    if (!coordsData || !mapRef.current || !mapLoaded) return;
    const map = mapRef.current.getMap();

    let hasBuilt = false;
    const buildProfile = () => {
       const firstElev = map.queryTerrainElevation([coordsData.coords[0][0], coordsData.coords[0][1]]);
       // Solo calculamos si los tiles DEM ya están en memoria del navegador
       if (firstElev !== null) {
          const newProfile = coordsData.coords.map((c, i) => {
             const elev = map.queryTerrainElevation([c[0], c[1]]);
             return {
               dist: coordsData.dists[i],
               lng: c[0],
               lat: c[1],
               elev: elev !== null ? elev : firstElev
             }
          });
          setProfile(newProfile);
          setLoading(false);
          hasBuilt = true;
       }
    };

    buildProfile();
    
    const interval = setInterval(() => {
      if (!hasBuilt) buildProfile();
    }, 500);
    
    // Refinamos cuando terminan de llegar mapas de max resolución
    const onIdle = () => { buildProfile() };
    map.on('idle', onIdle);
    
    return () => {
       clearInterval(interval);
       map.off('idle', onIdle);
    };
  }, [coordsData, mapLoaded]);



  const profileGeojsonLine = useMemo(() => {
    if(!profile || profile.length === 0) return null
    return lineString(profile.map(p => [p.lng, p.lat]))
  }, [profile])

  const customLineSource = useMemo(() => {
    if (cutDirection === 'CUSTOM' && customPoints.length === 2 && (!profile || profile.length === 0)) {
       return lineString(customPoints);
    }
    return null;
  }, [cutDirection, customPoints, profile])

  const onMapLoad = () => {
    setMapLoaded(true);
    if (featureGeo && mapRef.current) {
      const box = bbox(featureGeo);
      mapRef.current.getMap().fitBounds(
        [[box[0], box[1]], [box[2], box[3]]],
        { padding: 40, pitch: 65, bearing: -45, duration: 1500, essential: true }
      );
    }
  };


  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] sm:h-[80vh] flex flex-col overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Modelo Topográfico 3D y Perfil</h2>
            <p className="text-xs text-gray-500 mt-0.5">Predio: {predioLabel}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Map is always rendered to prevent WebGL reload */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          
          {/* Main Overlay for initial load or critical errors */}
          {(!featureGeo && loading) && (
            <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-medium text-gray-600">Cargando terreno principal...</p>
            </div>
          )}

          {/* 3D Map Section (55%) */}
          <div className="h-[55%] relative w-full bg-stone-200">
            {featureGeo && (
              <Map 
                ref={mapRef}
                initialViewState={{ 
                  longitude: (bbox(featureGeo)[0] + bbox(featureGeo)[2]) / 2, 
                  latitude: (bbox(featureGeo)[1] + bbox(featureGeo)[3]) / 2, 
                  zoom: 15, 
                  pitch: 60, 
                  bearing: 0 
                }}
                mapStyle={mapStyle as any}
                interactive={true}
                dragRotate={true}
                pitchWithRotate={true}
                onLoad={onMapLoad}
                onClick={(e) => {
                  if (cutDirection === 'CUSTOM') {
                    const { lng, lat } = e.lngLat;
                    setCustomPoints(prev => {
                      if (prev.length >= 2) return [[lng, lat]]; // Reinicia el trazo
                      return [...prev, [lng, lat]];
                    });
                  }
                }}
                cursor={cutDirection === 'CUSTOM' ? 'crosshair' : 'grab'}
              >
                <Source id="predio-source" type="geojson" data={featureGeo}>
                  <Layer id="predio-fill" type="fill" paint={{'fill-color': '#10b981', 'fill-opacity': 0.4}} />
                  <Layer id="predio-line" type="line" paint={{'line-color': '#059669', 'line-width': 2}} />
                </Source>

                {profileGeojsonLine && (
                  <Source id="profile-line-source" type="geojson" data={profileGeojsonLine}>
                    <Layer id="profile-line" type="line" paint={{'line-color': '#ef4444', 'line-width': 3, 'line-dasharray': [2, 2]}} />
                  </Source>
                )}

                {customLineSource && (
                  <Source id="custom-line-source" type="geojson" data={customLineSource}>
                    <Layer id="custom-line" type="line" paint={{'line-color': '#a855f7', 'line-width': 2, 'line-dasharray': [4, 4]}} />
                  </Source>
                )}

                {cutDirection === 'CUSTOM' && customPoints.map((pt, i) => (
                  <Marker key={i} longitude={pt[0]} latitude={pt[1]}>
                    <div className="w-5 h-5 bg-purple-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-[10px] font-bold transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                      {i === 0 ? 'A' : 'B'}
                    </div>
                  </Marker>
                ))}

                {hoverPoint && (
                  <Marker longitude={hoverPoint.lng} latitude={hoverPoint.lat} anchor="center" pitchAlignment="map">
                    <div className="w-5 h-5 bg-blue-500 border-[3px] border-white rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] pointer-events-none transition-transform duration-75"></div>
                  </Marker>
                )}
              </Map>
            )}
            
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-md text-[10px] sm:text-xs pointer-events-none">
              Usa <strong>Shift + Clic</strong> para rotar 3D {cutDirection === 'CUSTOM' && '| Usa clic para marcar puntos A y B'}
            </div>
          </div>

          {/* Profile Chart Section (45%) */}
          <div className="h-[45%] flex flex-col p-4 bg-white border-t border-gray-200 relative">
            <div className="flex justify-between items-center mb-3 shrink-0">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                Corte Transversal (Perfil de Elevación Longitudinal)
              </h3>
              
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold hidden sm:inline">Direccion:</span>
                <select 
                  value={cutDirection}
                  onChange={(e) => {
                    const val = e.target.value as CutDirection;
                    setCutDirection(val);
                    if (val === 'CUSTOM') setCustomPoints([]);
                  }}
                  className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-gray-50 cursor-pointer"
                >
                  <option value="SW-NE">Diagonal (SurOeste a NorEste)</option>
                  <option value="NW-SE">Diagonal Inversa (NorOeste a SurEste)</option>
                  <option value="N-S">Norte a Sur</option>
                  <option value="W-E">Oeste a Este</option>
                  <option value="CUSTOM">Modo Libre (Dibujar)</option>
                </select>
              </div>
            </div>
            
            <div className="flex-1 min-h-[100px] relative">
              {loading && featureGeo ? (
                <div className="absolute inset-0 z-10 bg-white/80 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                  <p className="text-xs text-gray-500">Calculando topografía...</p>
                </div>
              ) : error ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-red-50/50 rounded-lg p-4 text-center">
                   <svg className="w-6 h-6 text-red-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                   <p className="text-xs text-red-600 font-medium">{error}</p>
                </div>
              ) : cutDirection === 'CUSTOM' && customPoints.length < 2 ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center border-2 border-dashed border-purple-200 bg-purple-50/30 rounded-lg p-4 text-center">
                   <p className="text-sm text-purple-600 font-medium mb-1">Trazo de Corte Libre</p>
                   <p className="text-xs text-gray-500">
                     {customPoints.length === 0 
                       ? "Haz clic en el mapa superior para fijar el Punto A (Inicio)." 
                       : "Ahora haz clic en otro lugar del mapa para fijar el Punto B (Fin)."}
                   </p>
                </div>
              ) : profile ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={profile}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    onMouseMove={(e: any) => {
                      if(e && e.activePayload && e.activePayload.length > 0) {
                        setHoverPoint(e.activePayload[0].payload)
                      }
                    }}
                    onMouseLeave={() => setHoverPoint(null)}
                  >
                    <defs>
                      <linearGradient id="colorElev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="dist" 
                      tickFormatter={(v)=>`${v}m`} 
                      tick={{fontSize: 11, fill: '#6b7280'}} 
                      axisLine={{stroke: '#d1d5db'}}
                      tickLine={false}
                      minTickGap={20} 
                    />
                    <YAxis 
                      domain={['dataMin - 3', 'dataMax + 3']} 
                      tickFormatter={(v)=>`${v.toFixed(0)}m`} 
                      tick={{fontSize: 11, fill: '#6b7280'}} 
                      orientation="left" 
                      width={45} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      formatter={(value: any) => {
                        const valNum = Number(value);
                        return [`${isNaN(valNum) ? value : valNum.toFixed(1)} msnm`, 'Elevación'];
                      }}
                      labelFormatter={(label) => `Distancia: ${label}m`}
                      contentStyle={{borderRadius: '8px', border: '1px solid #f3f4f6', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px', zIndex: 3000}}
                    />
                    <Area type="natural" dataKey="elev" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#colorElev)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
