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
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('local_session_user')
  const user = sessionCookie ? JSON.parse(sessionCookie.value) : null
  const role: 'admin' | 'empleado' = user?.role || 'empleado'
  const activeUserId = user?.id || ''

  let userRequests: RequestRecord[] = []

  if (isLocal) {
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

    userRequests.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

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

  // --- Supabase DB Mode ---
  const supabase = await createClient()

  // 1. Fetch products with their movements
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

  // 2. Fetch requests
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
      profiles: { full_name: string } | null;
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
