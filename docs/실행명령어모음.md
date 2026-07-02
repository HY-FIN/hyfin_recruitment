# 실행명령어모음

## 로컬호스트로 접속하기

'''bash
npm run dev
'''

이후 브라우저에서 `http://localhost:3000` 접속

## DB truncate

'''bash
npx prisma db execute --stdin <<EOF
TRUNCATE TABLE "Applicant", "Evaluation", "InterviewSlot", "CommonQuestion", "FinalQuestion", "NotificationLog" CASCADE;
EOF
'''

'''bash
curl -s "http://localhost:3000/api/admin/seed" -H "x-admin-token: $(node -e "console.log(btoa(unescape(encodeURIComponent('박상윤:15736482'))))")"
'''

## DB 직접 확인

'''bash
npx prisma studio
'''