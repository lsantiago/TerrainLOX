import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { FeatureCollection, Feature } from 'geojson'
import { bbox, distance } from '@turf/turf'

const MIN_ZOOM = 16
const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

export interface PredioProperties {
  id: number
  clave_cata: string
  prov_cant: string
  parroquia: string
  zona: string
  sector: string
  manzana: string
  lote: string
  area_grafi: number
  area_gim: number
  tipo_pred: string
  reg_prop: string
  ocup_gim: string
  barrio: string
  cedula: string
  fecha: string
  observacio: string
  ante_gim: string
  clave_rura: string
}

export function usePredios() {
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(0)

  const loadByBounds = useCallback(async (
    minLng: number, minLat: number, maxLng: number, maxLat: number, zoom: number
  ) => {
    const requestId = ++abortRef.current

    if (zoom < MIN_ZOOM) {
      setGeojson(EMPTY_FC)
      return
    }

    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('get_predios_geojson', {
      min_lng: minLng,
      min_lat: minLat,
      max_lng: maxLng,
      max_lat: maxLat,
    })

    if (requestId !== abortRef.current) return

    if (err) {
      setError(err.message)
    } else {
      setGeojson(data as FeatureCollection)
    }
    setLoading(false)
  }, [])

  const searchByClave = useCallback(async (clave: string) => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('search_predios_by_clave', {
      clave,
    })
    if (err) {
      setError(err.message)
    } else {
      setGeojson(data as FeatureCollection)
    }
    setLoading(false)
    return data as FeatureCollection | null
  }, [])

  const getPredioById = useCallback(async (id: number): Promise<Feature | null> => {
    const { data, error: err } = await supabase.rpc('get_predio_geojson', {
      p_id: id,
    })
    if (err) {
      setError(err.message)
      return null
    }
    return data as Feature
  }, [])

  const getPendiente = useCallback(async (feature: Feature): Promise<{ pendiente: number, minElev: number, maxElev: number, resolucion: string } | null> => {
    try {
      const box = bbox(feature) // [minLng, minLat, maxLng, maxLat]
      const minLng = box[0]
      const minLat = box[1]
      const maxLng = box[2]
      const maxLat = box[3]

      // Distancia entre las dos esquinas en metros
      const dist = distance([minLng, minLat], [maxLng, maxLat], { units: 'meters' })
      if (dist < 0.1) return null

      // Evitar caracteres inválidos en la URL (%7C es el pipe '|')
      const locationsReq = `${minLat},${minLng}%7C${maxLat},${maxLng}`
      let data = null
      let resolucion = '30m'

      try {
        // Intento 1: OpenTopoData (Dataset Mapzen)
        const res = await fetch(`https://api.opentopodata.org/v1/mapzen?locations=${locationsReq}`)
        if (res.ok) {
           data = await res.json()
        } else {
           throw new Error('OpenTopoData API error')
        }
      } catch (err1) {
        // Intento 2 (Fallback si el primero falla por CORS/Rate limit): Open-Elevation
        try {
          const res2 = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${locationsReq}`)
          if (res2.ok) {
             const fallbackData = await res2.json()
             if (fallbackData && fallbackData.results) {
               data = fallbackData
               resolucion = 'Aprox. Global'
             }
          }
        } catch (err2) {
          console.error('Ambas APIs de elevación fallaron:', err1, err2)
          return null
        }
      }
      
      if (data && data.results && data.results.length === 2) {
        const elev1 = data.results[0].elevation
        const elev2 = data.results[1].elevation
        if (elev1 === null || elev2 === null) return null
        
        const minElev = Math.min(elev1, elev2)
        const maxElev = Math.max(elev1, elev2)
        const hDiff = maxElev - minElev
        
        // Pendiente en porcentaje
        const slopePercent = dist > 0 ? (hDiff / dist) * 100 : 0
        
        return {
          pendiente: slopePercent,
          minElev,
          maxElev,
          resolucion
        }
      }
    } catch (e) {
      console.error('Error procesando pendiente:', e)
    }
    return null
  }, [])

  return { geojson, loading, error, loadByBounds, searchByClave, getPredioById, getPendiente }
}
