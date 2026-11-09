import { useQueryClient } from '@tanstack/react-query'
import { Paperclip, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { formatSize, openAttachment, removeAttachment, uploadAttachment, useAttachments } from './attachments'

type Props = {
  issueId: string
  canEdit: boolean
  currentUserId: string | undefined
}

// Attachments shown as chips, matching the design. Editors can add files; uploaders can remove theirs.
export function AttachmentsSection({ issueId, canEdit, currentUserId }: Props) {
  const queryClient = useQueryClient()
  const attachments = useAttachments(issueId)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0 || !currentUserId) return
    setBusy(true)
    for (const file of Array.from(files)) {
      const error = await uploadAttachment(issueId, file, currentUserId)
      if (error) toast(error)
    }
    setBusy(false)
    if (input.current) input.current.value = ''
    queryClient.invalidateQueries({ queryKey: ['attachments', issueId] })
  }

  async function remove(id: string) {
    const item = (attachments.data ?? []).find((a) => a.id === id)
    if (!item) return
    try {
      await removeAttachment(item)
      queryClient.invalidateQueries({ queryKey: ['attachments', issueId] })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'The file could not be removed.')
    }
  }

  const items = attachments.data ?? []

  return (
    <section className="flex flex-col gap-3 border-border border-t pt-6">
      <h3 className="font-medium text-sm text-text-primary">
        Attachments <span className="text-text-secondary tabular-nums">{items.length}</span>
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong bg-surface-raised py-1 pr-1 pl-2.5 text-[13px] text-text-primary">
            <button type="button" onClick={() => openAttachment(item.storage_path).catch((e: Error) => toast(e.message))} className="flex cursor-pointer items-center gap-1.5 hover:text-primary">
              <Paperclip className="size-3.5 text-text-secondary" aria-hidden="true" />
              {item.file_name}
              {item.size_bytes !== null && <span className="text-xs text-text-secondary">{formatSize(item.size_bytes)}</span>}
            </button>
            {item.uploader_id === currentUserId && (
              <button type="button" aria-label={`Remove ${item.file_name}`} onClick={() => remove(item.id)} className="grid size-5 cursor-pointer place-items-center rounded-sm text-text-secondary hover:bg-surface-hover">
                <X className="size-3" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        {canEdit && (
          <>
            <input
              ref={input}
              type="file"
              multiple
              className="sr-only"
              aria-label="Add attachment"
              onChange={(e) => onFiles(e.target.files)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-[13px] text-primary hover:bg-surface-hover disabled:text-text-secondary"
            >
              <Paperclip className="size-4" aria-hidden="true" />
              {busy ? 'Uploading' : 'Add attachment'}
            </button>
          </>
        )}
      </div>
    </section>
  )
}
