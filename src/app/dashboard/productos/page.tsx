import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProductList from '@/components/dashboard/product-list'
import { NewProductDialog } from '@/components/dashboard/new-product-dialog'
import { BulkImportDialog } from '@/components/dashboard/bulk-import-dialog'
import { cookies } from 'next/headers'
import { isSupabaseConfigured, readLocalDB } from '@/lib/db'
import { Smartphone } from 'lucide-react'

interface ProductRow {
  id: string;
  codigo: string;
  nombre: string;
  marca: string;
  color: string;
  capacidad: string;
  descripcion?: string;
  cajas: number;
  unidades_por_caja: number;
  cantidad: number;
  fecha_creacion: string;
}

export const dynamic = 'force-dynamic'

export default async function ProductosPage() {
  const isLocal = !isSupabaseConfigured()
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('local_session_user')
  if (!sessionCookie) redirect('/login')
  const user = JSON.parse(sessionCookie.value)
  if (user.role !== 'admin') redirect('/dashboard')

  let products: ProductRow[] = []

  if (isLocal) {
    const db = readLocalDB()
    products = db.products.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      marca: p.marca,
      color: p.color,
      capacidad: p.capacidad,
      descripcion: p.descripcion,
      cajas: p.cajas,
      unidades_por_caja: p.unidades_por_caja,
      cantidad: p.cantidad,
      fecha_creacion: p.fecha_creacion
    }))
  } else {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('products')
      .select('id, codigo, nombre, marca, color, capacidad, descripcion, cajas, unidades_por_caja, cantidad, fecha_creacion')
      .order('codigo', { ascending: true })
    if (error) {
      console.error('Error fetching catalog products:', error)
    }
    if (data) products = data as unknown as ProductRow[]
  }

  const sortedProducts = [...products].sort((a, b) => {
    const brandCompare = a.marca.localeCompare(b.marca)
    if (brandCompare !== 0) return brandCompare

    const nameCompare = a.nombre.localeCompare(b.nombre)
    if (nameCompare !== 0) return nameCompare

    const capCompare = a.capacidad.localeCompare(b.capacidad)
    if (capCompare !== 0) return capCompare

    return a.color.localeCompare(b.color)
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-emerald-400" />
            <span>Catálogo de Productos</span>
          </h1>
          <p className="text-sm text-zinc-400">
            Crea, visualiza y elimina variantes de celulares (por modelo, marca, color y capacidad).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <BulkImportDialog />
          <NewProductDialog />
        </div>
      </div>

      <ProductList products={sortedProducts} />
    </div>
  )
}
