import React from 'react'
import { createClient } from '@/lib/supabase/server'
import InventoryDashboard from '@/components/dashboard/inventory-dashboard'
import { cookies } from 'next/headers'
import { isSupabaseConfigured, readLocalDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

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

export default async function DashboardPage() {
  const isLocal = !isSupabaseConfigured()

  let role: 'admin' | 'empleado' = 'empleado'
  let activeUserId = ''
  let userRequests: RequestRecord[] = []

  if (isLocal) {
    // 1. Fetch role and ID from cookie session
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('local_session_user')
    const user = sessionCookie ? JSON.parse(sessionCookie.value) : null
    role = user?.role || 'empleado'
    activeUserId = user?.id || ''

    // 2. Read products from local JSON DB
    const db = readLocalDB()
    const productsWithMovements = db.products.map((p) => {
      const productMovements = db.movements
        .filter((m) => m.producto_id === p.id)
        .map((m) => ({
          tipo: m.tipo,
          cantidad: m.cantidad,
          fecha: m.fecha,
          motivo: m.motivo
        }))
      
      return {
        ...p,
        movements: productMovements
      }
    })

    // Fetch requests for this Almacenista (or all for Admin)
    const localRequests = db.requests || []
    const filteredRequests = role === 'admin' 
      ? localRequests 
      : localRequests.filter(r => r.usuario_id === activeUserId)

    userRequests = filteredRequests.map(r => {
      const requester = db.users.find(u => u.id === r.usuario_id)
      const mappedItems = (r.items || []).map(item => {
        const product = db.products.find(p => p.id === item.producto_id)
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
        requesterName: requester ? requester.fullName : 'Almacenista'
      }
    })

    // Sort requests by date descending
    userRequests.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

    // Sort products by name ascending
    const sortedProducts = [...productsWithMovements].sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    )

    return (
      <InventoryDashboard 
        products={sortedProducts} 
        role={role} 
        requests={userRequests}
      />
    )
  }

  // --- Real Supabase Mode ---
  const supabase = await createClient()

  // 1. Fetch current logged-in user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    activeUserId = user.id
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (profile) {
      role = profile.role as 'admin' | 'empleado'
    }
  }

  // 2. Fetch products along with their movements
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id,
      codigo,
      nombre,
      marca,
      color,
      capacidad,
      descripcion,
      cajas,
      unidades_por_caja,
      cantidad,
      fecha_creacion,
      fecha_actualizacion,
      movements (
        tipo,
        cantidad,
        fecha,
        motivo
      )
    `)
    .order('nombre', { ascending: true })

  if (error) {
    console.error('Error fetching products from database:', error)
  }

  // 3. Fetch requests from Supabase
  let supabaseRequestsQuery = supabase
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

  if (role !== 'admin') {
    supabaseRequestsQuery = supabaseRequestsQuery.eq('usuario_id', activeUserId)
  }

  const { data: reqsData } = await supabaseRequestsQuery

  if (reqsData) {
    // Fetch all products to match details on server
    const { data: allProducts } = await supabase
      .from('products')
      .select('id, codigo, nombre, color, capacidad, unidades_por_caja, marca')

    const productMap = new Map(allProducts?.map((p) => [p.id, p]) || [])

    userRequests = (reqsData as unknown as {
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

  return (
    <InventoryDashboard 
      products={products || []} 
      role={role} 
      requests={userRequests}
    />
  )
}
