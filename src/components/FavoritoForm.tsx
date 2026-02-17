import { useState } from 'react'
import type { FavoritoMetadata, FavoritoEstado } from '../hooks/useFavoritos'
import { SERVICIOS_OPTIONS, CARACTERISTICAS_OPTIONS, ESTADO_OPTIONS } from '../hooks/useFavoritos'

interface FavoritoFormProps {
  mode: 'add' | 'edit'
  predioLabel: string
  initialValues: FavoritoMetadata
  saving: boolean
  onSave: (metadata: FavoritoMetadata) => void
  onCancel: () => void
}

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`w-8 h-8 cursor-pointer transition-colors ${
            value !== null && star <= value ? 'text-amber-400' : 'text-gray-300 hover:text-amber-300'
          }`}
        >
          <svg fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  )
}

export default function FavoritoForm({ mode, predioLabel, initialValues, saving, onSave, onCancel }: FavoritoFormProps) {
  const [form, setForm] = useState<FavoritoMetadata>(initialValues)

  const update = (patch: Partial<FavoritoMetadata>) => setForm(prev => ({ ...prev, ...patch }))

  const toggleArrayItem = (field: 'servicios' | 'caracteristicas', item: string) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item],
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...form,
      precio: form.precio === null || String(form.precio) === '' ? null : Number(form.precio),
    })
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 rounded-t-2xl flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-sm">
            {mode === 'add' ? 'Agregar a Favoritos' : 'Editar Favorito'}
          </h2>
          <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 cursor-pointer">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 font-medium">{predioLabel}</p>

          {/* Calificacion */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Mi Calificacion</label>
            <StarRating value={form.calificacion} onChange={v => update({ calificacion: v })} />
          </div>

          {/* Estado */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Estado</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ESTADO_OPTIONS.map(est => (
                <button
                  key={est}
                  type="button"
                  onClick={() => update({ estado: est as FavoritoEstado })}
                  className={`text-xs px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    form.estado === est
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {est}
                </button>
              ))}
            </div>
          </div>

          {/* Precio */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Precio de venta/arriendo</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.precio ?? ''}
                onChange={e => update({ precio: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="0.00"
                className={`${inputClass} pl-7`}
              />
            </div>
          </div>

          {/* Contacto */}
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre del contacto</label>
              <input
                type="text"
                value={form.contacto}
                onChange={e => update({ contacto: e.target.value })}
                placeholder="Juan Perez"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Telefono de contacto</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={e => update({ telefono: e.target.value })}
                placeholder="099-123-4567"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email_contacto}
                onChange={e => update({ email_contacto: e.target.value })}
                placeholder="correo@ejemplo.com"
                className={inputClass}
              />
            </div>
          </div>

          {/* Servicios */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Servicios Disponibles</label>
            <div className="flex flex-wrap gap-1.5">
              {SERVICIOS_OPTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleArrayItem('servicios', s)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-full border cursor-pointer transition-colors ${
                    form.servicios.includes(s)
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700 font-medium'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {form.servicios.includes(s) ? '✓ ' : ''}{s}
                </button>
              ))}
            </div>
          </div>

          {/* Caracteristicas */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Caracteristicas</label>
            <div className="flex flex-wrap gap-1.5">
              {CARACTERISTICAS_OPTIONS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleArrayItem('caracteristicas', c)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-full border cursor-pointer transition-colors ${
                    form.caracteristicas.includes(c)
                      ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {form.caracteristicas.includes(c) ? '✓ ' : ''}{c}
                </button>
              ))}
            </div>
          </div>

          {/* Ultima visita */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Ultima visita</label>
            <input
              type="date"
              value={form.ultima_visita}
              onChange={e => update({ ultima_visita: e.target.value })}
              className={inputClass}
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Notas personales</label>
            <textarea
              value={form.notas}
              onChange={e => update({ notas: e.target.value })}
              placeholder="Escribe tus notas aqui..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 rounded-lg cursor-pointer transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
