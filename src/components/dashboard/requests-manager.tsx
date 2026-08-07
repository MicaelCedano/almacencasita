'use client'

import React, { useState, useTransition, useEffect, useRef, useCallback } from 'react'
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
  unidad_medida?: 'cajas' | 'unidades';
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
  tipo: 'Entrada' | 'Salida';
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
  const [activeTab, setActiveTab] = useState<'exits' | 'entries' | 'users' | 'all-users'>('exits')
  const [isPending, startTransition] = useTransition()

  // Voucher modal states
  const [voucherOpen, setVoucherOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<RequestRecord | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Password reset modal states
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<UserRecord | null>(null)
  const [newPassword, setNewPassword] = useState('')

  // Filter requests
  const exitsRequests = requests.filter(r => r.tipo === 'Salida' || !r.tipo)
  const entriesRequests = requests.filter(r => r.tipo === 'Entrada')

  // Draw voucher helper function
  const drawVoucher = (canvas: HTMLCanvasElement | null) => {
    if (!canvas || !selectedRequest) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const itemsCount = selectedRequest.items?.length || 0
    const baseHeight = 380
    const itemsHeight = itemsCount * 36
    const canvasHeight = baseHeight + itemsHeight

    canvas.width = 500
    canvas.height = canvasHeight

    // Background - Modern dark slate/blue theme
    ctx.fillStyle = '#0b0f19'
    ctx.fillRect(0, 0, 500, canvasHeight)

    // Outer border
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2
    ctx.strokeRect(12, 12, 476, canvasHeight - 24)

    // Header Background Accent
    ctx.fillStyle = '#111827'
    ctx.beginPath()
    ctx.roundRect(12, 12, 476, 90, [12, 12, 0, 0])
    ctx.fill()

    const isEntrada = selectedRequest.tipo === 'Entrada'

    // Header Title
    ctx.fillStyle = isEntrada ? '#10b981' : '#f43f5e'
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('ALMACÉN CASITA', 250, 48)

    // Subtitle
    ctx.fillStyle = '#94a3b8'
    ctx.font = '500 12px system-ui, -apple-system, sans-serif'
    ctx.fillText(isEntrada ? 'COMPROBANTE DE ENTRADA' : 'COMPROBANTE DE ENTREGA', 250, 72)

    // Thin separator line
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(30, 102)
    ctx.lineTo(470, 102)
    ctx.stroke()

    // Metadata Grid Layout
    ctx.textAlign = 'left'
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#64748b'
    
    ctx.fillText('ID VALE', 40, 126)
    ctx.fillText('FECHA Y HORA', 260, 126)
    ctx.fillText(isEntrada ? 'SOLICITADO POR' : 'ENTREGA A', 40, 174)
    ctx.fillText('ESTADO', 260, 174)

    ctx.font = '500 11px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#f8fafc'
    
    const displayId = selectedRequest.id.toUpperCase()
    const truncatedId = displayId.length > 20 ? displayId.substring(0, 18) + '...' : displayId
    ctx.fillText(truncatedId, 40, 144)

    const dateText = new Date(selectedRequest.fecha).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    ctx.fillText(dateText, 260, 144)
    ctx.fillText(selectedRequest.requesterName || 'Almacenista', 40, 192)

    // Status badge
    let badgeText = ''
    let badgeBg = ''
    let badgeTextCol = ''

    if (selectedRequest.estado === 'Aprobado') {
      badgeText = isEntrada ? 'INGRESADO E INVENTARIADO' : 'RETIRADO E INVENTARIADO'
      badgeBg = 'rgba(16, 185, 129, 0.12)'
      badgeTextCol = '#34d399'
    } else if (selectedRequest.estado === 'Rechazado') {
      badgeText = 'RECHAZADO'
      badgeBg = 'rgba(239, 68, 68, 0.12)'
      badgeTextCol = '#f87171'
    } else {
      badgeText = 'PENDIENTE DE APROBACIÓN'
      badgeBg = 'rgba(245, 158, 11, 0.12)'
      badgeTextCol = '#fbbf24'
    }
    
    ctx.fillStyle = badgeBg
    ctx.beginPath()
    ctx.roundRect(260, 182, 180, 18, 4)
    ctx.fill()

    ctx.fillStyle = badgeTextCol
    ctx.font = 'bold 9px system-ui, -apple-system, sans-serif'
    ctx.fillText(badgeText, 270, 194)

    // Divider before table
    ctx.strokeStyle = '#1e293b'
    ctx.beginPath()
    ctx.moveTo(30, 222)
    ctx.lineTo(470, 222)
    ctx.stroke()

    // Table Header Background
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.roundRect(30, 234, 440, 26, 4)
    ctx.fill()

    // Table Header Labels
    ctx.fillStyle = '#94a3b8'
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif'
    ctx.fillText('PRODUCTO Y DETALLES', 42, 250)
    ctx.textAlign = 'right'
    ctx.fillText('CANTIDAD', 458, 250)
    ctx.textAlign = 'left' // reset

    let y = 284
    let totalCajas = 0
    let totalUnits = 0

    for (const item of selectedRequest.items || []) {
      // 1. Product Name
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
      const productName = item.nombre.length > 40 ? item.nombre.substring(0, 37) + '...' : item.nombre
      ctx.fillText(productName, 40, y)

      // 2. Sub-details
      ctx.fillStyle = '#64748b'
      ctx.font = 'normal 9px system-ui, -apple-system, sans-serif'
      const extraInfo = [item.capacidad, item.color].filter(x => x && x !== 'N/A').join('  ·  ')
      const detailsText = `[${item.codigo}]${extraInfo ? '  ·  ' + extraInfo : ''}`
      const detailsTrunc = detailsText.length > 55 ? detailsText.substring(0, 52) + '...' : detailsText
      ctx.fillText(detailsTrunc, 40, y + 14)

      // 3. Quantity
      const isUnidades = item.unidad_medida === 'unidades'
      ctx.textAlign = 'right'
      ctx.fillStyle = isEntrada ? '#10b981' : '#f43f5e'
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
      ctx.fillText(isUnidades ? `${item.cantidad} uds (sin caja)` : `${item.cantidad} cajas`, 458, y + 8)
      ctx.textAlign = 'left' // reset

      if (isUnidades) {
        totalUnits += item.cantidad
      } else {
        totalCajas += item.cantidad
        totalUnits += item.cantidad * item.unidades_por_caja
      }
      y += 36
    }

    // Divider after list
    ctx.strokeStyle = '#1e293b'
    ctx.beginPath()
    ctx.moveTo(30, y - 5)
    ctx.lineTo(470, y - 5)
    ctx.stroke()

    // Totals Section
    y += 15
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#64748b'
    ctx.fillText('TOTAL CAJAS:', 40, y)
    
    ctx.textAlign = 'right'
    ctx.fillStyle = isEntrada ? '#10b981' : '#f43f5e'
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif'
    ctx.fillText(`${totalCajas} cajas`, 458, y)
    ctx.textAlign = 'left' // reset

    y += 20
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#64748b'
    ctx.fillText('TOTAL UNIDADES:', 40, y)
    
    ctx.textAlign = 'right'
    ctx.fillStyle = '#f8fafc'
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif'
    ctx.fillText(`${totalUnits} celulares`, 458, y)
    ctx.textAlign = 'left' // reset

    // Modern Barcode container
    y += 25
    ctx.fillStyle = '#111827'
    ctx.beginPath()
    ctx.roundRect(100, y, 300, 36, 6)
    ctx.fill()

    // Barcode lines
    ctx.fillStyle = '#ffffff'
    let startX = 115
    for (let i = 0; i < 45; i++) {
      const lineWidth = (Math.sin(i * 3.7) > 0) ? 4 : 1
      ctx.fillRect(startX, y + 4, lineWidth, 28)
      startX += lineWidth + (i % 3 === 0 ? 2 : 1)
    }

    y += 50
    ctx.fillStyle = '#64748b'
    ctx.textAlign = 'center'
    ctx.font = '500 8px monospace'
    ctx.fillText('*' + selectedRequest.id.toUpperCase() + '*', 250, y)
  }

  // React Callback Ref to handle dynamic Dialog rendering race condition
  const canvasRefCallback = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node
    if (node) {
      drawVoucher(node)
    }
  }, [selectedRequest])

  // Download Voucher PNG
  const handleDownloadVoucher = () => {
    if (!canvasRef.current || !selectedRequest) return
    const url = canvasRef.current.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = url
    const suffix = selectedRequest.tipo === 'Entrada' ? 'Entrada' : 'Entrega'
    link.download = `Vale_${suffix}_${selectedRequest.id.toUpperCase()}.png`
    link.click()
    toast.success('Imagen del voucher descargada con éxito.')
  }

  // Share Voucher via WhatsApp (PNG Image or Clipboard)
  const handleWhatsAppShare = async () => {
    if (!canvasRef.current || !selectedRequest) return
    
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) {
          toast.error('No se pudo generar la imagen del comprobante.')
          return
        }

        const suffix = selectedRequest.tipo === 'Entrada' ? 'Entrada' : 'Entrega'
        const file = new File([blob], `Vale_${suffix}_${selectedRequest.id.toUpperCase()}.png`, { type: 'image/png' })

        // 1. Try Web Share API (mainly for mobile devices)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Vale de ${suffix}`,
              text: `Almacén Casita - Vale de ${suffix}`
            })
            return
          } catch (shareErr) {
            // User cancelled or sharing failed, fall through to clipboard copy
            console.log('Native share failed/cancelled:', shareErr)
          }
        }

        // 2. Fallback: Copy to clipboard and open WhatsApp
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ])
          toast.success('¡Imagen copiada al portapapeles! Abre WhatsApp y presiona Pegar (Ctrl+V) para enviarla.')
        } catch (clipErr) {
          console.error('Clipboard copy failed:', clipErr)
          toast.info('No se pudo copiar automáticamente. Descarga el PNG e insértalo en WhatsApp.')
        }

        const whatsappUrl = `https://api.whatsapp.com/send`
        window.open(whatsappUrl, '_blank')
      }, 'image/png')
    } catch (err) {
      toast.error('Error al intentar compartir el comprobante.')
      console.error(err)
    }
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
        toast.success('Solicitud aprobada e inventario actualizado.')
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
    if (!newPassword.trim() || newPassword.trim().length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.')
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

  const renderRequestsList = (requestsList: RequestRecord[], noRequestsText: string) => {
    return (
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
              {requestsList.length > 0 ? (
                requestsList.map((req) => {
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
                                Color: {item.color} | Memoria: {item.capacidad} | *{item.unidad_medida === 'unidades' ? `${item.cantidad} uds (sin caja)` : `${item.cantidad} cajas`}*
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
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedRequest(req)
                                setVoucherOpen(true)
                              }}
                              className="text-zinc-400 hover:text-zinc-200 h-8 px-2"
                              title="Ver Vale Pendiente"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
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
                          </div>
                        ) : (
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
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-zinc-500">
                    {noRequestsText}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card list */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {requestsList.length > 0 ? (
            requestsList.map((req) => {
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
                          Cantidad: {item.unidad_medida === 'unidades' ? `${item.cantidad} uds (sin caja)` : `${item.cantidad} cajas`}
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
                          variant="ghost"
                          onClick={() => {
                            setSelectedRequest(req)
                            setVoucherOpen(true)
                          }}
                          className="text-zinc-400 hover:text-zinc-200 h-9 px-2"
                          title="Ver Vale"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedRequest(req)
                          setVoucherOpen(true)
                        }}
                        className="border-zinc-800 text-zinc-300 hover:text-emerald-400 h-9 px-3 w-full justify-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" /> Ver Vale / Comprobante
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-8 text-center text-zinc-500 border border-zinc-800 bg-zinc-950/40 rounded-xl text-xs">
              {noRequestsText}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-zinc-800 max-w-2xl overflow-x-auto">
        <button
          onClick={() => setActiveTab('exits')}
          className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap px-4 ${
            activeTab === 'exits'
              ? 'border-emerald-500 text-zinc-100'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Salidas de Mercancía ({exitsRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('entries')}
          className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap px-4 ${
            activeTab === 'entries'
              ? 'border-emerald-500 text-zinc-100'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Entradas de Mercancía ({entriesRequests.length})
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
      {activeTab === 'exits' && renderRequestsList(exitsRequests, 'No hay solicitudes de salida registradas.')}

      {/* Tab 1.5: Entries Requests */}
      {activeTab === 'entries' && renderRequestsList(entriesRequests, 'No hay solicitudes de entrada registradas.')}

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
              Escribe la nueva contraseña para el usuario <span className="font-bold text-zinc-300">@{selectedUserForPassword?.username}</span>. Mínimo 6 caracteres.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">Nueva Contraseña</label>
              <Input
                type="password"
                placeholder="Escribe la clave de al menos 6 dígitos..."
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
        <DialogContent className="bg-zinc-900 border border-zinc-800 text-zinc-100 max-w-sm flex flex-col items-center shadow-2xl z-50 animate-in fade-in zoom-in duration-200">
          <DialogHeader className="w-full text-center">
            <DialogTitle className="text-zinc-200">Vale de Entrega Generado</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Descarga la imagen del vale o compártela por WhatsApp.
            </DialogDescription>
          </DialogHeader>

          {/* Thermal print simulated Canvas */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-black shadow-inner my-2">
            <canvas ref={canvasRefCallback} className="w-full max-w-[280px] h-auto block" />
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
