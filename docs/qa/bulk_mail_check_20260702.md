HYFIN 메일 발송 기능 점검 보고서
1. 메일 발송 모듈/설정 확인
상태: ✅ 정상 (CLAUDE.md에 명시된 대로 Nodemailer + Gmail 사용 확인)
파일: /home/babogaeguri/Desktop/hyfin_recruitment/lib/email.ts:4-24
내용: 실제로 Resend, SendGrid 등 다른 서비스는 전혀 사용되지 않고, package.json에도 nodemailer(^6.9.16)만 의존성으로 등록되어 있음. lib/email.ts에서 Gmail SMTP를 다음과 같이 사용:

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendEmail(options: SendEmailOptions) {
  const { to, type, ...templateOptions } = options;
  const from = `${process.env.EMAIL_FROM_NAME ?? "HYFIN"} <${process.env.GMAIL_USER}>`;
  const { subject, html } = getEmailTemplate(type, templateOptions);
  await transporter.sendMail({ from, to, subject, html });
}
pool: true 옵션이 설정되어 있지 않음 → Nodemailer 기본(비풀링) SMTP transport는 sendMail 호출마다 새로운 SMTP 연결을 열고 닫음. 즉 동시에 여러 통을 보내면 그만큼 동시 SMTP 커넥션이 열림.
transporter는 모듈 로드 시 1회 생성되어 재사용됨(요청마다 재생성하지는 않음) — 이 부분은 정상.
환경변수는 GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_FROM_NAME 세 개를 참조하며 .env.local.example에 플레이스홀더로만 존재(.env.local.example:4-5,11), 실제 비밀번호 값은 노출되어 있지 않음. 정상.
2. 메일 발송이 일어나는 지점
상태: ✅ 확인 완료
파일 목록 및 방식:
트리거	파일:라인	발송 방식	비고
지원서 제출 시 접수 확인 메일	app/api/applications/route.ts:35	단건, try/catch로 실패해도 지원서 생성은 롤백 안 됨	메일 실패해도 지원자 저장은 유지, NotificationLog에 실패 기록
서류합불/면접안내/최종합불 메일	app/api/admin/notify/route.ts:51-109	일괄(bulk), Promise.allSettled(applicants.map(async (a) => {...}))	ADMIN 전용, app/admin/notifications/page.tsx의 "전체 선택 → 발송" 버튼에서 호출
app/api/admin/notify/route.ts가 유일한 일괄 발송 API이며, 프론트(app/admin/notifications/page.tsx:139-185)에서 체크박스로 다수 지원자를 선택해 한 번의 POST 요청으로 전체 목록(applicantIds 배열)을 넘김. 100명을 한꺼번에 선택하면 서버는 100명분 이메일을 한 번의 요청 안에서 모두 처리.
인증: requireAdminRequest(req)로 ADMIN role 체크가 서버 레벨에 존재함 (route.ts:7-8). 정상.
로직상 장점: 개별 지원자 발송을 try/catch로 감싸고 Promise.allSettled를 사용하므로, 1명 메일 발송 실패가 전체를 중단시키거나 롤백시키지 않음. 성공/실패는 각각 NotificationLog에 기록되고 응답의 results 배열에도 개별 성공 여부가 담겨 있음. 이 설계 자체는 견고함.
3. 100명 규모 일괄 발송 시 뻑날 수 있는 지점
3-1. 동시 연결 수 제한 없음 — 가장 큰 위험
상태: ❌ 버그(스케일 취약점)
파일: app/api/admin/notify/route.ts:51-52
내용:

const results = await Promise.allSettled(
  applicants.map(async (a) => {
    ...
    await sendEmail({ ... });
applicants.map(async ...)는 배열 전체(최대 100개)에 대해 동시에 비동기 함수를 실행시키고, Promise.allSettled로 모두 끝날 때까지 기다림. 즉 딜레이/배치(batch)/동시성 제한(concurrency limit)이 전혀 없이 100건의 sendEmail → transporter.sendMail이 거의 동시에 발사됨.

lib/email.ts의 transporter가 pool: true가 아니므로 각 sendMail 호출마다 개별 SMTP 연결을 새로 맺음 → 순간적으로 최대 100개의 동시 SMTP 커넥션이 smtp.gmail.com에 열릴 수 있음.
Gmail은 계정당 동시 연결 수, 분당 발송 속도에 제한을 두고 있으며(개인 Gmail 계정 기준 하루 500통, 짧은 시간에 몰리는 대량/동시 요청은 스팸 방지 로직에 걸려 일시적으로 연결 거부(421, 454 등)나 앱 비밀번호 잠금으로 이어질 수 있음). 100명을 한 번에 선택해서 누르면 이 임계치에 가장 걸리기 쉬운 패턴.
수정 제안: transporter에 pool: true, maxConnections: 3~5, maxMessages: 100 등을 설정하거나, notify/route.ts에서 applicants를 청크(예: 5~10명씩)로 나눠 for 루프 + await Promise.allSettled(chunk) + 청크 사이 짧은 지연(setTimeout)을 주는 방식으로 동시성을 제한해야 함.
3-2. Vercel 서버리스 함수 실행 시간 제한
상태: ⚠️ 주의
파일: app/api/admin/notify/route.ts (전체), next.config.ts, 프로젝트 루트에 vercel.json 없음
내용: 이 라우트에는 export const maxDuration이 지정되어 있지 않고, 별도 vercel.json도 없음. 즉 Vercel 기본값을 그대로 사용:
Hobby 플랜: 함수 실행 제한이 기본 10초 수준
Pro 플랜: 기본은 더 길지만(플랜별 상이), 별도 설정 없이는 60초 이내
위 3-1의 동시성 폭주로 Gmail이 일부 연결을 지연/거부하기 시작하면, sendMail들의 응답이 늦어져 전체 요청 처리 시간이 수십 초로 늘어날 수 있고, Vercel 타임아웃에 걸려 함수가 강제 종료될 위험이 있음. 이 경우 이미 성공한 메일은 발송됐지만 NotificationLog 기록이나 stage 업데이트가 일부만 반영된 채 응답 자체가 500/타임아웃으로 끊겨 프론트가 결과를 못 받는 상황(부분 성공 후 응답 유실)이 발생할 수 있음.
수정 제안: app/api/admin/notify/route.ts에 export const maxDuration = 60;(Pro 플랜 기준) 명시, 근본적으로는 3-1의 배치 처리로 실행 시간 자체를 낮추는 것이 우선.
3-3. 에러 핸들링 및 가시성
상태: ⚠️ 주의 (완전 정상은 아니지만 치명적이지는 않음)
파일: app/api/admin/notify/route.ts:101-114, app/admin/notifications/page.tsx:206-217
내용: 서버는 실패자 개별 정보를 results 배열({ id, success, error })로 응답에 포함하고 있으나(route.ts:111), 프론트의 ResultBanner는 success/total 카운트만 보여주고 누가 실패했는지 이름/이메일 목록은 화면에 노출하지 않음(notifications/page.tsx:23-26, 206-217). 100명 중 몇 명이 실패해도 관리자는 "몇 명 실패"라는 숫자만 보고, 어떤 지원자에게 재발송해야 하는지 알 수 있는 UI가 없음. 재발송 시 어차피 같은 stage 필터(docApplicants 등)로 다시 노출되긴 하지만, 실패한 사람만 골라 재선택하는 편의 기능은 없음.
재시도 로직: 없음. 실패 시 그대로 실패 처리되고 재발송은 관리자가 수동으로 같은 화면에서 다시 체크해서 눌러야 함(멱등성 문제는 없음 — 같은 사람을 다시 보내도 stage 조건은 유지되므로 중복 발송 외의 부작용은 없어 보임).
수정 제안: 프론트에서 data.results 중 success: false인 항목을 이름과 함께 별도로 표시하고, "실패자만 다시 선택" 버튼을 추가하면 운영 편의성이 크게 개선됨. (기능 요구사항이 아니라면 우선순위는 낮음.)
3-4. 발송과 DB 업데이트가 원자적이지 않음
상태: ⚠️ 주의
파일: app/api/admin/notify/route.ts:69-99
내용: sendEmail 성공 후 notificationLog.create, 그리고 applicant.update(stage 전환)를 순차적으로 개별 await하는데, 트랜잭션으로 묶여있지 않음. 메일은 성공했는데 그 다음 notificationLog.create나 applicant.update가 DB 커넥션 문제 등으로 실패하면 catch 블록으로 빠지면서 "메일은 실제로 발송됐지만 stage는 전환 안 되고 실패로 기록되는" 불일치가 생길 수 있음(재발송 시 중복 메일 위험). 100명 규모에서는 DB 부하도 커지므로 이 경합 가능성이 상대적으로 커짐.
수정 제안: sendEmail과 notificationLog.create + applicant.update를 하나의 로직 단위로 보고, 실패 시 로그에 "메일은 갔으나 DB 갱신 실패"를 구분해서 남기거나, prisma.$transaction으로 로그+stage 업데이트를 묶는 것을 고려. (메일 발송 자체는 트랜잭션 밖에 있어야 하므로 완전한 원자성은 불가능하지만, 최소한 실패 사유를 구분해서 로깅하면 좋음.)
종합 요약 (심각도 순)
[높음] 동시성 제한 없는 일괄 발송 — app/api/admin/notify/route.ts:51-52에서 Promise.allSettled(applicants.map(...))로 최대 100건의 sendMail을 사실상 동시에 발사하고, lib/email.ts:4-10의 transporter는 pool 설정이 없어 매 발송마다 새 SMTP 연결을 맺음. Gmail의 동시 연결/발송 속도 제한에 걸려 중간에 다수가 실패하거나 계정이 일시적으로 스팸 처리될 위험이 있음. 100명 일괄 발송 전 반드시 청크 처리(5~10명 단위)+지연 또는 pool:true+maxConnections 제한 적용을 권장.
[중간] Vercel 함수 타임아웃 미설정 — maxDuration이 코드에 명시돼 있지 않아 기본 제한(플랜에 따라 10~60초)에 걸릴 수 있음. 1번 문제로 지연이 커지면 여기서 실제로 끊길 가능성이 높아짐. export const maxDuration 명시 필요.
[낮음] 실패자 목록 미노출 — 서버는 실패 정보를 응답에 담고 있지만(route.ts:111) 프론트(notifications/page.tsx:206-217)가 카운트만 보여줘서 관리자가 누구에게 재발송해야 할지 직접 알기 어려움.
[낮음] 메일 발송과 DB 상태 갱신의 비원자성 — 메일은 성공했는데 후속 DB 갱신이 실패하면 상태 불일치 및 중복 발송 위험이 소규모로 존재.
그 외 부분(모듈 선택, ADMIN 인증 체크, 개별 실패가 전체를 막지 않는 구조, 환경변수 노출 여부)은 정상적으로 잘 구현되어 있음.
결론: 현재 구조로 지원자 수가 적을 때(수십 명 이하, 특히 필터링된 소규모 배치)는 문제없이 동작할 가능성이 높지만, "100명을 한 번에 전체 선택해서 발송" 시나리오는 Gmail 동시 연결/속도 제한과 Vercel 함수 시간 제한이라는 두 축에서 실패 위험이 실제로 존재합니다. 코드 수정 없이 운영으로 우회하려면 "한 번에 20~30명씩 나눠서 여러 번 발송 버튼을 누르는" 방식이 임시 완화책이 될 수 있으나, 근본적으로는 서버 쪽에 배치 처리/동시성 제한 로직을 추가하는 것이 안전합니다.

점검 결과를 정리해서 설명드릴게요.

1. 어떤 모듈로 메일을 보내나
Nodemailer + Gmail SMTP를 사용합니다. lib/email.ts에 이렇게 설정돼 있어요.


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});
Resend, SendGrid 같은 별도 발송 서비스는 안 쓰고, 개인/조직 Gmail 계정을 SMTP 서버로 직접 사용하는 구조입니다.
transporter는 앱 시작 시 한 번만 만들어 재사용하고, pool: true 같은 연결 풀링 옵션은 켜져 있지 않습니다. 이게 뒤에서 문제가 됩니다.
2. 메일이 발송되는 지점
상황	위치	방식
지원서 제출 시 접수 확인 메일	app/api/applications/route.ts	단건 발송
서류합불/면접안내/최종합불 통보	app/api/admin/notify/route.ts	일괄(bulk) 발송 — 관리자가 지원자 여러 명 체크박스로 선택 후 한 번에 발송
일괄 발송 쪽 핵심 코드:


const results = await Promise.allSettled(
  applicants.map(async (a) => {
    ...
    await sendEmail({ ... });
applicants.map(async ...)이므로 선택된 인원 전체(최대 100명이면 100명)에 대해 동시에 메일 발송을 시작하고 Promise.allSettled로 다 끝나길 기다립니다. 한 명 실패해도 전체가 롤백되지 않고 각자 성공/실패가 개별 기록되는 점은 잘 설계돼 있습니다.

3. 100명 일괄 발송 시 뻑날 여지 — 있습니다
① 동시 연결 제한 없음 (가장 큰 위험)
lib/email.ts의 transporter가 pool: true가 아니라서, sendMail을 부를 때마다 매번 새 SMTP 연결을 엽니다. 여기에 위 Promise.allSettled(map(...)) 구조가 겹치면 100명분 메일이 거의 동시에, 최대 100개의 SMTP 연결로 Gmail 서버에 날아갑니다.

Gmail은 개인 계정 기준 동시 연결 수·분당 발송 속도에 제한이 있고, 짧은 시간에 몰리는 요청은 스팸 방지 로직에 걸려 421/454 같은 에러로 연결을 거부하거나 일시적으로 계정을 제한할 수 있습니다. 100명을 한 번에 선택해서 누르는 패턴이 정확히 이 임계치를 건드리기 쉬운 시나리오입니다.

② Vercel 함수 실행 시간 제한
app/api/admin/notify/route.ts에 maxDuration 설정이 없어서 Vercel 기본값(Hobby 10초, Pro 플랜별로 더 길지만 기본은 60초 이내)을 그대로 씁니다. ①번 문제로 Gmail 쪽 응답이 지연되기 시작하면 전체 요청 처리 시간이 늘어나, 이미 일부는 발송됐는데 함수가 타임아웃으로 끊겨 응답 자체를 못 받는 상황(부분 성공 후 결과 유실)이 생길 수 있습니다.

③ (부수적) 실패자 목록이 화면에 안 보임
서버는 실패한 사람 정보를 응답에 담고 있지만, 관리자 화면은 "몇 명 성공/실패" 카운트만 보여줘서 누구에게 재발송해야 하는지 직접 확인할 방법이 없습니다.

④ (부수적) 메일 발송과 DB 상태 갱신이 트랜잭션으로 묶여있지 않음
메일은 갔는데 그 다음 로그 기록이나 stage 업데이트가 실패하면, "메일은 갔지만 실패로 기록"되는 불일치가 소규모로 생길 수 있습니다.

결론
지금 구조는 소규모(수십 명 이하) 발송에서는 문제없이 동작하지만, 100명을 한 번에 선택해 발송하는 시나리오는 실제로 실패 위험이 있습니다. 가장 큰 원인은 동시성 제한 없이 전부 한꺼번에 쏘는 구조 + Gmail SMTP의 동시 연결 제한 조합입니다.

당장 코드 안 고치고 우회하려면 2030명씩 나눠서 여러 번 발송하는 게 임시방편이고, 근본 해결은 서버 쪽에 청크 처리(예: 510명씩 나눠 순차 처리)나 발송 딜레이를 추가하는 것입니다. 원하시면 이 부분 수정을 implementor 에이전트에게 맡겨서 반영해드릴 수 있어요.