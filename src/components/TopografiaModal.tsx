import { useState, useEffect, useMemo, useRef } from 'react'
import Map, { Source, Layer, Marker, NavigationControl } from 'react-map-gl/maplibre'
import type { MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { bbox, distance, along, lineString, pointGrid, isolines, lineIntersect } from '@turf/turf'
import type { Feature, Polygon, MultiPolygon, FeatureCollection, Point } from 'geojson'
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
  const [featureGeo, setFeatureGeo] = useState<Feature<Polygon | MultiPolygon> | null>(null)
  
  // Novedad: Puntos Extremos (Max y Min del polígono completo)
  const [globalExtremes, setGlobalExtremes] = useState<{
    max: { lng: number, lat: number, elev: number } | null,
    min: { lng: number, lat: number, elev: number } | null,
    loading: boolean
  }>({ max: null, min: null, loading: false })

  const mapRef = useRef<MapRef>(null)
  const [coordsData, setCoordsData] = useState<{coords: number[][], dists: number[]}|null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapBearing, setMapBearing] = useState(0)
  const [showContours, setShowContours] = useState(false)
  const [contourLines, setContourLines] = useState<FeatureCollection | null>(null)
  const [mapHoverIndex, setMapHoverIndex] = useState<number | null>(null)
  const [hoverSource, setHoverSource] = useState<'map' | 'chart' | null>(null)
  const [extendProfile, setExtendProfile] = useState(false)

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
          setFeatureGeo(feature as Feature<Polygon | MultiPolygon>)
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
        
        // --- CLIP TO POLYGON BOUNDARY (New Request) ---
        if (!extendProfile && cutDirection !== 'CUSTOM' && featureGeo) {
           const fullLine = lineString([p1, p2])
           const intersections = lineIntersect(fullLine, featureGeo)
           
           if (intersections.features.length >= 2) {
              // Sort features by distance along the line from p1
              const points = intersections.features.map(f => f.geometry.coordinates)
              const sorted = points.sort((a, b) => 
                 distance(p1, a, { units: 'meters' }) - distance(p1, b, { units: 'meters' })
              )
              p1 = sorted[0]
              p2 = sorted[sorted.length - 1]
           }
        }
        
        const finalDist = distance(p1, p2, { units: 'meters' })
        
        if (finalDist < 0.1) {
          setError("La distancia de corte es demasiado corta para generar un perfil.")
          setLoading(false)
          return
        }

        const line = lineString([p1, p2])
        const numPoints = 80 // Al no depender de una API, podemos triplicar la fidelidad del perfil
        const step = finalDist / (numPoints - 1)
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
  }, [featureGeo, cutDirection, customPoints, extendProfile])

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

  // Novedad: Calcular Malla (Grid) y Puntos Globales Max/Min cuando el mapa esté idle
  useEffect(() => {
    if (!featureGeo || !mapRef.current || !mapLoaded) return;
    const map = mapRef.current.getMap();

    const calculateExtremes = () => {
      // 1. Crear caja delimitadora (BBox) del predio
      const box = bbox(featureGeo);
      
      // 2. Crear una malla de puntos dentro del BBox (por ej. cada 5 metros o ajustado según tamaño)
      // Usamos una cantidad razonable para la malla (ej. 10m de separación) para no congelar.
      // Dependiendo del área, 'cellSide' ajusta. Para un lote grande, 10-15m es ideal.
      const distDiagonal = distance([box[0], box[1]], [box[2], box[3]], { units: 'kilometers' });
      const cellSide = Math.max(0.005, distDiagonal / 15); // Dinámico, ej. entre 5m y max div
      
      const grid = pointGrid(box, cellSide, { units: 'kilometers', mask: featureGeo });

      if(!grid || grid.features.length === 0) return;

      let highest = { lng: 0, lat: 0, elev: -Infinity };
      let lowest  = { lng: 0, lat: 0, elev: Infinity };
      let valid = false;

      // 3. Consultar elevaciones al motor de MapLibre
      for (const pt of grid.features) {
        const [lng, lat] = pt.geometry.coordinates;
        // Sólo considerar si está *estrictamente* dentro del polígono para mayor precisión, aunque mask ya ayuda.
        // booleanPointInPolygon(pt, featureGeo) -> omitimos por redudancia de la máscara de mask.
        const elev = map.queryTerrainElevation([lng, lat]);
        
        if (elev !== null) {
          valid = true;
          pt.properties = { ...pt.properties, elevation: elev };
          if (elev > highest.elev) highest = { lng, lat, elev };
          if (elev < lowest.elev) lowest = { lng, lat, elev };
        }
      }

      if (valid) {
         setGlobalExtremes({ max: highest, min: lowest, loading: false });
      }
    };

    // Al igual que el perfil, calculamos cuando los tiles estén cargados en memoria
    let hasCalculatedExtremes = false;
    const checkExtremes = () => {
       if(!hasCalculatedExtremes && map.queryTerrainElevation([bbox(featureGeo)[0], bbox(featureGeo)[1]]) !== null) {
          setGlobalExtremes(prev => ({ ...prev, loading: true }));
          calculateExtremes();
          hasCalculatedExtremes = true;
       }
    };

    checkExtremes();
    const extremeInterval = setInterval(checkExtremes, 1000); // Poll más distanciado

    const onIdleExtremes = () => { 
      calculateExtremes(); 
      hasCalculatedExtremes = true; 
    };
    map.on('idle', onIdleExtremes);

    return () => {
      clearInterval(extremeInterval);
      map.off('idle', onIdleExtremes);
    };

  }, [featureGeo, mapLoaded]);

  // Generar curvas de nivel cuando el usuario las active
  useEffect(() => {
    if (!showContours || !featureGeo || !mapRef.current || !mapLoaded) {
      setContourLines(null);
      return;
    }

    const map = mapRef.current.getMap();
    // Verificar que los tiles DEM estén disponibles (probar centro y esquinas)
    const box = bbox(featureGeo);
    const center: [number, number] = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    const testElev = map.queryTerrainElevation(center) || map.queryTerrainElevation([box[0], box[1]]) || map.queryTerrainElevation([box[2], box[3]]);
    
    if (testElev === null) {
      const retryOnIdle = () => { setGlobalExtremes(prev => ({ ...prev })); }; // Trigger re-run
      map.once('idle', retryOnIdle);
      return;
    }

    // Crear malla DENSA y RECTANGULAR (sin mask) - isolines necesita grilla regular
    const distDiag = distance([box[0], box[1]], [box[2], box[3]], { units: 'kilometers' });
    const cellSide = Math.max(0.003, distDiag / 25); // Más denso que la malla de extremos

    const denseGrid = pointGrid(box, cellSide, { units: 'kilometers' });
    if (!denseGrid || denseGrid.features.length < 9) return;

    // Asignar elevaciones desde MapLibre
    let minE = Infinity, maxE = -Infinity;
    let validCount = 0;
    for (const pt of denseGrid.features) {
      const [lng, lat] = pt.geometry.coordinates;
      const elev = map.queryTerrainElevation([lng, lat]);
      if (elev !== null) {
        pt.properties = { ...pt.properties, elevation: elev };
        if (elev < minE) minE = elev;
        if (elev > maxE) maxE = elev;
        validCount++;
      } else {
        pt.properties = { ...pt.properties, elevation: null };
      }
    }

    // Filtrar puntos sin elevación para evitar errores
    const validGrid = {
      type: 'FeatureCollection' as const,
      features: denseGrid.features.filter(f => f.properties?.elevation !== null)
    };

    if (validCount < 9 || maxE - minE < 0.5) return;

    const range = maxE - minE;
    let interval: number;
    if (range <= 5) interval = 1;
    else if (range <= 20) interval = 2;
    else if (range <= 50) interval = 5;
    else interval = 10;

    const breaks: number[] = [];
    const startElev = Math.ceil(minE / interval) * interval;
    for (let e = startElev; e <= maxE; e += interval) {
      breaks.push(Math.round(e * 10) / 10);
    }

    if (breaks.length < 2) return;

    try {
      const contours = isolines(validGrid as FeatureCollection<Point>, breaks, { zProperty: 'elevation' });
      contours.features.forEach(f => {
        if (f.properties) {
          f.properties.label = `${Math.round(f.properties.elevation)}m`;
        }
      });
      setContourLines(contours as FeatureCollection);
    } catch (e) {
      console.warn('Error generando curvas de nivel:', e);
      setContourLines(null);
    }
  }, [showContours, featureGeo, mapLoaded, globalExtremes]);

  const profileGeojsonLine = useMemo(() => {
    if(!profile || profile.length === 0) return null
    return lineString(profile.map(p => [p.lng, p.lat]))
  }, [profile])

  const getSlopeCategory = (pendiente: number) => {
    const p = Math.abs(pendiente);
    if (p <= 5)  return { label: 'Plano', color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' };
    if (p <= 15) return { label: 'Suave', color: '#eab308', bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-100' };
    if (p <= 30) return { label: 'Moderado', color: '#f97316', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' };
    if (p <= 50) return { label: 'Fuerte', color: '#ef4444', bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-100' };
    return { label: 'Escarpado', color: '#a855f7', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' };
  };

  const slopeStats = useMemo(() => {
    if (!profile || profile.length < 2) return null;
    const minElev = Math.min(...profile.map(p => p.elev));
    const maxElev = Math.max(...profile.map(p => p.elev));
    const desnivel = maxElev - minElev;
    const distancia = profile[profile.length - 1].dist - profile[0].dist;
    const pendiente = distancia > 0 ? (desnivel / distancia) * 100 : 0;
    const category = getSlopeCategory(pendiente);
    return { minElev, maxElev, desnivel, pendiente, category };
  }, [profile]);

  const customLineSource = useMemo(() => {
    if (cutDirection === 'CUSTOM' && customPoints.length === 2 && (!profile || profile.length === 0)) {
       return lineString(customPoints);
    }
    return null;
  }, [cutDirection, customPoints, profile])

  // Cambio 1: Aviso de resolución insuficiente
  const DEM_RESOLUTION_M = 30; // SRTM Terrarium = 30m por píxel
  const resolutionWarning = useMemo(() => {
    if (!featureGeo) return null;
    const box = bbox(featureGeo);
    const diagonalM = distance([box[0], box[1]], [box[2], box[3]], { units: 'meters' });
    const pixelsCovered = diagonalM / DEM_RESOLUTION_M;
    if (pixelsCovered < 4) {
      return {
        diagonal: Math.round(diagonalM),
        pixels: pixelsCovered.toFixed(1),
        severe: pixelsCovered < 2
      };
    }
    return null;
  }, [featureGeo]);

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

  // Cambio 5: Configuración de botones de dirección
  const directionButtons: { value: CutDirection; icon: string; label: string }[] = [
    { value: 'SW-NE', icon: '↗', label: 'Diagonal' },
    { value: 'NW-SE', icon: '↘', label: 'Inversa' },
    { value: 'N-S',   icon: '↕', label: 'N-S' },
    { value: 'W-E',   icon: '↔', label: 'E-O' },
    { value: 'CUSTOM', icon: '✏', label: 'Libre' },
  ];


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
                onMove={(evt) => setMapBearing(evt.viewState.bearing)}
                onMouseMove={(e) => {
                  if (!profile || profile.length === 0) return;
                  const map = mapRef.current?.getMap();
                  if (!map) return;

                  const features = map.queryRenderedFeatures(e.point, { 
                    layers: ['profile-line', 'profile-line-hit-area'] 
                  });
                  
                  if (features && features.length > 0) {
                    const { lng, lat } = e.lngLat;
                    let minDist = Infinity;
                    let closestIdx = 0;
                    
                    profile.forEach((p, i) => {
                      const d = Math.pow(p.lng - lng, 2) + Math.pow(p.lat - lat, 2);
                      if (d < minDist) {
                        minDist = d;
                        closestIdx = i;
                      }
                    });
                    
                    setMapHoverIndex(closestIdx);
                    setHoverPoint(profile[closestIdx]);
                    setHoverSource('map');
                  } else {
                    // Solo limpiamos si el movimiento ocurre sobre el mapa y no sobre el gráfico
                    if (hoverSource === 'map') {
                      setMapHoverIndex(null);
                      setHoverPoint(null);
                      setHoverSource(null);
                    }
                  }
                }}
                onMouseLeave={() => {
                  if (hoverSource === 'map') {
                    setMapHoverIndex(null);
                    setHoverPoint(null);
                    setHoverSource(null);
                  }
                }}
                onClick={(e) => {
                  if (cutDirection === 'CUSTOM') {
                    const { lng, lat } = e.lngLat;
                    setCustomPoints(prev => {
                      if (prev.length >= 2) return [[lng, lat]]; // Reinicia el trazo
                      return [...prev, [lng, lat]];
                    });
                  }
                }}
                cursor={
                  cutDirection === 'CUSTOM' 
                    ? 'crosshair' 
                    : mapHoverIndex !== null 
                      ? 'pointer' 
                      : 'grab'
                }
              >
                <Source id="predio-source" type="geojson" data={featureGeo}>
                  <Layer id="predio-fill" type="fill" paint={{'fill-color': '#10b981', 'fill-opacity': 0.4}} />
                  <Layer id="predio-line" type="line" paint={{'line-color': '#059669', 'line-width': 2}} />
                </Source>

                {profileGeojsonLine && (
                  <Source id="profile-line-source" type="geojson" data={profileGeojsonLine}>
                    {/* Área de impacto invisible más ancha para facilitar el hover */}
                    <Layer 
                      id="profile-line-hit-area" 
                      type="line" 
                      paint={{'line-color': '#ff0000', 'line-width': 25, 'line-opacity': 0}} 
                    />
                    <Layer 
                      id="profile-line" 
                      type="line" 
                      paint={{'line-color': '#ef4444', 'line-width': 3, 'line-dasharray': [2, 2]}} 
                    />
                  </Source>
                )}

                {/* Curvas de nivel */}
                {showContours && contourLines && (
                  <Source id="contour-source" type="geojson" data={contourLines}>
                    <Layer
                      id="contour-lines"
                      type="line"
                      paint={{
                        'line-color': '#facc15',
                        'line-width': 1.5,
                        'line-opacity': 0.85
                      }}
                    />
                    <Layer
                      id="contour-labels"
                      type="symbol"
                      layout={{
                        'symbol-placement': 'line',
                        'text-field': ['get', 'label'],
                        'text-size': 10,
                        'text-offset': [0, -0.6],
                        'text-allow-overlap': false,
                        'text-ignore-placement': false,
                      }}
                      paint={{
                        'text-color': '#fef08a',
                        'text-halo-color': '#000000',
                        'text-halo-width': 1.5,
                      }}
                    />
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

                {/* Marcadores de Máximo y Mínimo Global de todo el predio */}
                {globalExtremes.max && (
                  <Marker longitude={globalExtremes.max.lng} latitude={globalExtremes.max.lat} anchor="bottom">
                    <div className="flex flex-col items-center group pointer-events-none">
                      <div className="bg-red-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm opacity-80 group-hover:opacity-100 transition-opacity">
                        Pico {globalExtremes.max.elev.toFixed(0)}m
                      </div>
                      <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-red-500/90"></div>
                      <div className="w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full shadow-sm mt-0.5"></div>
                    </div>
                  </Marker>
                )}

                {globalExtremes.min && (
                  <Marker longitude={globalExtremes.min.lng} latitude={globalExtremes.min.lat} anchor="bottom">
                    <div className="flex flex-col items-center group pointer-events-none">
                      <div className="bg-blue-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm opacity-80 group-hover:opacity-100 transition-opacity">
                        Valle {globalExtremes.min.elev.toFixed(0)}m
                      </div>
                      <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-blue-600/90"></div>
                      <div className="w-2.5 h-2.5 bg-blue-600 border-2 border-white rounded-full shadow-sm mt-0.5"></div>
                    </div>
                  </Marker>
                )}

                {/* Indicador de Sincronización (Diseño Premium Restaurado) */}
                {hoverPoint && (
                  <Marker longitude={hoverPoint.lng} latitude={hoverPoint.lat} anchor="bottom" style={{ zIndex: 1000 }}>
                    <div className="flex flex-col items-center pointer-events-none select-none">
                      {/* Etiqueta de elevación flotante */}
                      <div className="bg-gray-900/95 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-2xl mb-1 whitespace-nowrap border border-yellow-400/60 ring-1 ring-black/20 translate-y-[-4px]">
                        <span className="text-yellow-400">{hoverPoint.elev.toFixed(1)}</span>
                        <span className="text-gray-400 text-[10px] ml-0.5">msnm</span>
                        <span className="mx-1.5 opacity-30">|</span>
                        <span className="text-cyan-400">{Math.round(hoverPoint.dist)}m</span>
                      </div>
                      
                      {/* Línea vertical de conexión con efecto de brillo */}
                      <div className="w-[2px] h-10 bg-gradient-to-b from-yellow-400 via-yellow-400/80 to-transparent shadow-[0_0_12px_rgba(250,204,21,0.6)]"></div>
                      
                      {/* Punto base interactivo con pulso animado */}
                      <div className="relative mb-[2px]">
                        <div className="absolute -inset-3 bg-yellow-400/40 rounded-full animate-ping"></div>
                        <div className="absolute -inset-1.5 bg-yellow-400/20 rounded-full"></div>
                        <div className="relative w-4 h-4 bg-yellow-400 border-[2.5px] border-white rounded-full shadow-[0_0_15px_rgba(250,204,21,0.8)]"></div>
                      </div>
                    </div>
                  </Marker>
                )}

                <NavigationControl position="top-right" visualizePitch={true} />
              </Map>
            )}
            
            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-md text-[10px] sm:text-xs pointer-events-none">
              Usa <strong>Shift + Clic</strong> para rotar 3D {cutDirection === 'CUSTOM' && '| Usa clic para marcar puntos A y B'}
            </div>

            {/* Botón toggle para curvas de nivel */}
            <button
              onClick={() => setShowContours(prev => !prev)}
              className={`absolute top-2 right-14 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer shadow-md ${
                showContours
                  ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-300'
                  : 'bg-black/60 backdrop-blur-sm text-white hover:bg-black/80'
              }`}
              title={showContours ? 'Ocultar curvas de nivel' : 'Mostrar curvas de nivel'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 18c2-2 4-6 8-6s6 4 8 6M4 13c2-1.5 4-5 8-5s6 3.5 8 5M4 8c2-1 4-4 8-4s6 3 8 4" />
              </svg>
              <span className="hidden sm:inline">{showContours ? 'Curvas ON' : 'Curvas'}</span>
            </button>

            {/* Flecha de Norte clásica */}
            <div className="absolute bottom-3 right-3 pointer-events-none" style={{ zIndex: 10 }}>
              <div
                className="w-14 h-14 flex items-center justify-center"
                style={{ transform: `rotate(${-mapBearing}deg)`, transition: 'transform 0.15s ease-out' }}
              >
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Círculo exterior */}
                  <circle cx="24" cy="24" r="22" fill="white" fillOpacity="0.85" stroke="#374151" strokeWidth="1.5" />
                  {/* Triángulo Norte (rojo) */}
                  <polygon points="24,5 29,22 19,22" fill="#dc2626" />
                  {/* Triángulo Sur (gris oscuro) */}
                  <polygon points="24,43 29,26 19,26" fill="#4b5563" />
                  {/* Centro */}
                  <circle cx="24" cy="24" r="3" fill="white" stroke="#374151" strokeWidth="1" />
                  {/* Letra N */}
                  <text x="24" y="14" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="Arial">N</text>
                </svg>
              </div>
            </div>
          </div>

          {/* Profile Chart Section (45%) */}
          <div className="h-[45%] flex flex-col p-4 bg-white border-t border-gray-200 relative">
            <div className="flex justify-between items-center mb-2 shrink-0">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                Perfil de Elevación
              </h3>
              
              {/* Cambio 5: Botones visuales con íconos */}
              <div className="flex items-center gap-1">
                {directionButtons.map((btn) => (
                  <button
                    key={btn.value}
                    onClick={() => {
                      setCutDirection(btn.value);
                      if (btn.value === 'CUSTOM') setCustomPoints([]);
                    }}
                    title={btn.label}
                    className={`px-2 py-1 rounded text-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                      cutDirection === btn.value
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                    }`}
                  >
                    <span className="text-sm leading-none">{btn.icon}</span>
                    <span className="hidden sm:inline">{btn.label}</span>
                  </button>
                ))}
                
                <div className="w-px h-4 bg-gray-200 mx-1 hidden sm:block"></div>
                
                {/* Opción para Ver Entorno vs Solo Predio */}
                <button
                  onClick={() => setExtendProfile(!extendProfile)}
                  className={`px-2 py-1 rounded text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border shadow-sm ${
                    extendProfile
                      ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                      : 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100'
                  }`}
                  title={extendProfile ? "Volver al límite del predio" : "Ver elevación del terreno vecino"}
                >
                  <span className="text-xs">{extendProfile ? '🌲 Entorno' : '🏠 Predio'}</span>
                  <div className={`w-2 h-2 rounded-full ${extendProfile ? 'bg-amber-400 animate-pulse' : 'bg-sky-400'}`}></div>
                </button>
              </div>
            </div>

            {/* Cambio 1: Aviso de resolución */}
            {resolutionWarning && (
              <div className={`flex items-start gap-2 mb-2 rounded-md px-3 py-2 text-[11px] shrink-0 ${
                resolutionWarning.severe
                  ? 'bg-amber-50 border border-amber-200 text-amber-800'
                  : 'bg-sky-50 border border-sky-200 text-sky-700'
              }`}>
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>
                  Este predio mide ~{resolutionWarning.diagonal}m de diagonal. El modelo de elevación tiene resolución de {DEM_RESOLUTION_M}m
                  {resolutionWarning.severe
                    ? ' — los datos son orientativos, no precisos para este lote.'
                    : ' — la precisión es limitada para lotes de este tamaño.'}
                </span>
              </div>
            )}

            {/* Cambio 3: Color-coding por categoría de pendiente */}
            {slopeStats && profile && !loading && (
              <div className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-2 rounded-lg px-3 py-1.5 border shrink-0 transition-colors ${slopeStats.category.bg} ${slopeStats.category.border}`}>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">Pendiente Promedio</span>
                  <span className={`text-sm font-bold ${slopeStats.category.text}`}>
                    {slopeStats.pendiente.toFixed(1)}% <span className="opacity-70">({slopeStats.category.label})</span>
                  </span>
                </div>
                <div className="w-px h-6 bg-gray-300/30 hidden sm:block"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">Desnivel Total</span>
                  <span className="text-sm font-bold text-gray-700">{slopeStats.desnivel.toFixed(1)} m</span>
                </div>
                <div className="w-px h-6 bg-gray-300/30 hidden sm:block"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-tight">Rango Altura</span>
                  <span className="text-sm font-bold text-gray-700">{slopeStats.minElev.toFixed(0)} - {slopeStats.maxElev.toFixed(0)} m</span>
                </div>
                
                {/* Mini Leyenda de Pendientes */}
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex h-1.5 w-24 rounded-full overflow-hidden bg-gray-200">
                    <div className="h-full w-1/5 bg-emerald-500" title="Plano 0-5%"></div>
                    <div className="h-full w-1/5 bg-yellow-500" title="Suave 5-15%"></div>
                    <div className="h-full w-1/5 bg-orange-500" title="Moderado 15-30%"></div>
                    <div className="h-full w-1/5 bg-red-500" title="Fuerte 30-50%"></div>
                    <div className="h-full w-1/5 bg-purple-500" title="Escarpado >50%"></div>
                  </div>
                  <span className="text-[9px] text-gray-400 font-medium">PENDIENTE</span>
                </div>
              </div>
            )}
            
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
                        const point = e.activePayload[0].payload;
                        setHoverPoint(point);
                        setHoverSource('chart');
                        setMapHoverIndex(null); 
                      }
                    }}
                    onMouseLeave={() => {
                      if (hoverSource === 'chart') {
                        setHoverPoint(null);
                        setHoverSource(null);
                      }
                    }}
                  >
                    <defs>
                      <linearGradient id="colorElev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={slopeStats?.category.color || "#10b981"} stopOpacity={0.7}/>
                        <stop offset="95%" stopColor={slopeStats?.category.color || "#10b981"} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    {/* Línea de referencia que indica posición del mapa en el gráfico */}
                    {hoverSource === 'map' && hoverPoint && (
                      <ReferenceLine 
                        x={hoverPoint.dist} 
                        stroke="#ef4444" 
                        strokeWidth={2} 
                        strokeDasharray="4 4"
                        label={{ value: 'VISTA MAPA', position: 'top', fill: '#ef4444', fontSize: 9, fontWeight: 'bold' }} 
                      />
                    )}
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
                    <Area 
                      type="natural" 
                      dataKey="elev" 
                      stroke={slopeStats?.category.color || "#059669"} 
                      strokeWidth={2.5} 
                      fillOpacity={1} 
                      fill="url(#colorElev)"
                      activeDot={{ r: 5, fill: '#facc15', stroke: '#fff', strokeWidth: 2 }}
                    />
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
