'use client'

import type { PutBlobResult } from '@vercel/blob'

function randomHex(byteLength = 16): string {
  const a = new Uint8Array(byteLength)
  crypto.getRandomValues(a)
  return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('')
}

/**
 * 브라우저에서 Vercel Blob으로 직접 업로드 (대용량 동영상 등).
 * 실패 시 호출부에서 `/api/admin/upload` FormData 폴백을 사용하면 됨.
 */
export async function uploadFileToVercelBlob(file: File, pathnamePrefix = 'uploads'): Promise<PutBlobResult> {
  const { upload } = await import('@vercel/blob/client')
  const ext =
    file.name.includes('.') && file.name.lastIndexOf('.') > 0
      ? file.name.slice(file.name.lastIndexOf('.'))
      : ''
  const pathname = `${pathnamePrefix}/${randomHex(16)}${ext || (file.type.startsWith('video/') ? '.mp4' : '')}`

  return upload(pathname, file, {
    access: 'public',
    handleUploadUrl: '/api/admin/blob-upload',
    /** 4MB 초과 시 멀티파트로 분할 업로드 */
    multipart: file.size > 4 * 1024 * 1024,
    contentType: file.type || undefined,
  })
}

/** Encrypt before a direct upload, so the public Blob URL contains no viewable media. */
export async function uploadProtectedProjectFile(file: File): Promise<{ url: string }> {
  const key = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt'])
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, await file.arrayBuffer())
  const encryptedFile = new File([encrypted], 'media.bin', { type: 'application/octet-stream' })
  const blob = await uploadFileToVercelBlob(encryptedFile, 'protected-uploads')
  const toBase64 = (value: Uint8Array) => btoa(String.fromCharCode(...value))
  const response = await fetch('/api/admin/media', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blobUrl: blob.url, clientKey: toBase64(key), clientIv: toBase64(iv), contentType: file.type, filename: file.name }),
  })
  if (!response.ok) throw new Error('Failed to register protected media')
  return response.json()
}
