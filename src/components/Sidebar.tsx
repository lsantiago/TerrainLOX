import { useState, useEffect } from 'react'
import SearchBar from './SearchBar'
import PredioInfo from './PredioInfo'
import Favoritos from './Favoritos'
import type { PredioProperties } from '../hooks/usePredios'
import type { Favorito } from '../hooks/useFavoritos'

type Panel = 'search' | 'favoritos' | 'info' | null


interface SidebarProps {
  selectedPredio: PredioProperties | null
  isFavorito: boolean
  onToggleFavorito: () => void
  onSearchClave: (clave: string) => void
  onSearchLocation: (lat: number, lng: number, label: string) => void
  searchLoading: boolean
  favoritos: Favorito[]
  favoritosLoading: boolean
  onLocateFavorito: (predioId: number) => void
  onRemoveFavorito: (predioId: number) => void
  onEditFavorito: (fav: Favorito) => void
  onClearSelection: () => void
  mobile?: boolean
}

export default function Sidebar({
  selectedPredio,
  isFavorito,
  onToggleFavorito,
  onSearchClave,
  onSearchLocation,
  searchLoading,
  favoritos,
  favoritosLoading,
  onLocateFavorito,
  onRemoveFavorito,
  onEditFavorito,
  onClearSelection,
  mobile,
}: SidebarProps) {
  const [panel, setPanel] = useState<Panel>(mobile ? null : 'search')

  // Auto-open info panel when predio selected
  useEffect(() => {
    if (selectedPredio) setPanel('info')
  }, [selectedPredio])

  const closePanel = () => {
    setPanel(null)
    onClearSelection()
  }

  // ========== MOBILE ==========
  if (mobile) {
    return (
      <>
        {/* Floating action buttons - always visible */}
        {!panel && (
          <div className="absolute bottom-6 left-4 right-4 z-[1000] flex gap-3">
            <button
              onClick={() => setPanel('search')}
              className="flex-1 bg-white shadow-lg rounded-xl px-4 py-3.5 flex items-center gap-2 active:bg-gray-50"
            >
              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm text-gray-700 font-medium">Buscar predio</span>
            </button>
            <button
              onClick={() => setPanel('favoritos')}
              className="bg-white shadow-lg rounded-xl px-4 py-3.5 flex items-center gap-2 active:bg-gray-50 relative"
            >
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {favoritos.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {favoritos.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Modal panel from bottom */}
        {panel && (
          <>
            {/* Backdrop */}
            <div
              className="absolute inset-0 z-[1001] bg-black/30"
              onClick={closePanel}
            />

            {/* Panel */}
            <div className="absolute bottom-0 left-0 right-0 z-[1002] bg-white rounded-t-2xl shadow-2xl max-h-[80dvh] flex flex-col animate-slide-up">
              {/* Handle + close */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm">
                  {panel === 'search' && 'Buscar Predio'}
                  {panel === 'favoritos' && 'Mis Favoritos'}
                  {panel === 'info' && 'Informacion del Predio'}
                </h2>
                <button
                  onClick={closePanel}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {panel === 'search' && (
                  <SearchBar
                    onSearchClave={(clave) => { onSearchClave(clave); setPanel(null) }}
                    onSearchLocation={(lat, lng, label) => { onSearchLocation(lat, lng, label); setPanel(null) }}
                    loading={searchLoading}
                  />
                )}
                {panel === 'info' && selectedPredio && (
                  <PredioInfo
                    predio={selectedPredio}
                    isFavorito={isFavorito}
                    onToggleFavorito={onToggleFavorito}
                    onClose={closePanel}
                  />
                )}
                {panel === 'favoritos' && (
                  <Favoritos
                    favoritos={favoritos}
                    loading={favoritosLoading}
                    onLocate={(id) => { onLocateFavorito(id); setPanel(null) }}
                    onRemove={onRemoveFavorito}
                    onEdit={onEditFavorito}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </>
    )
  }

  // ========== DESKTOP ==========
  const currentTab = selectedPredio ? 'info' : (panel === 'favoritos' ? 'favoritos' : 'search')

  return (
    <aside className="w-80 bg-white border-r border-gray-200 h-full flex flex-col shrink-0 z-10">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => { setPanel('search'); onClearSelection() }}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
            currentTab === 'search'
              ? 'text-emerald-600 border-b-2 border-emerald-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Buscar
        </button>
        <button
          onClick={() => setPanel('favoritos')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors cursor-pointer relative ${
            currentTab === 'favoritos'
              ? 'text-emerald-600 border-b-2 border-emerald-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Favoritos
          {favoritos.length > 0 && (
            <span className="ml-1 bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0.5 rounded-full">
              {favoritos.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {currentTab === 'search' && (
          <SearchBar
            onSearchClave={onSearchClave}
            onSearchLocation={onSearchLocation}
            loading={searchLoading}
          />
        )}
        {currentTab === 'info' && selectedPredio && (
          <PredioInfo
            predio={selectedPredio}
            isFavorito={isFavorito}
            onToggleFavorito={onToggleFavorito}
            onClose={() => { onClearSelection(); setPanel('search') }}
          />
        )}
        {currentTab === 'favoritos' && (
          <Favoritos
            favoritos={favoritos}
            loading={favoritosLoading}
            onLocate={onLocateFavorito}
            onRemove={onRemoveFavorito}
            onEdit={onEditFavorito}
          />
        )}
      </div>
    </aside>
  )
}
