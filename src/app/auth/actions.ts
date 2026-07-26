'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { isSupabaseConfigured, readLocalDB, writeLocalDB } from '@/lib/db'
import crypto from 'crypto'

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function login(state: unknown, formData: { username: string; password?: string }) {
  const isLocal = !isSupabaseConfigured()

  if (isLocal) {
    const db = readLocalDB()
    const user = db.users.find(
      (u) => 
        u.username.toLowerCase() === formData.username.trim().toLowerCase() && 
        u.password === (formData.password || '')
    )

    if (!user) {
      return { success: false, error: 'Usuario o contraseña incorrectos.' }
    }

    if (!user.approved) {
      return { success: false, error: 'Tu cuenta está pendiente de aprobación por el administrador.' }
    }

    const cookieStore = await cookies()
    cookieStore.set('local_session_user', JSON.stringify({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role
    }), {
      path: '/',
      httpOnly: true,
      maxAge: 60 * 60 * 24 // 1 day
    })

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  }

  // --- Auth custom contra Supabase DB ---
  const supabase = await createClient()
  const username = formData.username.trim().toLowerCase()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, password_hash, full_name, role, approved')
    .eq('username', username)
    .single()

  if (!profile) {
    return { success: false, error: 'Usuario o contraseña incorrectos.' }
  }

  const inputHash = hashPassword(formData.password || '')
  if (profile.password_hash !== inputHash) {
    return { success: false, error: 'Usuario o contraseña incorrectos.' }
  }

  if (!profile.approved) {
    return { success: false, error: 'Tu cuenta está pendiente de aprobación por el administrador.' }
  }

  const cookieStore = await cookies()
  cookieStore.set('local_session_user', JSON.stringify({
    id: profile.id,
    username: profile.username,
    fullName: profile.full_name,
    role: profile.role
  }), {
    path: '/',
    httpOnly: true,
    maxAge: 60 * 60 * 24
  })

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(
  state: unknown, 
  formData: { username: string; password?: string; fullName: string; role: 'admin' | 'empleado' }
) {
  const isLocal = !isSupabaseConfigured()

  if (isLocal) {
    const db = readLocalDB()
    const exists = db.users.some(
      (u) => u.username.toLowerCase() === formData.username.trim().toLowerCase()
    )

    if (exists) {
      return { success: false, error: 'El nombre de usuario ya está registrado.' }
    }

    const approved = formData.role === 'admin'

    const newUser = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      username: formData.username.trim(),
      password: formData.password || '',
      fullName: formData.fullName.trim(),
      role: formData.role,
      approved
    }

    db.users.push(newUser)
    writeLocalDB(db)

    if (!approved) {
      return { 
        success: true, 
        isPendingApproval: true, 
        message: 'Registro enviado. Tu cuenta está pendiente de aprobación por el administrador.' 
      }
    }

    const cookieStore = await cookies()
    cookieStore.set('local_session_user', JSON.stringify({
      id: newUser.id,
      username: newUser.username,
      fullName: newUser.fullName,
      role: newUser.role
    }), {
      path: '/',
      httpOnly: true,
      maxAge: 60 * 60 * 24
    })

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  }

  // --- Auth custom contra Supabase DB ---
  const supabase = await createClient()
  const username = formData.username.trim().toLowerCase()

  // Check if username exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single()

  if (existing) {
    return { success: false, error: 'El nombre de usuario ya está registrado.' }
  }

  const approved = formData.role === 'admin'
  const password_hash = hashPassword(formData.password || '')

  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert({
      username,
      password_hash,
      full_name: formData.fullName.trim(),
      role: formData.role,
      approved
    })
    .select('id, username, full_name, role')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  if (!approved) {
    return { 
      success: true, 
      isPendingApproval: true, 
      message: 'Registro enviado. Tu cuenta está pendiente de aprobación por el administrador.' 
    }
  }

  const cookieStore = await cookies()
  cookieStore.set('local_session_user', JSON.stringify({
    id: newProfile.id,
    username: newProfile.username,
    fullName: newProfile.full_name,
    role: newProfile.role
  }), {
    path: '/',
    httpOnly: true,
    maxAge: 60 * 60 * 24
  })

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('local_session_user')
  revalidatePath('/', 'layout')
  redirect('/login')
}
