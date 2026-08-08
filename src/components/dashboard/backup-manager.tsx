'use client'

import React, { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { exportFullBackup, restoreFullBackup } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Package,
  History,
  FileText,
  Users,
} from 'lucide-react'

interface BackupManagerProps {
  initialStats: {
    productsCount: number
    movementsCount: number
    requestsCount: number
    usersCount: number
    dbMode: 'local' | 'supabase'
  }
}

export default function BackupManager({ initialStats }: BackupManagerProps) {
  const [isPending, startTransition] = useTransition()
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null)

  // Restore Modal State
  const [restoreModalOpen, setRestoreModalOpen] = useState(false)
  const [parsedBackupData, setParsedBackupData] = useState<any>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>('')

  // Handle Export Full JSON Backup
  const handleExportJSON = () => {
    startTransition(async () => {
      try {
        const res = await exportFullBackup()
        if (!res.success || !res.backup) {
          toast.error(res.error || 'Error al generar la copia de seguridad.')
          return
        }

        const jsonString = JSON.stringify(res.backup, null, 2)
        const blob = new Blob([jsonString], { type: 'application/json' })
        const url = URL.createObjectURL(blob)

        const dateStr = new Date().toISOString().slice(0, 10)
        const link = document.createElement('a')
        link.href = url
        link.download = `backup_almacen_casita_${dateStr}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        setLastBackupDate(new Date().toLocaleString())
        toast.success('¡Copia de seguridad (JSON) descargada con éxito!')
      } catch (err: any) {
        toast.error('Error inesperado al exportar respaldo: ' + err.message)
      }
    })
  }

  // Handle Export Products CSV
  const handleExportProductsCSV = () => {
    startTransition(async () => {
      try {
        const res = await exportFullBackup()
        if (!res.success || !res.backup) {
          toast.error('No se pudieron obtener los datos para el reporte.')
          return
        }

        const products = res.backup.data.products || []
        if (products.length === 0) {
          toast.info('No hay productos registrados para exportar.')
          return
        }

        const headers = [
          'Código',
          'Nombre',
          'Marca',
          'Color',
          'Capacidad',
          'Cajas',
          'Unidades Por Caja',
          'Unidades Sueltas',
          'Cantidad Total',
          'Fecha Creación',
        ]

        const rows = products.map((p: any) => [
          `"${p.codigo || ''}"`,
          `"${(p.nombre || '').replace(/"/g, '""')}"`,
          `"${(p.marca || '').replace(/"/g, '""')}"`,
          `"${(p.color || '').replace(/"/g, '""')}"`,
          `"${(p.capacidad || '').replace(/"/g, '""')}"`,
          p.cajas ?? 0,
          p.unidades_por_caja ?? 0,
          p.unidades_sueltas ?? 0,
          p.cantidad ?? 0,
          `"${p.fecha_creacion || ''}"`,
        ])

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)

        const dateStr = new Date().toISOString().slice(0, 10)
        const link = document.createElement('a')
        link.href = url
        link.download = `inventario_almacen_casita_${dateStr}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast.success('Reporte de productos en CSV descargado.')
      } catch (err: any) {
        toast.error('Error al exportar CSV: ' + err.message)
      }
    })
  }

  // Handle Export Movements CSV
  const handleExportMovementsCSV = () => {
    startTransition(async () => {
      try {
        const res = await exportFullBackup()
        if (!res.success || !res.backup) {
          toast.error('No se pudieron obtener los datos para el reporte.')
          return
        }

        const movements = res.backup.data.movements || []
        if (movements.length === 0) {
          toast.info('No hay movimientos registrados para exportar.')
          return
        }

        const headers = ['ID', 'Fecha', 'Tipo', 'Cantidad', 'Unidad Medida', 'Motivo', 'Producto ID', 'Usuario ID']

        const rows = movements.map((m: any) => [
          `"${m.id || ''}"`,
          `"${m.fecha || ''}"`,
          `"${m.tipo || ''}"`,
          m.cantidad ?? 0,
          `"${m.unidad_medida || 'cajas'}"`,
          `"${(m.motivo || '').replace(/"/g, '""')}"`,
          `"${m.producto_id || ''}"`,
          `"${m.usuario_id || ''}"`,
        ])

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)

        const dateStr = new Date().toISOString().slice(0, 10)
        const link = document.createElement('a')
        link.href = url
        link.download = `movimientos_almacen_casita_${dateStr}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        toast.success('Reporte de movimientos en CSV descargado.')
      } catch (err: any) {
        toast.error('Error al exportar CSV: ' + err.message)
      }
    })
  }

  // Handle File Select for Restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFileName(file.name)
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const parsed = JSON.parse(text)

        if (!parsed || (!parsed.data && !parsed.products)) {
          toast.error('El archivo JSON seleccionado no tiene un formato válido de respaldo.')
          return
        }

        // Normalize if raw db object was uploaded
        const normalizedData = parsed.data || {
          products: parsed.products || [],
          movements: parsed.movements || [],
          requests: parsed.requests || [],
          users: parsed.users || [],
        }

        setParsedBackupData({
          ...parsed,
          data: normalizedData,
        })
        setRestoreModalOpen(true)
      } catch (err) {
        toast.error('Error al leer el archivo JSON. Verifique la sintaxis.')
      }
    }

    reader.readAsText(file)
    // Reset file input value so same file can be chosen again if needed
    e.target.value = ''
  }

  // Confirm Restore
  const confirmRestore = () => {
    if (!parsedBackupData) return

    startTransition(async () => {
      try {
        const res = await restoreFullBackup(parsedBackupData)
        if (!res.success) {
          toast.error(res.error || 'Error al restaurar la copia de seguridad.')
          return
        }

        setRestoreModalOpen(false)
        setParsedBackupData(null)
        toast.success(
          `¡Base de datos restaurada! (${res.stats?.products} productos, ${res.stats?.movements} movimientos, ${res.stats?.requests} solicitudes).`
        )
      } catch (err: any) {
        toast.error('Error inesperado durante la restauración: ' + err.message)
      }
    })
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/90 border border-zinc-800 p-6 rounded-2xl shadow-xl backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Centro de Respaldos & Copias de Seguridad</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Exporta la base de datos completa de Almacén Casita o restaura copias anteriores.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`px-3 py-1 font-mono text-xs uppercase flex items-center gap-1.5 ${
              initialStats.dbMode === 'supabase'
                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Modo: {initialStats.dbMode === 'supabase' ? 'Supabase Postgres' : 'Local JSON'}
          </Badge>
        </div>
      </div>

      {/* Database Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-400">Productos Registrados</p>
              <h3 className="text-lg font-bold text-zinc-100">{initialStats.productsCount}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-400">Movimientos</p>
              <h3 className="text-lg font-bold text-zinc-100">{initialStats.movementsCount}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-400">Solicitudes Totales</p>
              <h3 className="text-lg font-bold text-zinc-100">{initialStats.requestsCount}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/60 border-zinc-800">
          <CardContent className="p-4 flex items-center space-x-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-zinc-400">Usuarios / Cuentas</p>
              <h3 className="text-lg font-bold text-zinc-100">{initialStats.usersCount}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Backup Card */}
        <Card className="bg-zinc-900/80 border-zinc-800 shadow-lg flex flex-col justify-between">
          <CardHeader>
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 mb-2">
              <Download className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg font-semibold text-zinc-100">Exportar Copia de Seguridad</CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Genera un archivo `.json` completo con todos los productos, movimientos, solicitudes y usuarios del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleExportJSON}
              disabled={isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-2 h-11"
            >
              {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Descargar Backup Completo (JSON)
            </Button>

            {lastBackupDate && (
              <p className="text-[11px] text-zinc-500 text-center flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Última descarga: {lastBackupDate}
              </p>
            )}

            <div className="pt-4 border-t border-zinc-800 space-y-2">
              <span className="text-xs font-semibold text-zinc-300 block">Exportación Rápida a Excel/CSV:</span>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportProductsCSV}
                  disabled={isPending}
                  className="border-zinc-700 bg-zinc-950/40 hover:bg-zinc-800 text-zinc-300 text-xs gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  Inventario (.csv)
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportMovementsCSV}
                  disabled={isPending}
                  className="border-zinc-700 bg-zinc-950/40 hover:bg-zinc-800 text-zinc-300 text-xs gap-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
                  Movimientos (.csv)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Restore Backup Card */}
        <Card className="bg-zinc-900/80 border-zinc-800 shadow-lg flex flex-col justify-between">
          <CardHeader>
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 mb-2">
              <Upload className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg font-semibold text-zinc-100">Restaurar Copia de Seguridad</CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Selecciona un archivo `.json` previo para restaurar los datos del inventario.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-zinc-700 hover:border-emerald-500/50 bg-zinc-950/50 rounded-xl p-6 text-center transition-colors">
              <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
              <p className="text-xs text-zinc-300 font-medium">Haz clic aquí para seleccionar el archivo `.json`</p>
              <p className="text-[10px] text-zinc-500 mt-1">Archivos de respaldo soportados: backup_almacen_casita_*.json</p>
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                disabled={isPending}
                className="hidden"
                id="backup-file-input"
              />
              <label
                htmlFor="backup-file-input"
                className="mt-3 inline-block cursor-pointer px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-700 transition-colors"
              >
                Seleccionar Archivo
              </label>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-lg flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-200/90 leading-tight">
                <strong>Advertencia:</strong> Restaurar un respaldo actualizará el inventario actual con la información guardada en el archivo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Preview & Confirmation for Restore */}
      <Dialog open={restoreModalOpen} onOpenChange={setRestoreModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Restauración de Datos
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Se han detectado los siguientes datos dentro del archivo: <strong className="text-zinc-200">{selectedFileName}</strong>
            </DialogDescription>
          </DialogHeader>

          {parsedBackupData && (
            <div className="space-y-3 bg-zinc-950/70 border border-zinc-800 p-4 rounded-xl text-xs">
              {parsedBackupData.exportedAt && (
                <p className="text-zinc-400">
                  Fecha de creación del respaldo:{' '}
                  <span className="text-zinc-200 font-mono">
                    {new Date(parsedBackupData.exportedAt).toLocaleString()}
                  </span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
                <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">Productos</span>
                  <span className="font-semibold text-emerald-400 text-sm">
                    {parsedBackupData.data?.products?.length || 0}
                  </span>
                </div>
                <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">Movimientos</span>
                  <span className="font-semibold text-purple-400 text-sm">
                    {parsedBackupData.data?.movements?.length || 0}
                  </span>
                </div>
                <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">Solicitudes</span>
                  <span className="font-semibold text-amber-400 text-sm">
                    {parsedBackupData.data?.requests?.length || 0}
                  </span>
                </div>
                <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[10px]">Usuarios</span>
                  <span className="font-semibold text-blue-400 text-sm">
                    {parsedBackupData.data?.users?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRestoreModalOpen(false)}
              disabled={isPending}
              className="border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmRestore}
              disabled={isPending}
              className="bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs gap-1.5"
            >
              {isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Restaurar Base de Datos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
