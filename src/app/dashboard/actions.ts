'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { isSupabaseConfigured, readLocalDB, writeLocalDB } from '@/lib/db'

export async function createProduct(formData: {
  codigo: string;
  nombre: string;
  marca: string;
  color: string;
  capacidad: string;
  descripcion?: string;
  unidades_por_caja: number;
}) {
  const isLocal = !isSupabaseConfigured()

  if (isLocal) {
    // Check local session and role
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('local_session_user')
    if (!sessionCookie) return { success: false, error: 'No autenticado' }
    
    const user = JSON.parse(sessionCookie.value)
    if (user.role !== 'admin') {
      return { success: false, error: 'No autorizado. Solo administradores pueden agregar productos.' }
    }

    const db = readLocalDB()
    const exists = db.products.some(
      (p) => p.codigo.toUpperCase() === formData.codigo.toUpperCase()
    )

    if (exists) {
      return { success: false, error: 'El código del producto ya existe.' }
    }

    const newProduct = {
      id: 'prod_' + Math.random().toString(36).substr(2, 9),
      codigo: formData.codigo.toUpperCase(),
      nombre: formData.nombre.trim(),
      marca: formData.marca.trim(),
      color: formData.color.trim(),
      capacidad: formData.capacidad.trim(),
      descripcion: formData.descripcion?.trim(),
      cajas: 0,
      unidades_por_caja: formData.unidades_por_caja,
      cantidad: 0,
      fecha_creacion: new Date().toISOString(),
      fecha_actualizacion: new Date().toISOString()
    }

    db.products.push(newProduct)
    writeLocalDB(db)

    revalidatePath('/dashboard')
    return { success: true }
  }

  // --- Real Supabase ---
  const supabase = await createClient()

  // Verify authentication and role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'No autorizado. Solo administradores pueden agregar productos.' }
  }

  // Insert product in database with color and capacidad
  const { error } = await supabase
    .from('products')
    .insert({
      codigo: formData.codigo,
      nombre: formData.nombre,
      marca: formData.marca,
      color: formData.color,
      capacidad: formData.capacidad,
      descripcion: formData.descripcion,
      cajas: 0,
      unidades_por_caja: formData.unidades_por_caja,
      cantidad: 0,
    })

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'El código del producto ya existe.' }
    }
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function createMovement(formData: {
  producto_id: string;
  cantidad: number; // in boxes
  tipo: 'Entrada' | 'Salida';
  motivo: string;
}) {
  const isLocal = !isSupabaseConfigured()

  if (isLocal) {
    // Check local session and role
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('local_session_user')
    if (!sessionCookie) return { success: false, error: 'No autenticado' }
    
    const user = JSON.parse(sessionCookie.value)
    if (user.role !== 'admin') {
      return { success: false, error: 'No autorizado. Solo administradores pueden registrar movimientos.' }
    }

    const db = readLocalDB()
    const product = db.products.find((p) => p.id === formData.producto_id)
    if (!product) {
      return { success: false, error: 'Producto no encontrado.' }
    }

    // Emulate trigger validation
    if (formData.tipo === 'Salida') {
      if (product.cajas < formData.cantidad) {
        return { success: false, error: 'Stock de cajas insuficiente para realizar la salida.' }
      }
      product.cajas -= formData.cantidad
    } else {
      product.cajas += formData.cantidad
    }

    // Update total units count
    product.cantidad = product.cajas * product.unidades_por_caja
    product.fecha_actualizacion = new Date().toISOString()

    const newMovement = {
      id: 'mov_' + Math.random().toString(36).substr(2, 9),
      producto_id: formData.producto_id,
      cantidad: formData.cantidad, // number of boxes
      tipo: formData.tipo,
      motivo: formData.motivo.trim(),
      usuario_id: user.id,
      fecha: new Date().toISOString()
    }

    db.movements.push(newMovement)
    writeLocalDB(db)

    revalidatePath('/dashboard')
    return { success: true }
  }

  // --- Real Supabase ---
  const supabase = await createClient()

  // Verify authentication and role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'No autorizado. Solo administradores pueden registrar movimientos.' }
  }

  // Insert the movement. The stock trigger will update both product.cajas and product.cantidad
  const { error } = await supabase
    .from('movements')
    .insert({
      producto_id: formData.producto_id,
      cantidad: formData.cantidad,
      tipo: formData.tipo,
      motivo: formData.motivo,
      usuario_id: user.id,
    })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteProduct(id: string) {
  const isLocal = !isSupabaseConfigured()

  if (isLocal) {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('local_session_user')
    if (!sessionCookie) return { success: false, error: 'No autenticado' }
    
    const user = JSON.parse(sessionCookie.value)
    if (user.role !== 'admin') {
      return { success: false, error: 'No autorizado. Solo administradores pueden eliminar productos.' }
    }

    const db = readLocalDB()
    db.products = db.products.filter(p => p.id !== id)
    db.movements = db.movements.filter(m => m.producto_id !== id)
    writeLocalDB(db)

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/productos')
    return { success: true }
  }

  // --- Real Supabase ---
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'No autorizado. Solo administradores pueden eliminar productos.' }
  }

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/productos')
  return { success: true }
}

export async function updateProduct(id: string, formData: {
  codigo: string;
  nombre: string;
  marca: string;
  color: string;
  capacidad: string;
  descripcion?: string;
  unidades_por_caja: number;
}) {
  const isLocal = !isSupabaseConfigured()

  if (isLocal) {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('local_session_user')
    if (!sessionCookie) return { success: false, error: 'No autenticado' }
    
    const user = JSON.parse(sessionCookie.value)
    if (user.role !== 'admin') {
      return { success: false, error: 'No autorizado. Solo administradores pueden editar productos.' }
    }

    const db = readLocalDB()
    const productIndex = db.products.findIndex((p) => p.id === id)
    if (productIndex === -1) {
      return { success: false, error: 'Producto no encontrado.' }
    }

    // Check if new code already exists on another product
    const codeExists = db.products.some(
      (p) => p.id !== id && p.codigo.toUpperCase() === formData.codigo.toUpperCase()
    )
    if (codeExists) {
      return { success: false, error: 'El nuevo código ya está registrado en otro producto.' }
    }

    const p = db.products[productIndex]
    p.codigo = formData.codigo.toUpperCase()
    p.nombre = formData.nombre.trim()
    p.marca = formData.marca.trim()
    p.color = formData.color.trim()
    p.capacidad = formData.capacidad.trim()
    p.descripcion = formData.descripcion?.trim()
    p.unidades_por_caja = formData.unidades_por_caja
    p.cantidad = p.cajas * formData.unidades_por_caja
    p.fecha_actualizacion = new Date().toISOString()

    writeLocalDB(db)

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/productos')
    return { success: true }
  }

  // --- Real Supabase ---
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'No autorizado. Solo administradores pueden editar productos.' }
  }

  // Get current boxes count to recalculate quantity
  const { data: currentProduct, error: fetchError } = await supabase
    .from('products')
    .select('cajas')
    .eq('id', id)
    .single()

  if (fetchError || !currentProduct) {
    return { success: false, error: 'Error al buscar el producto.' }
  }

  const newCantidad = currentProduct.cajas * formData.unidades_por_caja

  const { error } = await supabase
    .from('products')
    .update({
      codigo: formData.codigo,
      nombre: formData.nombre,
      marca: formData.marca,
      color: formData.color,
      capacidad: formData.capacidad,
      descripcion: formData.descripcion,
      unidades_por_caja: formData.unidades_por_caja,
      cantidad: newCantidad,
      fecha_actualizacion: new Date().toISOString()
    })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/productos')
  return { success: true }
}

export async function approveUser(userId: string) {
  const isLocal = !isSupabaseConfigured()

  if (isLocal) {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('local_session_user')
    if (!sessionCookie) return { success: false, error: 'No autenticado' }

    const user = JSON.parse(sessionCookie.value)
    if (user.role !== 'admin') {
      return { success: false, error: 'No autorizado.' }
    }

    const db = readLocalDB()
    const u = db.users.find((usr) => usr.id === userId)
    if (u) {
      u.approved = true
      writeLocalDB(db)
    }

    revalidatePath('/dashboard/solicitudes')
    return { success: true }
  }

  // --- Real Supabase ---
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'No autorizado.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ approved: true })
    .eq('id', userId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/solicitudes')
  return { success: true }
}

export async function deleteUser(userId: string) {
  const isLocal = !isSupabaseConfigured()

  if (isLocal) {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('local_session_user')
    if (!sessionCookie) return { success: false, error: 'No autenticado' }

    const user = JSON.parse(sessionCookie.value)
    if (user.role !== 'admin') {
      return { success: false, error: 'No autorizado.' }
    }

    const db = readLocalDB()
    db.users = db.users.filter((usr) => usr.id !== userId)
    writeLocalDB(db)

    revalidatePath('/dashboard/solicitudes')
    return { success: true }
  }

  // --- Real Supabase ---
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'No autorizado.' }
  }

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/solicitudes')
  return { success: true }
}

export async function createWithdrawalRequest(formData: {
  items: { producto_id: string; cantidad: number }[];
  motivo: string;
}) {
  const isLocal = !isSupabaseConfigured()

  if (isLocal) {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('local_session_user')
    if (!sessionCookie) return { success: false, error: 'No autenticado' }

    const user = JSON.parse(sessionCookie.value)

    const db = readLocalDB()
    
    // Validate each item exists in db
    for (const item of formData.items) {
      const product = db.products.find((p) => p.id === item.producto_id)
      if (!product) return { success: false, error: 'Uno de los productos seleccionados no existe.' }
    }

    const newRequest = {
      id: 'req_' + Math.random().toString(36).substr(2, 9),
      items: formData.items,
      motivo: formData.motivo.trim(),
      usuario_id: user.id,
      estado: 'Pendiente' as const,
      fecha: new Date().toISOString()
    }

    db.requests = db.requests || []
    db.requests.push(newRequest)
    writeLocalDB(db)

    revalidatePath('/dashboard')
    return { success: true }
  }

  // --- Real Supabase ---
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('requests')
    .insert({
      items: formData.items,
      motivo: formData.motivo,
      usuario_id: user.id,
      estado: 'Pendiente'
    })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function approveWithdrawalRequest(requestId: string) {
  const isLocal = !isSupabaseConfigured()

  if (isLocal) {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('local_session_user')
    if (!sessionCookie) return { success: false, error: 'No autenticado' }

    const user = JSON.parse(sessionCookie.value)
    if (user.role !== 'admin') {
      return { success: false, error: 'No autorizado. Solo administradores pueden aprobar solicitudes.' }
    }

    const db = readLocalDB()
    const request = db.requests?.find((r) => r.id === requestId)
    if (!request) return { success: false, error: 'Solicitud no encontrada.' }
    if (request.estado !== 'Pendiente') return { success: false, error: 'La solicitud ya fue procesada.' }

    // 1. Verify stock for ALL items in batch first
    for (const item of request.items) {
      const product = db.products.find((p) => p.id === item.producto_id)
      if (!product) return { success: false, error: 'Producto no encontrado.' }
      if (product.cajas < item.cantidad) {
        return { success: false, error: `Stock insuficiente para ${product.nombre} (Solicitado: ${item.cantidad} cajas, Disponible: ${product.cajas} cajas).` }
      }
    }

    // 2. Perform atomic deduction and movements registration
    const requestUser = db.users.find(u => u.id === request.usuario_id)
    const requesterName = requestUser ? requestUser.fullName : 'Almacenista'

    for (const item of request.items) {
      const product = db.products.find((p) => p.id === item.producto_id)!
      
      // Deduct stock
      product.cajas -= item.cantidad
      product.cantidad = product.cajas * product.unidades_por_caja
      product.fecha_actualizacion = new Date().toISOString()

      // Create stock movement
      db.movements.push({
        id: 'mov_' + Math.random().toString(36).substr(2, 9),
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        tipo: 'Salida' as const,
        motivo: `Aprobado - Solicitud de ${requesterName}. Motivo: ${request.motivo}`,
        usuario_id: request.usuario_id,
        fecha: new Date().toISOString()
      })
    }

    // Update request state
    request.estado = 'Aprobado'
    writeLocalDB(db)

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/solicitudes')
    return { success: true }
  }

  // --- Real Supabase ---
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'No autorizado. Solo administradores pueden aprobar solicitudes.' }
  }

  // Fetch the request details
  const { data: request, error: fetchErr } = await supabase
    .from('requests')
    .select('items, motivo, usuario_id')
    .eq('id', requestId)
    .single()

  if (fetchErr || !request) return { success: false, error: 'Solicitud no encontrada.' }

  const items = request.items as { producto_id: string; cantidad: number }[]

  // 1. Verify stock for ALL items in batch first
  for (const item of items) {
    const { data: product } = await supabase
      .from('products')
      .select('nombre, cajas')
      .eq('id', item.producto_id)
      .single()

    if (!product) return { success: false, error: 'Producto no encontrado.' }
    if (product.cajas < item.cantidad) {
      return { success: false, error: `Stock insuficiente para ${product.nombre} (Solicitado: ${item.cantidad} cajas, Disponible: ${product.cajas} cajas).` }
    }
  }

  // 2. Set request to Approved
  const { error: reqError } = await supabase
    .from('requests')
    .update({ estado: 'Aprobado' })
    .eq('id', requestId)

  if (reqError) return { success: false, error: reqError.message }

  // 3. Fetch requester profile name
  const { data: requester } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', request.usuario_id)
    .single()

  const requesterName = requester?.full_name || 'Almacenista'

  // 4. Insert movements in loop
  for (const item of items) {
    const { error: movError } = await supabase
      .from('movements')
      .insert({
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        tipo: 'Salida',
        motivo: `Aprobado - Solicitud de ${requesterName}. Motivo: ${request.motivo}`,
        usuario_id: request.usuario_id
      })

    if (movError) {
      console.error('Error recording movement for item:', item, movError)
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/solicitudes')
  return { success: true }
}

export async function rejectWithdrawalRequest(requestId: string) {
  const isLocal = !isSupabaseConfigured()

  if (isLocal) {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('local_session_user')
    if (!sessionCookie) return { success: false, error: 'No autenticado' }

    const user = JSON.parse(sessionCookie.value)
    if (user.role !== 'admin') {
      return { success: false, error: 'No autorizado. Solo administradores pueden rechazar solicitudes.' }
    }

    const db = readLocalDB()
    const request = db.requests?.find((r) => r.id === requestId)
    if (!request) return { success: false, error: 'Solicitud no encontrada.' }
    if (request.estado !== 'Pendiente') {
      return { success: false, error: 'La solicitud ya fue procesada.' }
    }

    request.estado = 'Rechazado'
    writeLocalDB(db)

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/solicitudes')
    return { success: true }
  }

  // --- Real Supabase ---
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, error: 'No autorizado. Solo administradores pueden rechazar solicitudes.' }
  }

  const { error } = await supabase
    .from('requests')
    .update({ estado: 'Rechazado' })
    .eq('id', requestId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/solicitudes')
  return { success: true }
}
