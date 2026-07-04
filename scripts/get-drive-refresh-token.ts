/**
 * Google Drive 리프레시 토큰 발급 헬퍼 (로컬 1회 실행용)
 *
 * 실행법:
 *   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... npx tsx scripts/get-drive-refresh-token.ts
 *
 * 절차:
 *   1. 출력된 URL 을 브라우저에서 열고 hyu.hyfin@gmail.com 계정으로 로그인/동의
 *   2. 동의 후 localhost:53682 로 리다이렉트되면 콘솔에 refresh_token 이 출력됨
 *   3. 출력된 값을 GOOGLE_OAUTH_REFRESH_TOKEN 환경변수로 저장
 */

import http from "http";
import { google } from "googleapis";

const REDIRECT_URI = "http://localhost:53682";

async function main() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "환경변수 GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET 가 필요합니다."
    );
    console.error(
      "예: GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... npx tsx scripts/get-drive-refresh-token.ts"
    );
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
  });

  console.log("\n브라우저에서 이 URL을 열고 hyu.hyfin 계정으로 로그인/동의하세요:\n");
  console.log(authUrl);
  console.log("\n리다이렉트를 기다리는 중... (포트 53682)\n");

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "", REDIRECT_URI);
      const code = url.searchParams.get("code");
      if (!code) {
        res.writeHead(400);
        res.end("code 파라미터가 없습니다.");
        return;
      }

      const { tokens } = await oauth2Client.getToken(code);

      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("토큰 발급 완료. 콘솔을 확인하세요. 이 창은 닫아도 됩니다.");

      if (tokens.refresh_token) {
        console.log("\n========================================");
        console.log("GOOGLE_OAUTH_REFRESH_TOKEN:");
        console.log(tokens.refresh_token);
        console.log("========================================\n");
      } else {
        console.log(
          "\nrefresh_token 이 반환되지 않았습니다. (이미 동의한 계정일 수 있음)"
        );
        console.log(
          "Google 계정 보안 설정에서 앱 액세스를 제거한 뒤 다시 실행하거나, prompt=consent 로 재동의하세요.\n"
        );
      }

      server.close();
      process.exit(0);
    } catch (err) {
      console.error("토큰 교환 실패:", err);
      res.writeHead(500);
      res.end("토큰 교환 실패. 콘솔을 확인하세요.");
      server.close();
      process.exit(1);
    }
  });

  server.listen(53682);
}

main();
