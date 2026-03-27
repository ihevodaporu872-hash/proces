import { useState, useEffect } from 'react'
import { Plus, Search, ChevronRight, Play, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import StatusBadge from '@/components/shared/StatusBadge'
import CreateWorkStageModal from '@/components/montage/CreateWorkStageModal'
import WorkRecordModal from '@/components/montage/WorkRecordModal'
import StageDetailModal from '@/components/montage/StageDetailModal'
import type { WorkStage } from '@/types'

const statusLabels: Record<string, string> = {
  planned: 'Запланирован',
  in_progress: 'В работе',
  completed: 'Завершён',
}
const statusColors: Record<string, string> = {
  planned: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
}

export default function MontagePage() {
  const [stages, setStages] = useState<WorkStage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [recordStage, setRecordStage] = useState<WorkStage | null>(null)
  const [detailStage, setDetailStage] = useState<WorkStage | null>(null)

  useEffect(() => { loadStages() }, [])

  const loadStages = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('work_stages')
      .select('*, work_stage_materials(*, request_item:request_items(*))')
      .order('created_at', { ascending: false })
    setStages(data || [])
    setLoading(false)
  }

  const startStage = async (stage: WorkStage) => {
    await supabase.from('work_stages').update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
    }).eq('id', stage.id)

    await supabase.from('process_history').insert({
      event_type: 'work_started',
      reference_id: stage.id,
      reference_table: 'work_stages',
      title: `Начат монтаж: ${stage.title}`,
    })

    loadStages()
  }

  const completeStage = async (stage: WorkStage) => {
    await supabase.from('work_stages').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', stage.id)

    await supabase.from('process_history').insert({
      event_type: 'work_completed',
      reference_id: stage.id,
      reference_table: 'work_stages',
      title: `Завершён этап: ${stage.title}`,
    })

    loadStages()
  }

  const filtered = stages.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Монтаж</h1>
          <p className="text-sm text-gray-500 mt-1">Этапы работ и фиксация выполнения</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} /> Новый этап
        </button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Этапов монтажа пока нет</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Создать первый этап
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((stage) => (
            <div
              key={stage.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => setDetailStage(stage)}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-medium text-gray-900">{stage.title}</h3>
                    <StatusBadge
                      label={statusLabels[stage.status] || stage.status}
                      colorClass={statusColors[stage.status] || 'bg-gray-100 text-gray-700'}
                    />
                  </div>
                  {stage.description && (
                    <p className="text-sm text-gray-500">{stage.description}</p>
                  )}

                  {stage.work_stage_materials && stage.work_stage_materials.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {stage.work_stage_materials.map((m: any) => (
                        <span key={m.id} className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                          {m.request_item?.name}: {m.quantity_planned} {m.request_item?.unit}
                          {m.quantity_used > 0 && (
                            <span className="text-blue-600 ml-1">(исп. {m.quantity_used})</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-400 mt-2">
                    Создан: {new Date(stage.created_at).toLocaleDateString('ru-RU')}
                    {stage.started_at && ` | Начат: ${new Date(stage.started_at).toLocaleDateString('ru-RU')}`}
                    {stage.completed_at && ` | Завершён: ${new Date(stage.completed_at).toLocaleDateString('ru-RU')}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {stage.status === 'planned' && (
                    <button
                      onClick={() => startStage(stage)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100"
                    >
                      <Play size={14} /> Начать
                    </button>
                  )}
                  {stage.status === 'in_progress' && (
                    <>
                      <button
                        onClick={() => setRecordStage(stage)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                      >
                        Фиксация работ
                      </button>
                      <button
                        onClick={() => completeStage(stage)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100"
                      >
                        <CheckCircle size={14} /> Завершить
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setDetailStage(stage)}
                    className="p-1.5 text-gray-400 hover:text-gray-600"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateWorkStageModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadStages} />
      <WorkRecordModal
        open={!!recordStage}
        onClose={() => setRecordStage(null)}
        stage={recordStage}
        onRecorded={loadStages}
      />
      <StageDetailModal
        open={!!detailStage}
        onClose={() => setDetailStage(null)}
        stage={detailStage}
      />
    </div>
  )
}
