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
  unidad_medida?: 'cajas' | 'unidades';
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

    const canvasHeight = 416
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

    const isEntrada = movement.tipo === 'Entrada'

    // Header Title
    ctx.fillStyle = isEntrada ? '#10b981' : '#f43f5e'
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('ALMACÉN CASITA', 250, 48)

    // Subtitle
    ctx.fillStyle = '#94a3b8'
    ctx.font = '500 12px system-ui, -apple-system, sans-serif'
    ctx.fillText(isEntrada ? 'COMPROBANTE DE ENTRADA' : 'COMPROBANTE DE SALIDA', 250, 72)

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
    
    ctx.fillText('ID MOVIMIENTO', 40, 126)
    ctx.fillText('FECHA Y HORA', 260, 126)
    ctx.fillText('REGISTRADO POR', 40, 174)
    ctx.fillText('ESTADO', 260, 174)

    ctx.font = '500 11px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#f8fafc'
    
    const displayId = movement.id.toUpperCase()
    const truncatedId = displayId.length > 20 ? displayId.substring(0, 18) + '...' : displayId
    ctx.fillText(truncatedId, 40, 144)

    const dateText = new Date(movement.fecha).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    ctx.fillText(dateText, 260, 144)
    ctx.fillText(movement.profiles?.full_name || 'Administrador', 40, 192)

    // Status badge
    const badgeText = isEntrada ? 'INGRESADO E INVENTARIADO' : 'RETIRADO E INVENTARIADO'
    const badgeBg = isEntrada ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)'
    const badgeTextCol = isEntrada ? '#34d399' : '#fb7185'
    
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
    const prod = movement.products
    if (prod) {
      // 1. Product Name
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
      const productName = prod.nombre.length > 40 ? prod.nombre.substring(0, 37) + '...' : prod.nombre
      ctx.fillText(productName, 40, y)

      // 2. Sub-details
      ctx.fillStyle = '#64748b'
      ctx.font = 'normal 9px system-ui, -apple-system, sans-serif'
      const detailsText = `[${prod.codigo}]  ·  ${prod.capacidad}  ·  ${prod.color}`
      const detailsTrunc = detailsText.length > 55 ? detailsText.substring(0, 52) + '...' : detailsText
      ctx.fillText(detailsTrunc, 40, y + 14)

      // 3. Quantity
      const isUnidades = movement.unidad_medida === 'unidades'
      ctx.textAlign = 'right'
      ctx.fillStyle = isEntrada ? '#10b981' : '#f43f5e'
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
      ctx.fillText(isUnidades ? `${movement.cantidad} uds (sin caja)` : `${movement.cantidad} cajas`, 458, y + 8)
      ctx.textAlign = 'left' // reset
    } else {
      ctx.fillStyle = '#f43f5e'
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
      ctx.fillText('Producto eliminado o no disponible', 40, y)
    }

    y += 36

    // Divider after list
    ctx.strokeStyle = '#1e293b'
    ctx.beginPath()
    ctx.moveTo(30, y - 5)
    ctx.lineTo(470, y - 5)
    ctx.stroke()

    // Totals Section
    const isUnidadesMov = movement.unidad_medida === 'unidades'
    y += 15
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#64748b'
    ctx.fillText('CANTIDAD REGISTRADA:', 40, y)
    
    ctx.textAlign = 'right'
    ctx.fillStyle = isEntrada ? '#10b981' : '#f43f5e'
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif'
    ctx.fillText(isUnidadesMov ? `${movement.cantidad} uds (sin caja)` : `${movement.cantidad} cajas`, 458, y)
    ctx.textAlign = 'left' // reset

    if (prod) {
      y += 20
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = '#64748b'
      ctx.fillText('TOTAL UNIDADES:', 40, y)
      
      ctx.textAlign = 'right'
      ctx.fillStyle = '#f8fafc'
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif'
      const totalUnits = isUnidadesMov ? movement.cantidad : movement.cantidad * prod.unidades_por_caja
      ctx.fillText(`${totalUnits} celulares`, 458, y)
      ctx.textAlign = 'left' // reset
    }

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
    ctx.fillText('*' + movement.id.toUpperCase() + '*', 250, y)
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

  const handleWhatsAppShare = async () => {
    if (!canvasRef.current || !movement) return
    
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) {
          toast.error('No se pudo generar la imagen del comprobante.')
          return
        }

        const file = new File([blob], `Voucher_${movement.id.toUpperCase()}.png`, { type: 'image/png' })

        // 1. Try Web Share API (mainly for mobile devices)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Comprobante de ${movement.tipo}`,
              text: `Almacén Casita - Comprobante de ${movement.tipo}`
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
