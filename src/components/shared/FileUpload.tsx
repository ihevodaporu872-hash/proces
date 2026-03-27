import { useRef } from 'react'
import { Upload, FileIcon, Trash2 } from 'lucide-react'

interface FileUploadProps {
  files: File[]
  onChange: (files: File[]) => void
  label?: string
}

export default function FileUpload({ files, onChange, label = 'Прикрепить файлы' }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onChange([...files, ...Array.from(e.target.files)])
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        <Upload size={16} />
        {label}
      </button>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={handleAdd} />

      {files.length > 0 && (
        <div className="mt-2 space-y-1">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-sm">
              <FileIcon size={14} className="text-gray-400 shrink-0" />
              <span className="truncate flex-1 text-gray-700">{file.name}</span>
              <span className="text-gray-400 text-xs shrink-0">{formatSize(file.size)}</span>
              <button type="button" onClick={() => handleRemove(i)} className="p-0.5 hover:text-red-500 text-gray-400">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
