import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Modal from '../shared/Modal'
import { supabase } from '@/lib/supabase'

interface ItemRow {
  name: string
  unit: string
  quantity: string
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function CreateRequestModal({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<ItemRow[]>([{ name: '', unit: 'шт', quantity: '' }])
  const [saving, setSaving] = useState(false)

  const addItem = () => setItems([...items, { name: '', unit: 'шт', quantity: '' }])

  const removeItem = (i: number) => {
    if (items.length > 1) setItems(items.filter((_, idx) => idx !== i))
  }

  const updateItem = (i: number, field: keyof ItemRow, value: string) => {
    const updated = [...items]
    updated[i] = { ...updated[i], [field]: value }
    setItems(updated)
  }

  const handleSave = async () => {
    if (!title.trim() || items.some((it) => !it.name.trim() || !it.quantity)) return
    setSaving(true)

    const { data: req, error } = await supabase
      .from('material_requests')
      .insert({ title: title.trim(), description: description.trim() || null })
      .select()
      .single()

    if (error || !req) {
      alert('Ошибка создания заявки: ' + (error?.message || ''))
      setSaving(false)
      return
    }

    const itemRows = items.map((it) => ({
      request_id: req.id,
      name: it.name.trim(),
      unit: it.unit,
      quantity_ordered: parseFloat(it.quantity),
    }))

    const { error: itemsErr } = await supabase.from('request_items').insert(itemRows)

    if (itemsErr) {
      alert('Ошибка добавления позиций: ' + itemsErr.message)
      setSaving(false)
      return
    }

    // Запись в историю
    await supabase.from('process_history').insert({
      event_type: 'request_created',
      reference_id: req.id,
      reference_table: 'material_requests',
      title: `Создана заявка: ${title.trim()}`,
      description: `${items.length} позиций`,
    })

    setSaving(false)
    setTitle('')
    setDescription('')
    setItems([{ name: '', unit: 'шт', quantity: '' }])
    onCreated()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Новая заявка на материалы" wide>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Название заявки</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Например: Арматура для 3 этажа"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            placeholder="Дополнительная информация..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Позиции (номенклатура)</label>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={14} /> Добавить
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(i, 'name', e.target.value)}
                  placeholder="Наименование"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <input
                  type="text"
                  value={item.unit}
                  onChange={(e) => updateItem(i, 'unit', e.target.value)}
                  placeholder="Ед."
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                  placeholder="Кол-во"
                  min="0"
                  step="0.001"
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="p-2 text-gray-400 hover:text-red-500"
                  disabled={items.length <= 1}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохранение...' : 'Создать заявку'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
