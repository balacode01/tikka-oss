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

// Storage path inside the bucket, taken from a public URL, so the old file can be removed.
function pathFromUrl(url: string) {
  const marker = `/object/public/${BUCKET}/`
  const index = url.indexOf(marker)
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length))
}

async function removeFile(url: string | null) {
  const path = url ? pathFromUrl(url) : null
  if (path) await supabase.storage.from(BUCKET).remove([path])
}

// Uploads the photo to the signed-in person's own folder, saves its URL on the profile, and removes the
// previous photo. Each upload gets a new random name, so browsers never show an old photo from cache.
export async function uploadAvatar(userId: string, file: File, previousUrl: string | null): Promise<string> {
  const extension = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '3600' })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: urlData.publicUrl })
    .eq('id', userId)
    .select('avatar_url')
    .single()
  if (profileError) {
    await supabase.storage.from(BUCKET).remove([path])
    throw profileError
  }

  await removeFile(previousUrl)
  return urlData.publicUrl
}

// Clears the photo from the profile, then removes the file.
export async function removeAvatar(userId: string, previousUrl: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId)
    .select('avatar_url')
    .single()
  if (error) throw error

  await removeFile(previousUrl)
}
