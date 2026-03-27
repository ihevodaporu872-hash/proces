import { useState, useEffect } from 'react'
import { Package, ClipboardCheck, FileText, Pencil, Trash2 } from 'lucide-react'
import Modal from '../shared/Modal'
import ProgressCell from '../shared/ProgressCell'
import { supabase } from '@/lib/supabase'
import { getFileUrl } from '@/lib/fileStorage'
import type { WorkStage, WorkStageMaterial, WorkRecord } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  stage: WorkStage | null
  onUpdated?: () => void
  onDeleted?: () => void
}

export default function StageDetailModal({ open, onClose, stage, onUpdated, onDeleted }: Props) {
  const [materials, setMaterials] = useState<any[]>([])
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (stage && open) loadData()
  }, [stage, open])

  const loadData = async () => {
    if (!stage) return
    setLoading(true)

    const [matsRes, recsRes] = await Promise.all([
      supabase
        .from('work_stage_materials')
        .select('*, request_item:request_items(*)')
        .eq('work_stage_id', stage.id),
      supabase
        .from('work_records')
        .select('*, work_record_files(*), material_consumptions(*, request_item:request_items(*)), leftovers(*)')
        .eq('work_stage_id', stage.id)
        .order('recorded_at', { ascending: false }),
    ])

    setMaterials(matsRes.data || [])
    setRecords(recsRes.data || [])
    setLoading(false)
  }

  const handleStartEdit = () => {
    if (!stage) return
    setEditTitle(stage.title)
    setEditDesc(stage.description || '')
    setEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!stage || !editTitle.trim()) return
    setSaving(true)
    await supabase.from('work_stages').update({
      title: editTitle.trim(),
      description: editDesc.trim() || null,
    }).eq('id', stage.id)
    setSaving(false)
    setEditing(false)
    onUpdated?.()
  }

  const handleDelete = async () => {
    if (!stage) return
    if (!confirm('Удалить этап и все связанные записи? Это действие необратимо.')) return
    setSaving(true)
    await supabase.from('work_stages').delete().eq('id', stage.id)
    setSaving(false)
    onClose()
    onDeleted?.()
  }

  if (!stage) return null

  return (
    <Modal open={open} onClose={onClose} title={stage.title} wide>
      <div className="space-y-5">
        {editing ? (
          <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Название</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Описание</label>
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Описание этапа..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editTitle.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Сохранить
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {(() => {
                const totalPlanned = materials.reduce((s: number, m: any) => s + Number(m.quantity_planned), 0)
                const totalDelivered = materials.reduce((s: number, m: any) => s + Number(m.request_item?.quantity_delivered || 0), 0)
                const totalUsed = materials.reduce((s: number, m: any) => s + Number(m.quantity_used), 0)
                return <ProgressCell total={totalPlanned} delivered={totalDelivered} used={totalUsed} />
              })()}
              {stage.description && <span className="text-sm text-gray-500">{stage.description}</span>}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleStartEdit}
                className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                title="Редактировать"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                title="Удалить этап"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Загрузка...</p>
        ) : (
          <>
            {/* Привязанные материалы */}
            {materials.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
                  <Package size={16} /> Материалы
                </h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Материал</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">План</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">Факт</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map((m: any) => (
                        <tr key={m.id} className="border-t border-gray-100">
                          <td className="px-3 py-2">{m.request_item?.name}</td>
                          <td className="px-3 py-2 text-right">{m.quantity_planned} {m.request_item?.unit}</td>
                          <td className="px-3 py-2 text-right font-medium">
                            <span className={m.quantity_used > 0 ? 'text-blue-600' : 'text-gray-400'}>
                              {m.quantity_used} {m.request_item?.unit}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Записи о работах */}
            {records.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
                  <ClipboardCheck size={16} /> Записи о выполненных работах
                </h3>
                <div className="space-y-3">
                  {records.map((r: any) => (
                    <div key={r.id} className="p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          {r.description && <p className="text-sm text-gray-800">{r.description}</p>}
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(r.recorded_at).toLocaleString('ru-RU')}
                          </p>
                        </div>
                      </div>

                      {r.material_consumptions?.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          <span className="font-medium">Использовано: </span>
                          {r.material_consumptions.map((mc: any, i: number) => (
                            <span key={mc.id}>
                              {mc.request_item?.name}: {mc.quantity} {mc.request_item?.unit}
                              {i < r.material_consumptions.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </div>
                      )}

                      {r.leftovers?.length > 0 && (
                        <div className="mt-1 text-xs">
                          {r.leftovers.map((l: any) => (
                            <span
                              key={l.id}
                              className={`inline-block mr-2 px-1.5 py-0.5 rounded ${
                                l.leftover_type === 'usable'
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {l.leftover_type === 'usable' ? 'Пригодные' : 'Утиль'}: {l.quantity}
                            </span>
                          ))}
                        </div>
                      )}

                      {r.work_record_files?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {r.work_record_files.map((f: any) => {
                            const isImage = f.mime_type?.startsWith('image/')
                            return isImage ? (
                              <a
                                key={f.id}
                                href={getFileUrl(f.file_path)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-colors"
                              >
                                <img src={getFileUrl(f.file_path)} alt={f.file_name} className="w-full h-full object-cover" />
                              </a>
                            ) : (
                              <a
                                key={f.id}
                                href={getFileUrl(f.file_path)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded hover:bg-blue-100"
                              >
                                <FileText size={12} /> {f.file_name}
                              </a>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
