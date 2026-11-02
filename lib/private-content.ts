import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

function encryptionKey(): Buffer {
  // Keep this key independent of the login password, so changing that password
  // cannot destroy documents. The Blob credential is already a server secret.
  const secret = process.env.PROJECT_CONTENT_ENCRYPTION_KEY || process.env.BLOB_READ_WRITE_TOKEN
  if (!secret || secret.length < 32) throw new Error('비공개 저장소 암호화 키가 설정되지 않았습니다.')
  return Buffer.from(hkdfSync('sha256', secret, 'portfolio2026', 'private-content-v1', 32))
}

export function encryptPrivateContent(content: Buffer): Buffer {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce)
  const encrypted = Buffer.concat([cipher.update(content), cipher.final()])
  return Buffer.concat([nonce, cipher.getAuthTag(), encrypted])
}

export function decryptPrivateContent(content: Buffer): Buffer {
  if (content.length < 28) throw new Error('Invalid encrypted content')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), content.subarray(0, 12))
  decipher.setAuthTag(content.subarray(12, 28))
  return Buffer.concat([decipher.update(content.subarray(28)), decipher.final()])
}
