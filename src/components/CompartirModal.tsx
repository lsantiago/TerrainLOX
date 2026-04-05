import { useState } from 'react'
import { createPortal } from 'react-dom'

interface CompartirModalProps {
  predioId: number
  claveCata: string
  onCompartir: (toEmail: string, nota: string) => Promise<{ error: string | null }>
  onClose: () => void
}

export default function CompartirModal({ predioId: _predioId, claveCata, onCompartir, onClose }: CompartirModalProps) {
  const [email, setEmail] = useState('')
  const [nota, setNota] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setResult(null)
    const { error } = await onCompartir(email, nota)
    setLoading(false)
    if (error) {
      setResult({ ok: false, msg: 'No se pudo enviar. Verifica el email.' })
    } else {
      setResult({ ok: true, msg: `Predio enviado a ${email}` })
      setEmail('')
      setNota('')
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">Compartir Predio</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 cursor-pointer">
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-xs text-gray-600">Clave: <span className="font-semibold text-gray-800">{claveCata}</span></span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Email del destinatario</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@ejemplo.com"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Nota <span className="text-gray-400 font-normal">(opcional)</span></label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Ej: Este predio me parece interesante para el proyecto..."
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
          </div>

          {result && (
            <div className={`text-xs px-3 py-2 rounded-lg ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {result.msg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}
