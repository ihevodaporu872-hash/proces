-- Миграция 001: Начальная схема БД
-- Дата: 2026-03-26
-- Описание: Создание всех таблиц для модуля управления материалами

-- ============================================================
-- DocStroy: Управление материалами — Схема БД
-- ============================================================

-- Статусы заявки
create type request_status as enum (
  'created',          -- Заявка создана
  'awaiting_delivery',-- Ожидание поставки
  'partial_delivery', -- Частично поставлено
  'available',        -- Материал доступен к использованию
  'in_progress',      -- В монтаже
  'partial_done',     -- Частично выполнено
  'needs_reorder',    -- Требуется допоставка
  'completed'         -- Завершено
);

-- Статусы этапа работ
create type work_stage_status as enum (
  'planned',          -- Запланирован
  'in_progress',      -- В работе
  'completed'         -- Завершён
);

-- Тип остатка
create type leftover_type as enum (
  'usable',           -- Пригодные
  'unusable'          -- Непригодные (утиль)
);

-- ============================================================
-- Заявки на материалы
-- ============================================================
create table material_requests (
  id uuid primary key default gen_random_uuid(),
  number serial,
  title text not null,
  description text,
  status request_status not null default 'created',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Позиции заявки (номенклатура)
create table request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references material_requests(id) on delete cascade,
  name text not null,                         -- Наименование материала
  unit text not null default 'шт',            -- Единица измерения
  quantity_ordered numeric(12,3) not null,     -- Заявленный объём
  quantity_delivered numeric(12,3) not null default 0, -- Поставлено всего
  quantity_used numeric(12,3) not null default 0,      -- Использовано в работах
  quantity_available numeric(12,3) not null default 0, -- Доступный остаток
  created_at timestamptz not null default now()
);

-- ============================================================
-- Поставки материалов
-- ============================================================
create table deliveries (
  id uuid primary key default gen_random_uuid(),
  request_item_id uuid not null references request_items(id) on delete cascade,
  quantity numeric(12,3) not null,             -- Количество поставки
  delivered_at timestamptz not null default now(),
  description text,
  recorded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Файлы поставки (подтверждение поступления)
create table delivery_files (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries(id) on delete cascade,
  file_name text not null,
  file_path text not null,                     -- Путь в Supabase Storage
  file_size bigint,
  mime_type text,
  uploaded_at timestamptz not null default now()
);

-- ============================================================
-- Остатки на объекте (агрегированное представление)
-- ============================================================
create table site_stock (
  id uuid primary key default gen_random_uuid(),
  request_item_id uuid not null references request_items(id) on delete cascade,
  quantity_available numeric(12,3) not null default 0,
  updated_at timestamptz not null default now(),
  unique (request_item_id)
);

-- ============================================================
-- Этапы работ (монтаж)
-- ============================================================
create table work_stages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status work_stage_status not null default 'planned',
  created_by uuid references auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Материалы, привязанные к этапу работ (план)
create table work_stage_materials (
  id uuid primary key default gen_random_uuid(),
  work_stage_id uuid not null references work_stages(id) on delete cascade,
  request_item_id uuid not null references request_items(id),
  quantity_planned numeric(12,3) not null,     -- Плановый объём
  quantity_used numeric(12,3) not null default 0 -- Фактически использовано
);

-- ============================================================
-- Фиксация выполненных работ
-- ============================================================
create table work_records (
  id uuid primary key default gen_random_uuid(),
  work_stage_id uuid not null references work_stages(id) on delete cascade,
  description text,
  recorded_by uuid references auth.users(id),
  recorded_at timestamptz not null default now()
);

-- Файлы фиксации работ
create table work_record_files (
  id uuid primary key default gen_random_uuid(),
  work_record_id uuid not null references work_records(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_at timestamptz not null default now()
);

-- Списание материалов при выполнении работ
create table material_consumptions (
  id uuid primary key default gen_random_uuid(),
  work_record_id uuid not null references work_records(id) on delete cascade,
  request_item_id uuid not null references request_items(id),
  quantity numeric(12,3) not null,
  consumed_at timestamptz not null default now()
);

-- ============================================================
-- Остатки после монтажа
-- ============================================================
create table leftovers (
  id uuid primary key default gen_random_uuid(),
  work_record_id uuid not null references work_records(id) on delete cascade,
  request_item_id uuid not null references request_items(id),
  leftover_type leftover_type not null,
  quantity numeric(12,3) not null,
  description text,
  created_at timestamptz not null default now()
);

-- Файлы остатков (фото утиля и пр.)
create table leftover_files (
  id uuid primary key default gen_random_uuid(),
  leftover_id uuid not null references leftovers(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_at timestamptz not null default now()
);

-- ============================================================
-- Единая история процесса (timeline)
-- ============================================================
create table process_history (
  id uuid primary key default gen_random_uuid(),
  event_type text not null, -- 'request_created', 'delivery', 'work_started', 'work_recorded', 'leftover_usable', 'leftover_unusable'
  reference_id uuid,        -- ID связанной записи
  reference_table text,     -- Имя таблицы-источника
  title text not null,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Файлы истории (ссылки на файлы из разных таблиц)
create table process_history_files (
  id uuid primary key default gen_random_uuid(),
  history_id uuid not null references process_history(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_at timestamptz not null default now()
);

-- ============================================================
-- Индексы
-- ============================================================
create index idx_request_items_request on request_items(request_id);
create index idx_deliveries_item on deliveries(request_item_id);
create index idx_delivery_files_delivery on delivery_files(delivery_id);
create index idx_site_stock_item on site_stock(request_item_id);
create index idx_work_stage_materials_stage on work_stage_materials(work_stage_id);
create index idx_work_records_stage on work_records(work_stage_id);
create index idx_work_record_files_record on work_record_files(work_record_id);
create index idx_material_consumptions_record on material_consumptions(work_record_id);
create index idx_leftovers_record on leftovers(work_record_id);
create index idx_process_history_type on process_history(event_type);
create index idx_process_history_created on process_history(created_at desc);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table material_requests enable row level security;
alter table request_items enable row level security;
alter table deliveries enable row level security;
alter table delivery_files enable row level security;
alter table site_stock enable row level security;
alter table work_stages enable row level security;
alter table work_stage_materials enable row level security;
alter table work_records enable row level security;
alter table work_record_files enable row level security;
alter table material_consumptions enable row level security;
alter table leftovers enable row level security;
alter table leftover_files enable row level security;
alter table process_history enable row level security;
alter table process_history_files enable row level security;

-- Политики: authenticated пользователи имеют полный доступ
create policy "auth_all" on material_requests for all using (auth.role() = 'authenticated');
create policy "auth_all" on request_items for all using (auth.role() = 'authenticated');
create policy "auth_all" on deliveries for all using (auth.role() = 'authenticated');
create policy "auth_all" on delivery_files for all using (auth.role() = 'authenticated');
create policy "auth_all" on site_stock for all using (auth.role() = 'authenticated');
create policy "auth_all" on work_stages for all using (auth.role() = 'authenticated');
create policy "auth_all" on work_stage_materials for all using (auth.role() = 'authenticated');
create policy "auth_all" on work_records for all using (auth.role() = 'authenticated');
create policy "auth_all" on work_record_files for all using (auth.role() = 'authenticated');
create policy "auth_all" on material_consumptions for all using (auth.role() = 'authenticated');
create policy "auth_all" on leftovers for all using (auth.role() = 'authenticated');
create policy "auth_all" on leftover_files for all using (auth.role() = 'authenticated');
create policy "auth_all" on process_history for all using (auth.role() = 'authenticated');
create policy "auth_all" on process_history_files for all using (auth.role() = 'authenticated');
