import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { History, ArrowUpRight, ArrowDownLeft, Calendar, User, ClipboardList } from 'lucide-react'
import { cookies } from 'next/headers'
import { isSupabaseConfigured, readLocalDB } from '@/lib/db'
import { VoucherButton } from '@/components/dashboard/voucher-button'

interface MovementRecord {
  id: string;
  cantidad: number;
  unidad_medida?: 'cajas' | 'unidades';
  tipo: 'Entrada' | 'Salida';
  motivo: string;
  fecha: string;
  products: {
    codigo: string;
    nombre: string;
    marca: string;
    color: string;
    capacidad: string;
    unidades_por_caja: number;
  } | null;
  profiles: {
    full_name: string;
  } | null;
}

export const dynamic = 'force-dynamic'

export default async function MovimientosPage() {
  const isLocal = !isSupabaseConfigured()
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('local_session_user')
  if (!sessionCookie) redirect('/login')
  const user = JSON.parse(sessionCookie.value)
  if (user.role !== 'admin') redirect('/dashboard')

  if (isLocal) {
    const db = readLocalDB()
    const mappedMovements = db.movements.map((m) => {
      const product = db.products.find((p) => p.id === m.producto_id)
      const userObj = db.users.find((u) => u.id === m.usuario_id)
      
      return {
        id: m.id,
        cantidad: m.cantidad,
        unidad_medida: m.unidad_medida,
        tipo: m.tipo,
        motivo: m.motivo,
        fecha: m.fecha,
        products: product ? { 
          codigo: product.codigo, 
          nombre: product.nombre,
          marca: product.marca,
          color: product.color,
          capacidad: product.capacidad,
          unidades_por_caja: product.unidades_por_caja
        } : null,
        profiles: userObj ? { full_name: userObj.fullName } : { full_name: 'Administrador' }
      } as MovementRecord
    })

    mappedMovements.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-400" />
            <span>Historial de Movimientos (Local)</span>
          </h1>
          <p className="text-sm text-zinc-400">
            Registro de auditoría local de todas las entradas y salidas de mercancía.
          </p>
        </div>

        <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-950/80">
                <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 py-3 text-xs">Fecha y Hora</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Producto</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Tipo</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Cantidad</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Motivo / Detalle</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Registrado Por</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappedMovements.length > 0 ? (
                  mappedMovements.map((mov) => {
                    const isEntrada = mov.tipo === 'Entrada'
                    const formattedDate = new Date(mov.fecha).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })

                    return (
                      <TableRow key={mov.id} className="border-b border-zinc-800 hover:bg-zinc-900/20 transition-colors">
                        <TableCell className="py-4 text-xs font-mono text-zinc-400">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                            {formattedDate}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 text-xs">
                          <div className="flex flex-col">
                            <span className="text-zinc-200 font-semibold">
                              {mov.products?.nombre || 'Producto eliminado'}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {mov.products?.codigo || 'N/A'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-xs font-mono">
                          <Badge
                            variant="outline"
                            className={`uppercase font-semibold text-[9px] px-2 py-0.5 rounded ${
                              isEntrada
                                ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-400'
                                : 'border-amber-500/25 bg-amber-500/5 text-amber-400'
                            }`}
                          >
                            <span className="flex items-center gap-1">
                              {isEntrada ? (
                                <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <ArrowUpRight className="w-3 h-3 text-amber-400" />
                              )}
                              {mov.tipo}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 text-xs font-mono font-bold">
                          <span className={isEntrada ? 'text-emerald-400' : 'text-amber-400'}>
                            {isEntrada ? '+' : '-'}{mov.cantidad} {mov.unidad_medida === 'unidades' ? 'uds' : 'cajas'}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 text-xs text-zinc-400 max-w-[240px] truncate">
                          <span className="flex items-center gap-1.5">
                            <ClipboardList className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                            {mov.motivo}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 text-xs text-zinc-300 font-medium">
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                            {mov.profiles?.full_name || 'Desconocido'}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 text-xs text-right">
                          <VoucherButton movement={mov} className="text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900 h-7 text-[10px] gap-1 px-2" />
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-zinc-500">
                      No se han registrado movimientos todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    )
  }

  // --- Supabase DB Mode ---
  const supabase = await createClient()

  const { data: movements, error } = await supabase
    .from('movements')
    .select(`
      id,
      cantidad,
      tipo,
      motivo,
      fecha,
      products (
        codigo,
        nombre,
        marca,
        color,
        capacidad,
        unidades_por_caja
      ),
      profiles (
        full_name
      )
    `)
    .order('fecha', { ascending: false })

  if (error) {
    console.error('Error fetching movements audit logs:', error)
  }

  const typedMovements = (movements || []) as unknown as MovementRecord[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          <History className="w-6 h-6 text-emerald-400" />
          <span>Historial de Movimientos</span>
        </h1>
        <p className="text-sm text-zinc-400">
          Registro de auditoría de todas las entradas y salidas de mercancía.
        </p>
      </div>

      <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-950/80">
              <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400 py-3 text-xs">Fecha y Hora</TableHead>
                <TableHead className="text-zinc-400 py-3 text-xs">Producto</TableHead>
                <TableHead className="text-zinc-400 py-3 text-xs">Tipo</TableHead>
                <TableHead className="text-zinc-400 py-3 text-xs">Cantidad</TableHead>
                <TableHead className="text-zinc-400 py-3 text-xs">Motivo / Detalle</TableHead>
                <TableHead className="text-zinc-400 py-3 text-xs">Registrado Por</TableHead>
                <TableHead className="text-zinc-400 py-3 text-xs text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typedMovements.length > 0 ? (
                typedMovements.map((mov) => {
                  const isEntrada = mov.tipo === 'Entrada'
                  const formattedDate = new Date(mov.fecha).toLocaleString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })

                  return (
                    <TableRow key={mov.id} className="border-b border-zinc-800 hover:bg-zinc-900/20 transition-colors">
                      <TableCell className="py-4 text-xs font-mono text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                          {formattedDate}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-xs">
                        <div className="flex flex-col">
                          <span className="text-zinc-200 font-semibold">
                            {mov.products?.nombre || 'Producto eliminado'}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {mov.products?.codigo || 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-xs font-mono">
                        <Badge
                          variant="outline"
                          className={`uppercase font-semibold text-[9px] px-2 py-0.5 rounded ${
                            isEntrada
                              ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-400'
                              : 'border-amber-500/25 bg-amber-500/5 text-amber-400'
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            {isEntrada ? (
                              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                            )}
                            {mov.tipo}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-xs font-mono font-bold">
                        <span className={isEntrada ? 'text-emerald-400' : 'text-amber-400'}>
                          {isEntrada ? '+' : '-'}{mov.cantidad} {mov.unidad_medida === 'unidades' ? 'uds' : 'cajas'}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-xs text-zinc-400 max-w-[240px] truncate">
                        <span className="flex items-center gap-1.5">
                          <ClipboardList className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                          {mov.motivo}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-xs text-zinc-300 font-medium">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                          {mov.profiles?.full_name || 'Desconocido'}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-xs text-right">
                        <VoucherButton movement={mov} className="text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900 h-7 text-[10px] gap-1 px-2" />
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-zinc-500">
                    No se han registrado movimientos todavía.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
