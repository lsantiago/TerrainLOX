import { useState, useCallback } from 'react'
import { useAuth } from './hooks/useAuth'
import { usePredios } from './hooks/usePredios'
import { useFavoritos, EMPTY_METADATA } from './hooks/useFavoritos'
import type { PredioProperties } from './hooks/usePredios'
import type { Favorito, FavoritoMetadata } from './hooks/useFavoritos'
import type { Feature } from 'geojson'
import Auth from './components/Auth'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import MapView from './components/Map'
import FavoritoForm from './components/FavoritoForm'

export default function App() {
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth()
  const { geojson, loading: prediosLoading, loadByBounds, searchByClave, getPredioById } = usePredios()
  const { favoritos, loading: favLoading, isFavorito, addFavorito, removeFavorito, updateFavorito } = useFavoritos(user?.id)

  const [selectedPredio, setSelectedPredio] = useState<PredioProperties | null>(null)
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)
  const [highlightFeature, setHighlightFeature] = useState<Feature | null>(null)

  // Favorito form modal state
  const [favoritoModal, setFavoritoModal] = useState<{
    mode: 'add' | 'edit'
    predioId: number
    predioLabel: string
    favoritoId?: string
    initialValues: FavoritoMetadata
  } | null>(null)
  const [favoritoSaving, setFavoritoSaving] = useState(false)

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
    await removeFavorito(predioId)
  }, [removeFavorito])

  const handleToggleFavorito = useCallback(() => {
    if (!selectedPredio) return
    if (isFavorito(selectedPredio.id)) {
      removeFavorito(selectedPredio.id)
    } else {
      setFavoritoModal({
        mode: 'add',
        predioId: selectedPredio.id,
        predioLabel: selectedPredio.clave_cata || `Predio #${selectedPredio.id}`,
        initialValues: EMPTY_METADATA,
      })
    }
  }, [selectedPredio, isFavorito, removeFavorito])

  const handleEditFavorito = useCallback((fav: Favorito) => {
    setFavoritoModal({
      mode: 'edit',
      predioId: fav.predio_id,
      predioLabel: fav.predio?.clave_cata || `Predio #${fav.predio_id}`,
      favoritoId: fav.id,
      initialValues: {
        precio: fav.precio,
        telefono: fav.telefono,
        contacto: fav.contacto,
        email_contacto: fav.email_contacto,
        notas: fav.notas,
        servicios: fav.servicios,
        caracteristicas: fav.caracteristicas,
        estado: fav.estado,
        calificacion: fav.calificacion,
        ultima_visita: fav.ultima_visita,
      },
    })
  }, [])

  const handleFavoritoSave = useCallback(async (metadata: FavoritoMetadata) => {
    if (!favoritoModal) return
    setFavoritoSaving(true)
    if (favoritoModal.mode === 'add') {
      await addFavorito(favoritoModal.predioId, metadata)
    } else if (favoritoModal.favoritoId) {
      await updateFavorito(favoritoModal.favoritoId, metadata)
    }
    setFavoritoSaving(false)
    setFavoritoModal(null)
  }, [favoritoModal, addFavorito, updateFavorito])

  const handleClearSelection = useCallback(() => {
    setSelectedPredio(null)
  }, [])

  if (authLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) {
    return <Auth onSignIn={signIn} onSignUp={signUp} />
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      <Header user={user} onSignOut={signOut} />

      <div className="flex-1 relative overflow-hidden">
        {/* Desktop sidebar - overlays left side */}
        <div className="hidden sm:block absolute inset-y-0 left-0 z-10">
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
            onEditFavorito={handleEditFavorito}
            onClearSelection={handleClearSelection}
          />
        </div>

        {/* Single map instance - full area, offset on desktop for sidebar */}
        <div className="absolute inset-0 sm:left-80">
          <MapView
            geojson={geojson}
            selectedPredioId={selectedPredio?.id ?? null}
            onSelectPredio={handleSelectPredio}
            onBoundsChange={handleBoundsChange}
            flyTo={flyTo}
            highlightFeature={highlightFeature}
          />
        </div>

        {/* Mobile floating panels */}
        <div className="sm:hidden">
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
            onEditFavorito={handleEditFavorito}
            onClearSelection={handleClearSelection}
            mobile
          />
        </div>
      </div>

      {/* Favorito form modal */}
      {favoritoModal && (
        <FavoritoForm
          mode={favoritoModal.mode}
          predioLabel={favoritoModal.predioLabel}
          initialValues={favoritoModal.initialValues}
          saving={favoritoSaving}
          onSave={handleFavoritoSave}
          onCancel={() => setFavoritoModal(null)}
        />
      )}
    </div>
  )
}
