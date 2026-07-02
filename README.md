# HYFIN 리크루팅 관리 툴

한양대학교 경제금융 동아리 HYFIN의 리크루팅 자동화 툴.

## 스택

- **프레임워크**: Next.js 15 (App Router)
- **DB**: PostgreSQL (Supabase) + Prisma ORM
- **이메일**: Nodemailer + Gmail SMTP
- **배포**: Vercel

---

## 프로젝트 구조

```
app/
  admin/                    # 어드민 전용 (로그인 필요)
    page.tsx                # 로그인 페이지
    layout.tsx              # 사이드바 네비게이션 (4개 탭)
    dashboard/page.tsx      # 대시보드
    applications/
      page.tsx              # 전체 지원자 시트 (정보/질문 뷰 토글)
      [id]/page.tsx         # 개별 지원자 평가 페이지
    interviews/page.tsx     # 면접 슬롯 관리
    notifications/page.tsx  # 이메일 일괄 발송 (ADMIN 전용)
  api/
    applications/route.ts           # 공개 지원서 제출 (POST)
    interview-time/route.ts         # 면접 희망 시간 제출 (POST)
    admin/
      login/route.ts
      applications/route.ts         # 지원자 목록 조회 (GET)
      applications/[id]/route.ts    # 상태/결과 변경 (PATCH)
      evaluate/route.ts             # 평가 저장 (POST)
      notify/route.ts               # 이메일 일괄 발송 (POST)
      interview-slots/route.ts      # 면접 슬롯 관리 (GET/POST)
      common-questions/route.ts     # 공통질문 관리 (GET/PATCH)
      final-questions/[id]/route.ts # 개인질문 관리 (GET/PATCH)
  apply/page.tsx            # 공개 지원서 작성 페이지
  interview-time/page.tsx   # 공개 면접 희망 시간 선택 페이지
lib/
  auth.ts         # 토큰 검증 (verifyRequest, requireAdminRequest)
  email.ts        # 이메일 발송 (sendEmail)
  prisma.ts       # Prisma 싱글턴
  users.ts        # 사용자 목록 (하드코딩)
components/
  StatusBadge.tsx # stage/docResult/finalResult 배지 컴포넌트
```

---

## DB 스키마

### Enum

```prisma
enum ApplicationStage {
  SUBMITTED       // 접수 완료
  DOC_REVIEWING   // 서류 평가 중
  DOC_COMPLETED   // 서류 결과 확정 (메일 발송 전)
  INTERVIEW_READY // 서류합불 메일 발송 완료
  INTERVIEW_SET   // 면접 시간 안내 완료
  FINISHED        // 최종합불 메일 발송 완료
}
enum DocResult   { PASS, FAIL }
enum FinalResult { PASS, FAIL }
```

### 테이블 (6개)

| 모델 | 역할 |
|------|------|
| Applicant | 지원자 기본정보 + stage + docResult + finalResult |
| Evaluation | 운영진별 서류/면접 평가 (1:N) |
| InterviewSlot | 면접 가능 시간 슬롯 |
| CommonQuestion | 날짜별 공통 면접 질문 (day: 1/2/3) |
| FinalQuestion | 지원자별 최종 개인 질문 (1:1) |
| NotificationLog | 이메일 발송 이력 (1:N) |

### Stage 자동 전환

| 트리거 | 전환 |
|--------|------|
| 첫 서류 평가 입력 (docScore 저장) | SUBMITTED → DOC_REVIEWING |
| docResult 설정 | → DOC_COMPLETED |
| 서류합불 메일 발송 (docResult=PASS) | → INTERVIEW_READY |
| 면접 시간 안내 메일 발송 | → INTERVIEW_SET |
| 최종합불 메일 발송 | → FINISHED |

---

## 인증

- **토큰 생성** (브라우저): `btoa(unescape(encodeURIComponent("이름:비밀번호")))`
- **토큰 디코딩** (서버): `Buffer.from(token, "base64").toString()` → `:` 기준 split
- **API header**: `x-admin-token`
- `verifyRequest()`: ADMIN + STAFF 모두 허용
- `requireAdminRequest()`: ADMIN만 허용

---

## 이메일

- `sendEmail({ to, name, type, passed?, interviewDate? })` — 항상 `await` 사용
- 타입: `RECEIPT` | `DOC_RESULT` | `INTERVIEW` | `FINAL_RESULT`
- Gmail SMTP: `GMAIL_USER`, `GMAIL_APP_PASSWORD` 환경변수

---

## 개발 환경

```bash
npm run dev                        # 로컬 개발 서버 (localhost:3000)
npx prisma studio                  # DB GUI (localhost:5555)
npx prisma db push --force-reset   # DB 전체 초기화
```

환경변수: `.env.local` (gitignore 대상, Vercel 대시보드에서 별도 설정)
