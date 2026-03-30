import { useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { FeatureCollection } from 'geojson'

export interface ColorStop {
  min: number
  color: string
  label: string
}

const COLOR_STOPS: ColorStop[] = [
  { min: 0,   color: '#d1d5db', label: 'Sin dato' },
  { min: 1,   color: '#22c55e', label: '$1 – $100' },
  { min: 100, color: '#84cc16', label: '$100 – $200' },
  { min: 200, color: '#eab308', label: '$200 – $350' },
  { min: 350, color: '#f97316', label: '$350 – $500' },
  { min: 500, color: '#ef4444', label: '$500+' },
]

export function useValorM2() {
  const [barriosValor, setBarriosValor] = useState<FeatureCollection | null>(null)
  const [loading, setLoading] = useState(false)

  const getValorColor = useMemo(() => {
    return (valor?: number | null): string => {
      if (!valor || valor <= 0) return COLOR_STOPS[0].color
      for (let i = COLOR_STOPS.length - 1; i >= 1; i--) {
        if (valor >= COLOR_STOPS[i].min) return COLOR_STOPS[i].color
      }
      return COLOR_STOPS[1].color
    }
  }, [])

  const loadBarriosValor = useCallback(async () => {
    if (barriosValor) return // ya cargado, cachear
    setLoading(true)
    const { data, error } = await supabase.rpc('get_barrios_valor_m2')
    if (!error && data) {
      setBarriosValor(data as FeatureCollection)
    }
    setLoading(false)
  }, [barriosValor])

  return {
    barriosValor,
    barriosLoading: loading,
    getValorColor,
    colorStops: COLOR_STOPS,
    loadBarriosValor,
  }
}
