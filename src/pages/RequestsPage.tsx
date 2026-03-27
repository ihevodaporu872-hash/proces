import { useState, useEffect } from 'react'
import { Plus, Search, ChevronRight, ChevronDown, Archive } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProgressCell from '@/components/shared/ProgressCell'
import CreateRequestModal from '@/components/requests/CreateRequestModal'
import RequestDetailModal from '@/components/requests/RequestDetailModal'
import type { MaterialRequest } from '@/types'

function getRequestProgress(req: MaterialRequest) {
  const items = req.request_items || []
  const totalOrdered = items.reduce((s, i) => s + Number(i.quantity_ordered), 0)
  const totalDelivered = items.reduce((s, i) => s + Number(i.quantity_delivered), 0)
  const totalUsed = items.reduce((s, i) => s + Number(i.quantity_used), 0)
  return { totalOrdered, totalDelivered, totalUsed }
}

function isFullyUsed(req: MaterialRequest): boolean {
  const items = req.request_items || []
  if (items.length === 0) return false
  return items.every((i) => Number(i.quantity_available) <= 0 && Number(i.quantity_used) > 0)
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<MaterialRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null)
  const [showArchive, setShowArchive] = useState(false)

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

  const activeRequests = requests.filter((r) => !isFullyUsed(r))
  const archivedRequests = requests.filter((r) => isFullyUsed(r))

  const filtered = activeRequests.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase())
  )
  const filteredArchive = archivedRequests.filter((r) =>
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Прогресс</th>
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
                    {(() => {
                      const { totalOrdered, totalDelivered, totalUsed } = getRequestProgress(req)
                      return <ProgressCell total={totalOrdered} delivered={totalDelivered} used={totalUsed} />
                    })()}
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

      {/* Архив */}
      {filteredArchive.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 mb-3"
          >
            <Archive size={16} />
            Архив ({filteredArchive.length})
            <ChevronDown size={16} className={`transition-transform ${showArchive ? 'rotate-180' : ''}`} />
          </button>
          {showArchive && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden opacity-75">
              <table className="w-full text-sm">
                <tbody>
                  {filteredArchive.map((req) => (
                    <tr
                      key={req.id}
                      className="border-t border-gray-100 first:border-t-0 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedRequest(req)}
                    >
                      <td className="px-4 py-3 text-gray-400">#{req.number}</td>
                      <td className="px-4 py-3 font-medium text-gray-600">{req.title}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const { totalOrdered, totalDelivered, totalUsed } = getRequestProgress(req)
                          return <ProgressCell total={totalOrdered} delivered={totalDelivered} used={totalUsed} />
                        })()}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
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
