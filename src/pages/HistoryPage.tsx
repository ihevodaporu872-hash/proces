import { useState, useEffect } from 'react'
import { Search, FileText, Clock, Package, Truck, Wrench, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getFileUrl } from '@/lib/fileStorage'
import type { ProcessHistoryEntry } from '@/types'

const eventIcons: Record<string, typeof Package> = {
  request_created: Package,
  delivery: Truck,
  work_created: Wrench,
  work_started: Wrench,
  work_recorded: CheckCircle,
  work_completed: CheckCircle,
  leftover_usable: Package,
  leftover_unusable: Trash2,
}

const eventColors: Record<string, string> = {
  request_created: 'bg-purple-100 text-purple-600',
  delivery: 'bg-orange-100 text-orange-600',
  work_created: 'bg-gray-100 text-gray-600',
  work_started: 'bg-blue-100 text-blue-600',
  work_recorded: 'bg-green-100 text-green-600',
  work_completed: 'bg-emerald-100 text-emerald-600',
  leftover_usable: 'bg-teal-100 text-teal-600',
  leftover_unusable: 'bg-red-100 text-red-600',
}

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

export default function HistoryPage() {
  const [entries, setEntries] = useState<ProcessHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('')

  useEffect(() => { loadHistory() }, [])

  const loadHistory = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('process_history')
      .select('*, process_history_files(*)')
      .order('created_at', { ascending: false })
      .limit(200)
    setEntries(data || [])
    setLoading(false)
  }

  const filtered = entries.filter((e) => {
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.description || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = !filter || e.event_type === filter
    return matchSearch && matchFilter
  })

  const eventTypes = [...new Set(entries.map((e) => e.event_type))]

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  // Группировка по дате
  const grouped = filtered.reduce<Record<string, ProcessHistoryEntry[]>>((acc, entry) => {
    const date = formatDate(entry.created_at)
    if (!acc[date]) acc[date] = []
    acc[date].push(entry)
    return acc
  }, {})

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">История процесса</h1>
        <p className="text-sm text-gray-500 mt-1">Хронология всех событий с файлами</p>
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
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dayEntries]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px bg-gray-200 flex-1" />
                <span className="text-xs font-medium text-gray-500 shrink-0">{date}</span>
                <div className="h-px bg-gray-200 flex-1" />
              </div>

              <div className="space-y-2">
                {dayEntries.map((entry) => {
                  const Icon = eventIcons[entry.event_type] || Clock
                  const colorClass = eventColors[entry.event_type] || 'bg-gray-100 text-gray-600'
                  const files = entry.process_history_files || []

                  return (
                    <div
                      key={entry.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${colorClass}`}>
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-medium text-gray-900">{entry.title}</h3>
                              {entry.description && (
                                <p className="text-sm text-gray-500 mt-0.5">{entry.description}</p>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 shrink-0 text-right">
                              <div>{formatTime(entry.created_at)}</div>
                              <div className="mt-0.5">{eventLabels[entry.event_type] || entry.event_type}</div>
                            </div>
                          </div>

                          {/* Файлы */}
                          {files.length > 0 && (
                            <div className="mt-3 space-y-1">
                              <p className="text-xs font-medium text-gray-500">Файлы:</p>
                              <div className="flex flex-wrap gap-2">
                                {files.map((f) => {
                                  const isImage = f.mime_type?.startsWith('image/')
                                  return (
                                    <a
                                      key={f.id}
                                      href={getFileUrl(f.file_path)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group"
                                    >
                                      {isImage ? (
                                        <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group-hover:border-blue-400 transition-colors">
                                          <img
                                            src={getFileUrl(f.file_path)}
                                            alt={f.file_name}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
                                          <FileText size={14} />
                                          <span className="max-w-[120px] truncate">{f.file_name}</span>
                                        </div>
                                      )}
                                    </a>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
