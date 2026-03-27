-- ============================================================
-- Политики доступа к хранилищу файлов (storage)
-- ============================================================

-- Разрешить всем загружать файлы в бакет process-files
create policy "allow_upload" on storage.objects
  for insert
  with check (bucket_id = 'process-files');

-- Разрешить всем читать файлы из бакета process-files
create policy "allow_read" on storage.objects
  for select
  using (bucket_id = 'process-files');

-- Разрешить всем удалять файлы из бакета process-files
create policy "allow_delete" on storage.objects
  for delete
  using (bucket_id = 'process-files');
