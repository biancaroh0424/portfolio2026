# AI Assistant (YJ Assistant) 개발 스펙

포트폴리오 사이트용 RAG 기반 채팅 어시스턴트 스펙 요약입니다.

---

## 1. 아키텍처 개요

```
[Client: ChatBot.tsx / ProjectChatInput]
    → POST /api/chat (message, conversationHistory, currentPath, pageLanguage)
    → [Chat API] searchRelevantContent() + generateAIResponseStream()
    → SSE 스트리밍 (thinking → answer)
    → 클라이언트 파싱·렌더링 (ThinkingAccordion, Markdown, 링크 chip)
```

- **역할**: 노영주(Youngjoo Roh) 포트폴리오 검토 보조
- **모델**: Google **Gemini 3 Pro Preview** (`gemini-3-pro-preview`)
- **형식**: `<thinking>...</thinking>` + `<answer>...</answer>` 스트리밍

---

## 2. 백엔드

### 2.1 Chat API (`app/api/chat/route.ts`)

**입력**
- `message`: 사용자 발화 (선택적으로 `[Selected Context: …]`, `[User selected this context: …]` 포함)
- `conversationHistory`: `{ role, content }[]` (최근 2개만 사용)
- `currentPath`: 예) `/portfolio`, `/portfolio/rag-chat-builder`
- `pageLanguage`: `'en' | 'ko' | 'it'`

**처리 흐름**
1. **언어**: `detectLanguage(actualMessage)` → `pageLang` → `detectedLanguage` (답변·검색 언어)
2. **검색 쿼리**: `selectedContext` 있으면 `actualMessage + "User selected this context: ${selectedContext}"` 로 확장
3. **검색 범위**
   - 프로젝트 상세(`/portfolio/:id`): `projectId` 필터, 상위 3개
   - 리스트(`/portfolio`): 프로젝트 필터 없음, 상위 4개
   - 개인정보·이력서 관련 키워드면 프로젝트 필터 미적용(resume 포함)
4. **병렬 처리**: `[currentProject, relevantContent, allProjects] = await Promise.all([...])`
5. **스트리밍**: 즉시 `{ type: 'content', thinking: '...', thinkingDone: false }` 전송 후 `generateAIResponseStream()` 구동

**출력**
- `Content-Type: text/event-stream`
- SSE `data: { type, content?, thinking?, deltaContent?, deltaThinking?, thinkingDone?, sources? }\n\n`

---

### 2.2 RAG 검색 (`lib/rag.ts`)

- **함수**: `searchRelevantContent(query, limit, projectId?, language?)`
- **내부**: `generateEmbedding(query)` → `vector-store.searchVectorStore(embedding, limit, { projectId, language })`
- **언어**: `language` 지정 시 문서별 `content.language` 일치만 반환 (resume 타입은 예외)
- **반환**: `SearchResult[]` (`content: Content`, `score`)

---

### 2.3 벡터 스토어 (`lib/vector-store.ts`)

- **엔진**: ChromaDB (로컬 `.chroma` 또는 `http://localhost:8000`)
- **컬렉션**: `portfolio_content`, cosine 유사도
- **데이터**: `getAllContent()` → 프로젝트/이력서 등 `Content[]` → 임베딩 후 저장
- **검색**: `searchVectorStore(embedding, limit, filter?)` → `projectId` / `language` 메타데이터 필터

---

### 2.4 임베딩 (`lib/embeddings.ts`)

- **모델**: Gemini `text-embedding-004`
- **용도**: `RETRIEVAL_DOCUMENT` 로 쿼리·문서 임베딩 생성
- **환경 변수**: `GEMINI_API_KEY`

---

### 2.5 스트리밍 생성 (`lib/rag-stream.ts`)

- **함수**: `generateAIResponseStream(query, context, conversationHistory, currentProject?, userLanguage?, greeting?, isProjectListPage?)`
- **콘텍스트**: 상위 5개까지, **총 14,000자 상한** (`CONTEXT_MAX_CHARS`), 초과분은 `...[truncated]`
- **시스템 프롬프트 요약**
  - YJ Assistant, 답변은 **반드시 지정 언어**(Korean/English/Italian)로
  - `<thinking>` → `<answer>` 순서
  - [Portfolio Content]만 참고, 친절·전문 톤
  - “누가 만들었나” → 노영주, 바이브 코딩, 포트폴리오 검토 보조 설명
- **Gemini 설정**: `temperature: 0.7`, `maxOutputTokens: 2048`
- **스트림 파싱**
  - `rawContent` 누적 → `<thinking>...</thinking>`, `<answer>...</answer>` 추출
  - thinking 델타/완료 시 `{ type: 'content', thinking, deltaThinking?, thinkingDone }`
  - answer 델타 시 `{ type: 'content', content, deltaContent, thinking?, thinkingDone }`
  - 종료 시 `{ type: 'done', content, thinking?, thinkingDone: true, sources }`
- **sources**: `context.slice(0, 5)` → `{ id, title, type }[]`

---

## 3. 프론트엔드

### 3.1 컨텍스트 (`contexts/ChatBotContext.tsx`)

- **상태**: `isOpen`, `width`, `chatInput`, `selectedTextChip`, `sendMessage`(ref)
- **영속**: `localStorage` — `chatbot-width`, `chatbot-is-open`
- **역할**: 패널 열림/너비, 입력값, 드래그된 텍스트, 전송 함수 공유

---

### 3.2 ChatBot (`components/ChatBot.tsx`)

- **메시지 타입**: `Message { id, role, content?, sources?, thinking?, thinkingDone?, selectedText? }`
- **저장**: `localStorage` — `yj-assistant-messages`; 히스토리 — 쿠키 `yj-assistant-history`
- **로드 시**: 마지막이 assistant이고 `thinkingDone === false`면 “진행 중이던 스트림”으로 간주해  
  `thinkingDone: true` 로 고치고, thinking이 `''` 또는 `'.'`/`'...'` 수준이면 `thinking: ''` 로 비움 (로더·shimmer·"..." 미표시)
- **전송**: `handleSend` — `messagesRef.current`, `pathname`, `language` 등으로 API 호출 후 SSE 읽기
- **thinking UI**: `ThinkingAccordion` — 로더+shimmer(진행 중·steps 없음), 단계별 steps(파싱), “N steps completed” 아코디언(기본 펼침, 접기/펼치기 가능)
- **thinking 스로틀**: 120ms 간격으로만 `setMessages` 호출해 리렌더 줄임
- **본문**: Markdown, `marked` + 링크는 칩 형태로 변환, `sources` 기준으로 `/portfolio/:id` 등 href 매핑
- **참조 프로젝트 캐러셀**: 제거됨(참조 목록/캐러셀 UI 없음)

---

### 3.3 ProjectChatInput (`components/ProjectChatInput.tsx`)

- **역할**: 입력창, 전송/중지, Selected Context 칩(드래그 텍스트), 페이지별 컨텍스트 칩
- **전송**: Context의 `sendMessage` ref 호출 → ChatBot의 `handleSend` 실행

---

## 4. 데이터·언어

- **프로젝트/콘텐츠**: `lib/data.ts` — `data/projects.json`, `getAllContent()` 등
- **Content**: `id`, `type`(project|about|general|resume), `title`, `content`, `projectId?`, `language?`
- **언어**: `lib/language.ts` — `detectLanguage`, `getGreeting` 등; 지원 `en` / `ko` / `it`

---

## 5. 분석·에러

- **분석**: 스트림 종료 후 `POST /api/admin/analytics` — `question`, `answer`, `userId`, `device`, `date` 등 저장 (`data/analytics.json`)
- **에러**: 스트림 중 에러 시 `{ type: 'error', content }`; 429/할당량 초과·API키·404 등은 Chat API에서 메시지 문구 분기

---

## 6. 환경·의존성

- **환경 변수**: `GEMINI_API_KEY` (Gemini API·임베딩 공용)
- **주요 패키지**: `@google/generative-ai`, `chromadb`, `marked`
- **Node**: Chat API `runtime = 'nodejs'`

---

## 7. 스펙 요약표

| 항목 | 내용 |
|------|------|
| LLM | Gemini 3 Pro Preview |
| 임베딩 | text-embedding-004 |
| 벡터 DB | ChromaDB (로컬/원격) |
| 컨텍스트 상한 | 14,000자 (참조 상위 5개) |
| 대화 히스토리 | 최근 2턴 |
| 답변 형식 | `<thinking>` + `<answer>` 스트리밍 |
| 지원 언어 | en / ko / it (질문 감지 + 동일 언어 답변) |
| 메시지 영속 | localStorage + 쿠키(히스토리) |
| 참조 UI | 본문 링크 칩만 사용, 참조 캐러셀 없음 |

이 문서는 현재 구현을 기준으로 작성되었고, 추후 API/모델/UI 변경 시 함께 갱신하면 됩니다.
