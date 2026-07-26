'use client'

import React, { useState, useTransition, useEffect, useRef } from 'react'
import { 
  approveUser, 
  deleteUser, 
  approveWithdrawalRequest, 
  rejectWithdrawalRequest,
  updateUserPassword 
} from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Check, X, FileText, MessageSquare, Download, ClipboardList, Key, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

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

interface UserRecord {
  id: string;
  username: string;
  fullName: string;
  role: 'admin' | 'empleado';
  approved: boolean;
}

interface RequestsManagerProps {
  requests: RequestRecord[];
  pendingUsers: UserRecord[];
  allUsers?: UserRecord[];
}

export default function RequestsManager({ requests, pendingUsers, allUsers = [] }: RequestsManagerProps) {
  const [activeTab, setActiveTab] = useState<'exits' | 'users' | 'all-users'>('exits')
  const [isPending, startTransition] = useTransition()

  // Voucher modal states
  const [voucherOpen, setVoucherOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<RequestRecord | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Password reset modal states
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<UserRecord | null>(null)
  const [newPassword, setNewPassword] = useState('')

  // Draw voucher helper
  useEffect(() => {
    if (voucherOpen && selectedRequest && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const itemsCount = selectedRequest.items?.length || 0
      const baseHeight = 360
      const itemsHeight = itemsCount * 22
      const canvasHeight = baseHeight + itemsHeight

      // Set canvas size (scaled for high resolution display)
      canvas.width = 500
      canvas.height = canvasHeight

      // Background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 500, canvasHeight)

      // Outer border
      ctx.strokeStyle = '#e4e4e7'
      ctx.lineWidth = 4
      ctx.strokeRect(12, 12, 476, canvasHeight - 24)

      // Header
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 24px Courier New'
      ctx.textAlign = 'center'
      ctx.fillText('ALMACEN CASITA', 250, 55)

      ctx.fillStyle = '#4b5563'
      ctx.font = '13px Courier New'
      ctx.fillText('COMPROBANTE DE ENTREGA', 250, 80)

      // Divider
      ctx.strokeStyle = '#d4d4d8'
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(30, 100)
      ctx.lineTo(470, 100)
      ctx.stroke()
      ctx.setLineDash([])

      // Metadata Info
      ctx.textAlign = 'left'
      ctx.fillStyle = '#4b5563'
      ctx.font = '12px Courier New'
      
      const dateText = new Date(selectedRequest.fecha).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      ctx.fillText(`ID VALE: ${selectedRequest.id.toUpperCase()}`, 40, 130)
      ctx.fillText(`FECHA:   ${dateText}`, 40, 150)
      ctx.fillText(`ENTREGA: ${selectedRequest.requesterName}`, 40, 170)
      ctx.fillText(`ESTADO:  APROBADO E INVENTARIADO`, 40, 190)

      // Divider before items list
      ctx.strokeStyle = '#d4d4d8'
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(30, 210)
      ctx.lineTo(470, 210)
      ctx.stroke()
      ctx.setLineDash([])

      // Draw Items Table Header
      let y = 235
      ctx.fillStyle = '#1f2937'
      ctx.font = 'bold 12px Courier New'
      ctx.fillText('PRODUCTO (CODIGO)', 40, y)
      ctx.fillText('CANTIDAD', 370, y)

      y += 10
      ctx.strokeStyle = '#d4d4d8'
      ctx.beginPath()
      ctx.moveTo(30, y)
      ctx.lineTo(470, y)
      ctx.stroke()
      
      y += 20

      // Render all items
      let totalCajas = 0
      let totalUnits = 0

      for (const item of selectedRequest.items || []) {
        ctx.fillStyle = '#0f172a'
        ctx.font = '12px Courier New'

        const name = `${item.nombre} (${item.capacidad} - ${item.color})`
        const descText = `[${item.codigo}] ${name.substring(0, 26)}`
        ctx.fillText(descText, 40, y)
        ctx.fillText(`${item.cantidad} cajas`, 370, y)

        totalCajas += item.cantidad
        totalUnits += item.cantidad * item.unidades_por_caja
        y += 22
      }

      // Divider after items list
      ctx.strokeStyle = '#d4d4d8'
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(30, y - 5)
      ctx.lineTo(470, y - 5)
      ctx.stroke()
      ctx.setLineDash([])

      // Draw totals
      y += 15
      ctx.fillStyle = '#4b5563'
      ctx.fillText('TOTAL CAJAS:', 40, y)
      ctx.fillStyle = '#047857'
      ctx.font = 'bold 13px Courier New'
      ctx.fillText(`${totalCajas} cajas`, 190, y)

      y += 20
      ctx.fillStyle = '#4b5563'
      ctx.font = '12px Courier New'
      ctx.fillText('TOTAL UDS:', 40, y)
      ctx.fillStyle = '#0f172a'
      ctx.fillText(`${totalUnits} celulares`, 190, y)

      y += 35
      // barcode simulation
      ctx.fillStyle = '#4b5563'
      ctx.textAlign = 'center'
      ctx.font = '10px Courier New'
      ctx.fillText('*' + selectedRequest.id.toUpperCase() + '*', 250, y + 40)
      
      ctx.fillStyle = '#1f2937'
      let startX = 135
      for (let i = 0; i < 35; i++) {
        const lineWidth = (Math.sin(i * 3.7) > 0) ? 5 : 2
        ctx.fillRect(startX, y, lineWidth, 28)
        startX += lineWidth + (i % 3 === 0 ? 3 : 1)
      }
    }
  }, [voucherOpen, selectedRequest])

  // Download Voucher PNG
  const handleDownloadVoucher = () => {
    if (!canvasRef.current || !selectedRequest) return
    const url = canvasRef.current.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = url
    link.download = `Vale_Entrega_${selectedRequest.id.toUpperCase()}.png`
    link.click()
    toast.success('Imagen del voucher descargada con éxito.')
  }

  // Share Voucher via WhatsApp (Formatted text summary)
  const handleWhatsAppShare = () => {
    if (!selectedRequest) return
    const dateText = new Date(selectedRequest.fecha).toLocaleString()

    let itemsText = ''
    let totalCajas = 0
    let totalUnits = 0

    selectedRequest.items.forEach((item, idx) => {
      const units = item.cantidad * item.unidades_por_caja
      totalCajas += item.cantidad
      totalUnits += units
      itemsText += `${idx + 1}. *[${item.codigo}] ${item.nombre}*\n` +
        `   Color: ${item.color} | Memoria: ${item.capacidad}\n` +
        `   Cantidad: *${item.cantidad} cajas* (${units} celulares)\n`
    })

    const text = `*Almacén Casita - Vale de Entrega*\n` +
      `----------------------------------------\n` +
      `*ID VALE:* ${selectedRequest.id.toUpperCase()}\n` +
      `*FECHA:* ${dateText}\n` +
      `*SOLICITANTE:* ${selectedRequest.requesterName}\n` +
      `*ESTADO:* APROBADO Y ENTREGADO\n` +
      `----------------------------------------\n` +
      `*PRODUCTOS ENTREGADOS:*\n` +
      itemsText +
      `----------------------------------------\n` +
      `*TOTAL CAJAS:* *${totalCajas} cajas*\n` +
      `*TOTAL CELULARES:* *${totalUnits} unidades*\n` +
      `----------------------------------------\n` +
      `Comprobante aprobado por el administrador.`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleUserApprove = (userId: string) => {
    startTransition(async () => {
      const res = await approveUser(userId)
      if (res.success) toast.success('Usuario aprobado con éxito.')
      else toast.error(res.error || 'Error al aprobar usuario.')
    })
  }

  const handleUserReject = (userId: string) => {
    startTransition(async () => {
      const res = await deleteUser(userId)
      if (res.success) toast.success('Usuario eliminado/rechazado.')
      else toast.error(res.error || 'Error al procesar.')
    })
  }

  const handleRequestApprove = (reqId: string) => {
    startTransition(async () => {
      const res = await approveWithdrawalRequest(reqId)
      if (res.success) {
        toast.success('Solicitud aprobada. Inventario descontado.')
        const req = requests.find(r => r.id === reqId)
        if (req) {
          setSelectedRequest(req)
          setVoucherOpen(true)
        }
      } else {
        toast.error(res.error || 'Error al aprobar solicitud.')
      }
    })
  }

  const handleRequestReject = (reqId: string) => {
    startTransition(async () => {
      const res = await rejectWithdrawalRequest(reqId)
      if (res.success) toast.success('Solicitud rechazada.')
      else toast.error(res.error || 'Error al rechazar solicitud.')
    })
  }

  // Handle password modification submit
  const handlePasswordChangeSubmit = () => {
    if (!selectedUserForPassword) return
    if (!newPassword.trim() || newPassword.trim().length < 4) {
      toast.error('La contraseña debe tener al menos 4 caracteres.')
      return
    }

    startTransition(async () => {
      const res = await updateUserPassword(selectedUserForPassword.id, newPassword)
      if (res.success) {
        toast.success(`Contraseña de @${selectedUserForPassword.username} modificada con éxito.`)
        setNewPassword('')
        setPasswordModalOpen(false)
        setSelectedUserForPassword(null)
      } else {
        toast.error(res.error || 'Error al actualizar contraseña.')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-zinc-800 max-w-lg overflow-x-auto">
        <button
          onClick={() => setActiveTab('exits')}
          className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap px-4 ${
            activeTab === 'exits'
              ? 'border-emerald-500 text-zinc-100'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Salidas de Mercancía
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap px-4 ${
            activeTab === 'users'
              ? 'border-emerald-500 text-zinc-100'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Accesos Pendientes ({pendingUsers.length})
        </button>
        <button
          onClick={() => setActiveTab('all-users')}
          className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap px-4 ${
            activeTab === 'all-users'
              ? 'border-emerald-500 text-zinc-100'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Usuarios Activos ({allUsers.length})
        </button>
      </div>

      {/* Tab 1: Exits Requests */}
      {activeTab === 'exits' && (
        <div className="space-y-4">
          
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-lg border border-zinc-800 bg-zinc-950/40 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-950/80">
                <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 py-3 text-xs">Fecha</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Almacenista</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Productos en la Solicitud</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Total Cajas</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Motivo</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Estado</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length > 0 ? (
                  requests.map((req) => {
                    const isPendingReq = req.estado === 'Pendiente'
                    const totalCajas = req.items?.reduce((sum, i) => sum + i.cantidad, 0) || 0
                    return (
                      <TableRow key={req.id} className="border-b border-zinc-800 hover:bg-zinc-900/20 transition-colors">
                        <TableCell className="py-4 text-xs font-mono text-zinc-400">
                          {new Date(req.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell className="py-4 text-xs font-medium text-zinc-200">
                          {req.requesterName}
                        </TableCell>
                        <TableCell className="py-4 text-xs max-w-sm">
                          <div className="flex flex-col gap-1.5">
                            {req.items?.map((item, idx) => (
                              <div key={idx} className="text-xs bg-zinc-900/60 border border-zinc-850 p-2 rounded-lg">
                                <span className="font-semibold text-zinc-150 block">
                                  [{item.codigo}] {item.nombre}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  Color: {item.color} | Memoria: {item.capacidad} | *{item.cantidad} cajas*
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 text-xs font-mono font-bold text-zinc-300">
                          {totalCajas} cajas
                        </TableCell>
                        <TableCell className="py-4 text-xs text-zinc-400 max-w-[150px] truncate">
                          {req.motivo}
                        </TableCell>
                        <TableCell className="py-4 text-xs">
                          <Badge
                            variant="outline"
                            className={`uppercase text-[9px] font-bold px-2 py-0.5 rounded ${
                              req.estado === 'Aprobado'
                                ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-400'
                                : req.estado === 'Rechazado'
                                ? 'border-red-500/25 bg-red-500/5 text-red-400'
                                : 'border-amber-500/25 bg-amber-500/5 text-amber-400'
                            }`}
                          >
                            {req.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 text-xs text-right whitespace-nowrap">
                          {isPendingReq ? (
                            <>
                              <Button
                                size="sm"
                                disabled={isPending}
                                onClick={() => handleRequestApprove(req.id)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold h-8 px-2.5 mr-1"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" /> Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isPending}
                                onClick={() => handleRequestReject(req.id)}
                                className="border-zinc-800 text-red-400 hover:text-red-300 hover:bg-red-500/5 h-8 px-2.5"
                              >
                                <X className="w-3.5 h-3.5 mr-1" /> Rechazar
                              </Button>
                            </>
                          ) : (
                            req.estado === 'Aprobado' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedRequest(req)
                                  setVoucherOpen(true)
                                }}
                                className="text-zinc-300 hover:text-emerald-400 hover:bg-zinc-800/50 h-8 gap-1.5"
                              >
                                <FileText className="w-3.5 h-3.5" /> Vale / Voucher
                              </Button>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-zinc-500">
                      No hay solicitudes de salida registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card list */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {requests.length > 0 ? (
              requests.map((req) => {
                const isPendingReq = req.estado === 'Pendiente'
                const totalCajas = req.items?.reduce((sum, i) => sum + i.cantidad, 0) || 0
                return (
                  <div key={req.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-mono text-zinc-500">
                          {new Date(req.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <h4 className="text-xs font-bold text-zinc-300 mt-0.5">Solicitó: {req.requesterName}</h4>
                      </div>
                      <Badge
                        variant="outline"
                        className={`uppercase text-[8px] font-bold px-1.5 py-0.5 rounded ${
                          req.estado === 'Aprobado'
                            ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-400'
                            : req.estado === 'Rechazado'
                            ? 'border-red-500/25 bg-red-500/5 text-red-400'
                            : 'border-amber-500/25 bg-amber-500/5 text-amber-400'
                        }`}
                      >
                        {req.estado}
                      </Badge>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">Celulares Pedidos:</span>
                      {req.items?.map((item, idx) => (
                        <div key={idx} className="bg-zinc-950/40 border border-zinc-900 rounded-lg p-2.5 text-xs">
                          <div className="font-semibold text-zinc-200">{item.nombre}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            [{item.codigo}] {item.color} | {item.capacidad}
                          </div>
                          <div className="text-right text-[10px] text-zinc-300 font-mono mt-1 font-bold">
                            Cantidad: {item.cantidad} cajas
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center text-xs font-mono py-1 border-y border-zinc-900/60">
                      <span className="text-zinc-500">Total de Cajas:</span>
                      <span className="text-zinc-200 font-bold">{totalCajas} cajas</span>
                    </div>

                    {req.motivo && (
                      <div className="text-[10px] text-zinc-400 flex items-start gap-1">
                        <ClipboardList className="w-3.5 h-3.5 text-zinc-650 shrink-0 mt-0.5" />
                        <span>Motivo: {req.motivo}</span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 justify-end">
                      {isPendingReq ? (
                        <>
                          <Button
                            size="sm"
                            disabled={isPending}
                            onClick={() => handleRequestApprove(req.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold h-9 px-3 flex-1 justify-center"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => handleRequestReject(req.id)}
                            className="border-zinc-800 text-red-400 hover:text-red-300 hover:bg-red-500/5 h-9 px-3 flex-1 justify-center"
                          >
                            <X className="w-3.5 h-3.5 mr-1" /> Rechazar
                          </Button>
                        </>
                      ) : (
                        req.estado === 'Aprobado' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest(req)
                              setVoucherOpen(true)
                            }}
                            className="border-zinc-800 text-zinc-300 hover:text-emerald-400 h-9 px-3 w-full justify-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" /> Ver Vale de Entrega
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="p-8 text-center text-zinc-500 border border-zinc-800 bg-zinc-950/40 rounded-xl text-xs">
                No hay solicitudes de salida registradas.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Pending Access requests */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-lg border border-zinc-800 bg-zinc-950/40 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-950/80">
                <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 py-3 text-xs">Nombre Completo</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Nombre de Usuario</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Rol Solicitado</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Estado de Acceso</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.length > 0 ? (
                  pendingUsers.map((usr) => (
                    <TableRow key={usr.id} className="border-b border-zinc-800 hover:bg-zinc-900/20 transition-colors">
                      <TableCell className="py-4 text-xs font-semibold text-zinc-200">
                        {usr.fullName}
                      </TableCell>
                      <TableCell className="py-4 text-xs font-mono text-zinc-400">
                        @{usr.username}
                      </TableCell>
                      <TableCell className="py-4 text-xs">
                        <Badge variant="outline" className="border-zinc-800 bg-zinc-900/50 text-zinc-300">
                          {usr.role === 'admin' ? 'Admin' : 'Almacenista'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-xs">
                        <Badge variant="outline" className="border-amber-500/20 bg-amber-500/5 text-amber-400 text-[10px]">
                          Pendiente de Aprobación
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-xs text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleUserApprove(usr.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold h-8 px-2.5 mr-1"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Autorizar Acceso
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => handleUserReject(usr.id)}
                          className="border-zinc-800 text-red-400 hover:text-red-300 hover:bg-red-500/5 h-8 px-2.5"
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Rechazar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-zinc-500">
                      No hay solicitudes de acceso pendientes.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card list */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {pendingUsers.length > 0 ? (
              pendingUsers.map((usr) => (
                <div key={usr.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-200">{usr.fullName}</h4>
                      <span className="text-[10px] font-mono text-zinc-500">@{usr.username}</span>
                    </div>
                    <Badge variant="outline" className="border-zinc-800 bg-zinc-900/50 text-zinc-350 text-[10px]">
                      {usr.role === 'admin' ? 'Admin' : 'Almacenista'}
                    </Badge>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleUserApprove(usr.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold h-9 px-3 flex-1 justify-center"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Autorizar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => handleUserReject(usr.id)}
                      className="border-zinc-800 text-red-400 hover:text-red-300 hover:bg-red-500/5 h-9 px-3 flex-1 justify-center"
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Rechazar
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-zinc-500 border border-zinc-800 bg-zinc-950/40 rounded-xl text-xs">
                No hay solicitudes de acceso pendientes.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: All Users Management (Active Users & Passwords resetting) */}
      {activeTab === 'all-users' && (
        <div className="space-y-4">
          
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-lg border border-zinc-800 bg-zinc-950/40 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-950/80">
                <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 py-3 text-xs">Nombre Completo</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Nombre de Usuario</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Rol</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs">Acceso Aprobado</TableHead>
                  <TableHead className="text-zinc-400 py-3 text-xs text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.length > 0 ? (
                  allUsers.map((usr) => (
                    <TableRow key={usr.id} className="border-b border-zinc-800 hover:bg-zinc-900/20 transition-colors">
                      <TableCell className="py-4 text-xs font-semibold text-zinc-200">
                        {usr.fullName}
                      </TableCell>
                      <TableCell className="py-4 text-xs font-mono text-zinc-400">
                        @{usr.username}
                      </TableCell>
                      <TableCell className="py-4 text-xs">
                        <Badge 
                          variant="outline" 
                          className={`uppercase text-[8px] font-bold ${
                            usr.role === 'admin' 
                              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' 
                              : 'border-zinc-800 bg-zinc-900/50 text-zinc-300'
                          }`}
                        >
                          {usr.role === 'admin' ? 'Admin' : 'Almacenista'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-xs">
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] ${
                            usr.approved 
                              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' 
                              : 'border-amber-500/20 bg-amber-500/5 text-amber-400'
                          }`}
                        >
                          {usr.approved ? 'Aprobado' : 'Pendiente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-xs text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUserForPassword(usr)
                            setPasswordModalOpen(true)
                          }}
                          className="border-zinc-850 text-zinc-200 hover:text-emerald-400 hover:bg-emerald-500/5 h-8 px-2.5 mr-1"
                        >
                          <Key className="w-3.5 h-3.5 mr-1" /> Clave
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => handleUserReject(usr.id)}
                          className="border-zinc-850 text-red-400 hover:text-red-300 hover:bg-red-500/5 h-8 px-2.5"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-zinc-500">
                      No hay usuarios registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card list */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {allUsers.length > 0 ? (
              allUsers.map((usr) => (
                <div key={usr.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-200">{usr.fullName}</h4>
                      <span className="text-[10px] font-mono text-zinc-500">@{usr.username}</span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-[9px] ${
                        usr.approved 
                          ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' 
                          : 'border-amber-500/20 bg-amber-500/5 text-amber-400'
                      }`}
                    >
                      {usr.approved ? 'Aprobado' : 'Pendiente'}
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center text-xs font-mono py-1 border-t border-zinc-900/60">
                    <span className="text-zinc-500">Rol asignado:</span>
                    <span className="text-zinc-300 font-bold uppercase text-[10px]">{usr.role === 'admin' ? 'Administrador' : 'Almacenista'}</span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedUserForPassword(usr)
                        setPasswordModalOpen(true)
                      }}
                      className="border-zinc-850 text-zinc-200 hover:text-emerald-400 hover:bg-emerald-500/5 h-9 px-3 flex-1 justify-center"
                    >
                      <Key className="w-3.5 h-3.5 mr-1" /> Cambiar Clave
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => handleUserReject(usr.id)}
                      className="border-zinc-850 text-red-400 hover:text-red-300 hover:bg-red-500/5 h-9 px-3 flex-1 justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Eliminar
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-zinc-500 border border-zinc-800 bg-zinc-950/40 rounded-xl text-xs">
                No hay usuarios registrados.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Change Password Dialog Modal */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-zinc-200">Modificar Contraseña</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Escribe la nueva contraseña para el usuario <span className="font-bold text-zinc-300">@{selectedUserForPassword?.username}</span>. Mínimo 4 caracteres.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Nueva Contraseña</label>
              <Input
                type="password"
                placeholder="Escribe la clave de al menos 4 dígitos..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-zinc-950 border-zinc-850 focus:border-emerald-500 text-xs h-10 text-zinc-100"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-zinc-950/80">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNewPassword('')
                setPasswordModalOpen(false)
              }}
              className="border-zinc-850 text-zinc-350 hover:bg-zinc-950 hover:text-zinc-200 h-9"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={handlePasswordChangeSubmit}
              className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold h-9"
            >
              {isPending ? 'Guardando...' : 'Guardar Clave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voucher Drawer Modal */}
      <Dialog open={voucherOpen} onOpenChange={setVoucherOpen}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 text-zinc-100 max-w-sm flex flex-col items-center shadow-2xl relative z-50 animate-in fade-in zoom-in duration-200">
          <DialogHeader className="w-full text-center">
            <DialogTitle className="text-zinc-200">Vale de Entrega Generado</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Descarga la imagen del vale o compártela por WhatsApp.
            </DialogDescription>
          </DialogHeader>

          {/* Thermal print simulated Canvas */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-black shadow-inner my-2">
            <canvas ref={canvasRef} className="w-full max-w-[280px] h-auto block" />
          </div>

          {/* Action buttons */}
          <div className="w-full grid grid-cols-2 gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadVoucher}
              className="border-zinc-800 hover:bg-zinc-900 text-zinc-200 text-xs gap-1.5 h-10 w-full"
            >
              <Download className="w-3.5 h-3.5" /> Descargar PNG
            </Button>
            <Button
              type="button"
              onClick={handleWhatsAppShare}
              className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs gap-1.5 h-10 w-full"
            >
              <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
            </Button>
          </div>

          <DialogFooter className="w-full border-t border-zinc-900 pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setVoucherOpen(false)}
              className="w-full text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
