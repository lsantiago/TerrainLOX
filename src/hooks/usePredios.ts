import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { FeatureCollection, Feature } from 'geojson'

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

  return { geojson, loading, error, loadByBounds, searchByClave, getPredioById }
}
