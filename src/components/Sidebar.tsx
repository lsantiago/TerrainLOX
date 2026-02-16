import { useState } from 'react'
import SearchBar from './SearchBar'
import PredioInfo from './PredioInfo'
import Favoritos from './Favoritos'
import type { PredioProperties } from '../hooks/usePredios'
import type { Favorito } from '../hooks/useFavoritos'

type Tab = 'search' | 'info' | 'favoritos'

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
  onClearSelection: () => void
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
  onClearSelection,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>('search')
  const [isOpen, setIsOpen] = useState(true)

  const currentTab = selectedPredio ? 'info' : activeTab

  return (
    <>
      {/* Toggle button for mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-16 left-2 z-[1000] bg-white shadow-lg rounded-lg p-2 sm:hidden cursor-pointer"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isOpen
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          }
        </svg>
      </button>

      <aside className={`${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform absolute sm:relative z-[999] w-80 bg-white border-r border-gray-200 h-full flex flex-col shadow-lg sm:shadow-none`}>
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => { setActiveTab('search'); onClearSelection() }}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
              currentTab === 'search'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Buscar
          </button>
          <button
            onClick={() => setActiveTab('favoritos')}
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

        {/* Content */}
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
              onClose={onClearSelection}
            />
          )}
          {currentTab === 'favoritos' && (
            <Favoritos
              favoritos={favoritos}
              loading={favoritosLoading}
              onLocate={onLocateFavorito}
              onRemove={onRemoveFavorito}
            />
          )}
        </div>
      </aside>
    </>
  )
}
