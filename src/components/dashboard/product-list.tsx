'use client'

import React, { useState, useTransition } from 'react'
import { deleteProduct, updateProduct } from '@/app/dashboard/actions'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Trash2, Pencil, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const editProductSchema = z.object({
  codigo: z.string().min(3, { message: 'Mínimo 3 caracteres' }).toUpperCase(),
  nombre: z.string().min(2, { message: 'Mínimo 2 caracteres' }),
  marca: z.string().min(2, { message: 'Mínimo 2 caracteres' }),
  color: z.string().min(2, { message: 'Mínimo 2 caracteres' }),
  capacidad: z.string().min(2, { message: 'Mínimo 2 caracteres (Ej. 8+256GB)' }),
  descripcion: z.string().optional(),
  unidades_por_caja: z.coerce.number().int().min(1, { message: 'Debe haber al menos 1 unidad por caja' }),
})

type EditProductFormValues = z.infer<typeof editProductSchema>

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
  unidades_sueltas?: number;
  cantidad: number;
  fecha_creacion: string;
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

interface ProductListProps {
  products: Product[];
}

export default function ProductList({ products }: ProductListProps) {
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  
  // Delete dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm({
    resolver: zodResolver(editProductSchema),
  })

  const filteredProducts = products.filter((p) => {
    const term = search.toLowerCase()
    return (
      p.codigo.toLowerCase().includes(term) ||
      p.nombre.toLowerCase().includes(term) ||
      p.marca.toLowerCase().includes(term) ||
      p.color.toLowerCase().includes(term) ||
      p.capacidad.toLowerCase().includes(term)
    )
  })

  // Delete handlers
  const handleDeleteClick = (product: Product) => {
    setSelectedProduct(product)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = () => {
    if (!selectedProduct) return

    startTransition(async () => {
      try {
        const res = await deleteProduct(selectedProduct.id)
        if (res.success) {
          toast.success(`Producto ${selectedProduct.codigo} eliminado con éxito.`)
          setDeleteConfirmOpen(false)
          setSelectedProduct(null)
        } else {
          toast.error(res.error || 'Error al eliminar el producto.')
        }
      } catch {
        toast.error('Ocurrió un error inesperado al eliminar.')
      }
    })
  }

  // Edit handlers
  const handleEditClick = (product: Product) => {
    setEditingProduct(product)
    resetEdit({
      codigo: product.codigo,
      nombre: product.nombre,
      marca: product.marca,
      color: product.color,
      capacidad: product.capacidad,
      descripcion: product.descripcion || '',
      unidades_por_caja: product.unidades_por_caja,
    })
    setEditDialogOpen(true)
  }

  const onEditSubmit = async (data: EditProductFormValues) => {
    if (!editingProduct) return
    setLoadingEdit(true)
    try {
      const res = await updateProduct(editingProduct.id, data)
      if (res.success) {
        toast.success('Producto actualizado con éxito.')
        setEditDialogOpen(false)
        setEditingProduct(null)
      } else {
        toast.error(res.error || 'Error al actualizar el producto.')
      }
    } catch {
      toast.error('Ocurrió un error inesperado al editar.')
    } finally {
      setLoadingEdit(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Buscar por código, modelo, color..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-zinc-100 placeholder-zinc-500 w-full text-xs h-10"
        />
      </div>

      {/* Catalog Display Section */}
      <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 md:p-6 backdrop-blur-sm">
        
        {/* Desktop Table View */}
        <div className="hidden md:block rounded-lg border border-zinc-800 bg-zinc-950/40 overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-950/80">
              <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400 py-3 text-xs">Código (Kaptas)</TableHead>
                <TableHead className="text-zinc-400 py-3 text-xs">Marca</TableHead>
                <TableHead className="text-zinc-400 py-3 text-xs">Modelo / Celular</TableHead>
                <TableHead className="text-zinc-400 py-3 text-xs">RAM+GB</TableHead>
                <TableHead className="text-zinc-400 py-3 text-xs">Color</TableHead>
                <TableHead className="text-zinc-400 py-3 text-xs">Empaque</TableHead>
                <TableHead className="text-zinc-400 py-3 text-xs">Stock Físico</TableHead>
                <TableHead className="text-zinc-400 py-3 text-xs text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <TableRow key={product.id} className="border-b border-zinc-800 hover:bg-zinc-900/20 transition-colors">
                    <TableCell className="py-4 text-xs font-mono font-semibold text-zinc-300">
                      {product.codigo}
                    </TableCell>
                    <TableCell className="py-4 text-xs text-zinc-400">
                      {product.marca}
                    </TableCell>
                    <TableCell className="py-4 text-xs">
                      <div className="flex flex-col">
                        <span className="text-zinc-100 font-medium">{product.nombre}</span>
                        {product.descripcion && (
                          <span className="text-[10px] text-zinc-500 max-w-[200px] truncate">
                            {product.descripcion}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-xs">
                      <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/5 text-emerald-400 font-mono text-[10px] font-bold">
                        {product.capacidad}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-xs">
                      <Badge 
                        variant="outline" 
                        style={getColorBadgeStyle(product.color)}
                        className="border text-[10px] font-medium uppercase"
                      >
                        {product.color}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-xs text-zinc-500 font-mono">
                      {product.unidades_por_caja} uds/caja
                    </TableCell>
                    <TableCell className="py-4 text-xs">
                      <div className="flex flex-col font-mono">
                        <span className={product.cantidad === 0 ? 'text-red-400 text-[10px]' : 'text-zinc-300 text-xs font-bold'}>
                          {product.cajas > 0 ? `${product.cajas} ${product.cajas === 1 ? 'caja' : 'cajas'}` : ''}
                          {product.cajas > 0 && product.unidades_sueltas ? ' + ' : ''}
                          {product.unidades_sueltas ? `${product.unidades_sueltas} uds sueltas` : (product.cajas === 0 ? '0 stock' : '')}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {product.cantidad} celulares totales
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-xs text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(product)}
                        className="text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 h-8 w-8 mr-1"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(product)}
                        className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-zinc-500">
                    No se encontraron productos registrados en el catálogo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards View */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <div 
                key={product.id}
                className="bg-zinc-950/40 border border-zinc-800 rounded-xl p-4 space-y-3 relative"
              >
                <div className="flex justify-between items-start">
                  <div className="truncate">
                    <span className="text-[10px] font-mono text-zinc-500 font-bold tracking-wider">
                      {product.codigo}
                    </span>
                    <h3 className="text-zinc-100 font-bold text-sm mt-0.5 truncate">{product.nombre}</h3>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(product)}
                      className="text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 h-10 w-10 border border-zinc-850 rounded-lg flex items-center justify-center"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(product)}
                      className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 h-10 w-10 border border-zinc-850 rounded-lg flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="border-zinc-800 bg-zinc-900/60 text-zinc-350 text-[10px] py-0.5">
                    {product.marca}
                  </Badge>
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
                  <span className={product.cajas === 0 ? 'text-red-400 font-bold' : 'text-zinc-250 font-bold'}>
                    {product.cajas} cajas ({product.cantidad} uds)
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-zinc-500 border border-zinc-800 bg-zinc-950/40 rounded-xl text-xs">
              No se encontraron productos en el catálogo.
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-4 mt-2">
          <span>Total de modelos registrados: {products.length}</span>
          <span>Catálogo de productos general</span>
        </div>
      </div>

      {/* Edit Product Modal */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Celular</DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Modifica los detalles del celular seleccionado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-codigo">Código (Kaptas)</Label>
                <Input
                  id="edit-codigo"
                  placeholder="KPT-15PM-N"
                  className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 uppercase text-xs"
                  {...registerEdit('codigo')}
                />
                {editErrors.codigo && (
                  <p className="text-[10px] text-red-400">{editErrors.codigo.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-unidades">Unidades por Caja</Label>
                <Input
                  id="edit-unidades"
                  type="number"
                  placeholder="10"
                  className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs"
                  {...registerEdit('unidades_por_caja')}
                />
                {editErrors.unidades_por_caja && (
                  <p className="text-[10px] text-red-400">{editErrors.unidades_por_caja.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-nombre">Modelo / Nombre</Label>
              <Input
                id="edit-nombre"
                placeholder="iPhone 15 Pro Max"
                className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs"
                {...registerEdit('nombre')}
              />
              {editErrors.nombre && (
                <p className="text-[10px] text-red-400">{editErrors.nombre.message}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-marca">Marca</Label>
                <Input
                  id="edit-marca"
                  placeholder="Apple"
                  className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs"
                  {...registerEdit('marca')}
                />
                {editErrors.marca && (
                  <p className="text-[10px] text-red-400">{editErrors.marca.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-color">Color</Label>
                <Input
                  id="edit-color"
                  placeholder="Titanio Negro"
                  className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs"
                  {...registerEdit('color')}
                />
                {editErrors.color && (
                  <p className="text-[10px] text-red-400">{editErrors.color.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-capacidad">RAM + GB</Label>
                <Input
                  id="edit-capacidad"
                  placeholder="Ej. 8+256GB"
                  className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs"
                  {...registerEdit('capacidad')}
                />
                {editErrors.capacidad && (
                  <p className="text-[10px] text-red-400">{editErrors.capacidad.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-descripcion">Descripción (Opcional)</Label>
              <Input
                id="edit-descripcion"
                placeholder="Descripción del celular..."
                className="bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-xs"
                {...registerEdit('descripcion')}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={loadingEdit}
                onClick={() => setEditDialogOpen(false)}
                className="border-zinc-800 hover:bg-zinc-800 hover:text-zinc-50"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loadingEdit}
                className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-semibold"
              >
                {loadingEdit ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 max-w-sm">
          <DialogHeader className="flex flex-col items-center">
            <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-400 mb-2">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-center">¿Eliminar Producto?</DialogTitle>
            <DialogDescription className="text-center text-zinc-400 text-xs mt-1">
              Esta acción eliminará permanentemente el producto <strong>{selectedProduct?.codigo}</strong> ({selectedProduct?.nombre}) y todo su historial de movimientos. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="grid grid-cols-2 gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDeleteConfirmOpen(false)}
              className="border-zinc-800 hover:bg-zinc-800 hover:text-zinc-50"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-500 text-zinc-50 font-semibold"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
