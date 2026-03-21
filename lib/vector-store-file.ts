/**
 * 로컬 개발용 파일 벡터 스토어 (data/embeddings.json).
 * Chroma 서버/클라우드 없이 RAG 미리보기 — 프로덕션·스테이징 DB와 충돌 없음.
 */
import fs from 'fs/promises'
import path from 'path'
import { generateEmbedding } from './embeddings'
import { getAllContent, type Content } from './data'
import {
  loadVectorStore,
  searchVectorStore as searchJsonStore,
  clearVectorStoreMemoryCache,
  type VectorDocument,
} from './vector-store-optimized'

const CHROMA_DOC_MAX_BYTES = 12 * 1024
const DATA_DIR = path.join(process.cwd(), 'data')
const JSON_PATH = path.join(DATA_DIR, 'embeddings.json')

function chunkTextByBytes(text: string, maxBytes: number): string[] {
  const buf = Buffer.from(text, 'utf8')
  if (buf.length <= maxBytes) return [text]
  const chunks: string[] = []
  let start = 0
  while (start < buf.length) {
    let end = Math.min(start + maxBytes, buf.length)
    if (end < buf.length) {
      const slice = buf.subarray(start, end)
      const lastNewline = slice.lastIndexOf(10)
      const lastPeriod = slice.lastIndexOf(46)
      const best = lastNewline >= 0 ? lastNewline : lastPeriod >= 0 ? lastPeriod : slice.length - 1
      end = start + best + 1
    }
    chunks.push(buf.subarray(start, end).toString('utf8'))
    start = end
  }
  return chunks
}

export interface VectorStoreInitResult {
  configured: boolean
  contentsCount?: number
  chunksCount?: number
  error?: string
  /** 응답/로그용: 로컬 파일 스토어 사용 중 */
  storage?: 'file'
}

export function ensureVectorStoreInitialized(): void {
  // 파일 스토어는 요청 시 로드; 백그라운드 Chroma 초기화 없음
}

export async function initializeVectorStore(force?: boolean): Promise<VectorStoreInitResult> {
  try {
    const allContent = await getAllContent()
    if (allContent.length === 0) {
      return {
        configured: true,
        contentsCount: 0,
        chunksCount: 0,
        error: 'No project data (projects.json / Blob empty)',
        storage: 'file',
      }
    }

    const existing = await loadVectorStore()
    // force가 아니고 이미 임베딩 파일이 있으면 재생성 생략(빠른 기동). Admin 저장은 항상 force.
    if (!force && existing.length > 0) {
      return {
        configured: true,
        contentsCount: allContent.length,
        chunksCount: existing.length,
        storage: 'file',
      }
    }

    const docs: VectorDocument[] = []
    const batchSize = 5
    for (let i = 0; i < allContent.length; i += batchSize) {
      const batch = allContent.slice(i, i + batchSize)
      for (const content of batch) {
        try {
          const textToEmbed = `${content.title}\n${Array.isArray(content.content) ? content.content.join(' ') : content.content}`
          const chunks = chunkTextByBytes(textToEmbed, CHROMA_DOC_MAX_BYTES)
          for (let c = 0; c < chunks.length; c++) {
            const chunkId = chunks.length === 1 ? content.id : `${content.id}-c${c}`
            const embedding = await generateEmbedding(chunks[c])
            const chunkContent: Content = {
              ...content,
              id: chunkId,
              content: chunks[c],
            }
            docs.push({ id: chunkId, content: chunkContent, embedding })
          }
        } catch (e) {
          console.error(`[vector-store-file] Error embedding ${content.id}:`, e)
        }
      }
    }

    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(JSON_PATH, JSON.stringify(docs, null, 2), 'utf-8')
    clearVectorStoreMemoryCache()

    return {
      configured: true,
      contentsCount: allContent.length,
      chunksCount: docs.length,
      storage: 'file',
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[vector-store-file] Init error:', error)
    return { configured: true, error: msg, storage: 'file' }
  }
}

type SearchFilter = { projectId?: string; language?: 'en' | 'ko' | 'it' }

export async function searchVectorStore(
  queryEmbedding: number[],
  limit: number = 5,
  filter?: SearchFilter
) {
  return searchJsonStore(queryEmbedding, limit, filter)
}

export async function listVectorStoreDocuments(): Promise<Array<{ id: string; content: { title: string } }>> {
  const docs = await loadVectorStore()
  return docs.map((d) => ({
    id: d.id,
    content: { title: d.content.title || '' },
  }))
}
