'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { isSupabaseConfigured, readLocalDB, writeLocalDB } from '@/lib/db'

/** Get session user from cookie (works for both local and Supabase modes) */
function getSessionUser(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const sessionCookie = cookieStore.get('local_session_user')
  if (!sessionCookie) return null
  return JSON.parse(sessionCookie.value) as {
    id: string;
    username: string;
    fullName: string;
    role: 'admin' | 'empleado';
  }
}

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
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado. Solo administradores pueden agregar productos.' }

  if (isLocal) {
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

  // --- Supabase DB ---
  const supabase = await createClient()

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
  cantidad: number;
  tipo: 'Entrada' | 'Salida';
  motivo: string;
}) {
  const isLocal = !isSupabaseConfigured()
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado. Solo administradores pueden registrar movimientos.' }

  if (isLocal) {
    const db = readLocalDB()
    const product = db.products.find((p) => p.id === formData.producto_id)
    if (!product) {
      return { success: false, error: 'Producto no encontrado.' }
    }

    if (formData.tipo === 'Salida') {
      if (product.cajas < formData.cantidad) {
        return { success: false, error: 'Stock de cajas insuficiente para realizar la salida.' }
      }
      product.cajas -= formData.cantidad
    } else {
      product.cajas += formData.cantidad
    }

    product.cantidad = product.cajas * product.unidades_por_caja
    product.fecha_actualizacion = new Date().toISOString()

    const newMovement = {
      id: 'mov_' + Math.random().toString(36).substr(2, 9),
      producto_id: formData.producto_id,
      cantidad: formData.cantidad,
      tipo: formData.tipo,
      motivo: formData.motivo.trim(),
      usuario_id: user.id,
      fecha: new Date().toISOString()
    }

    db.movements.push(newMovement)

    writeLocalDB(db)

    revalidatePath('/dashboard')
    return { 
      success: true,
      movement: {
        id: newMovement.id,
        fecha: newMovement.fecha,
        tipo: newMovement.tipo,
        cantidad: newMovement.cantidad,
        motivo: newMovement.motivo,
        product: {
          codigo: product.codigo,
          nombre: product.nombre,
          marca: product.marca,
          color: product.color,
          capacidad: product.capacidad,
          unidades_por_caja: product.unidades_por_caja,
        },
        user: {
          fullName: user.fullName
        }
      }
    }
  }

  // --- Supabase DB ---
  const supabase = await createClient()

  // Fetch product details for the voucher
  const { data: product, error: prodError } = await supabase
    .from('products')
    .select('codigo, nombre, marca, color, capacidad, unidades_por_caja')
    .eq('id', formData.producto_id)
    .single()

  if (prodError) {
    return { success: false, error: 'Error al obtener detalles del producto: ' + prodError.message }
  }

  const { data: newMov, error } = await supabase
    .from('movements')
    .insert({
      producto_id: formData.producto_id,
      cantidad: formData.cantidad,
      tipo: formData.tipo,
      motivo: formData.motivo,
      usuario_id: user.id,
    })
    .select('id, fecha')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard')
  return { 
    success: true,
    movement: {
      id: newMov.id,
      fecha: newMov.fecha,
      tipo: formData.tipo,
      cantidad: formData.cantidad,
      motivo: formData.motivo,
      product: {
        codigo: product.codigo,
        nombre: product.nombre,
        marca: product.marca,
        color: product.color,
        capacidad: product.capacidad,
        unidades_por_caja: product.unidades_por_caja,
      },
      user: {
        fullName: user.fullName
      }
    }
  }
}

export async function createMovementsBulk(formData: {
  tipo: 'Entrada' | 'Salida';
  motivo: string;
  items: { producto_id: string; cantidad: number }[];
}) {
  const isLocal = !isSupabaseConfigured()
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado. Solo administradores pueden registrar movimientos.' }

  if (!formData.items || formData.items.length === 0) {
    return { success: false, error: 'Debe agregar al menos un producto.' }
  }

  if (isLocal) {
    const db = readLocalDB()
    const resultItems = []
    const batchId = 'batch_' + Math.random().toString(36).substr(2, 9)

    for (const item of formData.items) {
      const product = db.products.find((p) => p.id === item.producto_id)
      if (!product) {
        return { success: false, error: 'Producto no encontrado.' }
      }

      if (formData.tipo === 'Salida') {
        if (product.cajas < item.cantidad) {
          return { success: false, error: `Stock de cajas insuficiente para realizar la salida de ${product.nombre}.` }
        }
        product.cajas -= item.cantidad
      } else {
        product.cajas += item.cantidad
      }

      product.cantidad = product.cajas * product.unidades_por_caja
      product.fecha_actualizacion = new Date().toISOString()

      db.movements.push({
        id: 'mov_' + Math.random().toString(36).substr(2, 9),
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        tipo: formData.tipo,
        motivo: formData.motivo.trim(),
        usuario_id: user.id,
        fecha: new Date().toISOString()
      })

      resultItems.push({
        codigo: product.codigo,
        nombre: product.nombre,
        marca: product.marca,
        color: product.color,
        capacidad: product.capacidad,
        unidades_por_caja: product.unidades_por_caja,
        cantidad: item.cantidad,
      })
    }

    writeLocalDB(db)

    revalidatePath('/dashboard')
    return { 
      success: true,
      movementBatch: {
        id: batchId,
        fecha: new Date().toISOString(),
        tipo: formData.tipo,
        motivo: formData.motivo,
        items: resultItems,
        user: {
          fullName: user.fullName
        }
      }
    }
  }

  // --- Supabase DB ---
  const supabase = await createClient()
  const resultItems = []
  const batchId = 'batch_' + Math.random().toString(36).substr(2, 9)

  for (const item of formData.items) {
    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('codigo, nombre, marca, color, capacidad, unidades_por_caja')
      .eq('id', item.producto_id)
      .single()

    if (prodError || !product) {
      return { success: false, error: 'Error al obtener detalles de uno de los productos.' }
    }

    const { error } = await supabase
      .from('movements')
      .insert({
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        tipo: formData.tipo,
        motivo: formData.motivo,
        usuario_id: user.id,
      })

    if (error) {
      return { success: false, error: error.message }
    }

    resultItems.push({
      codigo: product.codigo,
      nombre: product.nombre,
      marca: product.marca,
      color: product.color,
      capacidad: product.capacidad,
      unidades_por_caja: product.unidades_por_caja,
      cantidad: item.cantidad,
    })
  }

  revalidatePath('/dashboard')
  return { 
    success: true,
    movementBatch: {
      id: batchId,
      fecha: new Date().toISOString(),
      tipo: formData.tipo,
      motivo: formData.motivo,
      items: resultItems,
      user: {
        fullName: user.fullName
      }
    }
  }
}

export async function deleteProduct(id: string) {
  const isLocal = !isSupabaseConfigured()
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado. Solo administradores pueden eliminar productos.' }

  if (isLocal) {
    const db = readLocalDB()
    db.products = db.products.filter(p => p.id !== id)
    db.movements = db.movements.filter(m => m.producto_id !== id)
    writeLocalDB(db)

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/productos')
    return { success: true }
  }

  // --- Supabase DB ---
  const supabase = await createClient()
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
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado. Solo administradores pueden editar productos.' }

  if (isLocal) {
    const db = readLocalDB()
    const productIndex = db.products.findIndex((p) => p.id === id)
    if (productIndex === -1) {
      return { success: false, error: 'Producto no encontrado.' }
    }

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

  // --- Supabase DB ---
  const supabase = await createClient()

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
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado.' }

  if (isLocal) {
    const db = readLocalDB()
    const u = db.users.find((usr) => usr.id === userId)
    if (u) {
      u.approved = true
      writeLocalDB(db)
    }

    revalidatePath('/dashboard/solicitudes')
    return { success: true }
  }

  // --- Supabase DB ---
  const supabase = await createClient()
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
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado.' }

  if (isLocal) {
    const db = readLocalDB()
    db.users = db.users.filter((usr) => usr.id !== userId)
    writeLocalDB(db)

    revalidatePath('/dashboard/solicitudes')
    return { success: true }
  }

  // --- Supabase DB ---
  const supabase = await createClient()
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
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }

  if (isLocal) {
    const db = readLocalDB()
    
    for (const item of formData.items) {
      const product = db.products.find((p) => p.id === item.producto_id)
      if (!product) return { success: false, error: 'Uno de los productos seleccionados no existe.' }
    }

    db.requests = db.requests || []
    db.requests.push({
      id: 'req_' + Math.random().toString(36).substr(2, 9),
      items: formData.items,
      motivo: formData.motivo.trim(),
      usuario_id: user.id,
      estado: 'Pendiente',
      fecha: new Date().toISOString()
    })

    writeLocalDB(db)

    revalidatePath('/dashboard')
    return { success: true }
  }

  // --- Supabase DB ---
  const supabase = await createClient()
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
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado. Solo administradores pueden aprobar solicitudes.' }

  if (isLocal) {
    const db = readLocalDB()
    const request = db.requests?.find((r) => r.id === requestId)
    if (!request) return { success: false, error: 'Solicitud no encontrada.' }
    if (request.estado !== 'Pendiente') return { success: false, error: 'La solicitud ya fue procesada.' }

    for (const item of request.items) {
      const product = db.products.find((p) => p.id === item.producto_id)
      if (!product) return { success: false, error: 'Producto no encontrado.' }
      if (product.cajas < item.cantidad) {
        return { success: false, error: `Stock insuficiente para ${product.nombre} (Solicitado: ${item.cantidad} cajas, Disponible: ${product.cajas} cajas).` }
      }
    }

    const requestUser = db.users.find(u => u.id === request.usuario_id)
    const requesterName = requestUser ? requestUser.fullName : 'Almacenista'

    for (const item of request.items) {
      const product = db.products.find((p) => p.id === item.producto_id)!
      product.cajas -= item.cantidad
      product.cantidad = product.cajas * product.unidades_por_caja
      product.fecha_actualizacion = new Date().toISOString()

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

    request.estado = 'Aprobado'
    writeLocalDB(db)

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/solicitudes')
    return { success: true }
  }

  // --- Supabase DB ---
  const supabase = await createClient()

  const { data: request, error: fetchErr } = await supabase
    .from('requests')
    .select('items, motivo, usuario_id')
    .eq('id', requestId)
    .single()

  if (fetchErr || !request) return { success: false, error: 'Solicitud no encontrada.' }

  const items = request.items as { producto_id: string; cantidad: number }[]

  // Verify stock
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

  // Set request to Approved
  const { error: reqError } = await supabase
    .from('requests')
    .update({ estado: 'Aprobado' })
    .eq('id', requestId)

  if (reqError) return { success: false, error: reqError.message }

  // Fetch requester name
  const { data: requester } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', request.usuario_id)
    .single()

  const requesterName = requester?.full_name || 'Almacenista'

  // Insert movements
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
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado. Solo administradores pueden rechazar solicitudes.' }

  if (isLocal) {
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

  // --- Supabase DB ---
  const supabase = await createClient()
  const { error } = await supabase
    .from('requests')
    .update({ estado: 'Rechazado' })
    .eq('id', requestId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/solicitudes')
  return { success: true }
}

export async function updateUserPassword(userId: string, newPassword: string) {
  const isLocal = !isSupabaseConfigured()
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado. Solo administradores pueden cambiar claves.' }

  if (isLocal) {
    const db = readLocalDB()
    const targetUser = db.users.find((u) => u.id === userId)
    if (!targetUser) return { success: false, error: 'Usuario no encontrado.' }

    targetUser.password = newPassword.trim()
    writeLocalDB(db)

    revalidatePath('/dashboard/solicitudes')
    return { success: true }
  }

  // --- Supabase DB ---
  const supabase = await createClient()
  const crypto = require('crypto')
  const newHash = crypto.createHash('sha256').update(newPassword.trim()).digest('hex')

  const { error } = await supabase
    .from('profiles')
    .update({ password_hash: newHash })
    .eq('id', userId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/solicitudes')
  return { success: true }
}

export async function createProductsBulk(productsList: {
  codigo: string;
  nombre: string;
  marca: string;
  color: string;
  capacidad: string;
  descripcion?: string;
  unidades_por_caja: number;
}[]) {
  const isLocal = !isSupabaseConfigured()
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado.' }

  // Validate
  for (const p of productsList) {
    if (!p.codigo || !p.nombre || !p.marca || !p.color || !p.capacidad) {
      return { success: false, error: 'Datos de productos incompletos.' }
    }
  }

  if (isLocal) {
    const db = readLocalDB()
    const existingCodigos = new Set(db.products.map((prod) => prod.codigo.toUpperCase()))
    const newProducts = []

    for (const p of productsList) {
      const cleanCodigo = p.codigo.trim().toUpperCase()
      if (existingCodigos.has(cleanCodigo)) continue

      newProducts.push({
        id: 'prod_' + Math.random().toString(36).substr(2, 9),
        codigo: cleanCodigo,
        nombre: p.nombre.trim(),
        marca: p.marca.trim(),
        color: p.color.trim(),
        capacidad: p.capacidad.trim(),
        descripcion: p.descripcion?.trim() || '',
        cajas: 0,
        unidades_por_caja: p.unidades_por_caja || 20,
        cantidad: 0,
        fecha_creacion: new Date().toISOString(),
        fecha_actualizacion: new Date().toISOString()
      })
      existingCodigos.add(cleanCodigo)
    }

    db.products.push(...newProducts)
    writeLocalDB(db)

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/productos')
    return { success: true, count: newProducts.length }
  }

  // --- Supabase DB ---
  const supabase = await createClient()
  const rows = productsList.map((p) => ({
    codigo: p.codigo.trim().toUpperCase(),
    nombre: p.nombre.trim(),
    marca: p.marca.trim(),
    color: p.color.trim(),
    capacidad: p.capacidad.trim(),
    descripcion: p.descripcion?.trim() || '',
    cajas: 0,
    unidades_por_caja: p.unidades_por_caja || 20,
    cantidad: 0
  }))

  // Filter local duplicates
  const codigosToInsert = rows.map((r) => r.codigo)
  const { data: existing } = await supabase
    .from('products')
    .select('codigo')
    .in('codigo', codigosToInsert)

  const existingSet = new Set(existing?.map((e) => e.codigo.toUpperCase()) || [])
  const filteredRows = rows.filter((r) => !existingSet.has(r.codigo))

  if (filteredRows.length === 0) {
    return { success: true, count: 0, message: 'Todos los productos ya existían en la base de datos.' }
  }

  const { error } = await supabase
    .from('products')
    .insert(filteredRows)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/productos')
  return { success: true, count: filteredRows.length }
}
