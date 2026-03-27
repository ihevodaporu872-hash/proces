import { useState, useEffect } from 'react'
import { Package, ClipboardCheck, FileText, Image, ChevronLeft, ChevronRight, X } from 'lucide-react'
import Modal from '../shared/Modal'
import ProgressCell from '../shared/ProgressCell'
import { supabase } from '@/lib/supabase'
import { getFileUrl } from '@/lib/fileStorage'
import type { WorkStage } from '@/types'

interface FileInfo {
  id: string
  file_name: string
  file_path: string
  mime_type: string | null
  uploaded_at: string
  context: string // описание контекста: дата, описание работ, материалы
}

interface Props {
  open: boolean
  onClose: () => void
  stage: WorkStage | null
}

export default function ProcessDetailModal({ open, onClose, stage }: Props) {
  const [materials, setMaterials] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [allFiles, setAllFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'history' | 'gallery'>('history')
  const [galleryIndex, setGalleryIndex] = useState(0)

  useEffect(() => {
    if (stage && open) {
      setTab('history')
      setGalleryIndex(0)
      loadData()
    }
  }, [stage, open])

  const loadData = async () => {
    if (!stage) return
    setLoading(true)

    const [matsRes, recsRes, histRes] = await Promise.all([
      supabase
        .from('work_stage_materials')
        .select('*, request_item:request_items(*)')
        .eq('work_stage_id', stage.id),
      supabase
        .from('work_records')
        .select('*, work_record_files(*), material_consumptions(*, request_item:request_items(*)), leftovers(*)')
        .eq('work_stage_id', stage.id)
        .order('recorded_at', { ascending: false }),
      supabase
        .from('process_history')
        .select('*, process_history_files(*)')
        .eq('reference_table', 'work_stages')
        .eq('reference_id', stage.id)
        .order('created_at', { ascending: false }),
    ])

    // Также загрузим историю по work_records этого этапа
    const records = recsRes.data || []
    const recordIds = records.map((r: any) => r.id)

    let recordHistory: any[] = []
    if (recordIds.length > 0) {
      const { data } = await supabase
        .from('process_history')
        .select('*, process_history_files(*)')
        .eq('reference_table', 'work_records')
        .in('reference_id', recordIds)
        .order('created_at', { ascending: false })
      recordHistory = data || []
    }

    const allHistory = [...(histRes.data || []), ...recordHistory]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setMaterials(matsRes.data || [])
    setHistory(allHistory)

    // Собираем все файлы из записей о работах + истории
    const files: FileInfo[] = []
    for (const r of records) {
      const consumptionText = (r.material_consumptions || [])
        .filter((mc: any) => mc.quantity > 0)
        .map((mc: any) => `${mc.request_item?.name}: ${mc.quantity} ${mc.request_item?.unit}`)
        .join(', ')

      for (const f of r.work_record_files || []) {
        files.push({
          ...f,
          context: [
            new Date(r.recorded_at).toLocaleString('ru-RU'),
            r.description,
            consumptionText ? `Использовано: ${consumptionText}` : null,
          ].filter(Boolean).join(' — '),
        })
      }
    }
    for (const h of allHistory) {
      for (const f of h.process_history_files || []) {
        if (!files.find((ef) => ef.file_path === f.file_path)) {
          files.push({
            ...f,
            context: [
              new Date(h.created_at).toLocaleString('ru-RU'),
              h.title,
              h.description,
            ].filter(Boolean).join(' — '),
          })
        }
      }
    }

    setAllFiles(files)
    setLoading(false)
  }

  const imageFiles = allFiles.filter((f) => f.mime_type?.startsWith('image/'))

  const formatDateTime = (s: string) => new Date(s).toLocaleString('ru-RU')

  if (!stage) return null

  const totalPlanned = materials.reduce((s: number, m: any) => s + Number(m.quantity_planned), 0)
  const totalDelivered = materials.reduce((s: number, m: any) => s + Number(m.request_item?.quantity_delivered || 0), 0)
  const totalUsed = materials.reduce((s: number, m: any) => s + Number(m.quantity_used), 0)

  return (
    <Modal open={open} onClose={onClose} title={stage.title} wide>
      <div className="space-y-4">
        {/* Прогресс */}
        <div className="flex items-center gap-4">
          <ProgressCell total={totalPlanned} delivered={totalDelivered} used={totalUsed} />
          {stage.description && <span className="text-sm text-gray-500">{stage.description}</span>}
        </div>

        {/* Табы */}
        <div className="flex gap-1 border-b border-gray-200">
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ClipboardCheck size={14} className="inline mr-1.5 -mt-0.5" />
            История
          </button>
          <button
            onClick={() => { setTab('gallery'); setGalleryIndex(0) }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'gallery' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Image size={14} className="inline mr-1.5 -mt-0.5" />
            Фото ({imageFiles.length})
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 py-4">Загрузка...</p>
        ) : tab === 'history' ? (
          /* История */
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {history.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">Событий пока нет</p>
            )}
            {history.map((entry: any) => (
              <div key={entry.id} className="p-3 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">{entry.title}</h4>
                    {entry.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{entry.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatDateTime(entry.created_at)}</span>
                </div>
                {entry.process_history_files?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entry.process_history_files.map((f: any) => {
                      const isImage = f.mime_type?.startsWith('image/')
                      return isImage ? (
                        <div
                          key={f.id}
                          className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 cursor-pointer transition-colors"
                          onClick={() => {
                            const idx = imageFiles.findIndex((img) => img.file_path === f.file_path)
                            if (idx >= 0) { setGalleryIndex(idx); setTab('gallery') }
                          }}
                        >
                          <img src={getFileUrl(f.file_path)} alt={f.file_name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <a
                          key={f.id}
                          href={getFileUrl(f.file_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded hover:bg-blue-100"
                        >
                          <FileText size={12} /> {f.file_name}
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Галерея */
          imageFiles.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Нет прикреплённых изображений</p>
          ) : (
            <div>
              {/* Основное изображение */}
              <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ minHeight: 320 }}>
                <img
                  src={getFileUrl(imageFiles[galleryIndex].file_path)}
                  alt={imageFiles[galleryIndex].file_name}
                  className="w-full max-h-[50vh] object-contain"
                />

                {/* Навигация */}
                {imageFiles.length > 1 && (
                  <>
                    <button
                      onClick={() => setGalleryIndex((i) => (i - 1 + imageFiles.length) % imageFiles.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow hover:bg-white transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={() => setGalleryIndex((i) => (i + 1) % imageFiles.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow hover:bg-white transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}

                {/* Счётчик */}
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                  {galleryIndex + 1} / {imageFiles.length}
                </div>
              </div>

              {/* Информация о файле */}
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{imageFiles[galleryIndex].file_name}</p>
                <p className="text-xs text-gray-500 mt-1">{imageFiles[galleryIndex].context}</p>
              </div>

              {/* Превью */}
              {imageFiles.length > 1 && (
                <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                  {imageFiles.map((f, i) => (
                    <div
                      key={f.id}
                      onClick={() => setGalleryIndex(i)}
                      className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 cursor-pointer border-2 transition-colors ${
                        i === galleryIndex ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img src={getFileUrl(f.file_path)} alt={f.file_name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </Modal>
  )
}
