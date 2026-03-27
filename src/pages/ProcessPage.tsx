import { useState, useEffect } from 'react'
import { ChevronRight, Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProgressCell from '@/components/shared/ProgressCell'
import ProcessDetailModal from '@/components/process/ProcessDetailModal'
import PhotoGalleryModal from '@/components/process/PhotoGalleryModal'
import type { WorkStage } from '@/types'

interface StageRow {
  stage: WorkStage
  totalPlanned: number
  totalDelivered: number
  totalUsed: number
  lastRecordAt: string | null
}

export default function ProcessPage() {
  const [rows, setRows] = useState<StageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStage, setSelectedStage] = useState<WorkStage | null>(null)
  const [photoStage, setPhotoStage] = useState<WorkStage | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)

    const { data: stages } = await supabase
      .from('work_stages')
      .select('*, work_stage_materials(*, request_item:request_items(*))')
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })

    if (!stages?.length) {
      setRows([])
      setLoading(false)
      return
    }

    // Загрузим последнюю фиксацию для каждого этапа
    const stageIds = stages.map((s: any) => s.id)
    const { data: records } = await supabase
      .from('work_records')
      .select('work_stage_id, recorded_at')
      .in('work_stage_id', stageIds)
      .order('recorded_at', { ascending: false })

    const lastRecordMap = new Map<string, string>()
    for (const r of records || []) {
      if (!lastRecordMap.has(r.work_stage_id)) {
        lastRecordMap.set(r.work_stage_id, r.recorded_at)
      }
    }

    const result: StageRow[] = stages.map((stage: any) => {
      const mats = stage.work_stage_materials || []
      return {
        stage,
        totalPlanned: mats.reduce((s: number, m: any) => s + Number(m.quantity_planned), 0),
        totalDelivered: mats.reduce((s: number, m: any) => s + Number(m.request_item?.quantity_delivered || 0), 0),
        totalUsed: mats.reduce((s: number, m: any) => s + Number(m.quantity_used), 0),
        lastRecordAt: lastRecordMap.get(stage.id) || null,
      }
    })

    setRows(result)
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Процесс</h1>
        <p className="text-sm text-gray-500 mt-1">Конструкции в работе — текущий статус и история</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Загрузка...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Нет конструкций в работе</p>
          <p className="text-xs text-gray-400 mt-1">Начните этап монтажа, чтобы он появился здесь</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Конструкция</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Прогресс</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Последняя фиксация</th>
                <th className="px-4 py-3 font-medium text-gray-600">Фото</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ stage, totalPlanned, totalDelivered, totalUsed, lastRecordAt }) => (
                <tr
                  key={stage.id}
                  className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedStage(stage)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{stage.title}</div>
                    {stage.description && (
                      <div className="text-xs text-gray-400 mt-0.5">{stage.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ProgressCell total={totalPlanned} delivered={totalDelivered} used={totalUsed} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {lastRecordAt
                      ? new Date(lastRecordAt).toLocaleString('ru-RU', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : <span className="text-gray-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPhotoStage(stage) }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Camera size={16} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight size={16} className="text-gray-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProcessDetailModal
        open={!!selectedStage}
        onClose={() => setSelectedStage(null)}
        stage={selectedStage}
      />
      <PhotoGalleryModal
        open={!!photoStage}
        onClose={() => setPhotoStage(null)}
        stage={photoStage}
      />
    </div>
  )
}
