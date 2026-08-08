import React from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isSupabaseConfigured, readLocalDB } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import BackupManager from '@/components/dashboard/backup-manager'

export const dynamic = 'force-dynamic'

export default async function RespaldosPage() {
  const isLocal = !isSupabaseConfigured()
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('local_session_user')
  const user = sessionCookie ? JSON.parse(sessionCookie.value) : null

  if (!user || user.role !== 'admin') {
    redirect('/dashboard')
  }

  let initialStats = {
    productsCount: 0,
    movementsCount: 0,
    requestsCount: 0,
    usersCount: 0,
    dbMode: (isLocal ? 'local' : 'supabase') as 'local' | 'supabase',
  }

  if (isLocal) {
    const db = readLocalDB()
    initialStats = {
      productsCount: db.products?.length || 0,
      movementsCount: db.movements?.length || 0,
      requestsCount: db.requests?.length || 0,
      usersCount: db.users?.length || 0,
      dbMode: 'local',
    }
  } else {
    const supabase = await createClient()
    const [
      { count: pCount },
      { count: mCount },
      { count: rCount },
      { count: uCount },
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('movements').select('*', { count: 'exact', head: true }),
      supabase.from('requests').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
    ])

    initialStats = {
      productsCount: pCount || 0,
      movementsCount: mCount || 0,
      requestsCount: rCount || 0,
      usersCount: uCount || 0,
      dbMode: 'supabase',
    }
  }

  return <BackupManager initialStats={initialStats} />
}
