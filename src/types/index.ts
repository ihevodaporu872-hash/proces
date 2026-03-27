export type RequestStatus =
  | 'created'
  | 'awaiting_delivery'
  | 'partial_delivery'
  | 'available'
  | 'in_progress'
  | 'partial_done'
  | 'needs_reorder'
  | 'completed'

export type WorkStageStatus = 'planned' | 'in_progress' | 'completed'

export type LeftoverType = 'usable' | 'unusable'

export interface MaterialRequest {
  id: string
  number: number
  title: string
  description: string | null
  status: RequestStatus
  created_by: string | null
  created_at: string
  updated_at: string
  request_items?: RequestItem[]
}

export interface RequestItem {
  id: string
  request_id: string
  name: string
  unit: string
  quantity_ordered: number
  quantity_delivered: number
  quantity_used: number
  quantity_available: number
  created_at: string
}

export interface Delivery {
  id: string
  request_item_id: string
  quantity: number
  delivered_at: string
  description: string | null
  recorded_by: string | null
  created_at: string
  delivery_files?: DeliveryFile[]
  request_item?: RequestItem
}

export interface DeliveryFile {
  id: string
  delivery_id: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  uploaded_at: string
}

export interface WorkStage {
  id: string
  title: string
  description: string | null
  status: WorkStageStatus
  created_by: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  work_stage_materials?: WorkStageMaterial[]
  work_records?: WorkRecord[]
}

export interface WorkStageMaterial {
  id: string
  work_stage_id: string
  request_item_id: string
  quantity_planned: number
  quantity_used: number
  request_item?: RequestItem
}

export interface WorkRecord {
  id: string
  work_stage_id: string
  description: string | null
  recorded_by: string | null
  recorded_at: string
  work_record_files?: WorkRecordFile[]
  material_consumptions?: MaterialConsumption[]
  leftovers?: Leftover[]
}

export interface WorkRecordFile {
  id: string
  work_record_id: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  uploaded_at: string
}

export interface MaterialConsumption {
  id: string
  work_record_id: string
  request_item_id: string
  quantity: number
  consumed_at: string
  request_item?: RequestItem
}

export interface Leftover {
  id: string
  work_record_id: string
  request_item_id: string
  leftover_type: LeftoverType
  quantity: number
  description: string | null
  created_at: string
}

export interface ProcessHistoryEntry {
  id: string
  event_type: string
  reference_id: string | null
  reference_table: string | null
  title: string
  description: string | null
  created_by: string | null
  created_at: string
  process_history_files?: ProcessHistoryFile[]
}

export interface ProcessHistoryFile {
  id: string
  history_id: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  uploaded_at: string
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  created: 'Создана',
  awaiting_delivery: 'Ожидание поставки',
  partial_delivery: 'Частично поставлено',
  available: 'Материал доступен',
  in_progress: 'В монтаже',
  partial_done: 'Частично выполнено',
  needs_reorder: 'Требуется допоставка',
  completed: 'Завершено',
}

export const STATUS_COLORS: Record<RequestStatus, string> = {
  created: 'bg-gray-100 text-gray-700',
  awaiting_delivery: 'bg-yellow-100 text-yellow-800',
  partial_delivery: 'bg-orange-100 text-orange-800',
  available: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  partial_done: 'bg-indigo-100 text-indigo-800',
  needs_reorder: 'bg-red-100 text-red-800',
  completed: 'bg-emerald-100 text-emerald-800',
}

export const WORK_STATUS_LABELS: Record<WorkStageStatus, string> = {
  planned: 'Запланирован',
  in_progress: 'В работе',
  completed: 'Завершён',
}

export const WORK_STATUS_COLORS: Record<WorkStageStatus, string> = {
  planned: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
}
