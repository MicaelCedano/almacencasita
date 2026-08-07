'use client'

import React, { useState, useRef, useCallback } from 'react'
import { createMovementsBulk, createWithdrawalRequest } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { PlusCircle, MinusCircle, Loader2, Search, ChevronDown, Download, MessageSquare, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface MovementDialogProps {
  tipo: 'Entrada' | 'Salida';
  role?: 'admin' | 'empleado';
  products: {
    id: string;
    codigo: string;
    nombre: string;
    color: string;
    capacidad: string;
    cajas: number;
    unidades_por_caja: number;
    cantidad: number;
    marca: string;
  }[];
}

export function MovementDialog({ tipo, role = 'admin', products }: MovementDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Searchable picker states
  const [pickerOpen, setPickerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Selected items list state
  const [selectedItems, setSelectedItems] = useState<{
    product: typeof products[number];
    cantidad: number | '';
    unidad_medida: 'cajas' | 'unidades';
  }[]>([])

  const [motivo, setMotivo] = useState('')

  // Voucher states
  const [createdMovement, setCreatedMovement] = useState<any | null>(null)
  const [voucherOpen, setVoucherOpen] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Filter products by search query
  const filteredProducts = products.filter((p) => {
    const term = searchQuery.toLowerCase().trim()
    if (!term) return true
    return (
      p.codigo.toLowerCase().includes(term) ||
      p.nombre.toLowerCase().includes(term) ||
      p.marca.toLowerCase().includes(term) ||
      p.color.toLowerCase().includes(term) ||
      p.capacidad.toLowerCase().includes(term)
    )
  })

  const handleOpenChange = (openVal: boolean) => {
    setOpen(openVal)
    if (!openVal) {
      setSelectedItems([])
      setMotivo('')
      setPickerOpen(false)
      setSearchQuery('')
    }
  }

  const handleAddProduct = (product: typeof products[number]) => {
    if (selectedItems.some((item) => item.product.id === product.id)) {
      toast.warning('Este producto ya está en la lista.')
      return
    }
    setSelectedItems((prev) => [...prev, { product, cantidad: 1, unidad_medida: 'cajas' }])
    setPickerOpen(false)
    setSearchQuery('')
    toast.success(`Añadido: ${product.nombre}`)
  }

  const drawVoucher = (canvas: HTMLCanvasElement | null) => {
    if (!canvas || !createdMovement) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const itemsCount = createdMovement.items?.length || 0
    const baseHeight = 380
    const itemsHeight = itemsCount * 36
    const canvasHeight = baseHeight + itemsHeight

    canvas.width = 500
    canvas.height = canvasHeight

    // Background - Modern dark slate/blue theme
    ctx.fillStyle = '#0b0f19'
    ctx.fillRect(0, 0, 500, canvasHeight)

    // Outer border (thin sleek border)
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2
    ctx.strokeRect(12, 12, 476, canvasHeight - 24)

    // Header Background Accent
    ctx.fillStyle = '#111827'
    ctx.beginPath()
    ctx.roundRect(12, 12, 476, 90, [12, 12, 0, 0])
    ctx.fill()

    const isEntrada = createdMovement.tipo === 'Entrada'

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
    
    const displayId = createdMovement.id.toUpperCase()
    const truncatedId = displayId.length > 20 ? displayId.substring(0, 18) + '...' : displayId
    ctx.fillText(truncatedId, 40, 144)

    const dateText = new Date(createdMovement.fecha).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    ctx.fillText(dateText, 260, 144)
    ctx.fillText(createdMovement.user?.fullName || 'Administrador', 40, 192)

    // Status rounded badge
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
    let totalCajas = 0
    let totalUnits = 0

    for (const item of createdMovement.items || []) {
      // 1. Product Name
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
      const productName = item.nombre.length > 40 ? item.nombre.substring(0, 37) + '...' : item.nombre
      ctx.fillText(productName, 40, y)

      // 2. Sub-details
      ctx.fillStyle = '#64748b'
      ctx.font = 'normal 9px system-ui, -apple-system, sans-serif'
      const detailsText = `[${item.codigo}]  ·  ${item.capacidad}  ·  ${item.color}`
      const detailsTrunc = detailsText.length > 55 ? detailsText.substring(0, 52) + '...' : detailsText
      ctx.fillText(detailsTrunc, 40, y + 14)

      // 3. Quantity
      const isUnidades = item.unidad_medida === 'unidades'
      ctx.textAlign = 'right'
      ctx.fillStyle = isEntrada ? '#10b981' : '#f43f5e'
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
      const qtyLabel = isUnidades ? `${item.cantidad} uds (sin caja)` : `${item.cantidad} cajas`
      ctx.fillText(qtyLabel, 458, y + 8)
      ctx.textAlign = 'left' // reset

      if (isUnidades) {
        totalUnits += item.cantidad
      } else {
        totalCajas += item.cantidad
        totalUnits += item.cantidad * (item.unidades_por_caja || 20)
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
    ctx.fillText('*' + createdMovement.id.toUpperCase() + '*', 250, y)
  }

  const canvasRefCallback = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node
    if (node) {
      drawVoucher(node)
    }
  }, [createdMovement, voucherOpen])

  const handleDownloadVoucher = () => {
    if (!canvasRef.current || !createdMovement) return
    const url = canvasRef.current.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = url
    link.download = `Voucher_${createdMovement.tipo}_${createdMovement.id.toUpperCase()}.png`
    link.click()
    toast.success('Voucher descargado correctamente.')
  }

  const handleWhatsAppShare = async () => {
    if (!canvasRef.current || !createdMovement) return
    
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) {
          toast.error('No se pudo generar la imagen del comprobante.')
          return
        }

        const file = new File([blob], `Voucher_${createdMovement.id.toUpperCase()}.png`, { type: 'image/png' })

        // 1. Try Web Share API (mainly for mobile devices)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `Comprobante de ${createdMovement.tipo}`,
              text: `Almacén Casita - Comprobante de ${createdMovement.tipo}`
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedItems.length === 0) {
      toast.error('Debe agregar al menos un producto a la lista.')
      return
    }

    // Client-side validation and stock check
    for (const item of selectedItems) {
      if (item.cantidad === '' || item.cantidad <= 0) {
        toast.error(`Por favor, ingresa una cantidad válida (mayor que 0) para ${item.product.nombre}.`)
        return
      }
      const isUnidades = item.unidad_medida === 'unidades'
      const unitsNeeded = isUnidades ? Number(item.cantidad) : Number(item.cantidad) * item.product.unidades_por_caja
      const currentTotal = item.product.cantidad ?? (item.product.cajas * item.product.unidades_por_caja)

      if (tipo === 'Salida' && currentTotal < unitsNeeded) {
        const requestedDesc = isUnidades ? `${item.cantidad} unidades` : `${item.cantidad} cajas`
        toast.error(`Stock insuficiente para ${item.product.nombre}. Solicitado: ${requestedDesc}, Disponible: ${currentTotal} celulares.`)
        return
      }
    }

    setLoading(true)
    try {
      if (role === 'empleado') {
        const res = await createWithdrawalRequest({
          items: selectedItems.map(item => ({
            producto_id: item.product.id,
            cantidad: Number(item.cantidad),
            unidad_medida: item.unidad_medida
          })),
          motivo: motivo.trim() || 'Sin descripción',
          tipo
        })

        if (res.success) {
          toast.success(`Solicitud de ${tipo} enviada con éxito al administrador.`)
          handleOpenChange(false)
        } else {
          toast.error(res.error || 'Error al enviar la solicitud.')
        }
      } else {
        const res = await createMovementsBulk({
          tipo,
          motivo: motivo.trim() || 'Sin descripción',
          items: selectedItems.map(item => ({
            producto_id: item.product.id,
            cantidad: Number(item.cantidad),
            unidad_medida: item.unidad_medida
          }))
        })

        if (res.success) {
          toast.success(`Movimiento de ${tipo} registrado con éxito.`)
          
          if (tipo === 'Entrada' && res.movementBatch) {
            setCreatedMovement(res.movementBatch)
            setVoucherOpen(true)
          }
          
          handleOpenChange(false)
        } else {
          toast.error(res.error || 'Error al registrar movimiento.')
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ocurrió un error inesperado.')
    } finally {
      setLoading(false)
    }
  }

  const triggerElement = (
    role === 'empleado' ? (
      <Button className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold gap-2">
        <PlusCircle className="w-4 h-4" />
        <span>Solicitar Entrada</span>
      </Button>
    ) : tipo === 'Entrada' ? (
      <Button className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold gap-2">
        <PlusCircle className="w-4 h-4" />
        <span>Nueva Entrada</span>
      </Button>
    ) : (
      <Button variant="outline" className="border-zinc-800 hover:bg-zinc-800 text-zinc-100 hover:text-zinc-50 gap-2">
        <MinusCircle className="w-4 h-4 text-red-400" />
        <span>Nueva Salida</span>
      </Button>
    )
  )

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger render={triggerElement} />
        <DialogContent className="bg-zinc-900 border border-zinc-800 text-zinc-100 max-w-md">
          <DialogHeader>
            <DialogTitle>{role === 'empleado' ? 'Solicitar' : 'Registrar'} {tipo} de Mercancía</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              {role === 'empleado'
                ? (tipo === 'Entrada'
                  ? 'Envía una solicitud al administrador para ingresar stock en un solo lote.'
                  : 'Envía una solicitud al administrador para retirar stock en un solo lote.')
                : (tipo === 'Entrada'
                  ? 'Agrega stock de múltiples modelos de celulares al almacén (por cajas o sin caja).'
                  : 'Retira stock de múltiples modelos de celulares del almacén (por cajas o sin caja).')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4 py-2">
            {/* Custom Searchable Autocomplete Picker */}
            <div className="space-y-2 relative">
              <Label className="text-xs text-zinc-350">Agregar Producto / Celular (Buscador)</Label>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => setPickerOpen(!pickerOpen)}
                className="w-full bg-zinc-950 border-zinc-800 hover:bg-zinc-900 text-zinc-200 justify-between text-left font-normal text-xs h-10 px-3"
              >
                <span className="text-zinc-500 truncate">Buscar y agregar celular a la lista...</span>
                <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0 ml-2" />
              </Button>

              {/* Dropdown container */}
              {pickerOpen && (
                <div className="absolute z-50 mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-md shadow-2xl p-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                    <Input
                      placeholder="Escribe el código, modelo, color o GB..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 bg-zinc-900 border-zinc-800 text-xs h-8 text-zinc-100 placeholder-zinc-500 focus:border-emerald-500"
                      autoFocus
                    />
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto divide-y divide-zinc-900/60 pt-1">
                    {filteredProducts.length === 0 ? (
                      <div className="p-3 text-xs text-zinc-500 text-center">No se encontraron resultados</div>
                    ) : (
                      filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleAddProduct(product)}
                          className="w-full text-left px-2 py-2 hover:bg-zinc-900 text-xs text-zinc-300 rounded transition-colors flex justify-between items-center group"
                        >
                          <div className="flex flex-col truncate pr-2">
                            <span className="font-semibold text-zinc-200 group-hover:text-emerald-400 transition-colors">
                              [{product.codigo}] {product.nombre}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              Color: {product.color} | Memoria: {product.capacidad} | 📦 Caja de {product.unidades_por_caja} uds
                            </span>
                          </div>
                          <span className="text-[10px] bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded text-zinc-400 font-mono shrink-0 ml-2">
                            {product.cajas} cajas
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* List of Selected Products */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-350">Modelos a Registrar</Label>
              {selectedItems.length > 0 ? (
                <div className="space-y-2 max-h-52 overflow-y-auto border border-zinc-800/80 rounded-lg p-2 bg-zinc-950/40">
                  {selectedItems.map((item, index) => (
                    <div key={item.product.id} className="flex items-center justify-between gap-2 bg-zinc-900/40 border border-zinc-850 p-2 rounded-lg text-xs">
                      <div className="flex-1 truncate pr-1">
                        <span className="font-semibold text-zinc-200 block truncate">
                          [{item.product.codigo}] {item.product.nombre}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {item.product.color} | {item.product.capacidad} | 📦 {item.product.unidades_por_caja} uds/caja
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={item.unidad_medida}
                          onChange={(e) => {
                            const val = e.target.value as 'cajas' | 'unidades'
                            setSelectedItems(prev => prev.map((it, idx) => idx === index ? { ...it, unidad_medida: val } : it))
                          }}
                          className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-[11px] rounded h-8 px-1.5 focus:border-emerald-500 font-medium cursor-pointer"
                        >
                          <option value="cajas">📦 Cajas ({item.product.unidades_por_caja} uds)</option>
                          <option value="unidades">📱 Uds (Sin caja)</option>
                        </select>

                        <Input
                          type="number"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : (parseInt(e.target.value) || 0)
                            setSelectedItems(prev => prev.map((it, idx) => idx === index ? { ...it, cantidad: val } : it))
                          }}
                          className="w-16 h-8 text-center bg-zinc-950 border-zinc-800 text-xs focus:border-emerald-500 font-mono"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedItems(prev => prev.filter((_, idx) => idx !== index))}
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/5 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-zinc-650 border border-dashed border-zinc-800 rounded-lg text-xs">
                  Ningún producto seleccionado. Búscalo arriba para agregarlo.
                </div>
              )}
            </div>

            {/* Reason (Motivo) */}
            <div className="space-y-2">
              <Label htmlFor="motivo" className="text-xs text-zinc-350">Motivo / Descripción (Opcional)</Label>
              <Input
                id="motivo"
                placeholder={tipo === 'Entrada' ? 'Abastecimiento de lote, compra factura #...' : 'Venta a cliente, despacho local...'}
                className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs h-10"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="border-zinc-800 hover:bg-zinc-800 hover:text-zinc-50 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || selectedItems.length === 0}
                className={`font-semibold text-xs ${
                  tipo === 'Entrada'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-zinc-950'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-950'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  role === 'empleado' ? `Enviar Solicitud de ${tipo}` : `Registrar ${tipo}`
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Voucher Drawer Modal for Newly Created Entries */}
      <Dialog open={voucherOpen} onOpenChange={setVoucherOpen}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 text-zinc-100 max-w-sm flex flex-col items-center shadow-2xl z-50 animate-in fade-in zoom-in duration-200">
          <DialogHeader className="w-full text-center">
            <DialogTitle className="text-zinc-200">Comprobante de Entrada</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Usa los botones para compartir el comprobante por WhatsApp o descargarlo.
            </DialogDescription>
          </DialogHeader>

          {/* Canvas */}
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
    </>
  )
}
