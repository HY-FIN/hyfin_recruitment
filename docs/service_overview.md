# HYFIN 리크루팅 툴 서비스 개요

이 문서는 프로젝트를 처음 보는 사람(예: 다음 기수 운영진)이 서비스 전체를 이해할 수 있도록 작성한 단일 문서다.
스택·폴더 구조 요약은 루트 [README.md](../README.md)에 있고, 여기서는 실제 코드 기준으로 동작을 깊게 설명한다.
초기 기획 문서([spec/](spec/))는 구현과 다를 수 있으므로, 이 문서와 코드가 우선이다.

---

## 1. 서비스 개요

한양대학교 경제금융 동아리 HYFIN의 **리크루팅 전 과정을 자동화하는 웹 서비스**다.
지원서 접수부터 서류 평가, 합불 메일 발송, 면접 시간 조율, 면접 평가, 최종 결과 통보까지를 하나의 툴에서 처리한다.

- **지원자**: 웹에서 지원서를 제출하고, 서류 합격 시 면접 희망 시간을 선택한다.
- **운영진/관리자**: 어드민 페이지에서 지원자를 평가하고 면접을 배치하며, 관리자는 합불 확정과 메일 발송을 담당한다.

수작업으로 하던 지원서 취합(구글폼), 평가 시트(스프레드시트), 합불 메일(개별 발송)을 한 곳으로 통합한 것이 핵심이다.

---

## 2. 사용자와 권한

### 사용자 유형 (3종)

| 사용자 | 로그인 | 할 수 있는 일 |
|---|---|---|
| 지원자 | 불필요 | 지원서 제출, 면접 희망 시간 선택 (이름+전화번호로 본인 확인) |
| 운영진 (STAFF) | 필요 | 지원자 조회, 서류/면접 평가 입력, 개인질문 제안. **본인 평가만 열람 가능** |
| 관리자 (ADMIN) | 필요 | 운영진 권한 전체 + 합불 확정, 면접 슬롯 배정, 공통질문/최종 개인질문 확정, 메일 발송, 전체 운영진 평가 열람 |

계정은 DB가 아닌 `lib/users.ts`에 **하드코딩**되어 있다 (관리자 7명 + 운영진 8명, 이름 + 8자리 숫자 비밀번호). 명단은 [spec/recruiting_members.md](spec/recruiting_members.md) 참고. 기수가 바뀌면 이 파일을 직접 수정해야 한다.

### 인증 방식 (실제 동작)

세션이나 JWT 없이 **매 요청마다 자격 증명을 재검증**하는 단순한 구조다.

1. `/admin` 로그인 페이지에서 이름/비밀번호 입력 → `POST /api/admin/login`이 `findUser()`로 검증.
2. 성공 시 브라우저가 직접 토큰을 생성해 sessionStorage에 저장:
   - `hyfin_user`: `{ id, role, title }` JSON
   - `hyfin_token`: `btoa(unescape(encodeURIComponent("이름:비밀번호")))` — 이름:비밀번호의 base64 인코딩
3. 이후 모든 어드민 API 호출에 `x-admin-token` 헤더로 토큰을 첨부.
4. 서버(`lib/auth.ts`)는 `Buffer.from(token, "base64").toString()`으로 디코딩 후 `USERS` 배열과 대조:
   - `verifyRequest(req)`: ADMIN + STAFF 모두 허용
   - `requireAdminRequest(req)`: ADMIN만 허용

sessionStorage 기반이므로 **탭/브라우저를 닫으면 로그아웃**된다. `app/admin/layout.tsx`가 `hyfin_user` 부재 시 `/admin`으로 리다이렉트한다 (클라이언트 사이드 가드이며, 실질적인 접근 통제는 API 레벨의 토큰 검증이 담당).

---

## 3. 리크루팅 전체 플로우

지원자의 상태는 `Applicant.stage` (ApplicationStage enum) 하나로 추적된다.

```
SUBMITTED → DOC_REVIEWING → DOC_COMPLETED ─┬─(합격 메일)→ INTERVIEW_READY → INTERVIEW_SET → FINISHED
                                           └─(불합격 메일)→ DOC_REJECTED
```

### 단계별 상세

| # | 단계 | 행위자 | 관여 페이지 / API | stage 변화 |
|---|---|---|---|---|
| 1 | 지원서 제출 | 지원자 | `app/apply/page.tsx` → `POST /api/applications` | `SUBMITTED`로 생성 + 접수 확인 메일(RECEIPT) 자동 발송 |
| 2 | 서류 평가 | 운영진 전원 | `app/admin/applications/[id]/page.tsx` → `POST /api/admin/evaluate` | 첫 docScore 저장 시 `SUBMITTED → DOC_REVIEWING` 자동 전환 |
| 3 | 서류 합불 확정 | 관리자 | `app/admin/applications/page.tsx`의 셀렉트 → `PATCH /api/admin/applications/[id]` (`{ docResult, stage: "DOC_COMPLETED" }`) | `→ DOC_COMPLETED` |
| 4 | 서류 결과 메일 | 관리자 | `app/admin/notifications/page.tsx` → `POST /api/admin/notify` (type=DOC_RESULT, 대상: DOC_COMPLETED) | 합격 `→ INTERVIEW_READY`, 불합격 `→ DOC_REJECTED` |
| 5 | 면접 희망 시간 선택 | 지원자 | 합격 메일의 링크 → `app/interview-time/page.tsx` → `POST /api/interview-time` | stage 변화 없음. `interviewPreferences`에 슬롯 ID 배열 저장 |
| 6 | 면접 슬롯 배정 | 관리자 | `app/admin/interviews/page.tsx` 배정 모달 → `PATCH /api/admin/interview-slots/[id]` | stage 변화 없음. `interviewSlotId` 설정 |
| 7 | 면접 일정 메일 | 관리자 | 메일 발송 탭 → `POST /api/admin/notify` (type=INTERVIEW, 대상: INTERVIEW_READY) | `→ INTERVIEW_SET` |
| 8 | 면접 평가 | 운영진 전원 | 면접 관리 탭 슬롯 상세 → `POST /api/admin/evaluate` (interviewScore/Comment) | stage 변화 없음 |
| 9 | 최종 합불 확정 | 관리자 | 지원자 시트의 최종합불 셀렉트 → `PATCH /api/admin/applications/[id]` (`{ finalResult }`) | stage 변화 없음 |
| 10 | 최종 결과 메일 | 관리자 | 메일 발송 탭 → `POST /api/admin/notify` (type=FINAL_RESULT, 대상: INTERVIEW_SET + finalResult 확정) | `→ FINISHED` |

stage 전환은 **평가 저장(2)과 메일 발송(4/7/10) 시 서버에서 자동**으로 일어나고, 합불 확정(3/9)은 관리자가 UI에서 직접 트리거한다.

---

## 4. 페이지별 기능 설명

### 공개 페이지 (로그인 불필요)

| 경로 | 파일 | 기능 |
|---|---|---|
| `/` | `app/page.tsx` | `/apply`로 리다이렉트만 수행 |
| `/apply` | `app/apply/page.tsx` | 지원서 작성 폼. 인적사항/학적사항/경력사항(동적 추가)/자기소개서 4문항. 필수 항목 클라이언트 검증 후 제출 |
| `/apply/success` | `app/apply/success/page.tsx` | 제출 완료 안내 (정적 페이지) |
| `/interview-time` | `app/interview-time/page.tsx` | 3단계 진행: ① 이름+전화번호 본인 확인(verifyOnly 요청) → ② 날짜별 슬롯 그리드에서 희망 시간 복수 선택(마감 슬롯은 비활성) → ③ 완료. 이미 제출했으면 바로 완료 화면 |

### 어드민 페이지 (`/admin` 하위)

`app/admin/layout.tsx`가 사이드바(4개 탭)와 로그인 가드를 제공한다. 메일 발송 탭은 ADMIN에게만 노출된다.

| 경로 | 파일 | 기능 |
|---|---|---|
| `/admin` | `app/admin/page.tsx` | 로그인 폼. 성공 시 sessionStorage에 토큰 저장 후 대시보드로 이동 |
| `/admin/dashboard` | `app/admin/dashboard/page.tsx` | 현황 카드(전체/평가중/서류합불/면접/최종합격), 전형 퍼널, 학과·학년별 분포, 평균 GPA, 합격률, 탭 바로가기 |
| `/admin/applications` | `app/admin/applications/page.tsx` | 전체 지원자 시트. 두 가지 뷰 토글: **정보 시트**(검색/단계 필터/정렬, 서류·면접 평균 점수, ADMIN은 서류합불·최종합불 셀렉트로 직접 확정), **질문 시트**(면접 슬롯, 날짜별 공통질문, 최종 개인질문, 내 개인질문 제안) |
| `/admin/applications/[id]` | `app/admin/applications/[id]/page.tsx` | 개별 평가 페이지. 좌측 지원자 목록 패널 + 우측 상세(기본 정보/자기소개서/평가 탭). 서류 점수(1~5)·코멘트·개인질문 제안 입력. ADMIN은 전체 운영진 평가와 평균을 보고 최종 개인질문을 확정 |
| `/admin/interviews` | `app/admin/interviews/page.tsx` | 면접 캘린더(날짜×시간 슬롯 그리드). 슬롯 클릭 시 상세 패널에서 배정자별 면접 평가 입력, Day별 공통질문·최종 개인질문 표시. ADMIN 전용: 공통질문/면접장소 수정 모달, 슬롯 배정 모달(희망 시간 제출자는 "희망" 표시, 정원 초과 시 배정 불가) |
| `/admin/notifications` | `app/admin/notifications/page.tsx` | **ADMIN 전용** 메일 일괄 발송. 3개 섹션(서류 결과/면접 일정/최종 결과)별로 대상자 체크박스 선택 → 확인 후 발송, 성공/실패 카운트 배너 표시. 예시 메일 미리보기(iframe) 제공. 면접 일정 메일은 3개 Day 모두 장소가 등록돼야 발송 버튼 활성화 |

---

## 5. API 레퍼런스

인증 표기 — **없음**: 공개, **STAFF+**: `verifyRequest` (ADMIN·STAFF 모두), **ADMIN**: `requireAdminRequest`. 인증이 필요한 API는 `x-admin-token` 헤더 필수.

### 공개 API

| 메서드/경로 | 인증 | 용도 | 주요 파라미터 |
|---|---|---|---|
| `POST /api/applications` | 없음 | 지원서 제출. 생성 후 접수 확인 메일 발송 + NotificationLog 기록 | body: 인적/학적사항, `careers`(배열), `essay1~4`. 필수 필드 누락 시 400 |
| `GET /api/interview-time` | 없음 | 면접 슬롯 목록 + 슬롯별 현재 배정 인원(`currentCount`) 조회 | - |
| `POST /api/interview-time` | 없음 | 본인 확인 또는 희망 시간 제출. stage가 INTERVIEW_READY/INTERVIEW_SET가 아니면 403 | body: `name`, `phone`, `slotIds[]`, `verifyOnly`(true면 확인만, `alreadySubmitted` 반환) |
| `POST /api/admin/login` | 없음 | 자격 증명 검증. 성공 시 `{ id, role, title }` 반환 (토큰은 클라이언트가 생성) | body: `id`, `password` |

### 어드민 API (`/api/admin` 하위)

| 메서드/경로 | 인증 | 용도 | 주요 파라미터 |
|---|---|---|---|
| `GET /api/admin/applications` | STAFF+ | 지원자 목록 (평가, 최근 알림 5건 포함) | query: `stage`(단계 필터), `search`(이름/이메일/학과) |
| `GET /api/admin/applications/[id]` | STAFF+ | 지원자 상세 (평가, 알림 이력 전체 포함) | - |
| `PATCH /api/admin/applications/[id]` | ADMIN | stage/docResult/finalResult 변경 | body: `stage`, `docResult`, `finalResult` (유효값만 반영, 셋 다 없으면 400) |
| `POST /api/admin/evaluate` | STAFF+ | 서류/면접 평가 upsert (지원자×운영진 1건). 첫 docScore 저장 시 SUBMITTED→DOC_REVIEWING | body: `applicantId`(필수), `docScore`, `docComment`, `personalQuestion`, `interviewScore`, `interviewComment` |
| `POST /api/admin/notify` | ADMIN | 메일 일괄 발송 + NotificationLog 기록 + stage 자동 전환 (7절 참고) | body: `applicantIds[]`, `type`(RECEIPT/DOC_RESULT/INTERVIEW/FINAL_RESULT), `interviewDate`(슬롯 미배정자 대체용) |
| `GET /api/admin/interview-slots` | STAFF+ | 슬롯 목록 + 배정된 지원자 조회 | - |
| `PATCH /api/admin/interview-slots/[id]` | ADMIN | 슬롯에 지원자 배정/해제 (정원 초과 시 400) | body: `applicantId`, `action`("assign"/"unassign") |
| `GET /api/admin/common-questions` | STAFF+ | Day 1~3 공통질문 조회 (없는 Day는 자동 생성) | - |
| `PATCH /api/admin/common-questions` | ADMIN | Day별 공통질문/면접 장소 upsert | body: `day`(필수), `questions[]`, `location` |
| `GET /api/admin/final-questions/[applicantId]` | STAFF+ | 지원자의 최종 개인질문 조회 | - |
| `PATCH /api/admin/final-questions/[applicantId]` | ADMIN | 최종 개인질문 upsert | body: `question`(필수) |
| `GET /api/admin/questions-sheet` | STAFF+ | 질문 시트용 통합 데이터 (지원자+평가+슬롯+최종질문+공통질문) | - |
| `GET /api/admin/email-preview` | STAFF+ | 예시 메일 미리보기 (`{ subject, html }`) | query: `type`, `passed`("true"/"false") |
| `GET /api/admin/seed` | ADMIN | 초기 데이터 생성: 면접 슬롯 15개(3일×5타임, 정원 3명) + CommonQuestion Day 1~3. 이미 있으면 건너뜀 | - |

---

## 6. DB 스키마

`prisma/schema.prisma` 기준. PostgreSQL(Supabase), Prisma ORM. 배열/객체형 데이터는 별도 테이블 대신 **String 컬럼에 JSON 문자열**로 저장하는 패턴을 쓴다.

### Enum

- `ApplicationStage`: `SUBMITTED` → `DOC_REVIEWING` → `DOC_COMPLETED` → (`DOC_REJECTED` | `INTERVIEW_READY` → `INTERVIEW_SET` → `FINISHED`)
- `DocResult`, `FinalResult`: `PASS` | `FAIL`

### 모델 (6개)

| 모델 | 역할 | 주요 필드 |
|---|---|---|
| `Applicant` | 지원자 원본 데이터 + 전형 상태 | 인적/학적사항, `careers`(JSON), `essay1~4`, `stage`, `docResult?`, `finalResult?`, `interviewPreferences`(희망 슬롯 ID의 JSON 배열), `interviewSlotId?`(배정 슬롯) |
| `Evaluation` | 운영진 1명의 지원자 1명에 대한 평가 | `staffName`(운영진 이름), 서류(`docScore`, `docComment`, `personalQuestion`) / 면접(`interviewScore`, `interviewComment`). `@@unique([applicantId, staffName])`로 1인 1건 |
| `InterviewSlot` | 면접 시간대 단위 | `date`, `startTime`, `endTime`, `maxCount`(기본 3) |
| `CommonQuestion` | 면접 날짜(Day)별 공통질문과 장소 | `day`(1~3, unique), `questions`(JSON 배열), `location?` |
| `FinalQuestion` | 지원자별 관리자 확정 개인질문 | `applicantId`(unique — 지원자당 1건), `question` |
| `NotificationLog` | 메일 발송 이력 | `type`, `channel`("email"), `success`, `sentAt` |

### 관계

```
Applicant 1 ─── N Evaluation      (운영진별 평가, onDelete: Cascade)
Applicant 1 ─── N NotificationLog (발송 이력, onDelete: Cascade)
Applicant N ─── 1 InterviewSlot   (배정된 슬롯, nullable)
FinalQuestion — applicantId로 1:1 (FK 없이 unique 컬럼으로 연결)
CommonQuestion — 관계 없음. 슬롯 날짜를 오름차순 정렬한 순번(1,2,3)을 day와 매핑
```

주의: `Applicant.interviewPreferences`(희망 시간)와 `interviewSlotId`(확정 배정)는 별개다. 지원자가 희망을 여러 개 제출하면 관리자가 그중(혹은 밖에서) 하나를 배정한다.

---

## 7. 메일 발송 체계

발송은 `lib/email.ts`의 `sendEmail()`(Nodemailer + Gmail SMTP), 템플릿은 `lib/emailTemplates.ts`가 담당한다. 모든 메일은 HTML이며 발신 전용, 문의처(hyu.hyfin@gmail.com)를 안내한다.

### 템플릿 4종과 발송 시점

| type | 제목 | 발송 시점 | 발송 후 stage 전환 |
|---|---|---|---|
| `RECEIPT` | 지원서 접수 확인 | 지원서 제출 직후 **자동** (`POST /api/applications`) | 없음 |
| `DOC_RESULT` | 서류 심사 결과 안내 | 관리자가 메일 발송 탭에서 수동. `passed`에 따라 합/불 본문 분기. 합격 메일에는 면접 희망 시간 선택 링크 포함 | PASS → `INTERVIEW_READY`, FAIL → `DOC_REJECTED` |
| `INTERVIEW` | 면접 일정 안내 | 관리자 수동. 면접 일시는 배정 슬롯(`date startTime~endTime`)에서, 장소는 해당 날짜 Day의 `CommonQuestion.location`에서 자동으로 채움 (미배정 시 "추후 안내") | → `INTERVIEW_SET` |
| `FINAL_RESULT` | 최종 합격/불합격 결과 안내 | 관리자 수동. `finalResult` 기준으로 합/불 분기 | → `FINISHED` |

### 발송 로직 (`POST /api/admin/notify`)

- 지원자별로 `Promise.allSettled`로 개별 발송 — 한 명 실패해도 나머지는 계속 진행.
- 성공/실패 각각 `NotificationLog`에 기록 (`success: true/false`).
- **stage 전환은 발송 성공 시에만** 일어난다. 실패한 지원자는 stage가 유지되어 재발송 대상에 남는다.
- 응답으로 `{ total, success, results }`를 반환하고, UI가 "N명 중 M명 성공" 배너로 표시.
- 접수 확인 메일(RECEIPT)도 실패 시 로그만 남기고 지원서 접수 자체는 성공 처리한다.

---

## 8. 환경변수와 실행

### 환경변수

값은 `.env.local`(로컬, gitignore 대상)과 Vercel 대시보드(배포)에 설정한다. 템플릿은 `.env.local.example` 참고.

| 이름 | 용도 |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL 연결 문자열 (Prisma `url`) |
| `DIRECT_URL` | Prisma `directUrl`용 직접 연결 문자열 (`prisma/schema.prisma`에서 요구) |
| `GMAIL_USER` | 발신 Gmail 계정 주소 |
| `GMAIL_APP_PASSWORD` | Gmail 앱 비밀번호 (SMTP 인증) |
| `EMAIL_FROM_NAME` | 발신자 표시 이름 (미설정 시 "HYFIN") |

참고: `.env.local.example`에는 `ADMIN_PASSWORD`도 있으나 현재 코드에서는 사용되지 않는다 (계정은 `lib/users.ts` 하드코딩).

### 로컬 실행

```bash
npm install        # postinstall에서 prisma generate 자동 실행
npm run dev        # http://localhost:3000
npm run db:push    # 스키마를 DB에 반영
npm run db:studio  # Prisma Studio (DB GUI)
```

최초 실행 시 ADMIN 계정으로 `GET /api/admin/seed`를 호출해 면접 슬롯과 공통질문을 생성해야 면접 관리 탭이 동작한다.
DB 초기화·seed 호출 등 자주 쓰는 명령어는 [commands.md](commands.md) 참고.
