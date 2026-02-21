import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type FavoritoEstado = 'Consultado' | 'En negociación' | 'Oferta realizada' | 'Descartado'

export const SERVICIOS_OPTIONS = [
  'Agua potable',
  'Energía eléctrica',
  'Alcantarillado',
  'Internet disponible',
  'Calle pavimentada',
  'Acera construida',
  'Alumbrado público',
] as const

export const CARACTERISTICAS_OPTIONS = [
  'Terreno plano',
  'Esquinero',
  'Forma regular',
  'Documentos en regla',
] as const

export const ESTADO_OPTIONS: FavoritoEstado[] = [
  'Consultado',
  'En negociación',
  'Oferta realizada',
  'Descartado',
]

export interface FavoritoMetadata {
  precio: number | null
  telefono: string
  contacto: string
  email_contacto: string
  notas: string
  servicios: string[]
  caracteristicas: string[]
  estado: FavoritoEstado
  calificacion: number | null
  ultima_visita: string
  fotos: string[]
}

export const EMPTY_METADATA: FavoritoMetadata = {
  precio: null,
  telefono: '',
  contacto: '',
  email_contacto: '',
  notas: '',
  servicios: [],
  caracteristicas: [],
  estado: 'Consultado',
  calificacion: null,
  ultima_visita: '',
  fotos: [],
}

export interface Favorito extends FavoritoMetadata {
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
        precio,
        telefono,
        contacto,
        email_contacto,
        notas,
        servicios,
        caracteristicas,
        estado,
        calificacion,
        ultima_visita,
        fotos,
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
        precio: f.precio ?? null,
        telefono: f.telefono ?? '',
        contacto: f.contacto ?? '',
        email_contacto: f.email_contacto ?? '',
        notas: f.notas ?? '',
        servicios: f.servicios ?? [],
        caracteristicas: f.caracteristicas ?? [],
        estado: f.estado ?? 'Consultado',
        calificacion: f.calificacion ?? null,
        ultima_visita: f.ultima_visita ?? '',
        fotos: f.fotos ?? [],
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

  const addFavorito = useCallback(async (predioId: number, metadata: FavoritoMetadata) => {
    if (!userId) return
    await supabase.from('favoritos').insert({
      user_id: userId,
      predio_id: predioId,
      precio: metadata.precio,
      telefono: metadata.telefono || null,
      contacto: metadata.contacto || null,
      email_contacto: metadata.email_contacto || null,
      notas: metadata.notas || null,
      servicios: metadata.servicios,
      caracteristicas: metadata.caracteristicas,
      estado: metadata.estado,
      calificacion: metadata.calificacion,
      ultima_visita: metadata.ultima_visita || null,
      fotos: metadata.fotos,
    })
    setFavoritoIds(prev => new Set(prev).add(predioId))
    fetchFavoritos()
  }, [userId, fetchFavoritos])

  const updateFavorito = useCallback(async (favoritoId: string, metadata: FavoritoMetadata) => {
    if (!userId) return
    await supabase
      .from('favoritos')
      .update({
        precio: metadata.precio,
        telefono: metadata.telefono || null,
        contacto: metadata.contacto || null,
        email_contacto: metadata.email_contacto || null,
        notas: metadata.notas || null,
        servicios: metadata.servicios,
        caracteristicas: metadata.caracteristicas,
        estado: metadata.estado,
        calificacion: metadata.calificacion,
        ultima_visita: metadata.ultima_visita || null,
        fotos: metadata.fotos,
      })
      .eq('id', favoritoId)
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

  return { favoritos, loading, isFavorito, addFavorito, removeFavorito, updateFavorito, fetchFavoritos }
}
