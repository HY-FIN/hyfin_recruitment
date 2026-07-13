# P0 버그 3건 원인 분석 보고서

- 분석일: 2026-07-11
- 분석: inspector 에이전트
- 대상: [260711_action_plan.md](./260711_action_plan.md)의 P0-1 ~ P0-3

---

## 심각도 순 요약

| 순위 | 버그 | 원인 | 확신도 |
|------|------|------|--------|
| 1 | 면접 점수 3점 리셋 | `selectSlot()`이 로컬 state를 서버값(기본 3)으로 무조건 덮어씀 + 저장 시 `?? 3` 폴백 → **DB 오염 가능** | 확실 |
| 2 | 박지원 로그인 불가 | `lib/users.ts` 계정 오타(`원지원`). 수정본이 스테이징만 되고 미커밋/미배포 | 확실 |
| 3 | 개인질문 STAFF 미표시 | API는 정상. UI 두 화면에서 fetch/렌더링을 `role === "ADMIN"`으로 게이팅 | 확실 |

---

## 버그 1: 박지원 로그인 불가 (P0-1)

**근본 원인 [확실]**: `lib/users.ts:14`에 계정이 `id: "원지원"`으로 오타 등록. 로그인 API(`app/api/admin/login/route.ts:10`)는 `findUser`의 문자열 완전일치 비교(`lib/users.ts:30-32`)만 사용하므로 "박지원" 입력 시 401. **수정본은 이미 워킹트리에 스테이징돼 있으나 커밋되지 않아** Vercel 운영 환경에는 미반영.

**추가 확인 결과**:
- 한글 ID의 base64 인코딩/디코딩은 정상 왕복됨 (인코딩 문제 아님) [확실]
- 세션은 sessionStorage 기반이라 잔존 세션 오염 가능성은 낮음 [추정]
- 다만 `app/admin/layout.tsx:18-28`은 API 401을 처리하지 않아, 무효 세션 시 "로그인은 된 것처럼 보이는데 데이터가 안 뜨는" 상태가 될 수 있음

**수정 방향**:
1. 스테이징된 `lib/users.ts` 수정을 커밋 → Vercel 배포 (즉시 해결)
2. (권장) API 401 시 sessionStorage 비우고 로그인 페이지로 보내는 공통 처리
3. (권장) 서버 측 `id.trim().normalize("NFC")` 정규화

## 버그 2: 면접 평가 점수 3점 리셋 (P0-2)

**근본 원인 [확실]**: `app/admin/interviews/page.tsx:132-177`의 `selectSlot()`이 실행될 때마다 `interviewScores` state 전체를 서버 응답으로 새로 만들어 무조건 덮어씀. 저장된 평가가 없으면 기본값 3 (155·158행). 리셋이 발생하는 두 경로:

1. **비동기 race [가능성 높음]**: 슬롯 클릭 → 패널 즉시 렌더링(3점 표시) → 사용자가 점수 선택 → 뒤늦게 도착한 fetch 응답(174행 `setInterviewScores`)이 선택을 3으로 덮어씀
2. **슬롯 재클릭 [확실]**: 슬롯 셀 전체가 버튼(343행)이라, 점수 선택 후 슬롯을 다시 클릭하면 미저장 점수가 전부 초기화됨

**⚠️ 데이터 오염 위험 [확실히 존재]**: state가 3으로 덮인 상태에서 "평가 저장"을 누르면 187행의 `?? 3`이 그대로 전송되고 API(`app/api/admin/evaluate/route.ts:40`)가 upsert → **DB에 의도치 않은 3점 저장 가능**. 진짜 3점과 오염된 3점은 구분 불가하므로 **베타 기간에 저장된 3점 평가는 평가자에게 재확인 필요**.

**수정 방향**:
1. `selectSlot`에서 state 통째 교체 대신 미저장(dirty) 변경 보존 병합
2. fetch 응답 도착 시 요청 시점 slot.id와 현재 선택 슬롯 일치 확인 (늦은 응답 무시)
3. 근본 해결: "미선택"을 3이 아닌 `null`로 표현, `null`은 저장하지 않음 (187행 `?? 3` 제거)

## 버그 3: 확정 개인질문 STAFF 미표시 (P0-3)

**근본 원인 [확실]**: 서버 권한은 정상 — GET API들(`final-questions`, `questions-sheet`, `common-questions`)은 모두 STAFF 포함 인증 유저 허용, PATCH만 ADMIN 전용(의도대로). 문제는 클라이언트:

- `app/admin/interviews/page.tsx:163` — final-questions fetch가 `role === "ADMIN"` 조건부
- 같은 파일 447행 — 렌더링도 ADMIN 전용
- `app/admin/applications/[id]/page.tsx:134, 510` — 지원자 상세도 동일하게 이중 차단
- 반면 `app/admin/applications/page.tsx:482` 질문 시트 탭은 STAFF에게 이미 노출 → **화면별 정책 불일치**

**수정 방향**:
1. `interviews/page.tsx`: 163행 ADMIN 조건 제거(전체 유저 fetch), 447행 렌더링 조건에서 role 제거
2. `applications/[id]/page.tsx`: fetch는 전체 유저로 확대, **편집 UI는 ADMIN 전용 유지** + STAFF에게는 읽기 전용 카드
3. 서버 측 변경 불필요 (PATCH가 이미 ADMIN 전용)
