# 설정 가이드

## 1. 환경 변수 설정

**관리하는 파일은 `.env.local` 하나만** 사용하면 됩니다. (`.env.example`은 Git에 있는 참고용 템플릿이며, 비밀 값은 넣지 않습니다.)

`.env.local` 파일을 프로젝트 루트에 생성하세요:

```env
NEXT_PUBLIC_PORTFOLIO_PASSWORD=your_password_here
ADMIN_PASSWORD=use_a_long_unique_password
GEMINI_API_KEY=your_gemini_api_key_here
```

### 비밀번호 설정
- `NEXT_PUBLIC_PORTFOLIO_PASSWORD`: 포트폴리오 접근 비밀번호 (CV에 적힌 비밀번호)
- `ADMIN_PASSWORD`: 선택 사항인 관리자 비밀번호 재정의 값. 미설정 시 기존 기본값 `admin2026`으로 로그인할 수 있습니다.
- 이전 `NEXT_PUBLIC_ADMIN_PASSWORD`는 관리자 인증에 사용하지 않습니다. 비밀번호 비교와 세션 검증은 서버에서 처리합니다.
- `/admin`, `/admin/edit/`, `/admin/edit/[id]`, `/admin/new`, `/admin/analytics`는 로그인 후 접근할 수 있습니다. 로그인은 HttpOnly 쿠키로 8시간 유지됩니다. 로그아웃 시 쿠키를 삭제하며 비밀번호 변경 후에는 기존 세션도 무효가 됩니다.
- 기본 비밀번호 `admin2026`을 사용할 때는 Vercel에 별도 설정이 필요하지 않습니다. 다른 비밀번호를 사용할 경우에만 **Settings → Environment Variables**의 `ADMIN_PASSWORD`를 Production / Preview 각각 설정하고 재배포하세요. `.env.local`은 로컬 개발에만 적용됩니다.
- 프로젝트 저장·삭제, 이력서 수정·삭제, 업로드, 분석 조회, 임베딩 API는 서버에서 관리자 인증을 검사합니다. 공개 포트폴리오에서 사용하는 프로젝트·이력서 GET 및 분석 수집 POST는 계속 공개입니다.
- 로그인 실패는 서버 인스턴스별로 IP당 15분 동안 10회까지 허용합니다. 배포 인스턴스 전체에 걸친 제한이 필요하면 Vercel Firewall에서 `/api/admin/auth` 제한을 추가하세요.

### CMS 문서 공개 범위

- `/admin/new`에서 새 문서는 **관리자만 보기**가 기본값입니다. **전체 공개**로 바꾸고 저장하면 방문자에게 공개됩니다. 기존 문서의 공개 상태는 유지됩니다.
- 관리자 로그인 후 문서 목록의 **미리보기**로 비공개 문서를 볼 수 있습니다. 외부 방문자의 목록·문서 API·직접 주소에는 비공개 문서가 표시되지 않습니다.
- **포트폴리오 목록(`/portfolio`)에는 관리자 로그인 중에도 비공개 문서가 나오지 않습니다.** 비공개 문서 목록은 관리자 CMS에서만 조회하며, 개별 문서 미리보기는 관리자 로그인 후 열 수 있습니다.
- 비공개 문서는 챗봇 입력·인덱싱에서 제외합니다. 이전 검색 인덱스가 남아 있어도 현재 공개 상태를 다시 확인합니다.
- 새로 올리는 프로젝트 첨부파일은 보호된 API를 통해 전달합니다. 공개 문서에서 참조하는 파일만 방문자가 볼 수 있고, 비공개 문서·저장 전 파일은 관리자만 볼 수 있습니다. 기존 외부 이미지·영상·임베드 URL은 원래 호스팅 서비스의 공개 범위를 따릅니다. 이미 공개했던 콘텐츠를 비공개로 바꿔도 이전에 다운로드한 사본까지 회수하지는 못합니다.
- Vercel Blob에 저장하는 비공개 문서와 보호 첨부파일은 AES-256-GCM으로 암호화합니다. 키는 서버의 `PROJECT_CONTENT_ENCRYPTION_KEY`(32자 이상), 미설정 시 `BLOB_READ_WRITE_TOKEN`에서 유도합니다. **관리자 비밀번호와는 별개**이므로 비밀번호 변경으로 문서가 사라지지 않습니다.
- **암호화 키를 분실·교체하면 기존 비공개 데이터는 읽을 수 없습니다.** Blob 토큰을 교체할 때 별도 키가 없었다면, 기존 토큰 값을 `PROJECT_CONTENT_ENCRYPTION_KEY`에 유지한 뒤 토큰을 교체하세요. 공개 저장소나 브라우저용 환경 변수에는 키를 넣지 마세요.

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
# 관리자 화면에서 로그인 후 '벡터 저장소 초기화' 버튼을 사용하세요.
```

### 방법 2: 브라우저에서 접속

개발 서버 실행 후 관리자 로그인 상태에서 http://localhost:3000/api/embed 에 접속하면 상태를 확인할 수 있습니다. 초기화는 관리자 화면의 버튼을 사용하세요.

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
# 관리자 화면에서 로그인 후 '벡터 저장소 초기화' 버튼을 사용하세요.
```

## 4. Gemini 모델 설정

### 사용 가능한 모델

- `gemini-2.0-flash-thinking-exp-01-21` - Thinking 모델 (실험적)
- `gemini-1.5-pro` - 최신 Pro 모델
- `gemini-1.5-flash` - 빠른 응답 모델
- `gemini-pro` - 기본 Pro 모델

모델을 변경하려면 `lib/rag.ts`의 `modelName` 변수를 수정하세요.

## 5. 문제 해결

### 개발 서버에서 스타일이 깨지거나 Tailwind가 일부만 적용될 때

Next.js는 HMR·캐시 때문에 가끔 CSS 번들이 꼬일 수 있습니다. 아래 순서로 시도해 보세요.

1. **캐시 삭제 후 재시작** (가장 효과적)
   ```bash
   npm run dev:clean
   ```
   (`rm -rf .next` 후 `next dev` — `package.json`에 이미 정의됨)

2. **브라우저 강력 새로고침** (캐시 비우기) 또는 시크릿 창에서 `http://localhost:3000` 접속

3. **지금 열린 폴더가 맞는지 확인** — Cursor 워크트리(`worktrees/.../tcr`)와 `Documents/portfolio_2026` 등 **다른 클론**에서 각각 `npm run dev`를 켜 두면, 수정한 파일과 보는 서버가 달라 “스타일이 이상하다”처럼 느껴질 수 있습니다.

4. **`app/globals.css`만 고친 뒤** 스타일이 안 바뀌면 한 번 전체 새로고침(F5) — 글로벌 CSS는 HMR이 완벽하지 않을 때가 있습니다.

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

