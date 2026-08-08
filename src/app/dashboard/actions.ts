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

/** Helper to update stock (boxes, loose units, and total quantity) */
function updateProductStock(
  product: {
    cajas: number;
    unidades_por_caja: number;
    unidades_sueltas?: number;
    cantidad: number;
    fecha_actualizacion?: string;
  },
  cantidad: number,
  unidadMedida: 'cajas' | 'unidades' = 'cajas',
  tipo: 'Entrada' | 'Salida' = 'Entrada'
) {
  const unitsPerBox = product.unidades_por_caja || 20
  const deltaUnits = unidadMedida === 'unidades' ? cantidad : cantidad * unitsPerBox
  const change = tipo === 'Entrada' ? deltaUnits : -deltaUnits
  
  const currentTotalUnits = product.cantidad ?? (product.cajas * unitsPerBox + (product.unidades_sueltas || 0))
  const newTotalUnits = Math.max(0, currentTotalUnits + change)
  
  product.cantidad = newTotalUnits
  product.cajas = Math.floor(newTotalUnits / unitsPerBox)
  product.unidades_sueltas = newTotalUnits % unitsPerBox
  product.fecha_actualizacion = new Date().toISOString()
}

export async function createProduct(formData: {
  codigo: string;
  nombre: string;
  marca: string;
  color?: string;
  capacidad?: string;
  descripcion?: string;
  unidades_por_caja: number;
}) {
  const isLocal = !isSupabaseConfigured()
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado. Solo administradores pueden agregar productos.' }

  const colorVal = formData.color?.trim() || 'N/A'
  const capacidadVal = formData.capacidad?.trim() || 'N/A'

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
      color: colorVal,
      capacidad: capacidadVal,
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
      color: colorVal,
      capacidad: capacidadVal,
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
  unidad_medida?: 'cajas' | 'unidades';
  tipo: 'Entrada' | 'Salida';
  motivo: string;
}) {
  const isLocal = !isSupabaseConfigured()
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado. Solo administradores pueden registrar movimientos.' }

  const unidadMedida = formData.unidad_medida || 'cajas'

  if (isLocal) {
    const db = readLocalDB()
    const product = db.products.find((p) => p.id === formData.producto_id)
    if (!product) {
      return { success: false, error: 'Producto no encontrado.' }
    }

    const unitsPerBox = product.unidades_por_caja || 20
    const deltaUnits = unidadMedida === 'unidades' ? formData.cantidad : formData.cantidad * unitsPerBox
    const currentTotalUnits = product.cantidad ?? (product.cajas * unitsPerBox + (product.unidades_sueltas || 0))

    if (formData.tipo === 'Salida') {
      if (currentTotalUnits < deltaUnits) {
        return { success: false, error: `Stock insuficiente para realizar la salida. Disponible: ${currentTotalUnits} celulares (${product.cajas} cajas y ${product.unidades_sueltas || 0} uds sueltas).` }
      }
    }

    updateProductStock(product, formData.cantidad, unidadMedida, formData.tipo)

    const newMovement = {
      id: 'mov_' + Math.random().toString(36).substr(2, 9),
      producto_id: formData.producto_id,
      cantidad: formData.cantidad,
      unidad_medida: unidadMedida,
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
        unidad_medida: newMovement.unidad_medida,
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
      unidad_medida: unidadMedida,
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
  items: { producto_id: string; cantidad: number; unidad_medida?: 'cajas' | 'unidades' }[];
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

      const unidadMedida = item.unidad_medida || 'cajas'
      const unitsPerBox = product.unidades_por_caja || 20
      const deltaUnits = unidadMedida === 'unidades' ? item.cantidad : item.cantidad * unitsPerBox
      const currentTotalUnits = product.cantidad ?? (product.cajas * unitsPerBox + (product.unidades_sueltas || 0))

      if (formData.tipo === 'Salida') {
        if (currentTotalUnits < deltaUnits) {
          const reqStr = unidadMedida === 'unidades' ? `${item.cantidad} unidades` : `${item.cantidad} cajas (${deltaUnits} unidades)`
          return { success: false, error: `Stock insuficiente para ${product.nombre} (Solicitado: ${reqStr}, Disponible: ${currentTotalUnits} celulares).` }
        }
      }

      updateProductStock(product, item.cantidad, unidadMedida, formData.tipo)

      db.movements.push({
        id: 'mov_' + Math.random().toString(36).substr(2, 9),
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        unidad_medida: unidadMedida,
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
        unidad_medida: unidadMedida,
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

    const unidadMedida = item.unidad_medida || 'cajas'

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
      unidad_medida: unidadMedida,
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

export async function updateProduct(
  id: string,
  formData: {
    codigo: string;
    nombre: string;
    marca: string;
    color?: string;
    capacidad?: string;
    descripcion?: string;
    unidades_por_caja: number;
  }
) {
  const isLocal = !isSupabaseConfigured()
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado. Solo administradores pueden editar productos.' }

  const colorVal = formData.color?.trim() || 'N/A'
  const capacidadVal = formData.capacidad?.trim() || 'N/A'

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
    p.color = colorVal
    p.capacidad = capacidadVal
    p.descripcion = formData.descripcion?.trim()
    p.unidades_por_caja = formData.unidades_por_caja
    p.cajas = Math.floor((p.cantidad || 0) / formData.unidades_por_caja)
    p.unidades_sueltas = (p.cantidad || 0) % formData.unidades_por_caja
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
      color: colorVal,
      capacidad: capacidadVal,
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
  items: { producto_id: string; cantidad: number; unidad_medida?: 'cajas' | 'unidades' }[];
  motivo: string;
  tipo?: 'Entrada' | 'Salida';
}) {
  const isLocal = !isSupabaseConfigured()
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }

  const tipo = formData.tipo || 'Salida'

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
      tipo,
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
      estado: 'Pendiente',
      tipo
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

    const isEntrada = request.tipo === 'Entrada'

    if (!isEntrada) {
      for (const item of request.items) {
        const product = db.products.find((p) => p.id === item.producto_id)
        if (!product) return { success: false, error: 'Producto no encontrado.' }
        
        const unidadMedida = item.unidad_medida || 'cajas'
        const unitsPerBox = product.unidades_por_caja || 20
        const deltaUnits = unidadMedida === 'unidades' ? item.cantidad : item.cantidad * unitsPerBox
        const currentTotalUnits = product.cantidad ?? (product.cajas * unitsPerBox + (product.unidades_sueltas || 0))

        if (currentTotalUnits < deltaUnits) {
          return { 
            success: false, 
            error: `Stock insuficiente para ${product.nombre} (Solicitado: ${item.cantidad} ${unidadMedida === 'unidades' ? 'unidades' : 'cajas'}, Disponible: ${currentTotalUnits} celulares).` 
          }
        }
      }
    }

    const requestUser = db.users.find(u => u.id === request.usuario_id)
    const requesterName = requestUser ? requestUser.fullName : 'Almacenista'

    for (const item of request.items) {
      const product = db.products.find((p) => p.id === item.producto_id)!
      const unidadMedida = item.unidad_medida || 'cajas'

      updateProductStock(product, item.cantidad, unidadMedida, isEntrada ? 'Entrada' : 'Salida')

      db.movements.push({
        id: 'mov_' + Math.random().toString(36).substr(2, 9),
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        unidad_medida: unidadMedida,
        tipo: isEntrada ? 'Entrada' : 'Salida',
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
    .select('items, motivo, usuario_id, tipo')
    .eq('id', requestId)
    .single()

  if (fetchErr || !request) return { success: false, error: 'Solicitud no encontrada.' }

  const items = request.items as { producto_id: string; cantidad: number }[]
  const isEntrada = request.tipo === 'Entrada'

  // Verify stock for Salidas
  if (!isEntrada) {
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
        tipo: isEntrada ? 'Entrada' : 'Salida',
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
    if (!p.codigo || !p.nombre || !p.marca) {
      return { success: false, error: 'Datos de productos incompletos (código, nombre y marca son requeridos).' }
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
        color: p.color?.trim() || 'N/A',
        capacidad: p.capacidad?.trim() || 'N/A',
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
    color: p.color?.trim() || 'N/A',
    capacidad: p.capacidad?.trim() || 'N/A',
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

export async function exportFullBackup() {
  const isLocal = !isSupabaseConfigured()
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado. Solo administradores pueden exportar respaldos.' }

  const exportedAt = new Date().toISOString()

  if (isLocal) {
    const db = readLocalDB()
    const backup = {
      app: 'Almacén Casita',
      version: '1.0',
      exportedAt,
      mode: 'local',
      stats: {
        productsCount: db.products?.length || 0,
        movementsCount: db.movements?.length || 0,
        requestsCount: db.requests?.length || 0,
        usersCount: db.users?.length || 0,
      },
      data: {
        products: db.products || [],
        movements: db.movements || [],
        requests: db.requests || [],
        users: (db.users || []).map((u) => ({
          id: u.id,
          username: u.username,
          fullName: u.fullName,
          role: u.role,
          approved: u.approved,
        })),
      },
    }
    return { success: true, backup }
  }

  // --- Supabase DB ---
  const supabase = await createClient()

  const [
    { data: products, error: prodErr },
    { data: movements, error: movErr },
    { data: requests, error: reqErr },
    { data: profiles, error: profErr },
  ] = await Promise.all([
    supabase.from('products').select('*'),
    supabase.from('movements').select('*'),
    supabase.from('requests').select('*'),
    supabase.from('profiles').select('*'),
  ])

  if (prodErr || movErr || reqErr || profErr) {
    return {
      success: false,
      error:
        prodErr?.message ||
        movErr?.message ||
        reqErr?.message ||
        profErr?.message ||
        'Error consultando datos de Supabase',
    }
  }

  const backup = {
    app: 'Almacén Casita',
    version: '1.0',
    exportedAt,
    mode: 'supabase',
    stats: {
      productsCount: products?.length || 0,
      movementsCount: movements?.length || 0,
      requestsCount: requests?.length || 0,
      usersCount: profiles?.length || 0,
    },
    data: {
      products: products || [],
      movements: movements || [],
      requests: requests || [],
      users: profiles || [],
    },
  }

  return { success: true, backup }
}

export async function restoreFullBackup(backupContent: {
  data?: {
    products?: any[];
    movements?: any[];
    requests?: any[];
    users?: any[];
  };
}) {
  const isLocal = !isSupabaseConfigured()
  const cookieStore = await cookies()
  const user = getSessionUser(cookieStore)
  if (!user) return { success: false, error: 'No autenticado' }
  if (user.role !== 'admin') return { success: false, error: 'No autorizado. Solo administradores pueden restaurar respaldos.' }

  if (!backupContent || !backupContent.data) {
    return { success: false, error: 'Estructura de archivo de respaldo no válida.' }
  }

  const { products = [], movements = [], requests = [], users = [] } = backupContent.data

  if (isLocal) {
    const currentDb = readLocalDB()

    // Build map for existing users to preserve passwords if not included in backup
    const existingUsersMap = new Map(currentDb.users.map((u) => [u.id, u]))

    const restoredUsers = users.map((u: any) => {
      const existing = existingUsersMap.get(u.id) || currentDb.users.find(x => x.username === u.username)
      return {
        id: u.id || existing?.id || 'usr_' + Math.random().toString(36).substr(2, 9),
        username: u.username,
        fullName: u.fullName || u.full_name || u.username,
        role: u.role || 'empleado',
        approved: u.approved !== undefined ? u.approved : true,
        password: existing?.password || '123456',
      }
    })

    // If no users in backup, keep current users
    const finalUsers = restoredUsers.length > 0 ? restoredUsers : currentDb.users

    const newDb = {
      users: finalUsers,
      products: products,
      movements: movements,
      requests: requests,
    }

    writeLocalDB(newDb)

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/productos')
    revalidatePath('/dashboard/movimientos')
    revalidatePath('/dashboard/solicitudes')
    revalidatePath('/dashboard/respaldos')

    return {
      success: true,
      stats: {
        products: products.length,
        movements: movements.length,
        requests: requests.length,
        users: finalUsers.length,
      },
    }
  }

  // --- Supabase DB ---
  const supabase = await createClient()

  // Clean and upsert products
  if (products.length > 0) {
    const { error: pErr } = await supabase.from('products').upsert(products)
    if (pErr) return { success: false, error: 'Error al restaurar productos: ' + pErr.message }
  }

  // Upsert requests
  if (requests.length > 0) {
    const { error: rErr } = await supabase.from('requests').upsert(requests)
    if (rErr) return { success: false, error: 'Error al restaurar solicitudes: ' + rErr.message }
  }

  // Upsert movements
  if (movements.length > 0) {
    const { error: mErr } = await supabase.from('movements').upsert(movements)
    if (mErr) return { success: false, error: 'Error al restaurar movimientos: ' + mErr.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/productos')
  revalidatePath('/dashboard/movimientos')
  revalidatePath('/dashboard/solicitudes')
  revalidatePath('/dashboard/respaldos')

  return {
    success: true,
    stats: {
      products: products.length,
      movements: movements.length,
      requests: requests.length,
      users: users.length,
    },
  }
}

