import { useState, useEffect, useRef, useCallback } from 'react'
import SearchBar from './SearchBar'
import PredioInfo from './PredioInfo'
import Favoritos from './Favoritos'
import type { PredioProperties } from '../hooks/usePredios'
import type { Favorito } from '../hooks/useFavoritos'
import type { EntornoData } from './EntornoPredio'

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
  onOpenCalculadora: () => void
  onEntornoChange: (data: EntornoData | null) => void
  onClearSelection: () => void
  mobile?: boolean
}

const SWIPE_THRESHOLD = 80

function MobilePanel({ panel, onClose, onMinimize, children }: {
  panel: Panel
  onClose: () => void
  onMinimize: () => void
  children: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; currentY: number; dragging: boolean }>({
    startY: 0, currentY: 0, dragging: false,
  })

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragRef.current = { startY: e.touches[0].clientY, currentY: e.touches[0].clientY, dragging: true }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current.dragging) return
    const currentY = e.touches[0].clientY
    const deltaY = currentY - dragRef.current.startY
    dragRef.current.currentY = currentY
    // Only allow dragging down
    if (deltaY > 0 && panelRef.current) {
      panelRef.current.style.transform = `translateY(${deltaY}px)`
      panelRef.current.style.transition = 'none'
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!dragRef.current.dragging) return
    const deltaY = dragRef.current.currentY - dragRef.current.startY
    dragRef.current.dragging = false

    if (panelRef.current) {
      if (deltaY > SWIPE_THRESHOLD) {
        // Animate out then minimize
        panelRef.current.style.transition = 'transform 0.2s ease-out'
        panelRef.current.style.transform = 'translateY(100%)'
        setTimeout(onMinimize, 200)
      } else {
        // Snap back
        panelRef.current.style.transition = 'transform 0.2s ease-out'
        panelRef.current.style.transform = 'translateY(0)'
      }
    }
  }, [onMinimize])

  const title = panel === 'search' ? 'Buscar Predio'
    : panel === 'favoritos' ? 'Mis Favoritos'
    : 'Información del Predio'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[1001] bg-black/30"
        onClick={onMinimize}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed bottom-0 left-0 right-0 z-[1002] bg-white rounded-t-2xl shadow-2xl max-h-[80dvh] flex flex-col animate-slide-up"
      >
        {/* Drag handle + header */}
        <div
          className="shrink-0 touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Visual drag indicator */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          {children}
        </div>
      </div>
    </>
  )
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
  onOpenCalculadora,
  onEntornoChange,
  onClearSelection,
  mobile,
}: SidebarProps) {
  const [panel, setPanel] = useState<Panel>(mobile ? null : 'search')
  // Track which panel was active before opening Info (to return on close)
  const prevPanelRef = useRef<Panel>('search')
  // Track if we're in a "locate from favoritos" flow to skip auto-open on mobile
  const locatingRef = useRef(false)

  // Auto-open info panel when predio selected (except mobile locate flow)
  useEffect(() => {
    if (selectedPredio) {
      if (mobile && locatingRef.current) {
        // Don't auto-open Info on mobile when locating from favoritos
        locatingRef.current = false
        return
      }
      setPanel('info')
    }
  }, [selectedPredio, mobile])

  const closeInfoPanel = () => {
    onClearSelection()
    // Return to the panel the user was on before opening Info
    setPanel(prevPanelRef.current || (mobile ? null : 'search'))
  }

  const closePanel = () => {
    setPanel(null)
    onClearSelection()
  }

  const handleLocateMobile = (id: number) => {
    locatingRef.current = true
    prevPanelRef.current = 'favoritos'
    onLocateFavorito(id)
    setPanel(null)
  }

  // ========== MOBILE ==========
  if (mobile) {
    return (
      <>
        {/* Floating action buttons - fixed to viewport */}
        {!panel && (
          <div className="fixed bottom-6 left-4 right-4 z-[1000] flex gap-3">
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

        {/* Modal panel from bottom - fixed to viewport */}
        {panel && (
          <MobilePanel
            panel={panel}
            onClose={panel === 'info' ? closeInfoPanel : closePanel}
            onMinimize={() => setPanel(null)}
          >
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
                onOpenCalculadora={onOpenCalculadora}
                onEntornoChange={onEntornoChange}
                onClose={closeInfoPanel}
              />
            )}
            {panel === 'favoritos' && (
              <Favoritos
                favoritos={favoritos}
                loading={favoritosLoading}
                onLocate={handleLocateMobile}
                onRemove={onRemoveFavorito}
                onEdit={onEditFavorito}
              />
            )}
          </MobilePanel>
        )}
      </>
    )
  }

  // ========== DESKTOP ==========
  // Allow switching tabs freely; Info tab shows only when predio is selected
  const currentTab = panel === 'favoritos' ? 'favoritos'
    : panel === 'info' && selectedPredio ? 'info'
    : selectedPredio && panel !== 'search' ? 'info'
    : 'search'

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
        {selectedPredio && (
          <button
            onClick={() => setPanel('info')}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
              currentTab === 'info'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Predio
          </button>
        )}
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
            onOpenCalculadora={onOpenCalculadora}
            onEntornoChange={onEntornoChange}
            onClose={() => { onClearSelection(); setPanel(prevPanelRef.current || 'search') }}
          />
        )}
        {currentTab === 'favoritos' && (
          <Favoritos
            favoritos={favoritos}
            loading={favoritosLoading}
            onLocate={(id) => { prevPanelRef.current = 'favoritos'; onLocateFavorito(id) }}
            onRemove={onRemoveFavorito}
            onEdit={onEditFavorito}
          />
        )}
      </div>
    </aside>
  )
}
