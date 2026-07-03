# 기획 대비 구현 차이 분석

검사일: 2026-07-03 / 기준 문서: `docs/spec/admin_logic.md`, `docs/spec/db_schema.md`, `docs/spec/role_and_process.md`

## 1. 요약

기획 문서에 적힌 핵심 흐름(4개 탭 구성, 평가 입력, 슬롯 기반 면접 배정, 선택 대상 일괄 메일 발송, 지원자 희망시간 회송 페이지)은 대부분 충실히 구현되었고, 오히려 기획에 없던 기능(대시보드 통계, stage 상태 머신, 질문 시트, 메일 미리보기 등)이 다수 추가되었다. 달라진 점은 주로 "DB 컬럼으로 계획했던 값의 계산 방식 전환"(평균점수·발송여부), "기능 위치 이동"(개인질문 수정이 면접 탭이 아닌 지원자 상세로), 그리고 일부 미구현(점수 커트라인 설정, 면접 오프닝/마무리 멘트, 면접 일자·시간 수정 UI)이다. 권한 체계는 기획 방향대로 서버 레벨에서 지켜지지만, "운영진은 자신의 평가만 열람" 규칙은 UI 필터로만 구현되어 있고 관리자 인원도 5명에서 7명으로 늘었다.

## 2. 문서별 대조 결과

### 2-1. admin_logic.md (admin 페이지 로직)

| 기획 내용 | 실제 구현 | 차이 유형 | 비고 |
|---|---|---|---|
| 탭 4개: 대시보드/지원자 관리/면접 관리/메일 발송 | 사이드바 네비게이션에 동일한 4개 탭 (`app/admin/layout.tsx:41-46`) | 일치 | 메일 발송 탭은 ADMIN에게만 노출 (`layout.tsx:45,59`) |
| 대시보드는 "아이디어를 더 내야 해서 마지막에 수정" (보류) | 통계 카드 6종, 전형 퍼널, 학과/학년 분포, 평균 GPA, 합격률, 바로가기까지 완성됨 (`app/admin/dashboard/page.tsx:69-113,127-253`) | 추가 | 기획 보류 상태였으나 완전 구현 |
| 지원자 관리: 전체 지원자 정보 시트(필터링·소팅)가 오프닝 페이지 | 검색(이름/이메일/학과), stage 필터, 6종 정렬(제출일/이름/GPA/학년/서류평균/면접평균) 구현 (`app/admin/applications/page.tsx:159-183,239-267`) | 일치 | |
| 시트 → (평가하러가기/지원자 선택) → 상세 페이지 | 행마다 "평가하러가기" 버튼 → `/admin/applications/[id]` 이동 (`applications/page.tsx:371-377`) | 일치 | 상세 페이지 좌측에 목록 패널도 유지 (`applications/[id]/page.tsx:213-295`) |
| 상세: 기본정보/자기소개서/평가 3분할 | 동일 3개 탭 (`applications/[id]/page.tsx:325-328`) | 일치 | |
| 평가에서 이름 쓰기 제거 (로그인 정보 활용) | 평가자 이름 입력란 없음. 서버가 토큰에서 `staffName = user.id` 자동 결정 (`app/api/admin/evaluate/route.ts:16`) | 일치 | |
| 점수/코멘트/개인질문 입력 → 제출 시 바로 DB 저장 | 1~5점 버튼, 코멘트, 개인질문 제안 textarea → `/api/admin/evaluate` upsert (`applications/[id]/page.tsx:176-187,432-469`, `evaluate/route.ts:25-43`) | 일치 | |
| 평가 완료 지원자를 시트에서 바로 확인 | 시트에 "내서류평가/내면접평가" 컬럼 및 목록의 "✓ 평가완료" 표시 (`applications/page.tsx:280,337-341`, `applications/[id]/page.tsx:279-281`) | 일치 | |
| 면접 관리: 면접 구성 캘린더가 오프닝 페이지 | 날짜별 슬롯 그리드 캘린더 (`app/admin/interviews/page.tsx:319-383`) | 일치 | |
| 슬롯 선택 → 면접 프로세스(오프닝멘트→공통질문→개인질문→마무리멘트) + 평가 칸 | 슬롯 상세에 공통질문, 최종 개인질문(ADMIN), 평가 입력은 있으나 오프닝멘트/마무리멘트는 없음 (`interviews/page.tsx:386-520`) | 변경 | 프로세스 중 멘트 2종 미구현, 질문+평가만 구성 |
| 관리자가 공통질문 수정 (3일 면접, 3세트) | Day1~3 공통질문 수정 모달, `CommonQuestion.day` 1~3 (`interviews/page.tsx:289-301,524-583`) | 일치 | 기획에 없던 "면접 장소" 필드가 모달에 추가됨 (`interviews/page.tsx:531-538`) |
| 관리자가 면접 캘린더 수정: 면접 일자·시간 + 타임별 지원자 묶기 | 타임별 지원자 배정/해제 모달은 구현 (`interviews/page.tsx:366-377,585-677`, `api/admin/interview-slots/[id]/route.ts:26-41`). 일자·시간 자체를 수정하는 UI는 없음 — 슬롯은 seed로 고정 생성 (`api/admin/seed/route.ts:5-33`) | 변경 | 같은 문서 마지막 문단의 "슬롯은 내가 미리 만들어둘 것"과 상충하는 항목으로, 구현은 고정 슬롯 방식 채택 |
| 관리자가 개인질문 수정 페이지 (면접 관리 탭 내) | 최종 개인질문 수정은 지원자 상세 페이지의 평가 탭으로 이동 (`applications/[id]/page.tsx:509-526`, `api/admin/final-questions/[applicantId]/route.ts:17-38`). 면접 관리 탭에서는 읽기 전용 표시만 (`interviews/page.tsx:441-446`) | 변경 | 기능 자체는 구현, 위치가 이동 |
| 메일 3종(서류합불/면접일정/최종합불)을 버튼 하나로 일괄 전송 | 3개 섹션 각각 체크박스 선택 + 일괄 발송 버튼 (`app/admin/notifications/page.tsx:230-457`) | 일치 | |
| 관리자가 선택한 지원자에게만 발송 | 체크박스 선택 + 전체 선택/해제, 선택된 ID만 `/api/admin/notify`로 전송 (`notifications/page.tsx:139-185`) | 일치 | |
| 탈락자(서류·면접)에게 탈락 메일 발송 | DOC_RESULT/FINAL_RESULT 발송 시 `docResult`/`finalResult` 값에 따라 합격/불합격 템플릿 자동 분기 (`api/admin/notify/route.ts:53-56`) | 일치 | |
| 메일 발송 후 DB에 발송여부 기록 | `NotificationLog` 생성(성공/실패 모두) (`notify/route.ts:77-79,103-105`) | 일치 | 추가로 발송 성공 시 stage 자동 전환까지 수행 (`notify/route.ts:82-99`) — 기획에 없던 확장 |
| 시간 슬롯은 미리 생성, 26년 8월 중순 임의 3일 | seed API가 2026-08-18~20 3일, 하루 5슬롯(18:00~20:30, 30분 단위, 정원 3명) 생성 (`seed/route.ts:5-21,31`) | 일치 | 지원자는 `/interview-time`에서 선택 (`app/interview-time/page.tsx`) |

### 2-2. db_schema.md (DB 컬럼 계획)

| 기획 내용 | 실제 구현 | 차이 유형 | 비고 |
|---|---|---|---|
| 지원자 시트: 제출일자 + 지원서로 받는 정보들 | `Applicant`의 appliedAt, 인적/학적/경력/자소서 필드 전부 존재 (`prisma/schema.prisma:31-74`) | 일치 | 지원서 폼 필드와 1:1 대응 (`app/apply/page.tsx:17-38`) |
| 자동 접수 확인 메일 발송여부 (컬럼) | Applicant 컬럼이 아닌 별도 `NotificationLog` 테이블(type/channel/success/sentAt)로 기록 (`schema.prisma:121-129`, `api/applications/route.ts:34-44`) | 변경 | 단일 boolean → 이력 테이블로 일반화 |
| 서류합불여부 | `docResult: DocResult?` (`schema.prisma:61`) | 일치 | |
| 운영진 통합 서류평가 평균점수 (컬럼) | DB 컬럼 없음. `Evaluation.docScore`들로부터 프론트에서 계산 (`applications/page.tsx:82-86`) | 변경 | 저장값 → 파생 계산값 |
| 면접 가능 시간대 | `interviewPreferences`(슬롯 ID JSON 배열) (`schema.prisma:66`) | 일치 | 배정 확정용 `interviewSlotId`가 별도로 추가됨 (`schema.prisma:69`) |
| 최종합불여부 | `finalResult: FinalResult?` (`schema.prisma:62`) | 일치 | |
| 운영진 통합 면접평가 평균점수 (컬럼) | 컬럼 없음, `Evaluation.interviewScore`로 계산 (`applications/page.tsx:88-92`) | 변경 | |
| 면접 관리 "시트" (단일 시트 개념) | 단일 시트가 아닌 4개 모델로 정규화: `InterviewSlot`, `CommonQuestion`, `FinalQuestion`, `Evaluation` (`schema.prisma:76-119`) | 변경 | 기능은 모두 커버 |
| 면접 시간 | `InterviewSlot(date, startTime, endTime, maxCount)` (`schema.prisma:97-104`) | 일치 | 정원(maxCount) 개념 추가 |
| 공통질문 | `CommonQuestion(day, questions JSON)` (`schema.prisma:106-112`) | 일치 | 기획에 없던 `location`(면접 장소) 필드 추가 (`schema.prisma:110`) |
| 최종 개인질문 | `FinalQuestion(applicantId, question)` (`schema.prisma:114-119`) | 일치 | |
| 운영진별 개인질문 | `Evaluation.personalQuestion` (`schema.prisma:85`) | 일치 | |
| 운영진별 서류평가 점수 / 면접점수 | `Evaluation.docScore`, `Evaluation.interviewScore` (`schema.prisma:83,88`) | 일치 | `docComment`, `interviewComment` 추가 |
| 특이사항 (컬럼) | 전용 컬럼 없음. `docComment`/`interviewComment`가 유사 역할 수행 | 미구현 | 코멘트 필드로 흡수된 것으로 보임 |
| (기획에 없음) 전형 단계 | `ApplicationStage` enum 7단계(SUBMITTED~FINISHED, DOC_REJECTED 포함) 및 자동 전환 로직 (`schema.prisma:11-19`, `evaluate/route.ts:46-57`, `notify/route.ts:82-99`) | 추가 | 기획 문서에는 상태 머신 개념 자체가 없음 |

### 2-3. role_and_process.md (권한·프로세스)

| 기획 내용 | 실제 구현 | 차이 유형 | 비고 |
|---|---|---|---|
| admin 페이지는 각자 할당된 id/password로만 접근 | 하드코딩 유저 목록 + 로그인 API + sessionStorage 토큰, 모든 admin API가 `x-admin-token` 검증 (`lib/users.ts:10-28`, `app/api/admin/login/route.ts`, `lib/auth.ts:4-32`) | 일치 | 인증 세부 방식(base64 토큰)은 기획에 명시 없던 구현 선택 |
| 사용자 3분류: 지원자/운영진/관리자 | 계정은 `ADMIN`/`STAFF` 2종, 지원자는 계정 없이 공개 페이지 이용 (`lib/users.ts:1`) | 일치 | 지원자는 이름+전화번호 본인확인으로 대체 (`api/interview-time/route.ts:32-42`) |
| 운영진: 메일 발송·면접 시트 수정 권한 없음, 서류/면접 평가 가능 | 메일 발송(`notify/route.ts:7`), 합불·stage 변경(`applications/[id]/route.ts:20`), 슬롯 배정(`interview-slots/[id]/route.ts:9`), 공통질문 수정(`common-questions/route.ts:26`), 최종질문(`final-questions/.../route.ts:21`) 모두 `requireAdminRequest`. 평가는 STAFF 가능 (`evaluate/route.ts:6`) | 일치 | UI에서도 메일 발송 탭 차단 (`notifications/page.tsx:97-106`) |
| 운영진은 자신이 평가한 내용만 볼 수 있음 | 상세/면접 페이지에서 STAFF는 자기 평가만 표시 (`applications/[id]/page.tsx:205-209`, `interviews/page.tsx:426-429`). 단, API는 STAFF에게도 전체 evaluations를 반환하고 (`api/admin/applications/route.ts:31-32`), 시트의 서류/면접 "평균" 컬럼은 STAFF에게도 노출 (`applications/page.tsx:332-345`) | 변경 | 규칙이 클라이언트 필터로만 구현. 통합 평균은 STAFF도 열람 가능하게 완화됨 |
| 관리자는 5명만 (학회장/부학회장/대외협력부장/집행부장/학술부장) | ADMIN 7명: 학술부장이 2명이고 "서비스 개발" 직함 1명 추가 (`lib/users.ts:11-18`) | 변경 | |
| 지원자: 지원서 제출 시 자동 접수 확인 메일 수신 | 제출 직후 RECEIPT 메일 발송 + 로그 기록 (`api/applications/route.ts:34-44`) | 일치 | |
| 지원자: 면접 희망 시간 웹페이지 체크 → 마스터 DB에 바로 연동 | `/interview-time` 본인확인 → 슬롯 다중 선택 → `interviewPreferences` 저장 (`app/interview-time/page.tsx`, `api/interview-time/route.ts:50-53`) | 일치 | 면접 대상자(INTERVIEW_READY/SET)만 접근 허용하는 자격 검사 추가 (`route.ts:40-42`) |
| 관리자: 점수 커트라인 설정(서류탈락 확정인원 선택) | 커트라인(점수 기준 일괄 확정) 기능 없음. 시트에서 지원자별 서류합불을 개별 셀렉트로 수동 결정 (`applications/page.tsx:185-192,312-330`) | 변경 | 점수순 정렬을 보며 수동 선택하는 방식으로 대체 |
| 관리자: 서류 합불 메일 발송 | DOC_RESULT 발송, PASS→INTERVIEW_READY / FAIL→DOC_REJECTED 전환 (`notify/route.ts:82-87`) | 일치 | |
| 관리자: 희망 시간 기반 면접 관리시트 작성 | 배정 모달에서 지원자의 희망 슬롯에 "희망" 태그를 표시하고 수동 배정 (`interviews/page.tsx:633-648`) | 일치 | |
| 관리자: 면접 일자/장소 공지 메일 발송 | INTERVIEW 메일 — 일시는 배정 슬롯에서, 장소는 CommonQuestion.location에서 자동 취합 (`notify/route.ts:30-49,58-66`). 장소 미등록 시 발송 버튼 비활성화 (`notifications/page.tsx:368-379`) | 일치 | 장소 검증 로직은 기획에 없던 추가 |
| 면접자 평가: 표에서는 관리자 담당 | STAFF도 면접 평가 입력 가능 (`interviews/page.tsx:448-486`, `evaluate/route.ts:6`) | 변경 | admin_logic.md 16행("운영진과 관리자가 평가")과는 일치 — 두 문서가 상충, 구현은 admin_logic 쪽 채택 |
| 관리자: 최종선발인원 확정 + 최종 합불 메일 발송 | 시트에서 finalResult 셀렉트(ADMIN 전용) → FINAL_RESULT 메일 발송 시 FINISHED 전환 (`applications/page.tsx:194-201,352-369`, `notify/route.ts:94-99`) | 일치 | |

## 3. 기획에 없던 추가 구현

1. **전형 단계(stage) 상태 머신** — 7단계 `ApplicationStage`(DOC_REJECTED 포함)와 자동 전환: 첫 서류 평가 시 SUBMITTED→DOC_REVIEWING (`app/api/admin/evaluate/route.ts:46-57`), 메일 발송 성공 시 단계 전환 (`app/api/admin/notify/route.ts:82-99`)
2. **완성형 대시보드** — 기획상 보류였으나 통계 카드, 전형 퍼널, 학과/학년 분포, 평균 GPA, 합격률까지 구현 (`app/admin/dashboard/page.tsx`)
3. **전체 지원자 질문 시트 탭** — 지원자 관리 안의 두 번째 시트(면접 슬롯, 공통질문, 최종 개인질문, 내 개인질문 열람) 및 전용 API (`app/admin/applications/page.tsx:390-499`, `app/api/admin/questions-sheet/route.ts`)
4. **이메일 미리보기** — 메일 타입별 예시 미리보기 모달 및 API (`app/admin/notifications/page.tsx:187-204,461-486`, `app/api/admin/email-preview/route.ts`)
5. **면접 장소 관리** — `CommonQuestion.location` 필드, 장소 미등록 시 면접 메일 발송 차단 (`prisma/schema.prisma:110`, `notifications/page.tsx:109,368-379`)
6. **면접 슬롯 정원 관리** — `maxCount`(3명), 마감 슬롯 선택 차단 및 배정 초과 방지 (`schema.prisma:102`, `app/interview-time/page.tsx:218-230`, `api/admin/interview-slots/[id]/route.ts:27-29`)
7. **Seed API** — 슬롯 15개 + 공통질문 3세트 초기 생성 (`app/api/admin/seed/route.ts`)
8. **면접 희망시간 페이지의 본인확인·자격검사·중복제출 감지** — verifyOnly 단계, INTERVIEW_READY/SET 검사, alreadySubmitted 처리 (`api/interview-time/route.ts:26-48`)
9. **평가 코멘트 필드** — `docComment`, `interviewComment` (기획은 서류 코멘트만 언급, 면접 코멘트는 확장) (`schema.prisma:84,89`)
10. **NotificationLog 이력화** — 발송여부 boolean 대신 타입/채널/성공여부/시각을 갖는 이력 테이블 (`schema.prisma:121-129`)
11. **지원서 폼 UX** — 경력사항 다건 추가/삭제, 자소서 글자수 카운터 (`app/apply/page.tsx:36-55,244-274`)

## 4. 참고 (판단이 애매했던 부분)

- **면접 캘린더 "일자·시간 수정" 미구현 여부**: `admin_logic.md` 18행은 관리자가 면접 일자와 시간을 수정할 수 있어야 한다고 했지만, 같은 문서 24행은 "시간 슬롯은 관리자가 만드는 게 아니라 내가 미리 만들어둘 것"이라고 하여 문서 내부에서 상충한다. 구현은 후자(고정 seed + 배정만 수정)를 채택했으므로 "미구현"이 아닌 "변경"으로 분류했다.
- **면접 평가 주체**: `role_and_process.md`의 표는 면접자 평가를 관리자 행에만 두었지만, `admin_logic.md` 16행은 "운영진과 관리자가 평가"라고 명시한다. 구현(STAFF도 면접 평가 가능)은 admin_logic 쪽을 따른 것이므로 어느 문서를 정답으로 보느냐에 따라 판정이 달라진다.
- **"자신의 평가만 열람" 규칙의 범위**: 개별 평가 내용(점수·코멘트)은 STAFF에게 자기 것만 보이지만, 통합 평균 점수는 시트에서 STAFF에게도 노출된다 (`applications/page.tsx:332-345`). 평균이 "다른 운영진의 평가 내용"에 해당하는지는 해석의 여지가 있다. 또한 이 규칙이 서버가 아닌 클라이언트 필터로만 적용되어 API 응답에는 전체 평가가 포함된다는 점은 기획 의도와의 간극으로 볼 수 있다 (`api/admin/applications/route.ts:31-32`).
- **"특이사항" 컬럼**: 전용 필드는 없지만 `docComment`/`interviewComment`가 실질적으로 그 역할을 대체하는 것으로 보여 "미구현"과 "변경" 사이에서 미구현 쪽으로 분류했다.
- **관리자 7명**: 학술부장 2명과 "서비스 개발"(개발자 본인 추정) 추가는 운영상 필요에 의한 의도적 확장일 가능성이 높다 (`lib/users.ts:11-18`).
- **서류합불 메일 대상**: 기획 문구는 "서류합격자들에게만" + "탈락자에게 탈락 메일"로 두 갈래처럼 읽히지만, 구현은 DOC_COMPLETED 대상자 한 목록에서 합불 템플릿을 자동 분기하므로 실질적으로 기획 의도를 충족하는 것으로 판단했다 (`notify/route.ts:53-56,82-87`).
