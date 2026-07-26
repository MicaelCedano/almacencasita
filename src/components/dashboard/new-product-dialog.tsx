'use client'

import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createProduct } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const productSchema = z.object({
  codigo: z.string().min(3, { message: 'Mínimo 3 caracteres' }).toUpperCase(),
  nombre: z.string().min(2, { message: 'Mínimo 2 caracteres' }),
  marca: z.string().min(2, { message: 'Mínimo 2 caracteres' }),
  color: z.string().min(2, { message: 'Mínimo 2 caracteres' }),
  capacidad: z.string().min(2, { message: 'Mínimo 2 caracteres (Ej. 8+256GB)' }),
  descripcion: z.string().optional(),
  unidades_por_caja: z.coerce.number().int().min(1, { message: 'Debe haber al menos 1 unidad por caja' }),
})

type ProductFormValues = z.infer<typeof productSchema>

export function NewProductDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      unidades_por_caja: 10,
    },
  })

  const onSubmit = async (data: ProductFormValues) => {
    setLoading(true)
    try {
      const res = await createProduct(data)
      if (res.success) {
        toast.success('Producto creado con éxito.')
        reset()
        setOpen(false)
      } else {
        toast.error(res.error || 'Error al crear producto.')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ocurrió un error inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold gap-2" />
        }
      >
        <Plus className="w-4 h-4" />
        <span>Registrar Producto</span>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo Producto</DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Registra un nuevo celular. Cada combinación de color y capacidad RAM+GB lleva un código Kaptas distinto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código (Kaptas)</Label>
              <Input
                id="codigo"
                placeholder="Ej. KPT-15PM-N"
                className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 uppercase text-xs"
                {...register('codigo')}
              />
              {errors.codigo && (
                <p className="text-[10px] text-red-400">{errors.codigo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unidades_por_caja">Unidades por Caja</Label>
              <Input
                id="unidades_por_caja"
                type="number"
                placeholder="10"
                className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs"
                {...register('unidades_por_caja')}
              />
              {errors.unidades_por_caja && (
                <p className="text-[10px] text-red-400">{errors.unidades_por_caja.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre">Modelo / Nombre</Label>
            <Input
              id="nombre"
              placeholder="iPhone 15 Pro Max"
              className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs"
              {...register('nombre')}
            />
            {errors.nombre && (
              <p className="text-[10px] text-red-400">{errors.nombre.message}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="marca">Marca</Label>
              <Input
                id="marca"
                placeholder="Apple"
                className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs"
                {...register('marca')}
              />
              {errors.marca && (
                <p className="text-[10px] text-red-400">{errors.marca.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                placeholder="Titanio Negro"
                className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs"
                {...register('color')}
              />
              {errors.color && (
                <p className="text-[10px] text-red-400">{errors.color.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacidad">RAM + GB</Label>
              <Input
                id="capacidad"
                placeholder="Ej. 8+256GB"
                className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs"
                {...register('capacidad')}
              />
              {errors.capacidad && (
                <p className="text-[10px] text-red-400">{errors.capacidad.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción (Opcional)</Label>
            <Input
              id="descripcion"
              placeholder="Detalle adicional..."
              className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs"
              {...register('descripcion')}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-zinc-800 hover:bg-zinc-800 hover:text-zinc-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Crear Celular'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
