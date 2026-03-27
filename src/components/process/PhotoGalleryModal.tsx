import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getFileUrl } from '@/lib/fileStorage'
import type { WorkStage } from '@/types'

interface PhotoInfo {
  id: string
  file_name: string
  file_path: string
  mime_type: string | null
  date: string
  description: string | null
  materials: string
}

interface Props {
  open: boolean
  onClose: () => void
  stage: WorkStage | null
}

export default function PhotoGalleryModal({ open, onClose, stage }: Props) {
  const [photos, setPhotos] = useState<PhotoInfo[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (stage && open) {
      setIndex(0)
      loadPhotos()
    }
  }, [stage, open])

  useEffect(() => {
    if (scrollRef.current && photos.length > 0) {
      const el = scrollRef.current.children[index] as HTMLElement
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [index, photos.length])

  const loadPhotos = async () => {
    if (!stage) return
    setLoading(true)

    const { data: records } = await supabase
      .from('work_records')
      .select('*, work_record_files(*), material_consumptions(*, request_item:request_items(*))')
      .eq('work_stage_id', stage.id)
      .order('recorded_at', { ascending: true })

    const result: PhotoInfo[] = []
    for (const r of records || []) {
      const materialsText = (r.material_consumptions || [])
        .filter((mc: any) => mc.quantity > 0)
        .map((mc: any) => `${mc.request_item?.name}: ${mc.quantity} ${mc.request_item?.unit}`)
        .join(', ')

      for (const f of r.work_record_files || []) {
        if (f.mime_type?.startsWith('image/')) {
          result.push({
            id: f.id,
            file_name: f.file_name,
            file_path: f.file_path,
            mime_type: f.mime_type,
            date: r.recorded_at,
            description: r.description,
            materials: materialsText,
          })
        }
      }
    }

    // Также из process_history
    const { data: histStage } = await supabase
      .from('process_history')
      .select('*, process_history_files(*)')
      .eq('reference_table', 'work_stages')
      .eq('reference_id', stage.id)

    const recordIds = (records || []).map((r: any) => r.id)
    let histRecords: any[] = []
    if (recordIds.length > 0) {
      const { data } = await supabase
        .from('process_history')
        .select('*, process_history_files(*)')
        .eq('reference_table', 'work_records')
        .in('reference_id', recordIds)
      histRecords = data || []
    }

    const allHist = [...(histStage || []), ...histRecords]
    const existingPaths = new Set(result.map((p) => p.file_path))

    for (const h of allHist) {
      for (const f of h.process_history_files || []) {
        if (f.mime_type?.startsWith('image/') && !existingPaths.has(f.file_path)) {
          result.push({
            id: f.id,
            file_name: f.file_name,
            file_path: f.file_path,
            mime_type: f.mime_type,
            date: h.created_at,
            description: h.title,
            materials: h.description || '',
          })
          existingPaths.add(f.file_path)
        }
      }
    }

    result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    setPhotos(result)
    setLoading(false)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(photos.length - 1, i + 1))
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, photos.length, onClose])

  if (!open || !stage) return null

  const current = photos[index]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      {/* Шапка */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/50">
        <div className="text-white">
          <h2 className="text-sm font-semibold">{stage.title} — Фото</h2>
          {photos.length > 0 && (
            <span className="text-xs text-gray-400">{index + 1} из {photos.length}</span>
          )}
        </div>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10">
          <X size={20} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">Загрузка...</div>
      ) : photos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">Нет прикреплённых фото</div>
      ) : (
        <>
          {/* Информация о текущем фото */}
          {current && (
            <div className="px-6 py-2 bg-black/40 border-b border-white/10">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-300">
                  {new Date(current.date).toLocaleString('ru-RU')}
                </span>
                {current.description && (
                  <span className="text-gray-400">{current.description}</span>
                )}
                {current.materials && (
                  <span className="text-gray-500">{current.materials}</span>
                )}
              </div>
            </div>
          )}

          {/* Фото */}
          <div className="flex-1 flex items-center justify-center relative min-h-0 px-12">
            {current && (
              <img
                src={getFileUrl(current.file_path)}
                alt={current.file_name}
                className="max-w-full max-h-full object-contain"
              />
            )}

            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  disabled={index === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full hover:bg-white/20 text-white disabled:opacity-30 disabled:cursor-default"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={() => setIndex((i) => Math.min(photos.length - 1, i + 1))}
                  disabled={index === photos.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full hover:bg-white/20 text-white disabled:opacity-30 disabled:cursor-default"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>

          {/* Превью снизу */}
          {photos.length > 1 && (
            <div className="px-4 py-3 bg-black/50 border-t border-white/10">
              <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((p, i) => (
                  <div
                    key={p.id}
                    onClick={() => setIndex(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden shrink-0 cursor-pointer border-2 transition-all ${
                      i === index ? 'border-blue-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
                    }`}
                  >
                    <img src={getFileUrl(p.file_path)} alt={p.file_name} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
