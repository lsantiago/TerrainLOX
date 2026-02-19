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

export function useZonificacion() {
  const [data, setData] = useState<ZonificacionData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getZonificacion = useCallback(async (predioId: number) => {
    setLoading(true)
    setError(null)
    const { data: result, error: err } = await supabase.rpc('get_zonificacion_predio', {
      p_id: predioId,
    })
    if (err) {
      setError(err.message)
      setData(null)
    } else {
      setData(result as ZonificacionData | null)
    }
    setLoading(false)
    return result as ZonificacionData | null
  }, [])

  return { data, loading, error, getZonificacion }
}
