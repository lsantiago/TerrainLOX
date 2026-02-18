import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Favorito } from '../hooks/useFavoritos'

interface FavoritosProps {
  favoritos: Favorito[]
  loading: boolean
  onLocate: (predioId: number) => void
  onRemove: (predioId: number) => void
  onEdit: (fav: Favorito) => void
}

const estadoStyle: Record<string, string> = {
  'Consultado': 'bg-gray-100 text-gray-600',
  'En negociación': 'bg-blue-100 text-blue-700',
  'Oferta realizada': 'bg-amber-100 text-amber-700',
  'Descartado': 'bg-red-100 text-red-600',
}

const servicioAbrev: Record<string, string> = {
  'Agua potable': 'Agua',
  'Energía eléctrica': 'Luz',
  'Alcantarillado': 'Alcant.',
  'Internet disponible': 'Internet',
  'Calle pavimentada': 'Pavimento',
  'Acera construida': 'Acera',
  'Alumbrado público': 'Alumbrado',
}

function MiniStars({ value }: { value: number | null }) {
  if (value === null) return null
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <svg key={s} className={`w-3 h-3 ${s <= value ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  )
}

function CompareModal({ items, onClose }: { items: Favorito[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[85dvh] flex flex-col">
        <div className="bg-white border-b border-gray-100 px-5 py-3 rounded-t-2xl flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-gray-800 text-sm">Comparar Favoritos ({items.length})</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 cursor-pointer">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-auto min-h-0 flex-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-3 py-2 text-gray-500 font-medium sticky left-0 bg-white">Atributo</th>
                {items.map(f => (
                  <th key={f.id} className="text-left px-3 py-2 text-gray-800 font-semibold min-w-[140px]">
                    {f.predio?.clave_cata || `#${f.predio_id}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2 text-gray-500 sticky left-0 bg-white">Barrio</td>
                {items.map(f => <td key={f.id} className="px-3 py-2">{f.predio?.barrio || '-'}</td>)}
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2 text-gray-500 sticky left-0 bg-white">Area (m2)</td>
                {items.map(f => <td key={f.id} className="px-3 py-2">{f.predio?.area_grafi?.toLocaleString('es-EC', { maximumFractionDigits: 2 }) || '-'}</td>)}
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2 text-gray-500 sticky left-0 bg-white">Precio</td>
                {items.map(f => <td key={f.id} className="px-3 py-2 font-semibold text-emerald-700">
                  {f.precio !== null ? `$${f.precio.toLocaleString('es-EC', { maximumFractionDigits: 0 })}` : '-'}
                </td>)}
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2 text-gray-500 sticky left-0 bg-white">$/m2</td>
                {items.map(f => {
                  const ppm = f.precio && f.predio?.area_grafi ? f.precio / f.predio.area_grafi : null
                  return <td key={f.id} className="px-3 py-2">{ppm !== null ? `$${ppm.toFixed(2)}` : '-'}</td>
                })}
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2 text-gray-500 sticky left-0 bg-white">Calificación</td>
                {items.map(f => <td key={f.id} className="px-3 py-2"><MiniStars value={f.calificacion} /></td>)}
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2 text-gray-500 sticky left-0 bg-white">Estado</td>
                {items.map(f => <td key={f.id} className="px-3 py-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${estadoStyle[f.estado] ?? ''}`}>{f.estado}</span>
                </td>)}
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2 text-gray-500 sticky left-0 bg-white">Servicios</td>
                {items.map(f => <td key={f.id} className="px-3 py-2">
                  {f.servicios.length > 0 ? f.servicios.map(s => servicioAbrev[s] || s).join(', ') : '-'}
                </td>)}
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2 text-gray-500 sticky left-0 bg-white">Características</td>
                {items.map(f => <td key={f.id} className="px-3 py-2">
                  {f.caracteristicas.length > 0 ? f.caracteristicas.join(', ') : '-'}
                </td>)}
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2 text-gray-500 sticky left-0 bg-white">Contacto</td>
                {items.map(f => <td key={f.id} className="px-3 py-2">{f.contacto || '-'}</td>)}
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2 text-gray-500 sticky left-0 bg-white">Teléfono</td>
                {items.map(f => <td key={f.id} className="px-3 py-2">{f.telefono || '-'}</td>)}
              </tr>
              <tr className="border-b border-gray-50">
                <td className="px-3 py-2 text-gray-500 sticky left-0 bg-white">Última visita</td>
                {items.map(f => <td key={f.id} className="px-3 py-2">{f.ultima_visita || '-'}</td>)}
              </tr>
              <tr>
                <td className="px-3 py-2 text-gray-500 sticky left-0 bg-white">Notas</td>
                {items.map(f => <td key={f.id} className="px-3 py-2 max-w-[160px]">{f.notas || '-'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function Favoritos({ favoritos, loading, onLocate, onRemove, onEdit }: FavoritosProps) {
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set())
  const [showCompare, setShowCompare] = useState(false)

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const compareItems = favoritos.filter(f => compareIds.has(f.id))

  return (
    <div className="p-4">
      {loading && <p className="text-xs text-gray-400">Cargando...</p>}

      {!loading && favoritos.length === 0 && (
        <div className="text-center py-8">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <p className="text-xs text-gray-400">No tienes predios favoritos.</p>
          <p className="text-xs text-gray-400">Selecciona un predio en el mapa y agrégalo.</p>
        </div>
      )}

      {/* Compare bar */}
      {compareIds.size >= 2 && (
        <button
          onClick={() => setShowCompare(true)}
          className="w-full mb-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition-colors"
        >
          Comparar Seleccionados ({compareIds.size})
        </button>
      )}

      <div className="space-y-2">
        {favoritos.map(fav => {
          const pricePerM2 = fav.precio && fav.predio?.area_grafi ? fav.precio / fav.predio.area_grafi : null

          return (
            <div key={fav.id} className="bg-gray-50 rounded-lg p-3">
              {/* Row 1: checkbox + title + status + actions */}
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={compareIds.has(fav.id)}
                  onChange={() => toggleCompare(fav.id)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-semibold text-gray-800 truncate">
                      {fav.predio?.clave_cata || `Predio #${fav.predio_id}`}
                    </p>
                    {fav.predio?.barrio && (
                      <span className="text-[10px] text-gray-400">- {fav.predio.barrio}</span>
                    )}
                  </div>
                  {fav.estado && (
                    <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${estadoStyle[fav.estado] ?? ''}`}>
                      {fav.estado}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => onLocate(fav.predio_id)} title="Ver en mapa"
                    className="p-1.5 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button onClick={() => onEdit(fav)} title="Editar"
                    className="p-1.5 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => onRemove(fav.predio_id)} title="Eliminar"
                    className="p-1.5 rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition-colors cursor-pointer">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Row 2: area + price */}
              <div className="flex items-center justify-between mt-1.5 ml-6">
                <span className="text-[11px] text-gray-500">
                  {fav.predio?.area_grafi ? `${fav.predio.area_grafi.toLocaleString('es-EC', { maximumFractionDigits: 2 })} m2` : ''}
                </span>
                {fav.precio !== null && (
                  <span className="text-[11px] font-semibold text-emerald-700">
                    ${fav.precio.toLocaleString('es-EC', { maximumFractionDigits: 0 })}
                    {pricePerM2 !== null && (
                      <span className="text-gray-400 font-normal"> (${pricePerM2.toFixed(2)}/m2)</span>
                    )}
                  </span>
                )}
              </div>

              {/* Row 3: stars + phone */}
              {(fav.calificacion !== null || fav.telefono) && (
                <div className="flex items-center justify-between mt-1 ml-6">
                  <MiniStars value={fav.calificacion} />
                  {fav.telefono && (
                    <span className="text-[11px] text-gray-500">{fav.telefono}</span>
                  )}
                </div>
              )}

              {/* Row 4: servicios */}
              {fav.servicios.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 ml-6">
                  {fav.servicios.map(s => (
                    <span key={s} className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                      ✓ {servicioAbrev[s] || s}
                    </span>
                  ))}
                </div>
              )}

              {/* Row 5: caracteristicas */}
              {fav.caracteristicas.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 ml-6">
                  {fav.caracteristicas.map(c => (
                    <span key={c} className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Row 6: notes + last visit */}
              {(fav.notas || fav.ultima_visita) && (
                <div className="mt-1.5 ml-6 space-y-0.5">
                  {fav.notas && (
                    <p className="text-[11px] text-gray-500 italic truncate">"{fav.notas}"</p>
                  )}
                  {fav.ultima_visita && (
                    <p className="text-[10px] text-gray-400">Última visita: {fav.ultima_visita}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showCompare && compareItems.length >= 2 && createPortal(
        <CompareModal items={compareItems} onClose={() => setShowCompare(false)} />,
        document.body
      )}
    </div>
  )
}
