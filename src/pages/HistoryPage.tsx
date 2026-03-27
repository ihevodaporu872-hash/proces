import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProgressCell from '@/components/shared/ProgressCell'
import type { ProcessHistoryEntry, MaterialRequest, WorkStage } from '@/types'

const eventLabels: Record<string, string> = {
  request_created: 'Заявка создана',
  delivery: 'Поставка',
  work_created: 'Этап создан',
  work_started: 'Монтаж начат',
  work_recorded: 'Работы зафиксированы',
  work_completed: 'Этап завершён',
  leftover_usable: 'Пригодные остатки',
  leftover_unusable: 'Утиль',
}

interface HistoryRow {
  entry: ProcessHistoryEntry
  totalOrdered: number
  totalDelivered: number
  totalUsed: number
}

export default function HistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('')

  useEffect(() => { loadHistory() }, [])

  const loadHistory = async () => {
    setLoading(true)

    const [histRes, reqRes, stageRes] = await Promise.all([
      supabase
        .from('process_history')
        .select('*, process_history_files(*)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('material_requests')
        .select('*, request_items(*)'),
      supabase
        .from('work_stages')
        .select('*, work_stage_materials(*, request_item:request_items(*))'),
    ])

    const entries: ProcessHistoryEntry[] = histRes.data || []
    const requests: MaterialRequest[] = reqRes.data || []
    const stages: WorkStage[] = stageRes.data || []

    const requestMap = new Map(requests.map((r) => [r.id, r]))
    const stageMap = new Map(stages.map((s) => [s.id, s]))

    // Для delivery — нужно связать delivery.request_item_id → request_item → request
    const { data: deliveries } = await supabase
      .from('deliveries')
      .select('id, request_item_id')
    const deliveryMap = new Map((deliveries || []).map((d: any) => [d.id, d.request_item_id]))

    // request_item_id → request_id
    const itemToRequest = new Map<string, string>()
    for (const req of requests) {
      for (const item of req.request_items || []) {
        itemToRequest.set(item.id, req.id)
      }
    }

    // work_record → work_stage
    const { data: workRecords } = await supabase
      .from('work_records')
      .select('id, work_stage_id')
    const recordToStage = new Map((workRecords || []).map((r: any) => [r.id, r.work_stage_id]))

    const result: HistoryRow[] = entries.map((entry) => {
      let totalOrdered = 0
      let totalDelivered = 0
      let totalUsed = 0

      const refId = entry.reference_id
      const refTable = entry.reference_table

      if (refTable === 'material_requests' && refId) {
        const req = requestMap.get(refId)
        if (req?.request_items) {
          totalOrdered = req.request_items.reduce((s, i) => s + Number(i.quantity_ordered), 0)
          totalDelivered = req.request_items.reduce((s, i) => s + Number(i.quantity_delivered), 0)
          totalUsed = req.request_items.reduce((s, i) => s + Number(i.quantity_used), 0)
        }
      } else if (refTable === 'deliveries' && refId) {
        const itemId = deliveryMap.get(refId)
        if (itemId) {
          const reqId = itemToRequest.get(itemId)
          if (reqId) {
            const req = requestMap.get(reqId)
            if (req?.request_items) {
              totalOrdered = req.request_items.reduce((s, i) => s + Number(i.quantity_ordered), 0)
              totalDelivered = req.request_items.reduce((s, i) => s + Number(i.quantity_delivered), 0)
              totalUsed = req.request_items.reduce((s, i) => s + Number(i.quantity_used), 0)
            }
          }
        }
      } else if (refTable === 'work_stages' && refId) {
        const stage = stageMap.get(refId)
        if (stage?.work_stage_materials) {
          totalOrdered = stage.work_stage_materials.reduce((s, m) => s + Number(m.quantity_planned), 0)
          totalUsed = stage.work_stage_materials.reduce((s, m) => s + Number(m.quantity_used), 0)
          // delivered = из связанных request_items
          totalDelivered = stage.work_stage_materials.reduce((s, m) => {
            return s + Number(m.request_item?.quantity_delivered || 0)
          }, 0)
        }
      } else if (refTable === 'work_records' && refId) {
        const stageId = recordToStage.get(refId)
        if (stageId) {
          const stage = stageMap.get(stageId)
          if (stage?.work_stage_materials) {
            totalOrdered = stage.work_stage_materials.reduce((s, m) => s + Number(m.quantity_planned), 0)
            totalUsed = stage.work_stage_materials.reduce((s, m) => s + Number(m.quantity_used), 0)
            totalDelivered = stage.work_stage_materials.reduce((s, m) => {
              return s + Number(m.request_item?.quantity_delivered || 0)
            }, 0)
          }
        }
      }

      return { entry, totalOrdered, totalDelivered, totalUsed }
    })

    setRows(result)
    setLoading(false)
  }

  const filtered = rows.filter((r) => {
    const e = r.entry
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.description || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = !filter || e.event_type === filter
    return matchSearch && matchFilter
  })

  const eventTypes = [...new Set(rows.map((r) => r.entry.event_type))]

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">История процесса</h1>
        <p className="text-sm text-gray-500 mt-1">Хронология всех событий</p>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по событиям..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">Все события</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>{eventLabels[t] || t}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Событий пока нет</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Дата</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Событие</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Название</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Прогресс</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ entry, totalOrdered, totalDelivered, totalUsed }) => (
                <tr
                  key={entry.id}
                  className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {formatDate(entry.created_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {eventLabels[entry.event_type] || entry.event_type}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {entry.title}
                  </td>
                  <td className="px-4 py-3">
                    <ProgressCell total={totalOrdered} delivered={totalDelivered} used={totalUsed} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
