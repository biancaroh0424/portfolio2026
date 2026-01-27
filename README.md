# Portfolio 2026 - Youngjoo Roh

포트폴리오 웹사이트 with RAG 챗봇 (Gemini 3 Pro Thinking)

## 기능

- 비밀번호 보호 페이지
- 프로젝트 리스트 및 상세 페이지
- **RAG 기반 AI 챗봇 (Gemini 3 Pro Thinking)**
- **벡터 임베딩 검색 (Gemini Embeddings)**
- 프로젝트 전용 질문 필터링
- 앵커 링크를 통한 스크롤 네비게이션
- 추천 질문 chips
- **CMS 기반 콘텐츠 관리**

## 시작하기

### 설치

```bash
npm install
```

### 환경 변수 설정

`.env.local` 파일을 생성하고 다음을 추가하세요:

```env
# Portfolio Password (CV에 적힌 비밀번호)
NEXT_PUBLIC_PORTFOLIO_PASSWORD=your_password_here

# Gemini API Key (필수)
GEMINI_API_KEY=your_gemini_api_key_here
```

Gemini API 키는 [Google AI Studio](https://makersuite.google.com/app/apikey)에서 발급받을 수 있습니다.

### 벡터 저장소 초기화

CMS 데이터를 벡터 임베딩으로 변환하기 위해 다음 API를 호출하세요:

```bash
curl -X POST http://localhost:3000/api/embed
```

또는 브라우저에서 직접 접속:
- http://localhost:3000/api/embed

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 프로젝트 구조

```
portfolio_2026/
├── app/
│   ├── (protected)/          # 보호된 페이지들
│   │   ├── home/             # 메인 페이지
│   │   └── projects/         # 프로젝트 페이지들
│   ├── api/
│   │   ├── chat/             # RAG 챗봇 API (Gemini 3 Pro Thinking)
│   │   └── embed/            # 벡터 임베딩 생성 API
│   └── page.tsx              # 비밀번호 페이지
├── components/
│   ├── ChatBot.tsx           # 챗봇 컴포넌트
│   ├── Navigation.tsx       # 네비게이션
│   └── ProjectCard.tsx       # 프로젝트 카드
├── lib/
│   ├── data.ts               # CMS 데이터 관리
│   ├── embeddings.ts         # Gemini Embeddings
│   ├── vector-store.ts       # 벡터 저장소 관리
│   └── rag.ts                # RAG 검색 및 AI 응답 생성
└── data/
    ├── projects.json         # 프로젝트 데이터 (CMS)
    └── embeddings.json       # 벡터 임베딩 저장소 (자동 생성)
```

## CMS 데이터 관리

프로젝트 데이터는 `data/projects.json`에서 관리됩니다.

### 데이터 구조

```json
{
  "id": "project-id",
  "title": "Project Title",
  "subtitle": "Project Subtitle",
  "period": "2024.01 ~ 2024.12",
  "sections": [
    {
      "id": "section-id",
      "title": "Section Title",
      "content": "Section content or array of strings",
      "image": "optional image path"
    }
  ]
}
```

### 데이터 업데이트 후

1. `data/projects.json` 파일 수정
2. 벡터 저장소 재생성:
   ```bash
   curl -X POST http://localhost:3000/api/embed
   ```

## AI 모델

- **임베딩**: `text-embedding-004` (Gemini)
- **챗봇**: `gemini-2.0-flash-thinking-exp-01-21` (Gemini 3 Pro Thinking)

## 주요 기능 설명

### RAG (Retrieval-Augmented Generation)

1. 사용자 질문을 벡터 임베딩으로 변환
2. 벡터 저장소에서 유사한 콘텐츠 검색 (코사인 유사도)
3. 검색된 콘텐츠를 컨텍스트로 Gemini 3 Pro Thinking에 전달
4. AI가 컨텍스트를 바탕으로 답변 생성

### 프로젝트 필터링

챗봇은 프로젝트 관련 질문만 답변합니다. 프로젝트와 무관한 질문이나 어뷰징 시도에는 거부 응답을 반환합니다.

## 향후 개선 사항

- [ ] 벡터 데이터베이스 (Pinecone, Weaviate 등) 연동
- [ ] 더 정교한 의미 기반 검색
- [ ] 다국어 지원 (EN/KO)
- [ ] 다크모드 구현
- [ ] 이미지 최적화
- [ ] 실시간 벡터 저장소 업데이트
