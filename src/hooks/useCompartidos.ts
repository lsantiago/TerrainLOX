import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface PredioCompartido {
  id: string
  from_user_id: string
  to_email: string
  predio_id: number
  nota: string | null
  visto: boolean
  created_at: string
  from_email?: string
  predio?: {
    clave_cata: string
    barrio: string
    parroquia: string
    area_grafi: number
  }
}

export function useCompartidos(userId: string | undefined, userEmail: string | undefined) {
  const [recibidos, setRecibidos] = useState<PredioCompartido[]>([])
  const [enviados, setEnviados] = useState<PredioCompartido[]>([])
  const [loading, setLoading] = useState(false)
  const [noVistos, setNoVistos] = useState(0)

  const fetchRecibidos = useCallback(async () => {
    if (!userEmail) return
    setLoading(true)
    const { data } = await supabase
      .from('predios_compartidos')
      .select(`
        id, from_user_id, to_email, predio_id, nota, visto, created_at,
        predio_loja ( clave_cata, barrio, parroquia, area_grafi )
      `)
      .eq('to_email', userEmail)
      .order('created_at', { ascending: false })

    if (data) {
      const mapped = data.map((r: any) => ({
        ...r,
        predio: r.predio_loja,
      }))
      setRecibidos(mapped)
      setNoVistos(mapped.filter((r: PredioCompartido) => !r.visto).length)
    }
    setLoading(false)
  }, [userEmail])

  const fetchEnviados = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('predios_compartidos')
      .select(`
        id, from_user_id, to_email, predio_id, nota, visto, created_at,
        predio_loja ( clave_cata, barrio, parroquia, area_grafi )
      `)
      .eq('from_user_id', userId)
      .order('created_at', { ascending: false })

    if (data) {
      setEnviados(data.map((r: any) => ({ ...r, predio: r.predio_loja })))
    }
  }, [userId])

  useEffect(() => {
    fetchRecibidos()
    fetchEnviados()
  }, [fetchRecibidos, fetchEnviados])

  const compartir = useCallback(async (predioId: number, toEmail: string, nota: string) => {
    if (!userId) return { error: 'No autenticado' }
    const { error } = await supabase.from('predios_compartidos').insert({
      from_user_id: userId,
      to_email: toEmail.trim().toLowerCase(),
      predio_id: predioId,
      nota: nota.trim() || null,
    })
    if (!error) fetchEnviados()
    return { error: error?.message ?? null }
  }, [userId, fetchEnviados])

  const marcarVisto = useCallback(async (id: string) => {
    await supabase.from('predios_compartidos').update({ visto: true }).eq('id', id)
    setRecibidos(prev => prev.map(r => r.id === id ? { ...r, visto: true } : r))
    setNoVistos(prev => Math.max(0, prev - 1))
  }, [])

  return { recibidos, enviados, loading, noVistos, compartir, marcarVisto, fetchRecibidos }
}
