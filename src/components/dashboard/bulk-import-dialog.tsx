'use client'

import React, { useState, useTransition, useMemo } from 'react'
import { createProductsBulk } from '@/app/dashboard/actions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ClipboardList, Loader2, AlertCircle, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

interface ParsedProduct {
  codigo: string;
  nombre: string;
  marca: string;
  color: string;
  capacidad: string;
  unidades_por_caja: number;
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

export function BulkImportDialog() {
  const [open, setOpen] = useState(false)
  const [inputText, setInputText] = useState('')
  const [isPending, startTransition] = useTransition()

  // Real-time parsing logic
  const parsedProducts = useMemo(() => {
    if (!inputText.trim()) return []
    const lines = inputText.split('\n')
    const list: ParsedProduct[] = []

    for (const line of lines) {
      if (!line.trim()) continue
      
      // Try tab split first (standard spreadsheet copy)
      let cols = line.split('\t')
      
      // Fallback splits
      if (cols.length === 1) {
        cols = line.split(';')
      }
      if (cols.length === 1) {
        cols = line.split(',')
      }

      if (cols.length < 3) continue

      let codigo = ''
      let nombre = ''
      let marca = ''
      let color = ''
      let capacidad = ''

      // Format A: 8 columns (matching exact spreadsheet screenshot)
      // 0: Código, 1: Descripción, 2: Marca, 3: Detalle (Nombre + Capacidad), 4: Referencia, 5: Numeración, 6: Medida, 7: Color
      if (cols.length >= 8) {
        codigo = cols[0]?.trim() || ''
        marca = cols[2]?.trim() || ''
        color = cols[7]?.trim() || ''
        
        const detail = cols[3]?.trim() || ''
        const firstSpace = detail.indexOf(' ')
        if (firstSpace !== -1) {
          nombre = detail.substring(0, firstSpace).trim()
          capacidad = detail.substring(firstSpace + 1).trim()
        } else {
          nombre = detail
          capacidad = 'N/A'
        }
      }
      // Format B: 5 columns (Código | Marca | Modelo | Memoria | Color)
      else if (cols.length >= 5) {
        codigo = cols[0]?.trim() || ''
        marca = cols[1]?.trim() || ''
        nombre = cols[2]?.trim() || ''
        capacidad = cols[3]?.trim() || ''
        color = cols[4]?.trim() || ''
      }
      // Format C: 4 columns (Código | Marca | Detalle (Modelo+Memoria) | Color)
      else if (cols.length >= 4) {
        codigo = cols[0]?.trim() || ''
        marca = cols[1]?.trim() || ''
        color = cols[3]?.trim() || ''
        
        const detail = cols[2]?.trim() || ''
        const firstSpace = detail.indexOf(' ')
        if (firstSpace !== -1) {
          nombre = detail.substring(0, firstSpace).trim()
          capacidad = detail.substring(firstSpace + 1).trim()
        } else {
          nombre = detail
          capacidad = 'N/A'
        }
      }
      // Format D: 3 columns (Código | Marca | Detalle)
      else if (cols.length >= 3) {
        codigo = cols[0]?.trim() || ''
        marca = cols[1]?.trim() || ''
        color = 'N/A'
        
        const detail = cols[2]?.trim() || ''
        const firstSpace = detail.indexOf(' ')
        if (firstSpace !== -1) {
          nombre = detail.substring(0, firstSpace).trim()
          capacidad = detail.substring(firstSpace + 1).trim()
        } else {
          nombre = detail
          capacidad = 'N/A'
        }
      }

      if (codigo && nombre && marca) {
        list.push({
          codigo: codigo.trim().toUpperCase(),
          nombre: nombre.trim(),
          marca: marca.trim(),
          color: color.trim() || 'N/A',
          capacidad: capacidad.trim() || 'N/A',
          unidades_por_caja: 20 // Default set to 20 per box
        })
      }
    }
    return list
  }, [inputText])

  const handleOpenChange = (openVal: boolean) => {
    setOpen(openVal)
    if (!openVal) {
      setInputText('')
    }
  }

  const handleImportSubmit = () => {
    if (parsedProducts.length === 0) {
      toast.error('No se detectaron productos válidos en el texto pegado.')
      return
    }

    startTransition(async () => {
      const res = await createProductsBulk(parsedProducts)
      if (res.success) {
        toast.success(`Carga masiva completada: se registraron ${res.count} nuevos productos.`)
        handleOpenChange(false)
      } else {
        toast.error(res.error || 'Error al procesar la carga masiva.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" className="border-zinc-800 hover:bg-zinc-800 text-zinc-100 hover:text-zinc-50 gap-2" />
        }
      >
        <ClipboardList className="w-4 h-4 text-emerald-400" />
        <span>Carga Masiva (Excel)</span>
      </DialogTrigger>
      
      <DialogContent className="bg-zinc-900 border border-zinc-800 text-zinc-100 max-w-4xl w-full max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-400" />
            <span>Carga Masiva de Productos</span>
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Selecciona y copia las filas de tu hoja de cálculo (Excel, Sheets o sistema) y pégalas abajo. El sistema detectará las columnas del listado (incluyendo el modelo y la memoria RAM/GB).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1 min-h-[300px]">
          {/* Paste Text Area */}
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Pega los datos aquí</label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ej. Copia y pega las filas de tu Excel directamente aquí..."
              className="w-full h-32 bg-zinc-950 border border-zinc-850 focus:border-emerald-500 rounded-lg p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none font-mono resize-none"
            />
          </div>

          {/* Live Preview Block */}
          {parsedProducts.length > 0 ? (
            <div className="space-y-2">
              <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">
                Vista Previa de Productos Detectados ({parsedProducts.length})
              </span>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-[11px] text-zinc-300 text-left">
                  <thead className="bg-zinc-950 text-zinc-500 font-mono tracking-wider border-b border-zinc-850">
                    <tr>
                      <th className="p-2">Código</th>
                      <th className="p-2">Marca</th>
                      <th className="p-2">Modelo</th>
                      <th className="p-2">Memoria</th>
                      <th className="p-2">Color</th>
                      <th className="p-2 text-right">Uds/Caja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedProducts.map((p, idx) => (
                      <tr key={idx} className="border-b border-zinc-850/40 hover:bg-zinc-900/10">
                        <td className="p-2 font-mono text-zinc-100">{p.codigo}</td>
                        <td className="p-2">{p.marca}</td>
                        <td className="p-2 font-medium">{p.nombre}</td>
                        <td className="p-2 font-mono text-zinc-400">{p.capacidad}</td>
                        <td className="p-2">
                          <Badge 
                            variant="outline" 
                            style={getColorBadgeStyle(p.color)}
                            className="border text-[10px] font-medium uppercase"
                          >
                            {p.color}
                          </Badge>
                        </td>
                        <td className="p-2 text-right font-mono text-zinc-400">{p.unidades_por_caja}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-zinc-800 bg-zinc-950/20 rounded-lg p-6 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-8 h-8 text-zinc-700" />
              <div>
                <p className="font-semibold text-zinc-400">Ningún producto detectado aún</p>
                <p className="text-[10px] text-zinc-600 mt-1 max-w-sm">
                  Copia las columnas de tu Excel y pégalas arriba. El sistema auto-completará la carga predeterminando 20 unidades por caja.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-zinc-850 flex items-center justify-between gap-4">
          <span className="text-[10px] text-zinc-500 font-mono text-left hidden sm:inline-block">
            * Los códigos ya existentes se omitirán automáticamente para evitar duplicaciones.
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="border-zinc-850 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isPending || parsedProducts.length === 0}
              onClick={handleImportSubmit}
              className="bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Cargar {parsedProducts.length} Celulares</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
