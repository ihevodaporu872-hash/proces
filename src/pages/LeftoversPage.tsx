import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { RequestItem } from '@/types'

interface LeftoverRow extends RequestItem {
  request_title: string
}

export default function LeftoversPage() {
  const [items, setItems] = useState<LeftoverRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { loadLeftovers() }, [])

  const loadLeftovers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('request_items')
      .select('*, material_requests!inner(title)')
      .gt('quantity_available', 0)

    if (data) {
      setItems(
        data.map((it: any) => ({
          ...it,
          request_title: it.material_requests?.title || '',
        }))
      )
    }
    setLoading(false)
  }

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.request_title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Остатки материалов</h1>
        <p className="text-sm text-gray-500 mt-1">Доступные материалы, не полностью использованные по заявкам</p>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по материалу или заявке..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Остатков нет — все материалы использованы</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Материал</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Заявка</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Доступно</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ед.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.request_title}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                    {item.quantity_available}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
