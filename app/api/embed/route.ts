import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
// 벡터 초기화는 임베딩 호출이 많아 오래 걸림. Pro: Fluid Compute 기본 300초, 최대 800초. 60초면 프로젝트 기본(15s)에 걸릴 수 있으므로 300으로 설정.
export const maxDuration = 300

// 벡터 저장소 초기화 API (Admin 저장 등 CMS 데이터 변경 시 호출 — 항상 전체 재구성)
export async function POST(_request: NextRequest) {
  try {
    const { initializeVectorStore } = await import('@/lib/vector-store')
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
      const hint =
        /401|403|Permission denied|ChromaError/i.test(result.error)
          ? 'Chroma 401/403: Check CHROMA_API_KEY is valid and has access to CHROMA_TENANT and CHROMA_DATABASE in Chroma Cloud.'
          : undefined
      return NextResponse.json(
        { success: false, error: result.error, hint, ...result },
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
    const err = error instanceof Error ? error : new Error(String(error))
    const errorMessage = err.message
    const stack = error instanceof Error ? error.stack : undefined
    console.error('[embed] POST failed:', errorMessage, stack)
    let hint = 'Check Vercel Function logs for this deployment.'
    if (/CHROMA|chroma|api\.trychroma/i.test(errorMessage)) hint = 'Check CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE in Vercel env.'
    if (/GEMINI|embedding|API key/i.test(errorMessage)) hint = 'Check GEMINI_API_KEY in Vercel env (used for embeddings).'
    if (/BLOB|blob|fetch/i.test(errorMessage)) hint = 'Check BLOB_READ_WRITE_TOKEN and that projects exist in Blob.'
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize vector store',
        details: errorMessage,
        hint,
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

