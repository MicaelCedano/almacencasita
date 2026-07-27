import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Warehouse, Package, History, LogOut, User, Shield, Smartphone, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { isSupabaseConfigured, readLocalDB } from '@/lib/db'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isLocal = !isSupabaseConfigured()
  let role: 'admin' | 'empleado' = 'empleado'
  let fullName = 'Cargando...'
  let email = ''

  // Get user from cookie (works for both local and Supabase-DB modes)
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('local_session_user')
  const user = sessionCookie ? JSON.parse(sessionCookie.value) : null
  if (user) {
    role = user.role
    fullName = user.fullName
    email = `@${user.username}`
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-zinc-900 border-r border-zinc-800 p-6 space-y-6">
        {/* Brand Logo */}
        <div className="flex items-center space-x-3 px-2">
          <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400">
            <Warehouse className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm tracking-tight">Almacén Casita</h2>
            <span className="text-[10px] text-zinc-400">Panel de Control</span>
          </div>
        </div>

        {/* User Card */}
        <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800/80 flex flex-col gap-2">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-300">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1 overflow-hidden">
              <h4 className="text-xs font-semibold text-zinc-100 truncate">{fullName}</h4>
              <p className="text-[10px] text-zinc-500 truncate">{email}</p>
            </div>
          </div>
          <div className="flex justify-start">
            <Badge 
              variant="outline" 
              className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-md ${
                role === 'admin' 
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' 
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300'
              }`}
            >
              {role === 'admin' ? (
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Admin
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> Almacenista
                </span>
              )}
            </Badge>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5">
          <Link
            href="/dashboard"
            className="flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg text-zinc-200 hover:text-zinc-50 hover:bg-zinc-800/60 transition-all duration-200"
          >
            <Package className="w-4 h-4 text-zinc-400" />
            <span>Inventario</span>
          </Link>
          {role === 'admin' && (
            <>
              <Link
                href="/dashboard/productos"
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg text-zinc-200 hover:text-zinc-50 hover:bg-zinc-800/60 transition-all duration-200"
              >
                <Smartphone className="w-4 h-4 text-zinc-400" />
                <span>Productos</span>
              </Link>
              <Link
                href="/dashboard/movimientos"
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg text-zinc-200 hover:text-zinc-50 hover:bg-zinc-800/60 transition-all duration-200"
              >
                <History className="w-4 h-4 text-zinc-400" />
                <span>Movimientos</span>
              </Link>
              <Link
                href="/dashboard/solicitudes"
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg text-zinc-200 hover:text-zinc-50 hover:bg-zinc-800/60 transition-all duration-200"
              >
                <ShieldAlert className="w-4 h-4 text-zinc-400" />
                <span>Solicitudes</span>
              </Link>
            </>
          )}
        </nav>

        {/* Log Out Button */}
        <form action={logout} className="pt-4 border-t border-zinc-800">
          <Button
            variant="ghost"
            type="submit"
            className="w-full justify-start text-zinc-400 hover:text-red-400 hover:bg-red-500/5 text-sm gap-3 px-3"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </Button>
        </form>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between bg-zinc-900 border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400">
              <Warehouse className="w-4 h-4" />
            </div>
            <h2 className="font-semibold text-sm tracking-tight text-zinc-100">Almacén Casita</h2>
          </div>

          <div className="flex items-center space-x-3">
             <Badge 
              variant="outline" 
              className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded-md ${
                role === 'admin' 
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' 
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300'
              }`}
            >
              {role === 'admin' ? 'Admin' : 'Almacenista'}
            </Badge>
            <form action={logout}>
              <Button
                variant="ghost"
                size="icon"
                type="submit"
                className="text-zinc-400 hover:text-red-400 hover:bg-red-500/5 h-8 w-8"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </header>

        {/* Sub-header / Mobile Navigation */}
        <div className="md:hidden flex bg-zinc-900/50 border-b border-zinc-800 px-6 py-2 gap-4">
          <Link
            href="/dashboard"
            className="text-xs font-medium text-zinc-300 hover:text-zinc-50 py-1"
          >
            Inventario
          </Link>
          {role === 'admin' && (
            <>
              <Link
                href="/dashboard/productos"
                className="text-xs font-medium text-zinc-300 hover:text-zinc-50 py-1"
              >
                Productos
              </Link>
              <Link
                href="/dashboard/movimientos"
                className="text-xs font-medium text-zinc-300 hover:text-zinc-50 py-1"
              >
                Movimientos
              </Link>
              <Link
                href="/dashboard/solicitudes"
                className="text-xs font-medium text-zinc-300 hover:text-zinc-50 py-1"
              >
                Solicitudes
              </Link>
            </>
          )}
        </div>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
