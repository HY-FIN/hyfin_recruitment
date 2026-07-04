import { google } from "googleapis";
import { Readable } from "stream";

export function getDriveClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Drive OAuth 환경변수가 설정되지 않았습니다.");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: "v3", auth: oauth2Client });
}

export async function uploadToDrive({
  name,
  mimeType,
  content,
}: {
  name: string;
  mimeType: string;
  content: string;
}): Promise<{ id: string; webViewLink: string }> {
  const folderId = process.env.GDRIVE_BACKUP_FOLDER_ID;
  if (!folderId) {
    throw new Error("GDRIVE_BACKUP_FOLDER_ID 환경변수가 설정되지 않았습니다.");
  }

  const drive = getDriveClient();

  const res = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(content),
    },
    fields: "id, webViewLink",
  });

  return {
    id: res.data.id ?? "",
    webViewLink: res.data.webViewLink ?? "",
  };
}
