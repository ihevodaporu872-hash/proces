import { useState, useEffect } from 'react'
import { Plus, Search, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import StatusBadge from '@/components/shared/StatusBadge'
import CreateRequestModal from '@/components/requests/CreateRequestModal'
import RequestDetailModal from '@/components/requests/RequestDetailModal'
import type { MaterialRequest } from '@/types'

const statusLabels: Record<string, string> = {
  created: 'Создана',
  awaiting_delivery: 'Ожидание поставки',
  partial_delivery: 'Частично поставлено',
  available: 'Материал доступен',
  in_progress: 'В монтаже',
  partial_done: 'Частично выполнено',
  needs_reorder: 'Требуется допоставка',
  completed: 'Завершено',
}
const statusColors: Record<string, string> = {
  created: 'bg-gray-100 text-gray-700',
  awaiting_delivery: 'bg-yellow-100 text-yellow-800',
  partial_delivery: 'bg-orange-100 text-orange-800',
  available: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  partial_done: 'bg-indigo-100 text-indigo-800',
  needs_reorder: 'bg-red-100 text-red-800',
  completed: 'bg-emerald-100 text-emerald-800',
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null)

  useEffect(() => { loadRequests() }, [])

  const loadRequests = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('material_requests')
      .select('*, request_items(*)')
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  const filtered = requests.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Заявки на материалы</h1>
          <p className="text-sm text-gray-500 mt-1">Создание заявок и контроль поступления</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} /> Новая заявка
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
          <p className="text-gray-500">Заявок пока нет</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Создать первую заявку
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">№</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Название</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Статус</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Позиций</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Дата</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => (
                <tr
                  key={req.id}
                  className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedRequest(req)}
                >
                  <td className="px-4 py-3 text-gray-400">#{req.number}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{req.title}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={statusLabels[req.status] || req.status}
                      colorClass={statusColors[req.status] || 'bg-gray-100 text-gray-700'}
                    />
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {req.request_items?.length || 0}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(req.created_at).toLocaleDateString('ru-RU')}
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

      <CreateRequestModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadRequests} />
      <RequestDetailModal
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
        onUpdated={loadRequests}
      />
    </div>
  )
}
