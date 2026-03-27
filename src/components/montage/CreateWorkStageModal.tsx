import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Modal from '../shared/Modal'
import { supabase } from '@/lib/supabase'
import type { RequestItem } from '@/types'

interface MaterialRow {
  request_item_id: string
  quantity_planned: string
  source: 'request' | 'leftover'
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function CreateWorkStageModal({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [materials, setMaterials] = useState<MaterialRow[]>([{ request_item_id: '', quantity_planned: '', source: 'request' }])
  const [availableItems, setAvailableItems] = useState<(RequestItem & { request_title: string })[]>([])
  const [leftoverItems, setLeftoverItems] = useState<(RequestItem & { request_title: string })[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) loadAvailableItems()
  }, [open])

  const loadAvailableItems = async () => {
    const { data } = await supabase
      .from('request_items')
      .select('*, material_requests!inner(title)')

    if (data) {
      const mapped = data.map((it: any) => ({
        ...it,
        request_title: it.material_requests?.title || '',
      }))
      // Новые материалы: ещё не использовались (включая непоступившие)
      setAvailableItems(mapped.filter((it: any) => Number(it.quantity_used) === 0))
      // Остатки: частично использованные, но ещё есть доступное кол-во
      setLeftoverItems(mapped.filter((it: any) => Number(it.quantity_used) > 0 && Number(it.quantity_available) > 0))
    }
  }

  const addMaterial = (source: 'request' | 'leftover') => setMaterials([...materials, { request_item_id: '', quantity_planned: '', source }])
  const removeMaterial = (i: number) => {
    if (materials.length > 1) setMaterials(materials.filter((_, idx) => idx !== i))
  }
  const updateMaterial = (i: number, field: keyof MaterialRow, value: string) => {
    const updated = [...materials]
    updated[i] = { ...updated[i], [field]: value }
    setMaterials(updated)
  }

  const handleSave = async () => {
    if (!title.trim()) return
    const validMaterials = materials.filter((m) => m.request_item_id && m.quantity_planned)
    if (validMaterials.length === 0) {
      alert('Укажите хотя бы один материал и необходимое количество')
      return
    }
    setSaving(true)

    const { data: stage, error } = await supabase
      .from('work_stages')
      .insert({ title: title.trim(), description: description.trim() || null })
      .select()
      .single()

    if (error || !stage) {
      alert('Ошибка: ' + (error?.message || ''))
      setSaving(false)
      return
    }

    if (validMaterials.length) {
      await supabase.from('work_stage_materials').insert(
        validMaterials.map((m) => ({
          work_stage_id: stage.id,
          request_item_id: m.request_item_id,
          quantity_planned: parseFloat(m.quantity_planned),
        }))
      )
    }

    await supabase.from('process_history').insert({
      event_type: 'work_created',
      reference_id: stage.id,
      reference_table: 'work_stages',
      title: `Создан этап: ${title.trim()}`,
      description: validMaterials.length ? `${validMaterials.length} материалов привязано` : null,
    })

    setSaving(false)
    setTitle('')
    setDescription('')
    setMaterials([{ request_item_id: '', quantity_planned: '', source: 'request' }])
    onCreated()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Новый этап монтажа" wide>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Название этапа</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Например: Монтаж каркаса 3 этажа"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Материалы из заявок</label>
            <button
              type="button"
              onClick={() => addMaterial('request')}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus size={14} /> Добавить
            </button>
          </div>

          <div className="space-y-2">
            {materials.filter((m) => m.source === 'request').map((mat) => {
              const idx = materials.indexOf(mat)
              return (
                <div key={idx} className="flex gap-2 items-start">
                  <select
                    value={mat.request_item_id}
                    onChange={(e) => updateMaterial(idx, 'request_item_id', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Выберите материал...</option>
                    {availableItems.map((item) => {
                      const avail = Number(item.quantity_available)
                      const delivered = Number(item.quantity_delivered)
                      const ordered = Number(item.quantity_ordered)
                      const statusText = avail > 0
                        ? `доступно: ${avail} ${item.unit}`
                        : delivered > 0
                          ? `поставлено: ${delivered}/${ordered} ${item.unit}`
                          : `ожидает поставки: ${ordered} ${item.unit}`
                      return (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.request_title}) — {statusText}
                        </option>
                      )
                    })}
                  </select>
                  <input
                    type="number"
                    value={mat.quantity_planned}
                    onChange={(e) => updateMaterial(idx, 'quantity_planned', e.target.value)}
                    placeholder="Кол-во"
                    min="0"
                    step="0.001"
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeMaterial(idx)}
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )
            })}
            {materials.filter((m) => m.source === 'request').length === 0 && (
              <p className="text-xs text-gray-400">Нет добавленных материалов</p>
            )}
          </div>
        </div>

        {leftoverItems.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Остатки от предыдущих работ</label>
              <button
                type="button"
                onClick={() => addMaterial('leftover')}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                <Plus size={14} /> Добавить остаток
              </button>
            </div>

            <div className="space-y-2">
              {materials.filter((m) => m.source === 'leftover').map((mat) => {
                const idx = materials.indexOf(mat)
                return (
                  <div key={idx} className="flex gap-2 items-start">
                    <select
                      value={mat.request_item_id}
                      onChange={(e) => updateMaterial(idx, 'request_item_id', e.target.value)}
                      className="flex-1 px-3 py-2 border border-emerald-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-emerald-50"
                    >
                      <option value="">Выберите остаток...</option>
                      {leftoverItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.request_title}) — остаток: {item.quantity_available} {item.unit}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={mat.quantity_planned}
                      onChange={(e) => updateMaterial(idx, 'quantity_planned', e.target.value)}
                      placeholder="Кол-во"
                      min="0"
                      step="0.001"
                      className="w-28 px-3 py-2 border border-emerald-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-emerald-50"
                    />
                    <button
                      type="button"
                      onClick={() => removeMaterial(idx)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Создать этап'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
