import { useState } from 'react'

interface SearchBarProps {
  onSearchClave: (clave: string) => void
  onSearchLocation: (lat: number, lng: number, label: string) => void
  loading: boolean
}

export default function SearchBar({ onSearchClave, onSearchLocation, loading }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState('')

  const handleSearchClave = () => {
    if (query.trim()) onSearchClave(query.trim())
  }

  const handleGPS = () => {
    if (!navigator.geolocation) {
      setGpsError('Tu navegador no soporta geolocalización.')
      return
    }

    setGpsLoading(true)
    setGpsError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        onSearchLocation(latitude, longitude, `GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
        setGpsLoading(false)
      },
      (err) => {
        setGpsLoading(false)
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGpsError('Permiso de ubicación denegado. Habilita el GPS en tu navegador.')
            break
          case err.POSITION_UNAVAILABLE:
            setGpsError('Ubicación no disponible.')
            break
          case err.TIMEOUT:
            setGpsError('Tiempo de espera agotado al obtener ubicación.')
            break
          default:
            setGpsError('No se pudo obtener la ubicación.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearchClave()
  }

  return (
    <div className="p-4">
      <h2 className="font-semibold text-gray-800 mb-3 text-sm">Buscar Predio</h2>

      {/* Búsqueda por clave catastral */}
      <label className="block text-xs text-gray-500 mb-1">Clave Catastral</label>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ej: 010150..."
          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <button
          onClick={handleSearchClave}
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      {loading && (
        <p className="text-xs text-gray-400 mb-3">Buscando predios...</p>
      )}

      {/* Separador */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-xs text-gray-400">o</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* Boton GPS */}
      <label className="block text-xs text-gray-500 mb-1">Mi Ubicación</label>
      <button
        onClick={handleGPS}
        disabled={gpsLoading}
        className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors cursor-pointer"
      >
        {gpsLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Obteniendo ubicación...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Usar mi posición GPS
          </>
        )}
      </button>

      {gpsError && (
        <p className="text-xs text-red-500 mt-2">{gpsError}</p>
      )}
    </div>
  )
}
