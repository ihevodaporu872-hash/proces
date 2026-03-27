-- ============================================================
-- Временный anon-доступ для разработки
-- ВНИМАНИЕ: убрать перед выходом в прод!
-- ============================================================

create policy "anon_all" on material_requests for all using (true) with check (true);
create policy "anon_all" on request_items for all using (true) with check (true);
create policy "anon_all" on deliveries for all using (true) with check (true);
create policy "anon_all" on delivery_files for all using (true) with check (true);
create policy "anon_all" on site_stock for all using (true) with check (true);
create policy "anon_all" on work_stages for all using (true) with check (true);
create policy "anon_all" on work_stage_materials for all using (true) with check (true);
create policy "anon_all" on work_records for all using (true) with check (true);
create policy "anon_all" on work_record_files for all using (true) with check (true);
create policy "anon_all" on material_consumptions for all using (true) with check (true);
create policy "anon_all" on leftovers for all using (true) with check (true);
create policy "anon_all" on leftover_files for all using (true) with check (true);
create policy "anon_all" on process_history for all using (true) with check (true);
create policy "anon_all" on process_history_files for all using (true) with check (true);
