import { useState, useEffect } from 'react'
import { ClipboardCheck, FileText } from 'lucide-react'
import Modal from '../shared/Modal'
import ProgressCell from '../shared/ProgressCell'
import { supabase } from '@/lib/supabase'
import { getFileUrl } from '@/lib/fileStorage'
import type { WorkStage } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  stage: WorkStage | null
}

export default function ProcessDetailModal({ open, onClose, stage }: Props) {
  const [materials, setMaterials] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (stage && open) loadData()
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

    const allProcessHistory = [...(histRes.data || []), ...recordHistory]

    // Объединяем process_history + work_records в единый таймлайн
    const timelineFromHistory = allProcessHistory.map((h: any) => ({
      id: h.id,
      title: h.title,
      description: h.description,
      created_at: h.created_at,
      files: (h.process_history_files || []) as any[],
      consumptions: [] as any[],
      leftovers: [] as any[],
    }))

    // work_records, у которых нет соответствующей записи в process_history
    const historyRecordIds = new Set(allProcessHistory
      .filter((h: any) => h.reference_table === 'work_records')
      .map((h: any) => h.reference_id))

    const timelineFromRecords = records
      .filter((r: any) => !historyRecordIds.has(r.id))
      .map((r: any) => ({
        id: `wr-${r.id}`,
        title: `Фиксация работ`,
        description: r.description,
        created_at: r.recorded_at,
        files: (r.work_record_files || []) as any[],
        consumptions: (r.material_consumptions || []) as any[],
        leftovers: (r.leftovers || []) as any[],
      }))

    // Для записей process_history, привязанных к work_records — добавляем файлы из work_records
    for (const entry of timelineFromHistory) {
      const ph = allProcessHistory.find((h: any) => h.id === entry.id)
      if (ph?.reference_table === 'work_records') {
        const wr = records.find((r: any) => r.id === ph.reference_id)
        if (wr) {
          // Добавляем work_record_files, которых нет в process_history_files
          const existingPaths = new Set(entry.files.map((f: any) => f.file_path))
          for (const f of wr.work_record_files || []) {
            if (!existingPaths.has(f.file_path)) {
              entry.files.push(f)
            }
          }
          entry.consumptions = wr.material_consumptions || []
          entry.leftovers = wr.leftovers || []
        }
      }
    }

    const timeline = [...timelineFromHistory, ...timelineFromRecords]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setMaterials(matsRes.data || [])
    setHistory(timeline)

    setLoading(false)
  }

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

        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <ClipboardCheck size={16} /> История
        </h3>

        {loading ? (
          <p className="text-sm text-gray-500 py-4">Загрузка...</p>
        ) : (
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

                {/* Использованные материалы */}
                {entry.consumptions?.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    <span className="font-medium">Использовано: </span>
                    {entry.consumptions
                      .filter((mc: any) => mc.quantity > 0)
                      .map((mc: any, i: number, arr: any[]) => (
                        <span key={mc.id}>
                          {mc.request_item?.name}: {mc.quantity} {mc.request_item?.unit}
                          {i < arr.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                  </div>
                )}

                {/* Остатки */}
                {entry.leftovers?.length > 0 && entry.leftovers.some((l: any) => l.quantity > 0) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {entry.leftovers.filter((l: any) => l.quantity > 0).map((l: any) => (
                      <span
                        key={l.id}
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          l.leftover_type === 'usable' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {l.leftover_type === 'usable' ? 'Пригодные' : 'Утиль'}: {l.quantity}
                      </span>
                    ))}
                  </div>
                )}

                {/* Файлы */}
                {entry.files?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entry.files.map((f: any) => {
                      const isImage = f.mime_type?.startsWith('image/')
                      return isImage ? (
                        <div
                          key={f.id}
                          className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 transition-colors"
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
        )}
      </div>
    </Modal>
  )
}
