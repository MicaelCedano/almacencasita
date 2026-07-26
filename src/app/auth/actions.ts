'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { isSupabaseConfigured, readLocalDB, writeLocalDB } from '@/lib/db'

// Helper to convert username to virtual email (for Supabase mode)
function getVirtualEmail(username: string): string {
  return `${username.trim().toLowerCase()}@almacencasita.test`
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

  // --- Real Supabase Auth ---
  const supabase = await createClient()
  const email = getVirtualEmail(formData.username)

  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password: formData.password || '',
  })

  if (error) {
    return { success: false, error: 'Usuario o contraseña incorrectos.' }
  }

  // Check if profile is approved in Supabase
  if (data?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('approved')
      .eq('id', data.user.id)
      .single()

    if (profile && !profile.approved) {
      await supabase.auth.signOut()
      return { success: false, error: 'Tu cuenta está pendiente de aprobación por el administrador.' }
    }
  }

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

    // Admins are approved automatically, employees (almacenistas) need approval
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
      maxAge: 60 * 60 * 24 // 1 day
    })

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  }

  // --- Real Supabase Auth ---
  const supabase = await createClient()
  const email = getVirtualEmail(formData.username)

  const approved = formData.role === 'admin'

  const { error } = await supabase.auth.signUp({
    email,
    password: formData.password || '',
    options: {
      data: {
        full_name: formData.fullName,
        role: formData.role,
        approved
      },
    },
  })

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

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const isLocal = !isSupabaseConfigured()

  if (isLocal) {
    const cookieStore = await cookies()
    cookieStore.delete('local_session_user')
    revalidatePath('/', 'layout')
    redirect('/login')
  }

  // --- Real Supabase Auth ---
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
