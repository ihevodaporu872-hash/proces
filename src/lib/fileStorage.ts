import { supabase } from './supabase'

const BUCKET = 'process-files'

export async function uploadFile(file: File, folder: string): Promise<{ path: string; error: string | null }> {
  const ext = file.name.split('.').pop()
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(fileName, file)
  if (error) return { path: '', error: error.message }

  return { path: fileName, error: null }
}

export function getFileUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteFile(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}
