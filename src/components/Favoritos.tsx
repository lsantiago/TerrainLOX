import type { Favorito } from '../hooks/useFavoritos'

interface FavoritosProps {
  favoritos: Favorito[]
  loading: boolean
  onLocate: (predioId: number) => void
  onRemove: (predioId: number) => void
}

export default function Favoritos({ favoritos, loading, onLocate, onRemove }: FavoritosProps) {
  return (
    <div className="p-4">
      <h2 className="font-semibold text-gray-800 mb-3 text-sm">Mis Favoritos</h2>

      {loading && <p className="text-xs text-gray-400">Cargando...</p>}

      {!loading && favoritos.length === 0 && (
        <div className="text-center py-8">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <p className="text-xs text-gray-400">No tienes predios favoritos.</p>
          <p className="text-xs text-gray-400">Selecciona un predio en el mapa y agregalo.</p>
        </div>
      )}

      <div className="space-y-2">
        {favoritos.map(fav => (
          <div key={fav.id} className="bg-gray-50 rounded-lg p-3 group">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {fav.predio?.clave_cata || `Predio #${fav.predio_id}`}
                </p>
                {fav.predio?.barrio && (
                  <p className="text-xs text-gray-500 truncate">{fav.predio.barrio}</p>
                )}
                {fav.predio?.parroquia && (
                  <p className="text-xs text-gray-400 truncate">{fav.predio.parroquia}</p>
                )}
                {fav.predio?.area_grafi && (
                  <p className="text-xs text-gray-400">
                    {fav.predio.area_grafi.toLocaleString('es-EC', { maximumFractionDigits: 2 })} m2
                  </p>
                )}
              </div>
              <div className="flex gap-1 ml-2">
                <button
                  onClick={() => onLocate(fav.predio_id)}
                  title="Ubicar en mapa"
                  className="p-1.5 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <button
                  onClick={() => onRemove(fav.predio_id)}
                  title="Quitar de favoritos"
                  className="p-1.5 rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
