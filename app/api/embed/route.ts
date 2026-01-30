import { NextRequest, NextResponse } from 'next/server'
import { initializeVectorStore } from '@/lib/vector-store'

export const runtime = 'nodejs'

// 벡터 저장소 초기화 API (Admin 저장 등 CMS 데이터 변경 시 호출 — 항상 전체 재구성)
export async function POST(_request: NextRequest) {
  try {
    const result = await initializeVectorStore(true) // force: Admin 저장 시 Chroma 전부 갱신

    if (!result.configured) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Chroma not configured',
          hint: 'Set CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE in Vercel Environment Variables (or run local Chroma with CHROMA_API_KEY unset)',
          ...result,
        },
        { status: 400 }
      )
    }
    if (result.error && (result.contentsCount === 0 || result.chunksCount === 0)) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          hint: 'Check BLOB_READ_WRITE_TOKEN and that projects exist in Blob (save a project from Admin first).',
          ...result,
        },
        { status: 400 }
      )
    }
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error, ...result },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Vector store initialized successfully',
      contentsCount: result.contentsCount,
      chunksCount: result.chunksCount,
    })
  } catch (error) {
    console.error('Error initializing vector store:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize vector store',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

// 벡터 저장소 상태 확인
export async function GET() {
  try {
    const { listVectorStoreDocuments } = await import('@/lib/vector-store')
    const documents = await listVectorStoreDocuments()

    return NextResponse.json({
      documentCount: documents.length,
      documents: documents.map(doc => ({
        id: doc.id,
        title: doc.content.title
      }))
    })
  } catch (error) {
    console.error('Error loading vector store:', error)
    return NextResponse.json(
      { error: 'Failed to load vector store' },
      { status: 500 }
    )
  }
}

