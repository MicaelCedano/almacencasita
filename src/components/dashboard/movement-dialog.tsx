'use client'

import React, { useState, useRef, useCallback } from 'react'
import { createMovementsBulk } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { PlusCircle, MinusCircle, Loader2, Search, ChevronDown, Download, MessageSquare, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface MovementDialogProps {
  tipo: 'Entrada' | 'Salida';
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

export function MovementDialog({ tipo, products }: MovementDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Searchable picker states
  const [pickerOpen, setPickerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Selected items list state
  const [selectedItems, setSelectedItems] = useState<{
    product: typeof products[number];
    cantidad: number | '';
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
    setSelectedItems((prev) => [...prev, { product, cantidad: 1 }])
    setPickerOpen(false)
    setSearchQuery('')
    toast.success(`Añadido: ${product.nombre}`)
  }

  const drawVoucher = (canvas: HTMLCanvasElement | null) => {
    if (!canvas || !createdMovement) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const itemsCount = createdMovement.items?.length || 0
    const baseHeight = 360
    const itemsHeight = itemsCount * 22
    const canvasHeight = baseHeight + itemsHeight

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
    const isEntrada = createdMovement.tipo === 'Entrada'
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
    
    const dateText = new Date(createdMovement.fecha).toLocaleDateString('es-ES', {
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
    ctx.fillText(createdMovement.id.toUpperCase(), 130, 130)
    ctx.fillText(dateText, 130, 150)
    ctx.fillText(createdMovement.user?.fullName || 'Administrador', 130, 170)
    
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
    ctx.fillText('CANTIDAD', 420, y)

    y += 10
    ctx.strokeStyle = '#3f3f46'
    ctx.beginPath()
    ctx.moveTo(30, y)
    ctx.lineTo(470, y)
    ctx.stroke()
    
    y += 20

    // Render products rows
    let totalCajas = 0
    let totalUnits = 0

    for (const item of createdMovement.items || []) {
      ctx.fillStyle = '#ffffff'
      ctx.font = '10px Courier New'

      const name = `${item.nombre} (${item.capacidad} - ${item.color})`
      const fullText = `[${item.codigo}] ${name}`
      const descText = fullText.length > 60 ? fullText.substring(0, 57) + '...' : fullText
      ctx.fillText(descText, 40, y)
      
      ctx.fillStyle = isEntrada ? '#34d399' : '#fb7185'
      ctx.fillText(`${item.cantidad} cajas`, 420, y)

      totalCajas += item.cantidad
      totalUnits += item.cantidad * item.unidades_por_caja
      y += 22
    }

    // Divider after list
    ctx.strokeStyle = '#3f3f46'
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(30, y - 5)
    ctx.lineTo(470, y - 5)
    ctx.stroke()
    ctx.setLineDash([])

    // Totals
    y += 15
    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px Courier New'
    ctx.fillText('TOTAL CAJAS:', 40, y)
    ctx.fillStyle = isEntrada ? '#10b981' : '#f43f5e'
    ctx.font = 'bold 13px Courier New'
    ctx.fillText(`${totalCajas} cajas`, 190, y)

    y += 20
    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px Courier New'
    ctx.fillText('TOTAL UDS:', 40, y)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`${totalUnits} celulares`, 190, y)

    y += 35
    // barcode simulation
    ctx.fillStyle = '#94a3b8'
    ctx.textAlign = 'center'
    ctx.font = '10px Courier New'
    ctx.fillText('*' + createdMovement.id.toUpperCase() + '*', 250, y + 40)
    
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

  const handleWhatsAppShare = () => {
    if (!createdMovement) return
    const dateText = new Date(createdMovement.fecha).toLocaleString()

    let itemsText = ''
    let totalCajas = 0
    let totalUnits = 0

    createdMovement.items.forEach((item: any, idx: number) => {
      const units = item.cantidad * item.unidades_por_caja
      totalCajas += item.cantidad
      totalUnits += units
      itemsText += `${idx + 1}. *[${item.codigo}] ${item.nombre}*\n` +
        `   Color: ${item.color} | Memoria: ${item.capacidad}\n` +
        `   Cantidad: *${item.cantidad} cajas* (${units} celulares)\n`
    })

    const text = `*Almacén Casita - Comprobante de ${createdMovement.tipo}*\n` +
      `----------------------------------------\n` +
      `*ID MOV:* ${createdMovement.id.toUpperCase()}\n` +
      `*FECHA:* ${dateText}\n` +
      `*REGISTRÓ:* ${createdMovement.user?.fullName || 'Administrador'}\n` +
      `*ESTADO:* ${createdMovement.tipo === 'Entrada' ? 'INGRESADO' : 'RETIRADO'} E INVENTARIADO\n` +
      `----------------------------------------\n` +
      `*PRODUCTOS REGISTRADOS:*\n` +
      itemsText +
      `----------------------------------------\n` +
      `*TOTAL CAJAS:* *${totalCajas} cajas*\n` +
      `*TOTAL CELULARES:* *${totalUnits} unidades*\n` +
      `----------------------------------------\n` +
      `Comprobante verificado por el administrador.`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(whatsappUrl, '_blank')
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
        toast.error(`Por favor, ingresa una cantidad válida de cajas (mayor que 0) para ${item.product.nombre}.`)
        return
      }
      if (tipo === 'Salida' && item.product.cajas < item.cantidad) {
        toast.error(`Stock insuficiente para ${item.product.nombre}. Solo hay ${item.product.cajas} cajas disponibles.`)
        return
      }
    }

    setLoading(true)
    try {
      const res = await createMovementsBulk({
        tipo,
        motivo: motivo.trim() || 'Sin descripción',
        items: selectedItems.map(item => ({
          producto_id: item.product.id,
          cantidad: Number(item.cantidad)
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ocurrió un error inesperado.')
    } finally {
      setLoading(false)
    }
  }

  const triggerElement = (
    tipo === 'Entrada' ? (
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
            <DialogTitle>Registrar {tipo} de Mercancía</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              {tipo === 'Entrada'
                ? 'Agrega stock de múltiples modelos de celulares al almacén en un solo lote.'
                : 'Retira stock de múltiples modelos de celulares del almacén en un solo lote.'}
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
                              Color: {product.color} | Memoria: {product.capacidad} | Marca: {product.marca}
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
                    <div key={item.product.id} className="flex items-center justify-between gap-3 bg-zinc-900/40 border border-zinc-850 p-2 rounded-lg text-xs">
                      <div className="flex-1 truncate">
                        <span className="font-semibold text-zinc-200 block truncate">
                          [{item.product.codigo}] {item.product.nombre}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {item.product.color} | {item.product.capacidad}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-zinc-550">Cajas:</span>
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
                  `Registrar ${tipo}`
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
