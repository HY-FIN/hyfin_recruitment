# HYFIN 리크루팅 툴 문서

문서는 성격에 따라 네 폴더로 나뉜다.

## 폴더 구조

```
docs/
├── commands.md    # 자주 쓰는 실행 명령어 모음
├── spec/          # 구현 계획 및 설계 문서, 참고 자료
├── qa/            # 테스트 체크리스트, 점검 보고서
└── assets/        # 이미지·원본 파일
```

## 루트 문서

| 문서 | 내용 |
|---|---|
| [service_overview.md](service_overview.md) | 서비스 전체 개요 — 사용자 권한, 리크루팅 플로우, 페이지·API·DB·메일 체계, 환경변수 (코드 기준) |
| [commands.md](commands.md) | 자주 쓰는 실행 명령어 모음 (dev 서버 실행, DB truncate 등) |

## 문서 목록

### spec/ — 구현 계획

| 문서 | 내용 |
|---|---|
| [admin_logic.md](spec/admin_logic.md) | admin 페이지 탭 구성(대시보드/지원자 관리/면접 관리/메일 발송) 및 각 탭의 로직 설계 |
| [db_schema.md](spec/db_schema.md) | 지원자 정보 시트·면접 관리 시트의 DB 컬럼 구조 초안 |
| [role_and_process.md](spec/role_and_process.md) | 사용자 권한 체계(지원자/운영진/관리자)와 리크루팅 프로세스별 역할 정의 |
| [recruiting_members.md](spec/recruiting_members.md) | 리크루팅 운영진 명단 (관리자 7명 + 운영진 8명) |

### qa/ — 테스트·점검

| 문서 | 내용 |
|---|---|
| [test_checklist.md](qa/test_checklist.md) | 테스트 항목 체크리스트 (브라우저 호환, validation, 면접 배치 등) |
| [bulk_mail_check_20260702.md](qa/bulk_mail_check_20260702.md) | 메일 발송 기능 점검 보고서 (2026-07-02) |
| [spec_vs_implementation_20260703.md](qa/spec_vs_implementation_20260703.md) | 기획 문서(spec/) 대비 실제 구현 차이 분석 (2026-07-03) |

### assets/ — 이미지·원본 파일

| 파일 | 내용 |
|---|---|
| HYFIN_7기_지원서.docx | 7기 지원서 원본 문서 |
| HYFIN_profile_500.png | GitHub 프로필용 HYFIN 로고 (500px) |
| kakaotalk_20231222.png | 카카오톡 공유 이미지 (2023-12-22) |

## 문서 작성 규칙

- 파일명은 영문 소문자 스네이크케이스로 통일한다.
- QA 점검 보고서는 `qa/` 아래에 `{주제}_{YYYYMMDD}.md` 형식으로 저장한다.
- 새 문서를 추가하면 이 README의 목록에도 한 줄 추가한다.
