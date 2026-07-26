'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createMovement } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { PlusCircle, MinusCircle, Loader2, Search, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

const movementSchema = z.object({
  producto_id: z.string().min(1, { message: 'Debes seleccionar un producto' }),
  cantidad: z.coerce.number().int().min(1, { message: 'La cantidad debe ser mayor o igual a 1 caja' }),
  motivo: z.string().min(3, { message: 'Debes ingresar un motivo' }),
})

type MovementFormValues = z.infer<typeof movementSchema>

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

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(movementSchema),
  })

  const selectedProductId = watch('producto_id')
  const selectedProduct = products.find((p) => p.id === selectedProductId)

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
      reset()
      setPickerOpen(false)
      setSearchQuery('')
    }
  }

  const onSubmit = async (data: MovementFormValues) => {
    // Client-side stock check for Salidas (in boxes)
    if (tipo === 'Salida' && selectedProduct && selectedProduct.cajas < data.cantidad) {
      toast.error(`Stock insuficiente. Solo hay ${selectedProduct.cajas} cajas disponibles de este producto.`)
      return
    }

    setLoading(true)
    try {
      const res = await createMovement({
        producto_id: data.producto_id,
        cantidad: data.cantidad, // quantity of boxes
        tipo,
        motivo: data.motivo,
      })

      if (res.success) {
        toast.success(`Movimiento de ${tipo} registrado con éxito.`)
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          tipo === 'Entrada' ? (
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold gap-2" />
          ) : (
            <Button variant="outline" className="border-zinc-800 hover:bg-zinc-800 text-zinc-100 hover:text-zinc-50 gap-2" />
          )
        }
      >
        {tipo === 'Entrada' ? (
          <>
            <PlusCircle className="w-4 h-4" />
            <span>Nueva Entrada</span>
          </>
        ) : (
          <>
            <MinusCircle className="w-4 h-4 text-red-400" />
            <span>Nueva Salida</span>
          </>
        )}
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar {tipo}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            {tipo === 'Entrada'
              ? 'Agrega cajas de celulares al almacén registrando el producto y la cantidad.'
              : 'Retira cajas de celulares del almacén. No se permiten existencias negativas.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Custom Searchable Autocomplete Picker */}
          <div className="space-y-2 relative">
            <Label>Producto / Celular (Buscador)</Label>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(!pickerOpen)}
              className="w-full bg-zinc-950 border-zinc-800 hover:bg-zinc-900 text-zinc-200 justify-between text-left font-normal text-xs h-10 px-3"
            >
              {selectedProduct ? (
                <span className="truncate">
                  [{selectedProduct.codigo}] {selectedProduct.nombre} ({selectedProduct.color} - {selectedProduct.capacidad})
                </span>
              ) : (
                <span className="text-zinc-500">Buscar y seleccionar celular...</span>
              )}
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
                        onClick={() => {
                          setValue('producto_id', product.id)
                          setPickerOpen(false)
                          setSearchQuery('')
                        }}
                        className="w-full text-left px-2 py-2.5 hover:bg-zinc-900 text-xs text-zinc-300 rounded transition-colors flex justify-between items-center group"
                      >
                        <div className="flex flex-col truncate">
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

            {errors.producto_id && (
              <p className="text-[10px] text-red-400">{errors.producto_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Quantity of boxes */}
            <div className="space-y-2">
              <Label htmlFor="cantidad">Cantidad de Cajas</Label>
              <Input
                id="cantidad"
                type="number"
                placeholder="5"
                className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs h-10"
                {...register('cantidad')}
              />
              {errors.cantidad && (
                <p className="text-[10px] text-red-400">{errors.cantidad.message}</p>
              )}
            </div>

            {/* Current Stock Reference */}
            <div className="space-y-2">
              <Label>Cajas Actuales</Label>
              <div className="h-10 px-3 py-2 rounded-md border border-zinc-800 bg-zinc-950/50 text-zinc-400 flex items-center text-xs font-mono">
                {selectedProduct 
                  ? `${selectedProduct.cajas} cajas (${selectedProduct.cantidad} uds)` 
                  : 'Selecciona...'}
              </div>
            </div>
          </div>

          {/* Reason (Motivo) */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo / Descripción</Label>
            <Input
              id="motivo"
              placeholder={tipo === 'Entrada' ? 'Abastecimiento de lote, compra factura #...' : 'Venta a cliente, despacho local...'}
              className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs h-10"
              {...register('motivo')}
            />
            {errors.motivo && (
              <p className="text-[10px] text-red-400">{errors.motivo.message}</p>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="border-zinc-800 hover:bg-zinc-800 hover:text-zinc-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={`font-semibold ${
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
  )
}
