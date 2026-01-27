import { GoogleGenerativeAI } from '@google/generative-ai'
import { SearchResult } from './rag'

export async function* generateAIResponseStream(
  query: string,
  context: SearchResult[],
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  currentProject?: { id: string; title: string },
  userLanguage: string = 'en',
  greeting?: string,
  isProjectListPage?: boolean,
  projectsOnPage?: { id: string; title: string }[]
): AsyncGenerator<{
  type: 'content' | 'done' | 'error'
  content?: string
  sources?: any[]
  thinking?: string
  deltaContent?: string
  deltaThinking?: string
  thinkingDone?: boolean
}> {
  const startTime = Date.now()
  
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set')
    
    const genAI = new GoogleGenerativeAI(apiKey)
    
    // ✅ [요청 반영] 모델을 'gemini-3-pro-preview'로 유지! (지능형 모델)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3-pro-preview',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096, // 답 잘림 방지 (이전 2048에서 증가)
      }
    })

    // 컨텍스트: 속도와 검색률 균형 — 12k·상위 4개 (잘림·누락 줄이기)
    const CONTEXT_MAX_CHARS = 12_000
    let contextText = ''
    if (context.length > 0) {
      const topDocs = context.slice(0, 4)
      let built = ''
      for (let idx = 0; idx < topDocs.length && built.length < CONTEXT_MAX_CHARS; idx++) {
        const doc = topDocs[idx]
        const block = `\n### Reference ${idx + 1}: ${doc.content.title}\n${doc.content.content}\n\n`
        if (built.length + block.length <= CONTEXT_MAX_CHARS) {
          built += block
        } else {
          const remain = CONTEXT_MAX_CHARS - built.length - 80
          built += remain > 0
            ? `\n### Reference ${idx + 1}: ${doc.content.title}\n${doc.content.content.slice(0, remain)}...[truncated]\n\n`
            : ''
          break
        }
      }
      contextText = built.trim()
    } else {
      // 검색 0건일 때: 참고 내용이 없다고 명시하고, 프로젝트 이름을 지어서 말하지 말라고 함
      contextText = '(No references were retrieved. Do NOT invent or recommend any project names. Say that they can browse the portfolio list on this page to see available projects, or ask again after a moment.)'
    }

    // 언어 설정 - 간단하고 명확하게
    const langName = userLanguage === 'ko' ? 'Korean' : userLanguage === 'it' ? 'Italian' : 'English'

    // /portfolio 리스트 페이지일 때: 이 페이지에 보이는 프로젝트 이름만 쓸 수 있다고 명시
    const pageProjectsBlock =
      projectsOnPage && projectsOnPage.length > 0
        ? `\n[Current page — Projects on this portfolio list]\nThe user is on /portfolio. This page shows exactly ${projectsOnPage.length} project(s): ${projectsOnPage.map((p) => `"${p.title}"`).join(', ')}.\nYou MUST only recommend or mention these projects by name. Do NOT invent or assume any other project name.\n`
        : ''

    const systemPrompt = `You are YJ Assistant for Youngjoo Roh's Portfolio.

CRITICAL LANGUAGE RULE: You MUST answer ONLY in ${langName}. The user asked in ${langName}. Do NOT switch to any other language, even if you see content in other languages. Always respond in ${langName}.
${pageProjectsBlock}
[Instructions]
1. ALWAYS use <thinking> tag first — keep it very brief (1–2 sentences only). Then use <answer> tag immediately.
2. Use <answer> tag for your full response. Never truncate: give a complete answer.
3. Use ONLY [Portfolio Content] below. If the user asks about a term (e.g. 게이미피케이션, gamification), look in ALL references — it may appear in related sections (해결, Solution, 온보딩, 결과 등). Do not say "not found" unless you have searched every block.
4. CRITICAL — NO HALLUCINATION: Only mention project names, titles, metrics, and facts that EXPLICITLY appear in [Portfolio Content] or in [Current page — Projects on this portfolio list] above. Do NOT invent or assume any other project name or detail.
5. Be professional and friendly - respond naturally to light jokes, but maintain appropriate formality.
6. CRITICAL: Answer language must match the user's question language (${langName}). Never answer in a different language.

[About YJ Assistant]
If asked "Who created you?" or "Who made you?" or similar questions about your creator:
- Answer naturally and warmly, but maintain professionalism.
- Mention that you were created by 노영주 (Youngjoo Roh) using 바이브 코딩 (Vibe Coding).
- Explain the purpose: to help reviewers review the portfolio more easily.
- In Korean: "아, 저는 노영주님이 바이브 코딩으로 만드셨어요. 심사관 분들이 포트폴리오를 좀 더 편하게 검토하실 수 있으면 좋겠다는 생각에서 시작된 거예요."
- In English: "I was created by Youngjoo Roh using Vibe Coding. The idea was to make it easier for reviewers to explore and understand the portfolio."
- In Italian: "Sono stato creato da Youngjoo Roh usando Vibe Coding. L'idea era di rendere più facile per i revisori esplorare e comprendere il portfolio."

[Portfolio Content]
${contextText}`;

    // 히스토리 (최근 2개만)
    const recentHistory = conversationHistory.slice(-2).map(msg => 
      `${msg.role === 'user' ? 'User' : 'Model'}: ${msg.content}`
    ).join('\n');

    const finalPrompt = `${systemPrompt}\n\n${recentHistory ? `${recentHistory}\n` : ''}User (${langName}): ${query}\nModel (${langName}):`;

    const logAI = (msg: string, extra?: Record<string, unknown>) => {
      const t = new Date().toISOString().slice(11, 23)
      if (extra) console.log(`[AI] ${t} ${msg}`, extra)
      else console.log(`[AI] ${t} ${msg}`)
    }
    logAI('RAG 스트림: 프롬프트 구성 완료', { ms: Date.now() - startTime })

    const result = await model.generateContentStream(finalPrompt)
    logAI('RAG 스트림: Gemini 스트림 시작')
    
    // 스트림 파싱 변수들
    let rawContent = ''
    let thinkingContent = ''
    let finalAnswer = ''
    let thinkingDone = false
    let lastThinkingLength = 0
    let lastAnswerLength = 0
    let tokenCount = 0

    for await (const chunk of result.stream) {
      const chunkText = chunk.text()
      if (!chunkText) continue
      tokenCount++
      if (tokenCount === 1) logAI('RAG 스트림: 첫 토큰 수신', { ms: Date.now() - startTime })

      rawContent += chunkText

      // Thinking 처리
      const thinkMatch = rawContent.match(/<thinking>([\s\S]*?)(<\/thinking>|$)/i)
      if (thinkMatch) {
        const currentThink = thinkMatch[1]
        // thinking이 닫혔는지 확인
        const thinkingClosed = rawContent.includes('</thinking>')
        
        // thinking 내용이 증가했거나 처음 나타났을 때 yield
        if (currentThink.length > lastThinkingLength || (currentThink.length > 0 && lastThinkingLength === 0)) {
          const delta = currentThink.slice(lastThinkingLength)
          thinkingContent = currentThink
          lastThinkingLength = currentThink.length
          
          // thinking이 닫혔으면 thinkingDone 플래그 설정
          if (thinkingClosed && !thinkingDone) {
            thinkingDone = true
            yield { 
              type: 'content', 
              thinking: thinkingContent, 
              deltaThinking: delta,
              thinkingDone: true
            }
          } else {
            yield { 
              type: 'content', 
              thinking: thinkingContent, 
              deltaThinking: delta,
              thinkingDone: false
            }
          }
        } else if (thinkingClosed && !thinkingDone && thinkingContent.length > 0) {
          // thinking이 닫혔지만 내용이 증가하지 않은 경우 (이미 완료)
          thinkingDone = true
          yield { 
            type: 'content', 
            thinking: thinkingContent, 
            thinkingDone: true
          }
        }
      } else if (rawContent.includes('</thinking>') && !thinkingDone && thinkingContent.length > 0) {
        // thinking 태그가 없지만 이미 닫혔다는 것을 감지
        thinkingDone = true
        yield { 
          type: 'content', 
          thinking: thinkingContent, 
          thinkingDone: true
        }
      }

      // Answer 처리 (thinking이 완료된 후에만)
      const answerMatch = rawContent.match(/<answer>([\s\S]*?)(<\/answer>|$)/i)
      if (answerMatch) {
        const currentAns = answerMatch[1]
        if (currentAns.length > lastAnswerLength) {
          const delta = currentAns.slice(lastAnswerLength)
          finalAnswer = currentAns
          lastAnswerLength = currentAns.length
          yield { 
            type: 'content', 
            content: finalAnswer, 
            deltaContent: delta,
            thinking: thinkingContent || undefined,
            thinkingDone: thinkingDone
          }
        }
      } else if (!rawContent.includes('<thinking>') && !rawContent.includes('<answer>') && !rawContent.includes('</thinking>')) {
        // 태그 없이 바로 말하는 경우 대비
        if (!thinkingDone) {
          thinkingDone = true
          yield { 
            type: 'content', 
            thinking: thinkingContent || undefined,
            thinkingDone: true
          }
        }
        finalAnswer += chunkText
        yield { 
          type: 'content', 
          content: finalAnswer, 
          deltaContent: chunkText,
          thinking: thinkingContent || undefined,
          thinkingDone: thinkingDone
        }
      }
    }

    logAI('RAG 스트림: 스트림 종료', { tokens: tokenCount, ms: Date.now() - startTime })

    // 최종 파싱 (스트림 완료 후 전체 내용 재확인)
    const finalThinkingMatch = rawContent.match(/<thinking>([\s\S]*?)<\/thinking>/i)
    const finalAnswerMatch = rawContent.match(/<answer>([\s\S]*?)<\/answer>/i)
    
    // 최종 thinking 내용 확정
    if (finalThinkingMatch && finalThinkingMatch[1]) {
      const finalThinking = finalThinkingMatch[1].trim()
      if (finalThinking.length > thinkingContent.length) {
        thinkingContent = finalThinking
        // thinking이 있으면 마지막으로 한 번 더 yield
        if (!thinkingDone) {
          yield {
            type: 'content',
            thinking: thinkingContent,
            thinkingDone: true
          }
        }
      }
      thinkingDone = true
    } else if (rawContent.includes('<thinking>') && !rawContent.includes('</thinking>')) {
      // thinking이 시작되었지만 닫히지 않은 경우
      const openThinkingMatch = rawContent.match(/<thinking>([\s\S]*?)$/i)
      if (openThinkingMatch && openThinkingMatch[1]) {
        const finalThinking = openThinkingMatch[1].trim()
        if (finalThinking.length > thinkingContent.length) {
          thinkingContent = finalThinking
        }
        thinkingDone = true
        yield {
          type: 'content',
          thinking: thinkingContent,
          thinkingDone: true
        }
      }
    }
    
    // 최종 answer 내용 확정
    if (finalAnswerMatch && finalAnswerMatch[1]) {
      finalAnswer = finalAnswerMatch[1].trim()
    } else if (!rawContent.includes('<thinking>') && !rawContent.includes('<answer>')) {
      // 태그가 전혀 없는 경우 전체를 답변으로
      finalAnswer = rawContent.replace(/<\/?thinking>/gi, '').replace(/<\/?answer>/gi, '').trim()
    } else if (rawContent.includes('</thinking>')) {
      // thinking만 있고 answer가 없는 경우, thinking 이후 내용을 답변으로
      const afterThinking = rawContent.split('</thinking>')[1]
      if (afterThinking) {
        finalAnswer = afterThinking.replace(/<\/?answer>/gi, '').trim()
      }
    }

    // 출처 정보 매핑 (참조 수와 동일하게 상위 4개)
    const sources = context.slice(0, 4).map(c => ({
      id: c.content.id,
      title: c.content.title,
      type: c.content.type
    }))

    // 최종 done 메시지 - thinking과 content 모두 포함
    const finalThinking = thinkingContent.trim()
    yield {
      type: 'done',
      content: finalAnswer || rawContent.replace(/<[^>]*>/g, '').trim(), // 태그 제거한 전체 내용
      thinking: finalThinking || undefined, // 빈 문자열이면 undefined
      thinkingDone: true,
      sources: sources
    }
    
    // 디버깅: thinking이 있는지 확인
    if (finalThinking) {
      console.log('[RAG Stream] Final thinking length:', finalThinking.length)
    }

  } catch (error: any) {
    console.error('[Stream Error]', error)
    yield {
      type: 'error',
      content: 'AI가 깊게 생각하다가 길을 잃었어요 🤯 잠시 후 다시 질문해 주세요.'
    }
  }
}
