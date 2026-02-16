import { useState, useRef, useEffect, useCallback } from 'react'
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

type SheetState = 'collapsed' | 'half' | 'full'

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 640)
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return mobile
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
  const [sheet, setSheet] = useState<SheetState>('collapsed')
  const isMobile = useIsMobile()

  const dragRef = useRef<{ startY: number; startSheet: SheetState } | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const currentTab = selectedPredio ? 'info' : activeTab

  // Auto-expand when predio selected on mobile
  useEffect(() => {
    if (selectedPredio && isMobile) setSheet('half')
  }, [selectedPredio, isMobile])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragRef.current = { startY: e.touches[0].clientY, startSheet: sheet }
  }, [sheet])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return
    const deltaY = e.changedTouches[0].clientY - dragRef.current.startY
    const prev = dragRef.current.startSheet
    dragRef.current = null

    if (Math.abs(deltaY) < 30) {
      // Tap on handle: cycle states
      if (prev === 'collapsed') setSheet('half')
      else if (prev === 'half') setSheet('full')
      else setSheet('collapsed')
      return
    }

    if (deltaY < -50) {
      // Swipe up
      if (prev === 'collapsed') setSheet('half')
      else if (prev === 'half') setSheet('full')
    } else if (deltaY > 50) {
      // Swipe down
      if (prev === 'full') setSheet('half')
      else if (prev === 'half') setSheet('collapsed')
    }
  }, [])

  const sheetHeight = sheet === 'full' ? 'h-[85dvh]' : sheet === 'half' ? 'h-[45dvh]' : 'h-14'

  const tabButtons = (
    <div className="flex border-b border-gray-200">
      <button
        onClick={() => { setActiveTab('search'); onClearSelection(); if (isMobile && sheet === 'collapsed') setSheet('half') }}
        className={`flex-1 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
          currentTab === 'search'
            ? 'text-emerald-600 border-b-2 border-emerald-600'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Buscar
      </button>
      <button
        onClick={() => { setActiveTab('favoritos'); if (isMobile && sheet === 'collapsed') setSheet('half') }}
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
  )

  const content = (
    <div className="flex-1 overflow-y-auto overscroll-contain">
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
          onClose={() => { onClearSelection(); if (isMobile) setSheet('collapsed') }}
        />
      )}
      {currentTab === 'favoritos' && (
        <Favoritos
          favoritos={favoritos}
          loading={favoritosLoading}
          onLocate={(id) => { onLocateFavorito(id); if (isMobile) setSheet('collapsed') }}
          onRemove={onRemoveFavorito}
        />
      )}
    </div>
  )

  // Mobile: bottom sheet
  if (isMobile) {
    return (
      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 z-[1000] bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.12)] flex flex-col transition-all duration-300 ease-out ${sheetHeight}`}
      >
        {/* Drag handle */}
        <div
          className="pt-2 pb-1 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => setSheet(sheet === 'collapsed' ? 'half' : sheet === 'half' ? 'full' : 'collapsed')}
        >
          <div className="drag-handle" />
        </div>

        {tabButtons}

        {sheet !== 'collapsed' && content}
      </div>
    )
  }

  // Desktop: side panel
  return (
    <aside className="relative z-[999] w-80 bg-white border-r border-gray-200 h-full flex flex-col">
      {tabButtons}
      {content}
    </aside>
  )
}
