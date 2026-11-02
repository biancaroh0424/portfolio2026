import fs from 'fs/promises'
import path from 'path'
import { createDecipheriv, randomBytes } from 'node:crypto'
import { list, put } from '@vercel/blob'
import { usesBlobStorage } from './project-storage'
import { decryptPrivateContent, encryptPrivateContent } from './private-content'

export interface ProjectMedia {
  contentType: string
  filename: string
  body?: string
  blobUrl?: string
  clientKey?: string
  clientIv?: string
}

const mediaPath = (id: string) => `data/protected-media/${id}.bin`

export async function saveProjectMedia(media: ProjectMedia): Promise<string> {
  const id = randomBytes(16).toString('hex')
  const payload = Buffer.from(JSON.stringify(media))
  if (usesBlobStorage()) {
    await put(mediaPath(id), encryptPrivateContent(payload), {
      access: 'public', contentType: 'application/octet-stream', addRandomSuffix: false,
    })
  } else {
    const filename = path.join(process.cwd(), mediaPath(id))
    await fs.mkdir(path.dirname(filename), { recursive: true })
    await fs.writeFile(filename, payload)
  }
  return `/api/admin/media/${id}`
}

export async function loadProjectMedia(id: string): Promise<{ media: ProjectMedia; bytes: Buffer }> {
  let payload: Buffer
  if (usesBlobStorage()) {
    const { blobs } = await list({ prefix: mediaPath(id), limit: 1 })
    const blob = blobs.find(blob => blob.pathname === mediaPath(id))
    if (!blob) throw new Error('Media not found')
    const response = await fetch(blob.url, { cache: 'no-store' })
    if (!response.ok) throw new Error('Media not found')
    payload = decryptPrivateContent(Buffer.from(await response.arrayBuffer()))
  } else {
    payload = await fs.readFile(path.join(process.cwd(), mediaPath(id)))
  }
  const media = JSON.parse(payload.toString('utf8')) as ProjectMedia
  if (media.body) return { media, bytes: Buffer.from(media.body, 'base64') }
  if (!media.blobUrl || !media.clientKey || !media.clientIv) throw new Error('Invalid media')
  const response = await fetch(media.blobUrl, { cache: 'no-store' })
  if (!response.ok) throw new Error('Media not found')
  const encrypted = Buffer.from(await response.arrayBuffer())
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(media.clientKey, 'base64'), Buffer.from(media.clientIv, 'base64'))
  decipher.setAuthTag(encrypted.subarray(-16))
  return { media, bytes: Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]) }
}
