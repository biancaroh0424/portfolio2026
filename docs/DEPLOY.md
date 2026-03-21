# 스테이징 → 프로덕션 배포 (Vercel + Git)

## 브랜치 역할

| 브랜치     | 역할 |
|-----------|------|
| `main`    | **프로덕션**. Vercel Production 배포 → 실제 도메인(예: `yourdomain.com`) |
| `staging` | **스테이징**. Vercel **Preview** 배포 → 매 푸시마다 `*.vercel.app` URL로 점검 |
| `feature/*` (선택) | 작은 단위 작업 후 `staging`으로 머지 |

도메인을 추가로 살 필요 없습니다. 스테이징은 Vercel이 주는 Preview URL로 충분합니다. (원하면 나중에 `staging.도메인`만 DNS로 연결 가능)

---

## 일상 워크플로

### 1. 스테이징에 올려서 확인

```bash
git checkout staging
git pull origin staging
# 작업 후
git add .
git commit -m "feat: 설명"
git push origin staging
```

- Vercel 대시보드 → **Deployments**에서 `staging` 브랜치 배포를 열면 **고유 Preview URL**이 있습니다.
- 그 URL로 실제 동작·모바일·Admin 등을 점검합니다.

### 2. 프로덕션 반영

스테이징에서 문제 없으면 `main`으로 합칩니다.

**권장: Pull Request**

1. GitHub에서 `staging` → `main` PR 생성
2. 체크리스트 확인 후 머지

**또는 로컬에서**

```bash
git checkout main
git pull origin main
git merge staging
git push origin main
```

`main`에 푸시되면 Vercel이 **Production**으로 다시 배포합니다.

---

## Vercel에서 한 번만 확인할 것

1. **Git 연결**: 레포가 Vercel 프로젝트에 연결되어 있는지
2. **Production Branch**: `Settings → Git → Production Branch` = `main`
3. **환경 변수**: `Settings → Environment Variables`
   - 민감한 값은 **Production**과 **Preview**를 나눠서 넣기 (스테이징용 키 / 프로덕션용 키)
   - `NEXT_PUBLIC_*`도 필요하면 Preview용 별도 값 설정

---

## 처음 `staging` 브랜치가 없을 때

로컬에서 `main`과 맞춘 뒤:

```bash
git checkout main
git pull origin main
git checkout -b staging
git push -u origin staging
```

이미 이 레포에 `staging`이 원격에 있다면 `git checkout staging && git pull`만 하면 됩니다.

---

## 문제 해결

- **스테이징 URL이 안 보임**: Vercel → 해당 프로젝트 → Deployments → 브랜치 필터 `staging`
- **프로덕션만 배포되고 싶음**: `main`에만 푸시하고, 실험은 `staging` 또는 PR Preview 사용
