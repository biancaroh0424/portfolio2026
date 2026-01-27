import { NextRequest, NextResponse } from 'next/server'
import { initializeVectorStore } from '@/lib/vector-store'

export const runtime = 'nodejs'

// 벡터 저장소 초기화 API (Admin 저장 등 CMS 데이터 변경 시 호출 — 항상 전체 재구성)
export async function POST(request: NextRequest) {
  try {
    await initializeVectorStore(true) // force: Admin 저장 시 Chroma 전부 갱신
    
    return NextResponse.json({
      success: true,
      message: 'Vector store initialized successfully'
    })
  } catch (error) {
    console.error('Error initializing vector store:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', { message: errorMessage, stack: errorStack })
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to initialize vector store',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}

// 벡터 저장소 상태 확인
export async function GET() {
  try {
    const { loadVectorStore } = await import('@/lib/vector-store')
    const documents = await loadVectorStore()
    
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

