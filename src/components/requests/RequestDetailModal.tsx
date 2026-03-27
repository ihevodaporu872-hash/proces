import { useState, useEffect } from 'react'
import { Package, Truck } from 'lucide-react'
import Modal from '../shared/Modal'
import FileUpload from '../shared/FileUpload'
import StatusBadge from '../shared/StatusBadge'
import { supabase } from '@/lib/supabase'
import { uploadFile } from '@/lib/fileStorage'
import type { MaterialRequest, RequestItem, Delivery, STATUS_LABELS, STATUS_COLORS } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  request: MaterialRequest | null
  onUpdated: () => void
}

export default function RequestDetailModal({ open, onClose, request, onUpdated }: Props) {
  const [items, setItems] = useState<RequestItem[]>([])
  const [deliveries, setDeliveries] = useState<Record<string, Delivery[]>>({})
  const [deliveryItemId, setDeliveryItemId] = useState<string | null>(null)
  const [deliveryQty, setDeliveryQty] = useState('')
  const [deliveryDesc, setDeliveryDesc] = useState('')
  const [deliveryFiles, setDeliveryFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

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

  useEffect(() => {
    if (request && open) loadData()
  }, [request, open])

  const loadData = async () => {
    if (!request) return
    setLoading(true)

    const { data: itemsData } = await supabase
      .from('request_items')
      .select('*')
      .eq('request_id', request.id)
      .order('created_at')

    setItems(itemsData || [])

    if (itemsData?.length) {
      const ids = itemsData.map((it) => it.id)
      const { data: delData } = await supabase
        .from('deliveries')
        .select('*, delivery_files(*)')
        .in('request_item_id', ids)
        .order('delivered_at', { ascending: false })

      const grouped: Record<string, Delivery[]> = {}
      for (const d of delData || []) {
        if (!grouped[d.request_item_id]) grouped[d.request_item_id] = []
        grouped[d.request_item_id].push(d)
      }
      setDeliveries(grouped)
    }

    setLoading(false)
  }

  const handleRecordDelivery = async () => {
    if (!deliveryItemId || !deliveryQty) return
    setSaving(true)

    const qty = parseFloat(deliveryQty)

    const { data: delivery, error } = await supabase
      .from('deliveries')
      .insert({
        request_item_id: deliveryItemId,
        quantity: qty,
        description: deliveryDesc.trim() || null,
      })
      .select()
      .single()

    if (error || !delivery) {
      alert('Ошибка: ' + (error?.message || ''))
      setSaving(false)
      return
    }

    // Загрузка файлов
    for (const file of deliveryFiles) {
      const { path, error: uploadErr } = await uploadFile(file, `deliveries/${delivery.id}`)
      if (!uploadErr) {
        await supabase.from('delivery_files').insert({
          delivery_id: delivery.id,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
        })
      }
    }

    // Обновить количество поставки в позиции
    const item = items.find((it) => it.id === deliveryItemId)
    if (item) {
      const newDelivered = item.quantity_delivered + qty
      const newAvailable = item.quantity_available + qty
      await supabase.from('request_items').update({
        quantity_delivered: newDelivered,
        quantity_available: newAvailable,
      }).eq('id', deliveryItemId)

      // Обновить site_stock
      await supabase.from('site_stock').upsert({
        request_item_id: deliveryItemId,
        quantity_available: newAvailable,
      }, { onConflict: 'request_item_id' })
    }

    // Обновить статус заявки
    const allItems = items.map((it) =>
      it.id === deliveryItemId
        ? { ...it, quantity_delivered: it.quantity_delivered + qty }
        : it
    )
    const allDelivered = allItems.every((it) => it.quantity_delivered >= it.quantity_ordered)
    const someDelivered = allItems.some((it) => it.quantity_delivered > 0)

    await supabase.from('material_requests').update({
      status: allDelivered ? 'available' : someDelivered ? 'partial_delivery' : 'awaiting_delivery',
    }).eq('id', request!.id)

    // История
    const historyFiles = []
    for (const file of deliveryFiles) {
      const { path } = await uploadFile(file, `history`)
      if (path) historyFiles.push({ file_name: file.name, file_path: path, file_size: file.size, mime_type: file.type })
    }

    const { data: histEntry } = await supabase.from('process_history').insert({
      event_type: 'delivery',
      reference_id: delivery.id,
      reference_table: 'deliveries',
      title: `Поставка: ${item?.name || ''}`,
      description: `Количество: ${qty} ${item?.unit || ''}. ${deliveryDesc}`.trim(),
    }).select().single()

    if (histEntry && historyFiles.length) {
      await supabase.from('process_history_files').insert(
        historyFiles.map((f) => ({ ...f, history_id: histEntry.id }))
      )
    }

    setSaving(false)
    setDeliveryItemId(null)
    setDeliveryQty('')
    setDeliveryDesc('')
    setDeliveryFiles([])
    loadData()
    onUpdated()
  }

  if (!request) return null

  return (
    <Modal open={open} onClose={onClose} title={`Заявка: ${request.title}`} wide>
      <div className="space-y-5">
        {/* Шапка */}
        <div className="flex items-center gap-3">
          <StatusBadge
            label={statusLabels[request.status] || request.status}
            colorClass={statusColors[request.status] || 'bg-gray-100 text-gray-700'}
          />
          {request.description && (
            <span className="text-sm text-gray-500">{request.description}</span>
          )}
        </div>

        {/* Позиции */}
        {loading ? (
          <p className="text-sm text-gray-500">Загрузка...</p>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Package size={16} /> Позиции заявки
            </h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Материал</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Ед.</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Заявлено</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Поставлено</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Доступно</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-900">{item.name}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{item.unit}</td>
                      <td className="px-3 py-2 text-right">{item.quantity_ordered}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={item.quantity_delivered >= item.quantity_ordered ? 'text-green-600' : 'text-orange-600'}>
                          {item.quantity_delivered}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{item.quantity_available}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setDeliveryItemId(item.id)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          <Truck size={14} /> Поставка
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Форма фиксации поставки */}
        {deliveryItemId && (
          <div className="p-4 bg-blue-50 rounded-lg space-y-3 border border-blue-200">
            <h4 className="text-sm font-semibold text-blue-800">
              Зафиксировать поставку: {items.find((it) => it.id === deliveryItemId)?.name}
            </h4>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-600 mb-1">Количество</label>
                <input
                  type="number"
                  value={deliveryQty}
                  onChange={(e) => setDeliveryQty(e.target.value)}
                  min="0"
                  step="0.001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs text-gray-600 mb-1">Описание</label>
                <input
                  type="text"
                  value={deliveryDesc}
                  onChange={(e) => setDeliveryDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Номер ТТН, комментарий..."
                />
              </div>
            </div>
            <FileUpload files={deliveryFiles} onChange={setDeliveryFiles} label="Подтверждающие документы" />
            <div className="flex gap-2">
              <button
                onClick={handleRecordDelivery}
                disabled={saving || !deliveryQty}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Зафиксировать'}
              </button>
              <button
                onClick={() => { setDeliveryItemId(null); setDeliveryFiles([]) }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* История поставок */}
        {items.some((it) => deliveries[it.id]?.length) && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Truck size={16} /> Поставки
            </h3>
            {items.map((item) =>
              (deliveries[item.id] || []).map((d) => (
                <div key={d.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{item.name} — {d.quantity} {item.unit}</div>
                    {d.description && <div className="text-gray-500 mt-0.5">{d.description}</div>}
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(d.delivered_at).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  {d.delivery_files && d.delivery_files.length > 0 && (
                    <div className="text-xs text-blue-600">{d.delivery_files.length} файл(ов)</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
