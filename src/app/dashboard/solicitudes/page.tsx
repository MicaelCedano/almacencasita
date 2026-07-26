import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RequestsManager from '@/components/dashboard/requests-manager'
import { cookies } from 'next/headers'
import { isSupabaseConfigured, readLocalDB } from '@/lib/db'
import { ShieldAlert } from 'lucide-react'

interface RequestItemDetails {
  producto_id: string;
  cantidad: number;
  codigo: string;
  nombre: string;
  color: string;
  capacidad: string;
  unidades_por_caja: number;
  marca: string;
}

interface RequestRecord {
  id: string;
  motivo: string;
  usuario_id: string;
  estado: 'Pendiente' | 'Aprobado' | 'Rechazado';
  fecha: string;
  items: RequestItemDetails[];
  requesterName: string;
}

interface UserRecord {
  id: string;
  username: string;
  fullName: string;
  role: 'admin' | 'empleado';
  approved: boolean;
}

export const dynamic = 'force-dynamic'

export default async function SolicitudesPage() {
  const isLocal = !isSupabaseConfigured()
  let role: 'admin' | 'empleado' = 'empleado'

  if (isLocal) {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('local_session_user')
    if (!sessionCookie) redirect('/login')
    const user = JSON.parse(sessionCookie.value)
    role = user.role
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile) role = profile.role as 'admin' | 'empleado'
  }

  // Admins only
  if (role !== 'admin') {
    redirect('/dashboard')
  }

  let requests: RequestRecord[] = []
  let pendingUsers: UserRecord[] = []

  if (isLocal) {
    const db = readLocalDB()
    
    // Map requests
    requests = (db.requests || []).map((r) => {
      const user = db.users.find((u) => u.id === r.usuario_id)
      const mappedItems = (r.items || []).map((item) => {
        const product = db.products.find((p) => p.id === item.producto_id)
        return {
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          codigo: product?.codigo || 'N/A',
          nombre: product?.nombre || 'Celular Eliminado',
          color: product?.color || 'N/A',
          capacidad: product?.capacidad || 'N/A',
          unidades_por_caja: product?.unidades_por_caja || 10,
          marca: product?.marca || 'N/A'
        } as RequestItemDetails
      })
      
      return {
        id: r.id,
        motivo: r.motivo,
        usuario_id: r.usuario_id,
        estado: r.estado,
        fecha: r.fecha,
        items: mappedItems,
        requesterName: user ? user.fullName : 'Almacenista'
      } as RequestRecord
    })

    // Sort requests by date descending
    requests.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

    // Fetch unapproved users
    pendingUsers = db.users
      .filter((u) => !u.approved)
      .map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        approved: u.approved
      }))
  } else {
    const supabase = await createClient()
    
    // Fetch pending users
    const { data: usersData } = await supabase
      .from('profiles')
      .select('id, full_name, role, approved')
      .eq('approved', false)

    if (usersData) {
      pendingUsers = usersData.map((u) => ({
        id: u.id,
        username: u.full_name.toLowerCase().replace(/\s+/g, ''), // simulated username
        fullName: u.full_name,
        role: u.role as 'admin' | 'empleado',
        approved: u.approved
      }))
    }

    // Fetch requests
    const { data: requestsData } = await supabase
      .from('requests')
      .select(`
        id,
        motivo,
        usuario_id,
        estado,
        fecha,
        items,
        profiles (
          full_name
        )
      `)
      .order('fecha', { ascending: false })

    if (requestsData) {
      // Fetch all products to match details on server
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, codigo, nombre, color, capacidad, unidades_por_caja, marca')

      const productMap = new Map(allProducts?.map((p) => [p.id, p]) || [])

      requests = (requestsData as unknown as {
        id: string;
        motivo: string;
        usuario_id: string;
        estado: 'Pendiente' | 'Aprobado' | 'Rechazado';
        fecha: string;
        items: { producto_id: string; cantidad: number }[];
        profiles: {
          full_name: string;
        } | null;
      }[]).map((r) => {
        const mappedItems = r.items.map((item) => {
          const product = productMap.get(item.producto_id)
          return {
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            codigo: product?.codigo || 'N/A',
            nombre: product?.nombre || 'Celular Eliminado',
            color: product?.color || 'N/A',
            capacidad: product?.capacidad || 'N/A',
            unidades_por_caja: product?.unidades_por_caja || 10,
            marca: product?.marca || 'N/A'
          } as RequestItemDetails
        })

        return {
          id: r.id,
          motivo: r.motivo,
          usuario_id: r.usuario_id,
          estado: r.estado,
          fecha: r.fecha,
          items: mappedItems,
          requesterName: r.profiles ? r.profiles.full_name : 'Almacenista'
        }
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-emerald-400" />
          <span>Solicitudes y Aprobaciones</span>
        </h1>
        <p className="text-sm text-zinc-400">
          Autoriza el registro de nuevos almacenistas o aprueba las solicitudes de retiro de cajas de celulares del inventario.
        </p>
      </div>

      <RequestsManager requests={requests} pendingUsers={pendingUsers} />
    </div>
  )
}
