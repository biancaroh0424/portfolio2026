'use client'

const DEFAULT_MAX_UPLOAD_BYTES = 4 * 1024 * 1024 // 4MB
const DEFAULT_MAX_DIMENSION = 2048

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to decode image file'))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode image blob'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      quality
    )
  })
}

/**
 * Vercel serverless request body limit(413)을 피하기 위해
 * 클라이언트에서 이미지를 리사이즈/압축해 업로드 가능한 크기로 맞춘다.
 */
export async function optimizeImageForUpload(
  file: File,
  maxBytes: number = DEFAULT_MAX_UPLOAD_BYTES
): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size <= maxBytes) return file

  const image = await loadImageFromFile(file)
  const ratio = Math.min(1, DEFAULT_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * ratio))
  const height = Math.max(1, Math.round(image.naturalHeight * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context is not available')
  ctx.drawImage(image, 0, 0, width, height)

  let quality = 0.9
  let blob = await canvasToBlob(canvas, quality)
  while (blob.size > maxBytes && quality > 0.45) {
    quality -= 0.1
    blob = await canvasToBlob(canvas, quality)
  }

  if (blob.size > maxBytes) {
    throw new Error('Image is too large even after compression')
  }

  const filename = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], filename, { type: 'image/jpeg' })
}
