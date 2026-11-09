import { supabase } from '../../lib/supabase'

const BUCKET = 'avatars'
const ALLOWED_TYPES = ['image/jpeg', 'image/png']
const MAX_BYTES = 2 * 1024 * 1024

// Returns a message for a file that cannot be used as a profile photo, or null when it is fine.
export function avatarFileError(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Use a JPG or PNG image.'
  if (file.size > MAX_BYTES) return 'Use an image up to 2 MB.'
  return null
}

// Uploads the photo to the signed-in person's own folder and returns its public URL. Each upload gets a new
// random name, so browsers never show an old photo from cache. The profile row is updated by the caller.
export async function uploadAvatarFile(userId: string, file: File): Promise<string> {
  const extension = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600' })
  if (error) throw error

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// Removes a photo file from the bucket, given its public URL. Anything that is not one of our files is ignored.
export async function deleteAvatarFile(url: string) {
  const marker = `/object/public/${BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return
  const path = decodeURIComponent(url.slice(index + marker.length))
  await supabase.storage.from(BUCKET).remove([path])
}
