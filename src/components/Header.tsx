import type { User } from '@supabase/supabase-js'

interface HeaderProps {
  user: User
  onSignOut: () => void
}

export default function Header({ user, onSignOut }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between z-50 relative">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <span className="font-semibold text-gray-800 text-sm">Terrain LOX</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 hidden sm:inline">
          {user.email}
        </span>
        <button
          onClick={onSignOut}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          Cerrar sesion
        </button>
      </div>
    </header>
  )
}
