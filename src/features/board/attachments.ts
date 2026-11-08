import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

export type Attachment = {
  id: string
  file_name: string
  storage_path: string
  size_bytes: number | null
  uploader_id: string | null
  created_at: string
}

// Attachments of one issue. RLS limits the rows to issues the user can see.
export function useAttachments(issueId: string | null) {
  return useQuery({
    queryKey: ['attachments', issueId],
    enabled: Boolean(issueId),
    queryFn: async (): Promise<Attachment[]> => {
      const { data, error } = await supabase
        .from('attachments')
        .select('id, file_name, storage_path, size_bytes, uploader_id, created_at')
        .eq('issue_id', issueId!)
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
  })
}

// Stores the file under <issue>/<unique id>-<name>, then records it. Returns an error message, or null.
export async function uploadAttachment(issueId: string, file: File, uploaderId: string): Promise<string | null> {
  if (file.size > MAX_ATTACHMENT_BYTES) return `${file.name} is larger than 25 MB`

  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '-')
  const path = `${issueId}/${crypto.randomUUID()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('issue-attachments')
    .upload(path, file, { contentType: file.type || 'application/octet-stream' })
  if (uploadError) return `${file.name} could not be uploaded. Try again.`

  const { error: rowError } = await supabase.from('attachments').insert({
    issue_id: issueId,
    uploader_id: uploaderId,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
  })
  if (rowError) {
    await supabase.storage.from('issue-attachments').remove([path])
    return `${file.name} could not be saved to the issue.`
  }
  return null
}

// A short-lived link to open a file. The bucket is private, so every link is signed.
export async function openAttachment(path: string) {
  const { data, error } = await supabase.storage.from('issue-attachments').createSignedUrl(path, 300)
  if (error || !data) throw new Error('The file could not be opened. Try again.')
  window.open(data.signedUrl, '_blank', 'noopener')
}

export async function removeAttachment(attachment: Attachment) {
  const { error } = await supabase.from('attachments').delete().eq('id', attachment.id)
  if (error) throw error
  await supabase.storage.from('issue-attachments').remove([attachment.storage_path])
}

export function formatSize(bytes: number | null) {
  if (bytes === null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
