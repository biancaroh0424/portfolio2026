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
  projectsOnPage?: { id: string; title: string }[],
  fallbackProjectContent?: string,
  pendingOpen?: { projectId: string; anchor?: string },
  currentAnchor?: string,
  currentPageLanguage?: string
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
        const refId = doc.content.projectId || doc.content.id || ''
        const refAnchor = doc.content.anchor ? `, anchor: ${doc.content.anchor}` : ''
        const refHeadingIndex = doc.content.headingIndex != null ? `, headingIndex: ${doc.content.headingIndex}` : ''
        const refHeader = refId ? ` (id: ${refId}${refAnchor}${refHeadingIndex})` : ''
        const block = `\n### Reference ${idx + 1}${refHeader}: ${doc.content.title}\n${doc.content.content}\n\n`
        if (built.length + block.length <= CONTEXT_MAX_CHARS) {
          built += block
          } else {
          const remain = CONTEXT_MAX_CHARS - built.length - 80
          built += remain > 0
            ? `\n### Reference ${idx + 1}${refHeader}: ${doc.content.title}\n${doc.content.content.slice(0, remain)}...[truncated]\n\n`
            : ''
          break
        }
      }
      contextText = built.trim()
      // 상세 페이지일 때: 참조 청크에 답이 없을 수 있으므로 전체 본문을 함께 전달
      if (fallbackProjectContent && fallbackProjectContent.length > 0 && currentProject) {
        const fallbackCap = 10_000
        const fallbackBlock = `\n\n[Full project page content — "${currentProject.title}". Use this if the references above do not contain the answer.]\n\n${fallbackProjectContent.slice(0, fallbackCap)}${fallbackProjectContent.length > fallbackCap ? '...[truncated]' : ''}`
        contextText = contextText + fallbackBlock
      }
    } else {
      // 검색 0건일 때
      if (fallbackProjectContent && fallbackProjectContent.length > 0 && currentProject) {
        // /portfolio/[id] 페이지: RAG 결과 없으면 현재 프로젝트 본문을 [Portfolio Content]로 사용
        contextText = `[Current project page content — "${currentProject.title}" (id: ${currentProject.id}). Use this as the only source. Do NOT say content was not loaded.]\n\n${fallbackProjectContent}`
      } else if (projectsOnPage && projectsOnPage.length > 0) {
        // /portfolio 페이지이고 프로젝트 목록이 있으면: 이 목록을 반드시 언급하라고 명시
        const names = projectsOnPage.map((p) => p.title).join(', ')
        contextText = `(No detailed references were retrieved. However, the user is on /portfolio and this page shows these projects: ${names}.\nYou MUST list or mention these project names in your answer. Say e.g. "This page shows: [list]. Click a project for details or ask me about a specific one." Do NOT say you have no project information — you have the list above. Do NOT invent any other project name.)`
      } else {
        contextText = '(No references were retrieved. Do NOT invent or recommend any project names. Say that they can browse the portfolio list on this page to see available projects, or ask again after a moment.)'
      }
    }

    // 언어 설정 - 간단하고 명확하게
    const langName = userLanguage === 'ko' ? 'Korean' : userLanguage === 'it' ? 'Italian' : 'English'

    // /portfolio 리스트 페이지일 때: 이 페이지에 보이는 프로젝트 이름만 쓸 수 있다고 명시
    const pageProjectsBlock =
      projectsOnPage && projectsOnPage.length > 0
        ? `\n[Current page — Projects on this portfolio list]\nThe user is on /portfolio. This page shows exactly ${projectsOnPage.length} project(s): ${projectsOnPage.map((p) => `"${p.title}"`).join(', ')}.\nYou MUST only recommend or mention these projects by name. When the user asks what is on this page or what projects exist, LIST these names. Do NOT invent or assume any other project name.\n`
        : ''

    // /portfolio/[id] 상세 페이지일 때: 사용자가 지금 보고 있는 프로젝트 명시 (AI가 반드시 인지하도록)
    const currentProjectBlock =
      currentProject && currentProject.title
        ? `\n[Current page — Project detail]\nThe user is NOW VIEWING the project detail page: **"${currentProject.title}"** (id: ${currentProject.id}). They are reading this project's content. You MUST assume their questions refer to THIS project unless they explicitly ask about another. When relevant, acknowledge which project they are viewing (e.g. "In this project [${currentProject.title}]..."). Do NOT say you don't know which project they mean — they are on /portfolio/${currentProject.id}.\n`
        : currentProject && currentProject.id
          ? `\n[Current page — Project detail]\nThe user is on a project detail page: /portfolio/${currentProject.id}. Assume their questions refer to THIS project. Do NOT say you don't know which project they are viewing.\n`
          : ''

    const currentAnchorBlock = currentProject && currentAnchor && currentAnchor.trim()
      ? `\n[Current section — URL hash]\nThe user is currently viewing the section with URL hash: "${currentAnchor}" (from ChapterStatus or in-page link). When they say "그 섹션으로 이동해줘", "거기로 이동해줘", "that section", "take me there", "그곳으로", use this EXACT anchor for [OPEN_LINK: /portfolio/${currentProject.id}#${currentAnchor.trim()}]. Do NOT use a different headingIndex — use the hash as-is so the page scrolls to the same section.\n`
      : ''

    const pageLangName = currentPageLanguage === 'ko' ? 'Korean' : currentPageLanguage === 'it' ? 'Italian' : 'English'
    const langVersionBlock = currentPageLanguage
      ? `\n[Current page language]\nThe page the user is viewing is currently in ${pageLangName} (${currentPageLanguage}). Links can include ?lang= to open in a specific language: ?lang=ko (Korean), ?lang=en (English), ?lang=it (Italian). Omit ?lang= to keep the current page language.\n
[Language version when opening a project]\nWhen the user asks to open or go to a project (or section), YOU decide from context: if the language they are writing in differs from the current page language (e.g. they write in Korean but the page is in English), first ask in the user's language whether to open in their language version or the current page language (e.g. "한국어 버전으로 이동해드릴까요, 아니면 영어 버전으로 유지할까요?"). If they confirm a language (e.g. "한국어로", "영어로", "그래", "네"), then output [OPEN_LINK: /portfolio/PROJECT_ID?lang=ko] or [OPEN_LINK: /portfolio/PROJECT_ID?lang=en] (or with #anchor if a section). If they want to keep current page language or do not specify, output [OPEN_LINK: /portfolio/PROJECT_ID] without ?lang=. All judgment by you — no regex or fixed rules.\n`
      : ''

    const systemPrompt = `You are YJ Assistant for Youngjoo Roh's Portfolio.

CRITICAL — ANSWER LANGUAGE: You MUST write your entire response (including <thinking> and <answer>) ONLY in ${langName}. The user wrote in ${langName}. Never use English if the user asked in Korean; never use Korean if the user asked in English/Italian. Your reply language must match the user's question language exactly.
${currentProjectBlock}
${pageProjectsBlock}
${currentAnchorBlock}
${langVersionBlock}
[Instructions]
1. ALWAYS use <thinking> tag first — keep it very brief (1–2 sentences only). Then use <answer> tag immediately.
2. Use <answer> tag for your full response. Never truncate: give a complete answer.
3. Use ONLY [Portfolio Content] below. If the user asks about a term (e.g. 게이미피케이션, gamification), look in ALL references — it may appear in related sections (해결, Solution, 온보딩, 결과 등). Do not say "not found" unless you have searched every block.
4. CRITICAL — NO HALLUCINATION: Only mention project names, titles, metrics, and facts that EXPLICITLY appear in [Portfolio Content], in [Current page — Project detail], or in [Current page — Projects on this portfolio list] above. Do NOT invent or assume any other project name or detail. When the user is on a project detail page, you MUST assume they are asking about THAT project.
5. Be professional and friendly - respond naturally to light jokes, but maintain appropriate formality.
6. CRITICAL: Your <answer> must be written entirely in ${langName}. If user wrote in Korean, answer ONLY in Korean. If user wrote in English, answer ONLY in English. Do not mix languages in your response.
7. When you recommend ONE specific project (e.g. user says "포트폴리오가 궁금해" or "추천해줘") and you suggest a project by name, END your answer by offering to open it (e.g. "열어드릴까요?", "Shall I open it for you?", "Vuoi che lo apra?" — use the phrase that fits the user's language). Then on a NEW line output exactly: [OFFERED_LINK: /portfolio/PROJECT_ID] using the project ID from the reference (e.g. rag-chat-builder). No other text after this line.
8. When the user asks vaguely where something is (e.g. "요금제 관련 내용 어디였지?", "where was the pricing part?") use [Portfolio Content] to find the section. Answer with the project name and section/heading name, then END by offering to guide. Then on a NEW line output [OFFERED_LINK: /portfolio/PROJECT_ID#heading-N] using the reference's "id" and "headingIndex" (N = headingIndex). If headingIndex is missing, use "anchor" for #ANCHOR. No other text after this line.
9. When YOU proactively offer to guide to a specific section by name (e.g. "Discovery 섹션으로 안내해 드릴까요?"), you MUST output [OFFERED_LINK: /portfolio/PROJECT_ID#heading-N] on a NEW line — use the Reference that contains that section and use its "id" and "headingIndex" (N). Example: Reference 2 (id: rag-chat-builder, headingIndex: 2) → [OFFERED_LINK: /portfolio/rag-chat-builder#heading-2]. If headingIndex is missing, use "anchor". No other text after this line.
10. When the user DIRECTLY asks to go to a section (e.g. "정량지표 파트로 이동해줘", "Solution으로 안내해줘", "Impact 섹션으로 이동해줘", "take me to the metrics section", "이동해줘"), you MUST navigate in the SAME message: (1) Give a brief acknowledgment in ${langName} (e.g. "네, Impact 정량 지표 섹션으로 바로 안내해 드리겠습니다."). (2) On the VERY NEXT line, with NO other text after it, output exactly [OPEN_LINK: /portfolio/PROJECT_ID#heading-N] — find that section in [Portfolio Content] (or [Current page — Project detail]) and use the reference's "id" and "headingIndex" (N = headingIndex). If headingIndex is missing, use "anchor" for #ANCHOR. Use currentProject.id for PROJECT_ID when the user is on a project detail page. Without [OPEN_LINK] the page will NOT move.
CRITICAL for 10 — EXACT subsection: When the user names a specific subsection (e.g. "정량 지표", "정량지표 파트", "Payment UX", "결제 UX"), use the headingIndex of the heading that EXACTLY or most closely matches that subsection title (e.g. "정량 지표 (리뉴얼 전후 8개월 비교)" for "정량지표"), NOT the parent section's heading (e.g. do NOT use the "Impact" h2 headingIndex when the user asked for "정량 지표" — use the "정량 지표" heading's own headingIndex). Otherwise the page will scroll to the wrong position (too far up).
CRITICAL for 7, 8, 9 and 10: Prefer "headingIndex" for section links so they work when section titles change. Use [OFFERED_LINK: /portfolio/ID#heading-N] or [OPEN_LINK: /portfolio/ID#heading-N] where N is the reference's headingIndex. Only use "anchor" (slug) when headingIndex is not in the Reference. Do not invent IDs.
${pendingOpen ? `
[OPEN LINK — Context] In your PREVIOUS message you offered to open or guide to: /portfolio/${pendingOpen.projectId}${pendingOpen.anchor ? `#${pendingOpen.anchor}` : ''}. The user has just replied. From the CONTEXT and MEANING of their reply, decide if they are confirming (e.g. yes, open it / take me there / guide me there; 응, 네, 그래, 그 지점으로 안내해줘, 결제 경험 부분으로 안내해줘, Payment UX로 가줘, sì, guidami, apri, etc.). If their intent is clearly "yes, open/guide me there", then:
1. Decide the target: (a) If the user named a section, look in [Portfolio Content] Reference headers for that section — use that reference's "id" and "headingIndex" (output [OPEN_LINK: /portfolio/ID#heading-N] where N = headingIndex). If headingIndex is missing, use "anchor". (b) If the user did not name a section, use projectId=${pendingOpen.projectId} and anchor=${pendingOpen.anchor ? pendingOpen.anchor : 'none'} (if anchor is none, output link without #anchor).
2. If the user confirmed a language version (e.g. "한국어로", "영어로", "English", "Korean"), add ?lang=ko or ?lang=en or ?lang=it to the link. Otherwise omit ?lang=.
3. Your <answer> must end with a brief acknowledgment (e.g. "RAG Chat Builder 프로젝트의 결제 경험 파트로 안내해드릴게요." / "Taken you there.").
4. On the VERY NEXT line, with NO other text after it, output exactly: [OPEN_LINK: /portfolio/PROJECT_ID] or [OPEN_LINK: /portfolio/PROJECT_ID?lang=ko] or [OPEN_LINK: /portfolio/PROJECT_ID#heading-N] (with ?lang= if they confirmed a language). Without this line the page will NOT move. If their reply is NOT a confirmation, do NOT output [OPEN_LINK] at all.
` : ''}

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

    const finalPrompt = `${systemPrompt}\n\n${recentHistory ? `${recentHistory}\n` : ''}User (answer ONLY in ${langName}): ${query}\nModel (in ${langName} only):`;

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

    // 출처 정보 매핑 (프로젝트 링크/앵커 열기용 projectId, anchor, headingIndex 포함)
    const sources = context.slice(0, 4).map(c => ({
      id: c.content.projectId || c.content.id,
      title: c.content.title,
      type: c.content.type,
      anchor: c.content.anchor,
      headingIndex: c.content.headingIndex,
      projectId: c.content.projectId
    }))

    // 최종 done 메시지 - thinking과 content 모두 포함 (thinking은 항상 전달해 클라이언트가 Step UI 표시)
    const finalThinking = thinkingContent.trim()
    let doneContent = finalAnswer || rawContent.replace(/<[^>]*>/g, '').trim()
    // [OPEN_LINK]가 <answer> 밖에 있거나 파싱에서 빠졌을 수 있음 → raw에서 복구해 클라이언트가 이동할 수 있도록 함
    const openLinkInRaw = rawContent.match(/\[OPEN_LINK:\s*\/portfolio\/[^\]]+\]/)
    if (openLinkInRaw && !doneContent.includes('[OPEN_LINK:')) {
      doneContent = (doneContent.trimEnd() + '\n' + openLinkInRaw[0]).trim()
    }
    yield { 
      type: 'done',
      content: doneContent,
      thinking: finalThinking,
      thinkingDone: true,
      sources: sources
    }
    
    // 디버깅: thinking / 답변 구분 가능하도록 로그
    const finalAnswerLen = (finalAnswer || '').length
    logAI('RAG 스트림: done', {
      thinkingLen: finalThinking.length,
      answerLen: finalAnswerLen,
      hasThinking: finalThinking.length > 0
    })

  } catch (error: any) {
    console.error('[Stream Error]', error)
    yield { 
      type: 'error',
      content: 'AI가 깊게 생각하다가 길을 잃었어요 🤯 잠시 후 다시 질문해 주세요.'
    }
  }
}
