import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Modal from '../shared/Modal'
import FileUpload from '../shared/FileUpload'
import { supabase } from '@/lib/supabase'
import { uploadFile } from '@/lib/fileStorage'
import type { WorkStage, WorkStageMaterial } from '@/types'

interface DeliveryRow {
  request_item_id: string
  name: string
  unit: string
  ordered: number
  delivered: number
  quantity: string
}

interface ConsumptionRow {
  request_item_id: string
  name: string
  unit: string
  available: number
  quantity: string
}

interface LeftoverRow {
  request_item_id: string
  name: string
  unit: string
  type: 'usable' | 'unusable'
  quantity: string
  description: string
}

interface Props {
  open: boolean
  onClose: () => void
  stage: WorkStage | null
  onRecorded: () => void
  completeAfterSave?: boolean
}

export default function WorkRecordModal({ open, onClose, stage, onRecorded, completeAfterSave }: Props) {
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [deliveryRows, setDeliveryRows] = useState<DeliveryRow[]>([])
  const [consumptions, setConsumptions] = useState<ConsumptionRow[]>([])
  const [leftovers, setLeftovers] = useState<LeftoverRow[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (stage && open) loadStageMaterials()
  }, [stage, open])

  const loadStageMaterials = async () => {
    if (!stage) return

    const { data } = await supabase
      .from('work_stage_materials')
      .select('*, request_item:request_items(*)')
      .eq('work_stage_id', stage.id)

    if (data) {
      // Поставки: показываем только материалы, по которым ещё не всё поставлено
      setDeliveryRows(
        data
          .filter((m: any) => Number(m.request_item?.quantity_delivered || 0) < Number(m.request_item?.quantity_ordered || 0))
          .map((m: any) => ({
            request_item_id: m.request_item_id,
            name: m.request_item?.name || '',
            unit: m.request_item?.unit || '',
            ordered: Number(m.request_item?.quantity_ordered || 0),
            delivered: Number(m.request_item?.quantity_delivered || 0),
            quantity: '',
          }))
      )
      setConsumptions(
        data.map((m: any) => ({
          request_item_id: m.request_item_id,
          name: m.request_item?.name || '',
          unit: m.request_item?.unit || '',
          available: m.request_item?.quantity_available || 0,
          quantity: '',
        }))
      )
      setLeftovers(
        data.map((m: any) => ({
          request_item_id: m.request_item_id,
          name: m.request_item?.name || '',
          unit: m.request_item?.unit || '',
          type: 'usable' as const,
          quantity: '',
          description: '',
        }))
      )
    }
  }

  const updateDeliveryRow = (i: number, value: string) => {
    const updated = [...deliveryRows]
    updated[i] = { ...updated[i], quantity: value }
    setDeliveryRows(updated)
  }

  const updateConsumption = (i: number, value: string) => {
    const updated = [...consumptions]
    updated[i] = { ...updated[i], quantity: value }
    setConsumptions(updated)
  }

  const updateLeftover = (i: number, field: string, value: string) => {
    const updated = [...leftovers]
    updated[i] = { ...updated[i], [field]: value }
    setLeftovers(updated)
  }

  const handleSave = async () => {
    if (!stage) return

    // Валидация поставок: нельзя поставить больше заказанного
    for (const d of deliveryRows) {
      const qty = parseFloat(d.quantity || '0')
      if (qty > 0) {
        const remaining = d.ordered - d.delivered
        if (qty > remaining) {
          alert(`${d.name}: нельзя поставить ${qty} ${d.unit}, осталось поставить: ${remaining}. Создайте новую заявку для большего объёма.`)
          return
        }
      }
    }

    // Рассчитаем доступное с учётом новых поставок
    const deliveredExtra = new Map<string, number>()
    for (const d of deliveryRows) {
      const qty = parseFloat(d.quantity || '0')
      if (qty > 0) deliveredExtra.set(d.request_item_id, qty)
    }

    // Валидация: нельзя списать больше доступного (с учётом новых поставок)
    for (const c of consumptions) {
      const qty = parseFloat(c.quantity || '0')
      const extra = deliveredExtra.get(c.request_item_id) || 0
      const totalAvailable = c.available + extra
      if (qty > totalAvailable) {
        alert(`${c.name}: нельзя использовать ${qty} ${c.unit}, доступно: ${totalAvailable} (${c.available} + ${extra} новая поставка).`)
        return
      }
    }

    setSaving(true)

    // Создаём запись о выполненных работах
    const { data: record, error } = await supabase
      .from('work_records')
      .insert({
        work_stage_id: stage.id,
        description: description.trim() || null,
      })
      .select()
      .single()

    if (error || !record) {
      alert('Ошибка: ' + (error?.message || ''))
      setSaving(false)
      return
    }

    // Загружаем файлы
    const uploadedFiles = []
    for (const file of files) {
      const { path, error: uploadErr } = await uploadFile(file, `work_records/${record.id}`)
      if (!uploadErr) {
        uploadedFiles.push({ file_name: file.name, file_path: path, file_size: file.size, mime_type: file.type })
        await supabase.from('work_record_files').insert({
          work_record_id: record.id,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
        })
      }
    }

    // Фиксация поставок
    const validDeliveries = deliveryRows.filter((d) => d.quantity && parseFloat(d.quantity) > 0)
    for (const d of validDeliveries) {
      const qty = parseFloat(d.quantity)

      const { data: delivery } = await supabase
        .from('deliveries')
        .insert({
          request_item_id: d.request_item_id,
          quantity: qty,
          description: `Поставка из этапа монтажа: ${stage.title}`,
        })
        .select()
        .single()

      const newDelivered = d.delivered + qty
      const currentItem = consumptions.find((c) => c.request_item_id === d.request_item_id)
      const currentAvail = (currentItem?.available || 0) + qty
      await supabase.from('request_items').update({
        quantity_delivered: newDelivered,
        quantity_available: currentAvail,
      }).eq('id', d.request_item_id)

      await supabase.from('site_stock').upsert({
        request_item_id: d.request_item_id,
        quantity_available: currentAvail,
      }, { onConflict: 'request_item_id' })

      // Обновить available в consumptions для корректного списания
      if (currentItem) currentItem.available = currentAvail

      if (delivery) {
        await supabase.from('process_history').insert({
          event_type: 'delivery',
          reference_id: delivery.id,
          reference_table: 'deliveries',
          title: `Поставка: ${d.name}`,
          description: `Количество: ${qty} ${d.unit}`,
        })
      }
    }

    // Списание материалов
    const validConsumptions = consumptions.filter((c) => c.quantity && parseFloat(c.quantity) > 0)
    for (const c of validConsumptions) {
      const qty = parseFloat(c.quantity)

      await supabase.from('material_consumptions').insert({
        work_record_id: record.id,
        request_item_id: c.request_item_id,
        quantity: qty,
      })

      // Обновить остатки
      const newAvailable = Math.max(0, c.available - qty)
      await supabase.from('request_items').update({
        quantity_used: qty,
        quantity_available: newAvailable,
      }).eq('id', c.request_item_id)

      await supabase.from('site_stock').upsert({
        request_item_id: c.request_item_id,
        quantity_available: newAvailable,
      }, { onConflict: 'request_item_id' })

      // Обновить факт использования в этапе
      await supabase.from('work_stage_materials').update({
        quantity_used: qty,
      }).eq('work_stage_id', stage.id).eq('request_item_id', c.request_item_id)
    }

    // Остатки после монтажа
    const validLeftovers = leftovers.filter((l) => l.quantity && parseFloat(l.quantity) > 0)
    for (const l of validLeftovers) {
      const qty = parseFloat(l.quantity)

      await supabase.from('leftovers').insert({
        work_record_id: record.id,
        request_item_id: l.request_item_id,
        leftover_type: l.type,
        quantity: qty,
        description: l.description.trim() || null,
      })

      if (l.type === 'usable') {
        // Пригодные остатки возвращаются в доступные
        const item = consumptions.find((c) => c.request_item_id === l.request_item_id)
        if (item) {
          const consumed = parseFloat(consumptions.find((c) => c.request_item_id === l.request_item_id)?.quantity || '0')
          const currentAvail = item.available - consumed + qty
          await supabase.from('request_items').update({
            quantity_available: Math.max(0, currentAvail),
          }).eq('id', l.request_item_id)

          await supabase.from('site_stock').upsert({
            request_item_id: l.request_item_id,
            quantity_available: Math.max(0, currentAvail),
          }, { onConflict: 'request_item_id' })
        }
      }
    }

    // История
    const { data: histEntry } = await supabase.from('process_history').insert({
      event_type: 'work_recorded',
      reference_id: record.id,
      reference_table: 'work_records',
      title: `Фиксация работ: ${stage.title}`,
      description: description.trim() || `Списано ${validConsumptions.length} материалов`,
    }).select().single()

    if (histEntry && uploadedFiles.length) {
      await supabase.from('process_history_files').insert(
        uploadedFiles.map((f) => ({ ...f, history_id: histEntry.id }))
      )
    }

    if (completeAfterSave) {
      await markCompleted()
    }

    setSaving(false)
    setDescription('')
    setFiles([])
    onRecorded()
    onClose()
  }

  const markCompleted = async () => {
    if (!stage) return
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
  }

  const handleSkipAndComplete = async () => {
    if (!stage) return
    setSaving(true)
    await markCompleted()
    setSaving(false)
    onRecorded()
    onClose()
  }

  if (!stage) return null

  return (
    <Modal open={open} onClose={onClose} title={completeAfterSave ? `Завершение этапа: ${stage.title}` : `Фиксация работ: ${stage.title}`} wide>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Описание выполненных работ</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            placeholder="Опишите выполненный объём работ..."
          />
        </div>

        <FileUpload files={files} onChange={setFiles} label="Прикрепить фото/документы" />

        {/* Фиксация поставок */}
        {deliveryRows.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-orange-800 mb-2">Поставки материалов</h4>
            <div className="space-y-2">
              {deliveryRows.map((d, i) => {
                const remaining = d.ordered - d.delivered
                return (
                  <div key={i} className="flex items-center gap-3 p-2 bg-orange-50 rounded-lg">
                    <span className="flex-1 text-sm text-gray-700">
                      {d.name} <span className="text-gray-400">(осталось: {remaining} {d.unit})</span>
                    </span>
                    <input
                      type="number"
                      value={d.quantity}
                      onChange={(e) => updateDeliveryRow(i, e.target.value)}
                      placeholder="Поступило"
                      min="0"
                      max={remaining}
                      step="0.001"
                      className="w-28 px-3 py-1.5 border border-orange-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <span className="text-xs text-gray-500 w-8">{d.unit}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Списание материалов */}
        {consumptions.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Использованные материалы</h4>
            <div className="space-y-2">
              {consumptions.map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <span className="flex-1 text-sm text-gray-700">
                    {c.name} <span className="text-gray-400">(доступно: {c.available} {c.unit})</span>
                  </span>
                  <input
                    type="number"
                    value={c.quantity}
                    onChange={(e) => updateConsumption(i, e.target.value)}
                    placeholder="Кол-во"
                    min="0"
                    max={c.available}
                    step="0.001"
                    className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500 w-8">{c.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Остатки после работ */}
        {leftovers.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Остатки после работ</h4>
            <div className="space-y-2">
              {leftovers.map((l, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700 w-40 shrink-0">{l.name}</span>
                  <select
                    value={l.type}
                    onChange={(e) => updateLeftover(i, 'type', e.target.value)}
                    className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none"
                  >
                    <option value="usable">Пригодные</option>
                    <option value="unusable">В утиль</option>
                  </select>
                  <input
                    type="number"
                    value={l.quantity}
                    onChange={(e) => updateLeftover(i, 'quantity', e.target.value)}
                    placeholder="Кол-во"
                    min="0"
                    step="0.001"
                    className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none"
                  />
                  <input
                    type="text"
                    value={l.description}
                    onChange={(e) => updateLeftover(i, 'description', e.target.value)}
                    placeholder="Примечание"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2 border-t border-gray-100">
          <div>
            {completeAfterSave && (
              <button
                onClick={handleSkipAndComplete}
                disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? 'Завершение...' : 'Данные уже указаны — завершить'}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : completeAfterSave ? 'Зафиксировать и завершить' : 'Зафиксировать работы'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
