# 서버 콘솔 로그 확인 가이드

챗봇이 정보를 찾지 못할 때 서버 콘솔에서 확인해야 할 로그들:

## 1. 검색 단계 로그

### 벡터 검색 시작
```
[Vector Store] Checking if vector store is empty...
[Vector Store] Filtered to X documents for project: rag-chat-builder (resume included)
```

### 검색 결과
```
[Vector Search Result 1] ID: project-rag-chat-builder, Title: "RAG Chat Builder Re-design", Score: 0.XXX, Content length: 2530, Content preview: "..."
[Vector Search Result 2] ID: heading-rag-chat-builder-problem, Title: "...", Score: 0.XXX, ...
```

**확인사항:**
- `Score`가 0.25 이상인지 확인 (임계값 미만이면 필터링됨)
- `Content length`가 0이 아닌지 확인
- `project-rag-chat-builder` 문서가 포함되어 있는지 확인

### 검색 요약
```
[Search Summary] Found X results
Found relevant content: X items (filter by project: true/false)
```

## 2. 컨텍스트 구성 로그

### 컨텍스트 처리
```
[Context] Processing X search results
[Context 1] Title: "RAG Chat Builder Re-design", ProjectId: rag-chat-builder, Content length: 2530, Score: 0.XXX
[Context 2] Title: "...", ProjectId: rag-chat-builder, Content length: XXX, Score: 0.XXX
```

### 컨텍스트 아이템
```
[Context Item 1] Title: "RAG Chat Builder Re-design", Content length: 2530, Preview: "..."
```

### 컨텍스트 요약 및 Fields 확인
```
[Context Summary] Total items: X, Context text length: XXXX
[Context Preview] First 500 chars: ...
[Context Check] Has Role info: true/false, Has Team info: true/false, Has Key Result info: true/false
```

**중요:** 
- `Has Role info: false` 또는 `Has Team info: false`가 나오면 문제!
- 이 경우 `[Found Role]`, `[Found Team]`, `[Found Key Result]` 로그를 확인

### Fields 정보 발견 로그
```
[Found Role] Role: : Sole Product Designer Scope: : ...
[Found Team] Team: : Designer 1, FE 2, BE 1, CEO Key Result: : ...
[Found Key Result] Key Result: : - 검색 노출 구조 개선 ...
```

## 3. 프롬프트 생성 로그

```
Generating content with model: gemini-3-pro-preview
Prompt length: XXXX
Prompt preview: ...
```

## 4. 문제 진단 체크리스트

### 문제 1: 검색 결과가 없음
- 로그: `Found relevant content: 0 items`
- 원인: 검색 쿼리가 너무 구체적이거나, 유사도 임계값이 너무 높음
- 해결: 검색 쿼리를 더 일반적으로 변경하거나, 임계값을 낮춤

### 문제 2: 검색 결과는 있지만 컨텍스트에 fields 정보가 없음
- 로그: `[Context Check] Has Role info: false`
- 원인: 검색된 문서에 fields 정보가 없거나, 필터링됨
- 해결: `project-rag-chat-builder` 문서가 검색 결과에 포함되는지 확인

### 문제 3: 컨텍스트에 fields 정보가 있지만 AI가 못 찾음
- 로그: `[Context Check] Has Role info: true` 하지만 AI가 "정보 없음"이라고 답함
- 원인: 프롬프트가 충분히 명확하지 않거나, AI가 컨텍스트를 제대로 읽지 못함
- 해결: 프롬프트를 더 명확하게 수정 (이미 개선됨)

## 5. 실제 테스트 방법

1. 챗봇에 질문 입력: "RAG Chat Builder 프로젝트의 역할은?"
2. 서버 콘솔에서 다음 로그들을 확인:
   - `[Vector Search Result X]` - 검색 결과 확인
   - `[Context Check]` - fields 정보 포함 여부 확인
   - `[Found Role]`, `[Found Team]` 등 - 실제 정보 위치 확인

## 6. 예상되는 정상 로그 예시

```
[Vector Store] Filtered to 7 documents for project: rag-chat-builder (resume included)
[Vector Search Result 1] ID: project-rag-chat-builder, Title: "RAG Chat Builder Re-design", Score: 0.850, Content length: 2530
[Search Summary] Found 7 results
Found relevant content: 7 items (filter by project: true)
[Context] Processing 7 search results
[Context Check] Has Role info: true, Has Team info: true, Has Key Result info: true
```

이 로그들이 모두 나오면 정상입니다!

