'use client'

import React, { useState, useMemo, useRef, useEffect, useTransition, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NewProductDialog } from '@/components/dashboard/new-product-dialog'
import { BulkImportDialog } from '@/components/dashboard/bulk-import-dialog'
import { MovementDialog } from '@/components/dashboard/movement-dialog'
import { approveWithdrawalRequest, rejectWithdrawalRequest, createWithdrawalRequest } from '@/app/dashboard/actions'
import { 
  Search, 
  X, 
  ArrowUpDown,
  FileText,
  Clock,
  Download,
  MessageSquare,
  Check,
  ClipboardList,
  Layers,
  Trash2,
  Send,
  Smartphone
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface Movement {
  tipo: 'Entrada' | 'Salida';
  cantidad: number; // in boxes
  fecha: string;
  motivo: string;
}

interface Product {
  id: string;
  codigo: string;
  nombre: string;
  marca: string;
  color: string;
  capacidad: string;
  descripcion?: string;
  cajas: number;
  unidades_por_caja: number;
  cantidad: number;
  fecha_creacion: string;
  fecha_actualizacion: string;
  movements?: Movement[];
}

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

interface UserRequest {
  id: string;
  motivo: string;
  usuario_id: string;
  estado: 'Pendiente' | 'Aprobado' | 'Rechazado';
  fecha: string;
  items: RequestItemDetails[];
  requesterName: string;
}

function getColorBadgeStyle(colorName: string): React.CSSProperties {
  const name = colorName.toLowerCase().trim()
  
  // Default fallback (zinc style)
  let bg = 'rgba(39, 39, 42, 0.4)'
  let text = '#d4d4d8'
  let border = '#3f3f46'
  
  if (name.includes('azul') || name.includes('blue')) {
    bg = 'rgba(59, 130, 246, 0.15)'
    text = '#60a5fa'
    border = 'rgba(59, 130, 246, 0.35)'
  } else if (name.includes('verde') || name.includes('green')) {
    bg = 'rgba(16, 185, 129, 0.15)'
    text = '#34d399'
    border = 'rgba(16, 185, 129, 0.35)'
  } else if (name.includes('rojo') || name.includes('red')) {
    bg = 'rgba(239, 68, 68, 0.15)'
    text = '#f87171'
    border = 'rgba(239, 68, 68, 0.35)'
  } else if (name.includes('naranja') || name.includes('orange')) {
    bg = 'rgba(249, 115, 22, 0.15)'
    text = '#fb923c'
    border = 'rgba(249, 115, 22, 0.35)'
  } else if (name.includes('amarillo') || name.includes('yellow')) {
    bg = 'rgba(234, 179, 8, 0.15)'
    text = '#facc15'
    border = 'rgba(234, 179, 8, 0.35)'
  } else if (name.includes('rosa') || name.includes('pink')) {
    bg = 'rgba(236, 72, 153, 0.15)'
    text = '#f472b6'
    border = 'rgba(236, 72, 153, 0.35)'
  } else if (name.includes('morado') || name.includes('purpura') || name.includes('purple')) {
    bg = 'rgba(168, 85, 247, 0.15)'
    text = '#c084fc'
    border = 'rgba(168, 85, 247, 0.35)'
  } else if (name.includes('negro') || name.includes('black') || name.includes('oscuro')) {
    bg = 'rgba(9, 9, 11, 0.8)'
    text = '#ffffff'
    border = 'rgba(255, 255, 255, 0.15)'
  } else if (name.includes('blanco') || name.includes('white')) {
    bg = 'rgba(255, 255, 255, 0.95)'
    text = '#09090b'
    border = 'rgba(0, 0, 0, 0.15)'
  } else if (name.includes('gris') || name.includes('gray') || name.includes('grey') || name.includes('titanio') || name.includes('plata') || name.includes('silver')) {
    bg = 'rgba(100, 116, 139, 0.15)'
    text = '#cbd5e1'
    border = 'rgba(100, 116, 139, 0.35)'
  } else if (name.includes('oro') || name.includes('dorado') || name.includes('gold')) {
    bg = 'rgba(202, 138, 4, 0.15)'
    text = '#fef08a'
    border = 'rgba(202, 138, 4, 0.35)'
  }

  return {
    backgroundColor: bg,
    color: text,
    borderColor: border,
  }
}

interface InventoryDashboardProps {
  products: Product[];
  role: 'admin' | 'empleado';
  requests?: UserRequest[];
}

export default function InventoryDashboard({ products, role, requests = [] }: InventoryDashboardProps) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('ALL')
  const [sorting, setSorting] = useState<SortingState>([])
  const [isPending, startTransition] = useTransition()

  // Calculate totals
  const totalCajas = useMemo(() => {
    return products.reduce((sum, p) => sum + p.cajas, 0)
  }, [products])

  const totalEquipos = useMemo(() => {
    return products.reduce((sum, p) => sum + p.cantidad, 0)
  }, [products])

  // Shopping cart state (for Almacenista)
  const [cart, setCart] = useState<{ [productId: string]: number }>({})
  const [cartSubmitOpen, setCartSubmitOpen] = useState(false)
  const [motivo, setMotivo] = useState('')

  // Voucher state
  const [voucherOpen, setVoucherOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<UserRequest | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Cart operations
  const addToCart = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    setCart(prev => {
      const currentVal = prev[productId] || 0
      if (currentVal >= product.cajas) {
        toast.error(`Stock máximo alcanzado (${product.cajas} cajas disponibles).`)
        return prev
      }
      toast.success(`Añadido: ${product.nombre} al vale de salida.`)
      return { ...prev, [productId]: currentVal + 1 }
    })
  }, [products])

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => {
      const next = { ...prev }
      if (next[productId] > 1) {
        next[productId] -= 1
      } else {
        delete next[productId]
      }
      return next
    })
  }, [])

  const clearCart = () => {
    setCart({})
    toast.info('Carrito de vale vaciado.')
  }

  // Draw voucher helper function
  const drawVoucher = (canvas: HTMLCanvasElement | null) => {
    if (!canvas || !selectedRequest) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const itemsCount = selectedRequest.items?.length || 0
    const baseHeight = 360
    const itemsHeight = itemsCount * 22
    const canvasHeight = baseHeight + itemsHeight

    // Set canvas size (scaled)
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
    ctx.fillStyle = '#10b981'
    ctx.font = 'bold 24px Courier New'
    ctx.textAlign = 'center'
    ctx.fillText('ALMACEN CASITA', 250, 55)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '13px Courier New'
    ctx.fillText('COMPROBANTE DE ENTREGA', 250, 80)

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
    
    const dateText = new Date(selectedRequest.fecha).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    // Labels in gray, values in pure white for maximum legibility
    ctx.fillText('ID VALE: ', 40, 130)
    ctx.fillText('FECHA:   ', 40, 150)
    ctx.fillText('ENTREGA: ', 40, 170)
    ctx.fillText('ESTADO:  ', 40, 190)

    ctx.fillStyle = '#ffffff'
    ctx.fillText(selectedRequest.id.toUpperCase(), 130, 130)
    ctx.fillText(dateText, 130, 150)
    ctx.fillText(selectedRequest.requesterName || 'Almacenista', 130, 170)
    
    ctx.fillStyle = '#34d399' // status in light emerald
    ctx.fillText('APROBADO E INVENTARIADO', 130, 190)

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

    // Render items
    let totalCajas = 0
    let totalUnits = 0

    for (const item of selectedRequest.items || []) {
      ctx.fillStyle = '#ffffff' // Pure white text
      ctx.font = '12px Courier New'

      const name = `${item.nombre} (${item.capacidad} - ${item.color})`
      const fullText = `[${item.codigo}] ${name}`
      const descText = fullText.length > 45 ? fullText.substring(0, 42) + '...' : fullText
      ctx.fillText(descText, 40, y)
      
      ctx.fillStyle = '#34d399' // highlight count in emerald
      ctx.fillText(`${item.cantidad} cajas`, 370, y)

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
    ctx.fillText('TOTAL CAJAS:', 40, y)
    ctx.fillStyle = '#10b981'
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
    ctx.fillText('*' + selectedRequest.id.toUpperCase() + '*', 250, y + 40)
    
    ctx.fillStyle = '#ffffff'
    let startX = 135
    for (let i = 0; i < 35; i++) {
      const lineWidth = (Math.sin(i * 3.7) > 0) ? 5 : 2
      ctx.fillRect(startX, y, lineWidth, 28)
      startX += lineWidth + (i % 3 === 0 ? 3 : 1)
    }
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
    link.download = `Vale_Entrega_${selectedRequest.id.toUpperCase()}.png`
    link.click()
    toast.success('Vale de entrega descargado.')
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
      `*ESTADO:* APROBADO E INVENTARIADO\n` +
      `----------------------------------------\n` +
      `*PRODUCTOS ENTREGADOS:*\n` +
      itemsText +
      `----------------------------------------\n` +
      `*TOTAL CAJAS:* *${totalCajas} cajas*\n` +
      `*TOTAL CELULARES:* *${totalUnits} unidades*\n` +
      `----------------------------------------\n` +
      `Comprobante verificado por el administrador.`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
    window.open(whatsappUrl, '_blank')
  }

  // Admin Request Actions
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

  // Submit Cart exit request (Almacenista)
  const handleCartSubmit = () => {
    if (Object.keys(cart).length === 0) return

    startTransition(async () => {
      const items = Object.entries(cart).map(([producto_id, cantidad]) => ({
        producto_id,
        cantidad
      }))

      const res = await createWithdrawalRequest({
        items,
        motivo: motivo.trim() || 'Sin descripción'
      })

      if (res.success) {
        toast.success('Solicitud de vale enviada al administrador con éxito.')
        setCart({})
        setMotivo('')
        setCartSubmitOpen(false)
      } else {
        toast.error(res.error || 'Error al enviar la solicitud.')
      }
    })
  }

  // Get unique brands for filter
  const brands = useMemo(() => {
    const set = new Set(products.map((p) => p.marca))
    return Array.from(set).sort()
  }, [products])

  // Process products to include formatted latest movement
  const tableData = useMemo(() => {
    return products
      .filter((p) => p.cajas > 0)
      .map((product) => {
        let ultimoMovText = 'Sin movimientos'
        if (product.movements && product.movements.length > 0) {
          const sorted = [...product.movements].sort(
            (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
          )
          const latest = sorted[0]
          const formattedDate = new Date(latest.fecha).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
          ultimoMovText = `${latest.tipo} (${latest.cantidad} cajas) - ${formattedDate}`
        }
        return {
          ...product,
          ultimo_movimiento: ultimoMovText,
        }
      })
      .sort((a, b) => {
        const brandCompare = a.marca.localeCompare(b.marca)
        if (brandCompare !== 0) return brandCompare

        const nameCompare = a.nombre.localeCompare(b.nombre)
        if (nameCompare !== 0) return nameCompare

        const capCompare = a.capacidad.localeCompare(b.capacidad)
        if (capCompare !== 0) return capCompare

        return a.color.localeCompare(b.color)
      })
  }, [products])

  // Filtered data based on Dropdown
  const filteredTableData = useMemo(() => {
    return tableData.filter((item) => {
      return brandFilter === 'ALL' || item.marca === brandFilter
    })
  }, [tableData, brandFilter])

  type RowData = Product & { ultimo_movimiento: string };

  // Table Columns Definition
  const columns = useMemo<ColumnDef<RowData>[]>(
    () => [
      {
        accessorKey: 'codigo',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="hover:bg-zinc-800 text-zinc-300 font-medium px-2 py-1"
          >
            Código <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-zinc-500" />
          </Button>
        ),
        cell: ({ row }) => <span className="font-mono text-zinc-300 font-semibold">{row.getValue('codigo')}</span>,
      },
      {
        accessorKey: 'marca',
        header: 'Marca',
        cell: ({ row }) => <span className="text-zinc-400">{row.getValue('marca')}</span>,
      },
      {
        accessorKey: 'nombre',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="hover:bg-zinc-800 text-zinc-300 font-medium px-2 py-1"
          >
            Modelo / Nombre <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-zinc-500" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-zinc-100 font-medium">{row.getValue('nombre')}</span>
            {row.original.descripcion && (
              <span className="text-[10px] text-zinc-500 truncate max-w-[200px]">
                {row.original.descripcion}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'capacidad',
        header: 'Memoria',
        cell: ({ row }) => (
          <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/5 text-emerald-400 font-mono text-[10px] font-bold">
            {row.getValue('capacidad')}
          </Badge>
        ),
      },
      {
        accessorKey: 'color',
        header: 'Color',
        cell: ({ row }) => {
          const colorName = String(row.getValue('color') || '')
          return (
            <Badge 
              variant="outline" 
              style={getColorBadgeStyle(colorName)}
              className="border text-[10px] font-medium uppercase"
            >
              {colorName}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'cajas',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="hover:bg-zinc-800 text-zinc-300 font-medium px-2 py-1"
          >
            Cajas <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-zinc-500" />
          </Button>
        ),
        cell: ({ row }) => {
          const cajas = Number(row.getValue('cajas'))
          return (
            <Badge variant="outline" className={`font-mono font-bold text-xs ${
              cajas === 0 
                ? 'border-red-500/20 bg-red-500/5 text-red-400' 
                : 'border-zinc-800 bg-zinc-900/50 text-zinc-300'
            }`}>
              {cajas} {cajas === 1 ? 'caja' : 'cajas'}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'unidades_por_caja',
        header: 'Uds. por Caja',
        cell: ({ row }) => <span className="font-mono text-zinc-500 text-xs">{row.original.unidades_por_caja}/caja</span>,
      },
      {
        accessorKey: 'cantidad',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="hover:bg-zinc-800 text-zinc-300 font-medium px-2 py-1"
          >
            Celulares Disponibles <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-zinc-500" />
          </Button>
        ),
        cell: ({ row }) => {
          const qty = Number(row.getValue('cantidad'))
          if (qty === 0) {
            return <span className="font-mono font-bold text-red-500">Agotado</span>
          }
          return <span className="font-mono text-emerald-400 font-bold">{qty} uds</span>
        },
      },
      {
        id: 'actions',
        header: 'Pedir Salida',
        cell: ({ row }) => {
          if (role === 'admin') return null
          const p = row.original
          const qty = cart[p.id] || 0
          
          if (qty === 0) {
            return (
              <Button
                size="sm"
                onClick={() => addToCart(p.id)}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-100 text-[10px] h-8 px-2.5 font-semibold"
              >
                + Añadir
              </Button>
            )
          }

          return (
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-850 rounded-lg p-0.5 w-fit">
              <button
                type="button"
                onClick={() => removeFromCart(p.id)}
                className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold flex items-center justify-center text-xs"
              >
                -
              </button>
              <span className="text-xs font-mono font-bold px-1.5 text-emerald-400">{qty}</span>
              <button
                type="button"
                onClick={() => addToCart(p.id)}
                className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold flex items-center justify-center text-xs"
              >
                +
              </button>
            </div>
          )
        }
      }
    ],
    [role, cart, addToCart, removeFromCart]
  )

  // React Table Instance
  const table = useReactTable({
    data: filteredTableData,
    columns,
    state: {
      globalFilter,
      sorting,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // Clear filters helper
  const isFiltered = brandFilter !== 'ALL' || globalFilter !== ''
  const handleClearFilters = () => {
    setBrandFilter('ALL')
    setGlobalFilter('')
  }

  // Filtered requests lists
  const pendingRequests = useMemo(() => requests.filter(r => r.estado === 'Pendiente'), [requests])
  const processedRequests = useMemo(() => requests.filter(r => r.estado !== 'Pendiente'), [requests])

  return (
    <div className="space-y-6 pb-24">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Almacén Casita</h1>
          <p className="text-sm text-zinc-400">
            {role === 'admin' 
              ? 'Consulta las existencias de celulares y aprueba las solicitudes de entrega.'
              : 'Consulta existencias y agrega celulares al vale para solicitar su salida.'}
          </p>
        </div>

        {/* Action Controls based on Role */}
        <div className="flex flex-wrap items-center gap-2">
          {role === 'admin' && (
            <>
              <BulkImportDialog />
              <NewProductDialog />
              <MovementDialog tipo="Entrada" products={products} />
              <MovementDialog tipo="Salida" products={products.filter((p) => p.cajas > 0)} />
            </>
          )}
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-3 flex items-center gap-3 backdrop-blur-sm">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Layers className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider block">Total Cajas</span>
            <span className="text-base font-bold text-zinc-100 font-mono">{totalCajas} cajas</span>
          </div>
        </div>

        <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-3 flex items-center gap-3 backdrop-blur-sm">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Smartphone className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider block">Total Equipos</span>
            <span className="text-base font-bold text-zinc-100 font-mono">{totalEquipos} uds</span>
          </div>
        </div>
      </div>

      {/* Admin Pending Requests Panel (Direct Approval Workspace) */}
      {role === 'admin' && (
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 md:p-6 backdrop-blur-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-amber-400" />
              <span>Solicitudes de Salida de los Almacenistas</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Autoriza o rechaza las salidas pedidas por tu equipo. Al aprobar, el stock se descuenta al instante y se genera el vale para compartir.
            </p>
          </div>

          {/* Pending Requests List */}
          <div className="space-y-3">
            {pendingRequests.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pendingRequests.map((req) => {
                  const totalCajas = req.items?.reduce((s, i) => s + i.cantidad, 0) || 0
                  return (
                    <div 
                      key={req.id} 
                      className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-start">
                          <div className="truncate">
                            <span className="text-[9px] font-mono text-zinc-500 block">
                              {new Date(req.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <h4 className="text-xs font-bold text-zinc-200 mt-0.5 truncate">Solicita: {req.requesterName}</h4>
                          </div>
                          <Badge variant="outline" className="border-amber-500/20 bg-amber-500/5 text-amber-400 text-[8px] font-bold uppercase shrink-0">
                            Pendiente
                          </Badge>
                        </div>

                        {/* Items list */}
                        <div className="space-y-1.5">
                          {req.items?.map((item, idx) => (
                            <div key={idx} className="bg-zinc-900/40 border border-zinc-900 rounded-lg p-2 text-xs">
                              <span className="font-semibold text-zinc-200 block truncate">{item.nombre}</span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                [{item.codigo}] {item.color} | {item.capacidad}
                              </span>
                              <span className="text-right text-[10px] text-zinc-300 font-mono block mt-1 font-bold">
                                Cantidad: {item.cantidad} cajas
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-between items-center text-xs font-mono py-1.5 border-y border-zinc-900/60">
                          <span className="text-zinc-500">Cajas Totales:</span>
                          <span className="text-emerald-400 font-bold">{totalCajas} cajas</span>
                        </div>

                        {req.motivo && (
                          <div className="text-[10px] text-zinc-400 flex items-start gap-1 pt-0.5">
                            <ClipboardList className="w-3.5 h-3.5 text-zinc-650 shrink-0 mt-0.5" />
                            <span className="italic">Motivo: &quot;{req.motivo}&quot;</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-zinc-900/40">
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleRequestApprove(req.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold h-9 px-3 flex-1 justify-center"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Aprobar Salida
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
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-zinc-500 border border-zinc-800 bg-zinc-950/20 rounded-xl text-xs">
                No hay solicitudes de salida pendientes.
              </div>
            )}
          </div>

          {/* Recents list of processed requests */}
          {processedRequests.length > 0 && (
            <div className="pt-3 border-t border-zinc-800/60">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Últimas Solicitudes Procesadas</h3>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-2">
                {processedRequests.slice(0, 5).map((req) => {
                  const totalCajas = req.items?.reduce((s, i) => s + i.cantidad, 0) || 0
                  return (
                    <div 
                      key={req.id} 
                      className="flex justify-between items-center text-xs bg-zinc-950/20 border border-zinc-900 rounded-lg p-2"
                    >
                      <div className="truncate pr-4 text-zinc-400">
                        <span className="font-semibold text-zinc-300">{req.requesterName}</span>
                        <span className="text-zinc-500"> pidió </span>
                        <span className="font-mono text-zinc-200 font-bold">{totalCajas} cajas</span>
                        <span className="text-zinc-550"> de mercadería </span>
                        <span className="text-zinc-500 font-mono text-[10px]">({req.items?.length} modelos)</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[8px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            req.estado === 'Aprobado'
                              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                              : 'border-red-500/20 bg-red-500/5 text-red-400'
                          }`}
                        >
                          {req.estado}
                        </Badge>
                        {req.estado === 'Aprobado' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedRequest(req)
                              setVoucherOpen(true)
                            }}
                            className="text-zinc-400 hover:text-emerald-400 h-7 text-[10px] gap-1 px-2 hover:bg-zinc-900"
                          >
                            <FileText className="w-3.5 h-3.5" /> Vale
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table & Controls Section */}
      <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 md:p-6 backdrop-blur-sm space-y-4">
        {/* Search and Filters Header */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
          {/* Search bar */}
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Buscar por código, modelo, marca..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-zinc-100 placeholder-zinc-500 w-full text-xs h-10"
            />
          </div>

          {/* Filters dropdowns */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Brand select */}
            <div className="w-full sm:w-[180px]">
              <Select value={brandFilter} onValueChange={(val) => setBrandFilter(val || 'ALL')}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100 text-xs h-10">
                  <SelectValue placeholder="Filtrar por Marca" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100 text-xs">
                  <SelectItem value="ALL">Todas las Marcas</SelectItem>
                  {brands.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters Button */}
            {isFiltered && (
              <Button
                variant="ghost"
                onClick={handleClearFilters}
                className="text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 gap-1.5 h-10 w-full sm:w-auto"
              >
                <X className="w-3.5 h-3.5" />
                Limpiar Filtros
              </Button>
            )}
          </div>
        </div>

        {/* Inventory Data Table (Desktop) */}
        <div className="hidden md:block rounded-lg border border-zinc-800 bg-zinc-950/40 overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-950/80">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b border-zinc-800 hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="text-zinc-400 py-3 text-xs">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-b border-zinc-800 hover:bg-zinc-900/20 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-4 text-xs">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center text-zinc-500">
                    Ningún producto coincide con los filtros de búsqueda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards View */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => {
              const product = row.original
              const isAgotado = product.cajas === 0
              const isEntrada = product.ultimo_movimiento.startsWith('Entrada')
              const isSalida = product.ultimo_movimiento.startsWith('Salida')

              // Cart count inside card
              const qty = cart[product.id] || 0

              return (
                <div 
                  key={product.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 relative"
                >
                  <div className="flex justify-between items-start">
                    <div className="truncate">
                      <span className="text-[10px] font-mono text-zinc-500 font-bold tracking-wider">
                        {product.codigo}
                      </span>
                      <h3 className="text-zinc-100 font-bold text-sm mt-0.5 truncate">{product.nombre}</h3>
                    </div>
                    <span className="text-xs font-mono font-bold text-zinc-400 shrink-0 ml-2">
                      {product.marca}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge 
                      variant="outline" 
                      style={getColorBadgeStyle(product.color)}
                      className="border text-[10px] py-0.5 font-medium uppercase"
                    >
                      {product.color}
                    </Badge>
                    <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[10px] py-0.5 font-bold font-mono">
                      {product.capacidad}
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center text-xs border-t border-zinc-900/60 pt-2.5 font-mono">
                    <span className="text-zinc-500">{product.unidades_por_caja} uds/caja</span>
                    <span className={isAgotado ? 'text-red-500 font-bold' : 'text-emerald-400 font-bold'}>
                      {product.cajas} cajas ({product.cantidad} uds)
                    </span>
                  </div>

                  {product.ultimo_movimiento && product.ultimo_movimiento !== 'Sin movimientos' && (
                    <div className="bg-zinc-900/40 border border-zinc-850 rounded-lg p-2 text-[10px] text-zinc-400 flex items-center gap-1.5 font-sans">
                      {isEntrada && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                      {isSalida && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
                      {!isEntrada && !isSalida && <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />}
                      <span className="truncate text-[9px]">Último: {product.ultimo_movimiento}</span>
                    </div>
                  )}

                  {/* Add to slip controls for mobile card */}
                  {role !== 'admin' && (
                    <div className="pt-2 border-t border-zinc-900/40 flex justify-end">
                      {qty === 0 ? (
                        <Button
                          size="sm"
                          onClick={() => addToCart(product.id)}
                          className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-100 text-xs h-9 font-semibold justify-center gap-1"
                        >
                          + Añadir al Vale
                        </Button>
                      ) : (
                        <div className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-xl p-1 w-full justify-between">
                          <button
                            type="button"
                            onClick={() => removeFromCart(product.id)}
                            className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold flex items-center justify-center text-sm"
                          >
                            -
                          </button>
                          <span className="text-sm font-mono font-bold text-emerald-400">{qty} cajas</span>
                          <button
                            type="button"
                            onClick={() => addToCart(product.id)}
                            className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold flex items-center justify-center text-sm"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="p-8 text-center text-zinc-500 border border-zinc-800 bg-zinc-950/40 rounded-xl text-xs">
              Ningún producto coincide con los filtros de búsqueda.
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-2">
          <span>Mostrando {filteredTableData.length} de {products.length} modelos de celular</span>
          <span>Inventario de celulares actualizado en tiempo real</span>
        </div>
      </div>

      {/* Almacenista Requests Tracking section (Only for Almacenistas) */}
      {role !== 'admin' && (
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 md:p-6 backdrop-blur-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Mis Solicitudes de Salida</span>
            </h3>
            <p className="text-[10px] text-zinc-500">Historial de vales de mercancía solicitados al administrador.</p>
          </div>

          {/* Desktop Requests Table */}
          <div className="hidden md:block rounded-lg border border-zinc-800 bg-zinc-950/40 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-950/80">
                <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 py-2.5 text-[10px]">Fecha</TableHead>
                  <TableHead className="text-zinc-400 py-2.5 text-[10px]">Productos Solicitados</TableHead>
                  <TableHead className="text-zinc-400 py-2.5 text-[10px]">Total Cajas</TableHead>
                  <TableHead className="text-zinc-400 py-2.5 text-[10px]">Motivo</TableHead>
                  <TableHead className="text-zinc-400 py-2.5 text-[10px]">Estado</TableHead>
                  <TableHead className="text-zinc-400 py-2.5 text-[10px] text-right">Comprobante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length > 0 ? (
                  requests.map((req) => {
                    const totalCajas = req.items?.reduce((s, i) => s + i.cantidad, 0) || 0
                    return (
                      <TableRow key={req.id} className="border-b border-zinc-850 hover:bg-zinc-900/10 text-xs">
                        <TableCell className="py-3 font-mono text-zinc-500 text-[10px]">
                          {new Date(req.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell className="py-3 max-w-sm">
                          <div className="flex flex-col gap-1.5">
                            {req.items?.map((item, idx) => (
                              <div key={idx} className="text-xs bg-zinc-900/50 border border-zinc-850 p-2 rounded-lg">
                                <span className="font-semibold text-zinc-200 block">
                                  {item.nombre}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono block">
                                  [{item.codigo}] {item.color} | {item.capacidad} | *{item.cantidad} cajas*
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 font-mono text-zinc-300 font-semibold">{totalCajas} cajas</TableCell>
                        <TableCell className="py-3 text-zinc-400 truncate max-w-[120px]">{req.motivo}</TableCell>
                        <TableCell className="py-3">
                          <Badge
                            variant="outline"
                            className={`uppercase text-[8px] font-bold px-1.5 py-0.5 rounded ${
                              req.estado === 'Aprobado'
                                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                                : req.estado === 'Rechazado'
                                ? 'border-red-500/20 bg-red-500/5 text-red-400'
                                : 'border-amber-500/20 bg-amber-500/5 text-amber-400'
                            }`}
                          >
                            {req.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          {req.estado === 'Aprobado' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedRequest(req)
                                setVoucherOpen(true)
                              }}
                              className="text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900 h-7 text-[10px] gap-1 px-2"
                            >
                              <FileText className="w-3 w-3" /> Ver Vale
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-zinc-650 text-xs">
                      Aún no has enviado ninguna solicitud de salida.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Requests Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {requests.length > 0 ? (
              requests.map((req) => {
                const totalCajas = req.items?.reduce((s, i) => s + i.cantidad, 0) || 0
                return (
                  <div key={req.id} className="bg-zinc-950/40 border border-zinc-850 rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] font-mono text-zinc-600">
                        {new Date(req.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <Badge
                        variant="outline"
                        className={`uppercase text-[8px] font-bold px-1.5 py-0.5 rounded ${
                          req.estado === 'Aprobado'
                            ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                            : req.estado === 'Rechazado'
                            ? 'border-red-500/20 bg-red-500/5 text-red-400'
                            : 'border-amber-500/20 bg-amber-500/5 text-amber-400'
                        }`}
                      >
                        {req.estado}
                      </Badge>
                    </div>

                    <div className="space-y-1.5">
                      {req.items?.map((item, idx) => (
                        <div key={idx} className="bg-zinc-900/30 p-2 border border-zinc-900 rounded-lg text-xs">
                          <div className="font-semibold text-zinc-300">{item.nombre}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            [{item.codigo}] {item.color} | {item.capacidad}
                          </div>
                          <div className="text-right text-[10px] text-zinc-400 font-mono font-bold mt-0.5">
                            {item.cantidad} cajas
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between items-center text-[11px] font-mono pt-1.5 border-t border-zinc-900/60">
                      <span className="text-zinc-500">Cajas Totales:</span>
                      <span className="text-zinc-200 font-bold">{totalCajas} cajas</span>
                    </div>

                    {req.estado === 'Aprobado' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedRequest(req)
                          setVoucherOpen(true)
                        }}
                        className="border-zinc-850 text-zinc-350 hover:text-emerald-400 h-8 w-full justify-center gap-1 text-[10px]"
                      >
                        <FileText className="w-3.5 h-3.5" /> Ver Voucher / Vale de Entrega
                      </Button>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="p-6 text-center text-zinc-650 border border-zinc-850 bg-zinc-950/40 rounded-xl text-xs">
                Aún no tienes solicitudes registradas.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Cart bar (Only visible when Almacenista has items in cart) */}
      {Object.keys(cart).length > 0 && role !== 'admin' && (
        <div className="fixed bottom-4 left-4 right-4 z-40 bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-bottom duration-300 max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 w-10 h-10 rounded-full flex items-center justify-center text-emerald-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-100">Vale de Salida en Preparación</h4>
              <p className="text-[10px] text-zinc-400">
                Has seleccionado {Object.keys(cart).length} modelos ({Object.values(cart).reduce((a, b) => a + b, 0)} cajas en total).
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearCart}
              className="border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs h-9 px-3 flex-1 sm:flex-none justify-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5 text-zinc-400" /> Vaciar
            </Button>
            <Button
              size="sm"
              onClick={() => setCartSubmitOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs h-9 px-4 flex-1 sm:flex-none justify-center gap-1"
            >
              <Send className="w-3.5 h-3.5 text-zinc-950" /> Pedir Vale
            </Button>
          </div>
        </div>
      )}

      {/* Cart submission modal */}
      <Dialog open={cartSubmitOpen} onOpenChange={setCartSubmitOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Solicitud de Salida</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Revisa la lista de celulares antes de enviar la solicitud al administrador.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* List of items in cart */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Productos Seleccionados:</span>
              {Object.entries(cart).map(([productId, quantity]) => {
                const product = products.find(p => p.id === productId)
                if (!product) return null
                return (
                  <div key={productId} className="flex justify-between items-center bg-zinc-950/50 border border-zinc-850 p-2.5 rounded-lg text-xs">
                    <div className="truncate pr-3">
                      <span className="font-semibold text-zinc-200 block truncate">{product.nombre}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        [{product.codigo}] {product.color} | {product.capacidad}
                      </span>
                    </div>
                    {/* Stepper directly inside modal */}
                    <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => removeFromCart(productId)}
                        className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="text-xs font-mono font-bold px-1.5 text-emerald-400">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => addToCart(productId)}
                        className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Motivo Input */}
            <div className="space-y-2">
              <Label htmlFor="submit-motivo">Motivo / Descripción de la Salida (Opcional)</Label>
              <Input
                id="submit-motivo"
                placeholder="Venta a cliente, reposición de tienda, despacho..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs h-10"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-zinc-900/60">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCartSubmitOpen(false)}
              className="border-zinc-800 hover:bg-zinc-800 hover:text-zinc-50"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={handleCartSubmit}
              className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold"
            >
              {isPending ? 'Enviando vale...' : 'Confirmar y Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Voucher Drawer Modal (For both Admin & Almacenistas) */}
      <Dialog open={voucherOpen} onOpenChange={setVoucherOpen}>
        <DialogContent className="bg-zinc-900 border border-zinc-800 text-zinc-100 max-w-sm flex flex-col items-center shadow-2xl z-50 animate-in fade-in zoom-in duration-200">
          <DialogHeader className="w-full text-center">
            <DialogTitle className="text-zinc-200">Comprobante de Entrega</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Usa los botones para compartir el vale por WhatsApp o descargarlo.
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
    </div>
  )
}
