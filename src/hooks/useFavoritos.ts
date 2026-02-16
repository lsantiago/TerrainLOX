import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface Favorito {
  id: string
  predio_id: number
  created_at: string
  predio?: {
    clave_cata: string
    barrio: string
    parroquia: string
    area_grafi: number
  }
}

export function useFavoritos(userId: string | undefined) {
  const [favoritos, setFavoritos] = useState<Favorito[]>([])
  const [loading, setLoading] = useState(false)
  const [favoritoIds, setFavoritoIds] = useState<Set<number>>(new Set())

  const fetchFavoritos = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('favoritos')
      .select(`
        id,
        predio_id,
        created_at,
        predio_loja (
          clave_cata,
          barrio,
          parroquia,
          area_grafi
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (data) {
      const mapped = data.map((f: any) => ({
        id: f.id,
        predio_id: f.predio_id,
        created_at: f.created_at,
        predio: f.predio_loja,
      }))
      setFavoritos(mapped)
      setFavoritoIds(new Set(mapped.map((f: Favorito) => f.predio_id)))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchFavoritos()
  }, [fetchFavoritos])

  const addFavorito = useCallback(async (predioId: number) => {
    if (!userId) return
    await supabase.from('favoritos').insert({ user_id: userId, predio_id: predioId })
    setFavoritoIds(prev => new Set(prev).add(predioId))
    fetchFavoritos()
  }, [userId, fetchFavoritos])

  const removeFavorito = useCallback(async (predioId: number) => {
    if (!userId) return
    await supabase.from('favoritos').delete().eq('user_id', userId).eq('predio_id', predioId)
    setFavoritoIds(prev => {
      const next = new Set(prev)
      next.delete(predioId)
      return next
    })
    fetchFavoritos()
  }, [userId, fetchFavoritos])

  const isFavorito = useCallback((predioId: number) => favoritoIds.has(predioId), [favoritoIds])

  const toggleFavorito = useCallback(async (predioId: number) => {
    if (isFavorito(predioId)) {
      await removeFavorito(predioId)
    } else {
      await addFavorito(predioId)
    }
  }, [isFavorito, addFavorito, removeFavorito])

  return { favoritos, loading, isFavorito, toggleFavorito, fetchFavoritos }
}
