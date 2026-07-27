'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FileText, Download, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

interface ProductDetails {
  codigo: string;
  nombre: string;
  marca: string;
  color: string;
  capacidad: string;
  unidades_por_caja: number;
}

interface UserProfile {
  full_name: string;
}

interface MovementForVoucher {
  id: string;
  fecha: string;
  tipo: 'Entrada' | 'Salida';
  cantidad: number;
  motivo: string;
  products: ProductDetails | null;
  profiles: UserProfile | null;
}

interface VoucherButtonProps {
  movement: MovementForVoucher;
  variant?: 'ghost' | 'outline' | 'default';
  className?: string;
  children?: React.ReactNode;
}

export function VoucherButton({ movement, variant = 'ghost', className, children }: VoucherButtonProps) {
  const [open, setOpen] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const drawVoucher = (canvas: HTMLCanvasElement | null) => {
    if (!canvas || !movement) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const canvasHeight = 400
    canvas.width = 500
    canvas.height = canvasHeight

    // Background
    ctx.fillStyle = '#09090b'
    ctx.fillRect(0, 0, 500, canvasHeight)

    // Outer border
    ctx.strokeStyle = '#27272a'
    ctx.lineWidth = 4
    ctx.strokeRect(12, 12, 476, canvasHeight - 24)

    // Header
    const isEntrada = movement.tipo === 'Entrada'
    ctx.fillStyle = isEntrada ? '#10b981' : '#f43f5e'
    ctx.font = 'bold 24px Courier New'
    ctx.textAlign = 'center'
    ctx.fillText('ALMACEN CASITA', 250, 55)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '13px Courier New'
    ctx.fillText(isEntrada ? 'COMPROBANTE DE ENTRADA' : 'COMPROBANTE DE SALIDA', 250, 80)

    // Divider
    ctx.strokeStyle = '#3f3f46'
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(30, 100)
    ctx.lineTo(470, 100)
    ctx.stroke()
    ctx.setLineDash([])

    // Metadata Info
    ctx.textAlign = 'left'
    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px Courier New'
    
    const dateText = new Date(movement.fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    ctx.fillText('ID MOV:    ', 40, 130)
    ctx.fillText('FECHA:     ', 40, 150)
    ctx.fillText('REGISTRÓ:  ', 40, 170)
    ctx.fillText('ESTADO:    ', 40, 190)

    ctx.fillStyle = '#ffffff'
    ctx.fillText(movement.id.toUpperCase(), 130, 130)
    ctx.fillText(dateText, 130, 150)
    ctx.fillText(movement.profiles?.full_name || 'Administrador', 130, 170)
    
    ctx.fillStyle = isEntrada ? '#34d399' : '#fb7185'
    ctx.fillText(isEntrada ? 'INGRESADO E INVENTARIADO' : 'RETIRADO E INVENTARIADO', 130, 190)

    // Divider before list
    ctx.strokeStyle = '#3f3f46'
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(30, 210)
    ctx.lineTo(470, 210)
    ctx.stroke()
    ctx.setLineDash([])

    // Table Header
    let y = 235
    ctx.fillStyle = '#cbd5e1'
    ctx.font = 'bold 12px Courier New'
    ctx.fillText('PRODUCTO (CODIGO)', 40, y)
    ctx.fillText('CANTIDAD', 370, y)

    y += 10
    ctx.strokeStyle = '#3f3f46'
    ctx.beginPath()
    ctx.moveTo(30, y)
    ctx.lineTo(470, y)
    ctx.stroke()
    
    y += 20

    // Render product row
    const prod = movement.products
    if (prod) {
      ctx.fillStyle = '#ffffff'
      ctx.font = '12px Courier New'

      const name = `${prod.nombre} (${prod.capacidad} - ${prod.color})`
      const descText = `[${prod.codigo}] ${name.substring(0, 26)}`
      ctx.fillText(descText, 40, y)
      
      ctx.fillStyle = isEntrada ? '#34d399' : '#fb7185'
      ctx.fillText(`${movement.cantidad} cajas`, 370, y)
    } else {
      ctx.fillStyle = '#ef4444'
      ctx.fillText('Producto eliminado o no disponible', 40, y)
    }

    // Divider after list
    y += 15
    ctx.strokeStyle = '#3f3f46'
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(30, y)
    ctx.lineTo(470, y)
    ctx.stroke()
    ctx.setLineDash([])

    // Totals
    y += 20
    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px Courier New'
    ctx.fillText('TOTAL CAJAS:', 40, y)
    ctx.fillStyle = isEntrada ? '#10b981' : '#f43f5e'
    ctx.font = 'bold 13px Courier New'
    ctx.fillText(`${movement.cantidad} cajas`, 190, y)

    if (prod) {
      y += 20
      ctx.fillStyle = '#94a3b8'
      ctx.font = '12px Courier New'
      ctx.fillText('TOTAL UDS:', 40, y)
      ctx.fillStyle = '#ffffff'
      const totalUnits = movement.cantidad * prod.unidades_por_caja
      ctx.fillText(`${totalUnits} celulares`, 190, y)
    }

    y += 25
    // barcode simulation
    ctx.fillStyle = '#94a3b8'
    ctx.textAlign = 'center'
    ctx.font = '10px Courier New'
    ctx.fillText('*' + movement.id.toUpperCase() + '*', 250, y + 40)
    
    ctx.fillStyle = '#ffffff'
    let startX = 135
    for (let i = 0; i < 35; i++) {
      const lineWidth = (Math.sin(i * 3.7) > 0) ? 5 : 2
      ctx.fillRect(startX, y, lineWidth, 28)
      startX += lineWidth + (i % 3 === 0 ? 3 : 1)
    }
  }

  const canvasRefCallback = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node
    if (node) {
      drawVoucher(node)
    }
  }, [movement, open])

  const handleDownloadVoucher = () => {
    if (!canvasRef.current) return
    const url = canvasRef.current.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = url
    link.download = `Voucher_${movement.tipo}_${movement.id.toUpperCase()}.png`
    link.click()
    toast.success('Voucher descargado correctamente.')
  }

  const handleWhatsAppShare = () => {
    const dateText = new Date(movement.fecha).toLocaleString()
    const prod = movement.products
    if (!prod) return

    const totalUnits = movement.cantidad * prod.unidades_por_caja
    const text = `*Almacén Casita - Comprobante de ${movement.tipo}*\n` +
      `----------------------------------------\n` +
      `*ID MOV:* ${movement.id.toUpperCase()}\n` +
      `*FECHA:* ${dateText}\n` +
      `*REGISTRÓ:* ${movement.profiles?.full_name || 'Administrador'}\n` +
      `*ESTADO:* ${movement.tipo === 'Entrada' ? 'INGRESADO' : 'RETIRADO'} E INVENTARIADO\n` +
      `----------------------------------------\n` +
      `*PRODUCTO:*\n` +
      `1. *[${prod.codigo}] ${prod.nombre}*\n` +
      `   Color: ${prod.color} | Memoria: ${prod.capacidad}\n` +
      `   Cantidad: *${movement.cantidad} cajas* (${totalUnits} celulares)\n` +
      `----------------------------------------\n` +
      `*TOTAL CAJAS:* *${movement.cantidad} cajas*\n` +
      `*TOTAL CELULARES:* *${totalUnits} unidades*\n` +
      `----------------------------------------\n` +
      `Comprobante verificado por el administrador.`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(whatsappUrl, '_blank')
  }

  const triggerElement = (children as React.ReactElement) || (
    <Button
      size="sm"
      variant={variant}
      className={className}
    >
      <FileText className="w-3.5 h-3.5 mr-1" />
      <span>Ver Baucher</span>
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={triggerElement} />
      <DialogContent className="bg-zinc-900 border border-zinc-800 text-zinc-100 max-w-sm flex flex-col items-center shadow-2xl z-50">
        <DialogHeader className="w-full text-center">
          <DialogTitle className="text-zinc-200">Comprobante de Movimiento</DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Descarga o comparte el comprobante de este registro.
          </DialogDescription>
        </DialogHeader>

        {/* Canvas */}
        <div className="border border-zinc-800 rounded-xl overflow-hidden bg-black shadow-inner my-2">
          <canvas ref={canvasRefCallback} className="w-full max-w-[280px] h-auto block" />
        </div>

        {/* Action Buttons */}
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
            onClick={() => setOpen(false)}
            className="w-full text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
