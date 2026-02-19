import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface ZonificacionData {
  clasificacion: string | null
  subclasificacion: string | null
  categoria: string | null
  pit: string | null
  cod_pit: string | null
  cos: number | null
  cus: number | null
  n_pisos: number | null
  retiro_frontal: number | null
  retiro_lateral: number | null
  retiro_posterior: number | null
  lote_min: number | null
  frente_min: number | null
  implantacion: string | null
  edificabilidad: string | null
  uso_general: string | null
  uso_principal: string | null
  uso_complementario: string | null
  uso_restringido: string | null
  uso_prohibido: string | null
  tratamiento: string | null
  densidad_bruta: number | null
  densidad_neta: number | null
  fondo: number | null
}

export interface AptitudData {
  aptitud: string | null
  amenazas: string | null
  estudios: string | null
  observacion_1: string | null
  observacion_2: string | null
}

export function useZonificacion() {
  const [data, setData] = useState<ZonificacionData | null>(null)
  const [aptitud, setAptitud] = useState<AptitudData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getZonificacion = useCallback(async (predioId: number) => {
    setLoading(true)
    setError(null)

    const [zonRes, aptRes] = await Promise.all([
      supabase.rpc('get_zonificacion_predio', { p_id: predioId }),
      supabase.rpc('get_aptitud_predio', { p_id: predioId }),
    ])

    if (zonRes.error) {
      setError(zonRes.error.message)
      setData(null)
    } else {
      setData(zonRes.data as ZonificacionData | null)
    }

    if (aptRes.error) {
      setAptitud(null)
    } else {
      setAptitud(aptRes.data as AptitudData | null)
    }

    setLoading(false)
    return zonRes.data as ZonificacionData | null
  }, [])

  return { data, aptitud, loading, error, getZonificacion }
}
