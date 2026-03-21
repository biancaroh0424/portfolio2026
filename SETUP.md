# 설정 가이드

## 1. 환경 변수 설정

**관리하는 파일은 `.env.local` 하나만** 사용하면 됩니다. (`.env.example`은 Git에 있는 참고용 템플릿이며, 비밀 값은 넣지 않습니다.)

`.env.local` 파일을 프로젝트 루트에 생성하세요:

```env
NEXT_PUBLIC_PORTFOLIO_PASSWORD=your_password_here
NEXT_PUBLIC_ADMIN_PASSWORD=admin2026
GEMINI_API_KEY=your_gemini_api_key_here
```

### 비밀번호 설정
- `NEXT_PUBLIC_PORTFOLIO_PASSWORD`: 포트폴리오 접근 비밀번호 (CV에 적힌 비밀번호)
- `NEXT_PUBLIC_ADMIN_PASSWORD`: 관리자 페이지 접근 비밀번호 (기본값: admin2026)

### Gemini API 키 발급 방법

**중요**: API 키를 생성하기 전에 Google Cloud 프로젝트를 먼저 생성해야 합니다.

#### 1단계: Google Cloud 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
   - Google 계정으로 로그인
2. 프로젝트 생성
   - 상단의 프로젝트 선택 메뉴(프로젝트 이름 옆) 클릭
   - "새 프로젝트" 또는 "NEW PROJECT" 클릭
   - 프로젝트 이름 입력 (예: "portfolio-2026")
   - "만들기" 또는 "CREATE" 클릭
   - 프로젝트 생성 완료까지 몇 초 대기

#### 2단계: Google AI Studio에서 프로젝트 Import 및 API 키 생성

1. [Google AI Studio](https://aistudio.google.com/apikey) 접속
   - Google 계정으로 로그인 (1단계와 동일한 계정)
2. "Create API key" 버튼 클릭
3. "Create a new key" 모달에서:
   - "Name your key"에 원하는 이름 입력 (예: "Portfolio2026")
   - **"Import project" 버튼 클릭**
   - Google Cloud Console로 이동하여 방금 생성한 프로젝트를 선택
   - 또는 "Choose an imported project" 드롭다운에서 프로젝트 선택
4. "Create key" 버튼 클릭
5. 생성된 API 키를 복사하여 `.env.local`에 추가

**참고**: 
- "No Cloud Projects Available" 메시지가 보이면 1단계에서 프로젝트를 먼저 생성해야 합니다
- "Import project" 버튼을 클릭하면 Google Cloud Console로 이동하여 프로젝트를 선택할 수 있습니다

**중요**: 
- `.env.local` 파일은 프로젝트 루트에 직접 생성해야 하며, Git에 커밋되지 않습니다 (`.gitignore`에 포함됨)
- API 키는 보안상 중요하므로 절대 공개 저장소에 올리지 마세요

## 2. 벡터 저장소 초기화

CMS 데이터를 벡터 임베딩으로 변환해야 합니다.

### 방법 1: API 호출

```bash
curl -X POST http://localhost:3000/api/embed
```

### 방법 2: 브라우저에서 접속

개발 서버 실행 후:
- http://localhost:3000/api/embed

### 방법 3: 자동 초기화 (선택사항)

프로젝트 시작 시 자동으로 초기화하려면 `app/api/embed/route.ts`를 수정하세요.

## 3. CMS 데이터 관리

### 프로젝트 추가/수정

`data/projects.json` 파일을 편집하세요:

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
      "content": "Section content",
      "image": null
    }
  ]
}
```

### 데이터 업데이트 후

프로젝트 데이터를 수정한 후에는 반드시 벡터 저장소를 재생성하세요:

```bash
curl -X POST http://localhost:3000/api/embed
```

## 4. Gemini 모델 설정

### 사용 가능한 모델

- `gemini-2.0-flash-thinking-exp-01-21` - Thinking 모델 (실험적)
- `gemini-1.5-pro` - 최신 Pro 모델
- `gemini-1.5-flash` - 빠른 응답 모델
- `gemini-pro` - 기본 Pro 모델

모델을 변경하려면 `lib/rag.ts`의 `modelName` 변수를 수정하세요.

## 5. 문제 해결

### 벡터 저장소가 비어있음

벡터 저장소를 초기화하세요:
```bash
curl -X POST http://localhost:3000/api/embed
```

### API 키 오류

`.env.local` 파일에 올바른 `GEMINI_API_KEY`가 설정되어 있는지 확인하세요.

### 임베딩 생성 실패

- API 키가 유효한지 확인
- API 할당량 확인
- 네트워크 연결 확인

