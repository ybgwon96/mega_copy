# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

MEGA COPY — 한국어 프리미엄 패션 이커머스 PWA. Next.js 14 App Router + Supabase + Cloudflare Pages 정적 배포.

## 주요 명령어

```bash
npm run dev          # 개발 서버 (localhost:3004)
npm run build        # 프로덕션 빌드 (정적 export)
npm run lint         # ESLint
npx playwright test  # E2E 테스트 (tests/e2e/)
node test-runner.cjs # 업로드/압축 회귀 테스트
```

백업: `npm run backup:download`, `npm run backup:upload`, `npm run backup:status`

## 아키텍처

### 라우팅 & 페이지
- `/` — 메인 상품 목록 (ProductGridOptimized, CategorySection, SearchBar)
- `/admin` — 관리자 대시보드 (상품·관리자·백업 탭)
- `/product` — 상품 상세
- `/privacy`, `/terms` — 법적 고지

### 핵심 레이어

```
app/components/   UI 컴포넌트 (19개, 'use client')
app/lib/          App Router 전용 API 클라이언트
lib/              공통 유틸리티 (@/ alias로 import)
  ├── supabase.ts          Singleton Supabase 클라이언트 + DB 타입 정의
  ├── supabase-rpc-api.ts  RPC 함수 래퍼
  ├── auth.ts              SHA-256 세션 인증 (4시간 만료)
  ├── korean-search.ts     초성 검색 지원 한국어 검색 API
  ├── image-utils.ts       이미지 압축 유틸리티
  ├── upload-queue.ts      병렬 업로드 큐 (동시 3개, 재시도 로직)
  └── stores/useInventoryStore.ts  Zustand 재고 상태 + Supabase 실시간 구독
```

### 데이터 모델 (Supabase)
4개 테이블: `products`, `product_images` (display_order로 정렬), `notices`, `admins`
타입 정의는 `lib/supabase.ts`의 `Database` 타입 참조.

### 이미지 처리 파이프라인
WebWorker 기반 적응형 압축 → upload-queue를 통한 병렬 업로드 (3개 동시) → Supabase Storage 저장. 상품당 최대 20장.

## 배포

- **타겟**: Cloudflare Pages (정적 export)
- `next.config.js`에 `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true` 설정
- 빌드 시 `eslint.ignoreDuringBuilds`와 `typescript.ignoreBuildErrors` 활성화

## 기술 스택

Next.js 14.2 · TypeScript 5 (strict) · TailwindCSS 3.4 · Zustand 5 · Supabase · Framer Motion 12 · Sharp · Playwright

## 코딩 컨벤션

- 컴포넌트/훅: `PascalCase`, 헬퍼/스토어: `camelCase`, 라우트 폴더: `kebab-case`
- `@/` alias 사용 (깊은 상대경로 금지)
- 2스페이스 들여쓰기, Tailwind 클래스는 layout → spacing → state 순서
- Strict TypeScript: 명시적 반환 타입, 강타입 Zustand 스토어

## 커밋 규칙

Conventional Commits (`feat:`, `fix:`, `docs:`) · 제목은 명령형 · 72자 이내. 모든 이슈, PR, 코드 리뷰는 한국어로 작성.

## 테스트

- Playwright E2E: `tests/e2e/` 디렉토리, dev 서버 자동 기동
- 회귀 테스트: `node test-runner.cjs` (dev 서버 먼저 기동 필요)
- 테스트 픽스처: `test-images/`

## 커스텀 색상 (Tailwind)

`mega-yellow` (#FFD700), `mega-black`, `mega-red` — `tailwind.config.js`에 정의
