import fs from 'fs'
import path from 'path'

const DB_PATH = process.env.VERCEL
  ? path.join('/tmp', 'db.json')
  : path.join(process.cwd(), 'db.json')

export interface LocalUser {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: 'admin' | 'empleado';
  approved: boolean; // Admin approval flag
}

export interface LocalProduct {
  id: string;
  codigo: string;
  nombre: string;
  marca: string;
  color: string;
  capacidad: string; // e.g. "8+256GB"
  descripcion?: string;
  cajas: number;
  unidades_por_caja: number;
  cantidad: number; // Total units: cajas * unidades_por_caja
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface LocalRequestItem {
  producto_id: string;
  cantidad: number; // in boxes
}

export interface LocalRequest {
  id: string;
  items: LocalRequestItem[];
  motivo: string;
  usuario_id: string;
  estado: 'Pendiente' | 'Aprobado' | 'Rechazado';
  fecha: string;
}

export interface LocalDB {
  users: LocalUser[];
  products: LocalProduct[];
  movements: LocalMovement[];
  requests: LocalRequest[];
}

export interface LocalMovement {
  id: string;
  producto_id: string;
  cantidad: number; // Quantity in boxes
  tipo: 'Entrada' | 'Salida';
  motivo: string;
  usuario_id: string;
  fecha: string;
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!(url && key && !url.includes('your-project') && !key.includes('your-anon-key'))
}

export function readLocalDB(): LocalDB {
  if (!fs.existsSync(DB_PATH)) {
    const initialDB: LocalDB = {
      users: [],
      products: [
        {
          id: '1-test',
          codigo: 'KPT-15PM-N',
          nombre: 'iPhone 15 Pro Max',
          marca: 'Apple',
          color: 'Titanio Negro',
          capacidad: '8+256GB',
          descripcion: 'Celular importado original',
          cajas: 5,
          unidades_por_caja: 10,
          cantidad: 50,
          fecha_creacion: new Date().toISOString(),
          fecha_actualizacion: new Date().toISOString()
        },
        {
          id: '2-test',
          codigo: 'KPT-15PM-T',
          nombre: 'iPhone 15 Pro Max',
          marca: 'Apple',
          color: 'Titanio Natural',
          capacidad: '8+256GB',
          descripcion: 'Celular importado original',
          cajas: 2,
          unidades_por_caja: 10,
          cantidad: 20,
          fecha_creacion: new Date().toISOString(),
          fecha_actualizacion: new Date().toISOString()
        },
        {
          id: '3-test',
          codigo: 'KPT-S24U-G',
          nombre: 'Samsung Galaxy S24 Ultra',
          marca: 'Samsung',
          color: 'Titanio Gris',
          capacidad: '12+512GB',
          descripcion: 'Celular con S-Pen',
          cajas: 3,
          unidades_por_caja: 10,
          cantidad: 30,
          fecha_creacion: new Date().toISOString(),
          fecha_actualizacion: new Date().toISOString()
        }
      ],
      movements: [],
      requests: []
    }
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2), 'utf-8')
    } catch (e) {
      console.error('No se pudo crear db.json (entorno de solo lectura?):', e)
    }
    return initialDB
  }
  
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8')
    const parsed = JSON.parse(data)
    return {
      users: parsed.users || [],
      products: parsed.products || [],
      movements: parsed.movements || [],
      requests: parsed.requests || []
    }
  } catch (e) {
    console.error('Error reading local JSON DB:', e)
    return { users: [], products: [], movements: [], requests: [] }
  }
}

export function writeLocalDB(db: LocalDB) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8')
  } catch (e) {
    console.error('Error writing local JSON DB:', e)
  }
}
