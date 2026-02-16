import { useState, useCallback } from 'react'
import { useAuth } from './hooks/useAuth'
import { usePredios } from './hooks/usePredios'
import { useFavoritos } from './hooks/useFavoritos'
import type { PredioProperties } from './hooks/usePredios'
import type { Feature } from 'geojson'
import Auth from './components/Auth'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import MapView from './components/Map'

export default function App() {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth()
  const { geojson, loading: prediosLoading, loadByBounds, searchByClave, getPredioById } = usePredios()
  const { favoritos, loading: favLoading, isFavorito, toggleFavorito } = useFavoritos(user?.id)

  const [selectedPredio, setSelectedPredio] = useState<PredioProperties | null>(null)
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)
  const [highlightFeature, setHighlightFeature] = useState<Feature | null>(null)

  const handleBoundsChange = useCallback((minLng: number, minLat: number, maxLng: number, maxLat: number, zoom: number) => {
    loadByBounds(minLng, minLat, maxLng, maxLat, zoom)
  }, [loadByBounds])

  const handleSelectPredio = useCallback((properties: PredioProperties) => {
    setSelectedPredio(properties)
  }, [])

  const handleSearchClave = useCallback(async (clave: string) => {
    setHighlightFeature(null)
    const result = await searchByClave(clave)
    if (result && result.features && result.features.length > 0) {
      setHighlightFeature(result.features[0])
    }
  }, [searchByClave])

  const handleSearchLocation = useCallback((_lat: number, _lng: number, _label: string) => {
    setFlyTo({ lat: _lat, lng: _lng, zoom: 16 })
  }, [])

  const handleLocateFavorito = useCallback(async (predioId: number) => {
    const feature = await getPredioById(predioId)
    if (feature) {
      setHighlightFeature(feature)
    }
  }, [getPredioById])

  const handleRemoveFavorito = useCallback(async (predioId: number) => {
    await toggleFavorito(predioId)
  }, [toggleFavorito])

  const handleToggleFavorito = useCallback(() => {
    if (selectedPredio) {
      toggleFavorito(selectedPredio.id)
    }
  }, [selectedPredio, toggleFavorito])

  const handleClearSelection = useCallback(() => {
    setSelectedPredio(null)
  }, [])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) {
    return <Auth onSignIn={signIn} onSignUp={signUp} />
  }

  return (
    <div className="h-screen flex flex-col">
      <Header user={user} onSignOut={signOut} />
      <div className="flex-1 flex relative overflow-hidden">
        <Sidebar
          selectedPredio={selectedPredio}
          isFavorito={selectedPredio ? isFavorito(selectedPredio.id) : false}
          onToggleFavorito={handleToggleFavorito}
          onSearchClave={handleSearchClave}
          onSearchLocation={handleSearchLocation}
          searchLoading={prediosLoading}
          favoritos={favoritos}
          favoritosLoading={favLoading}
          onLocateFavorito={handleLocateFavorito}
          onRemoveFavorito={handleRemoveFavorito}
          onClearSelection={handleClearSelection}
        />
        <div className="flex-1 relative">
          <MapView
            geojson={geojson}
            selectedPredioId={selectedPredio?.id ?? null}
            onSelectPredio={handleSelectPredio}
            onBoundsChange={handleBoundsChange}
            flyTo={flyTo}
            highlightFeature={highlightFeature}
          />
        </div>
      </div>
    </div>
  )
}
