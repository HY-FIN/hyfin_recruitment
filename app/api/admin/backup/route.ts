import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { buildBackup } from "@/lib/backup";
import { uploadToDrive } from "@/lib/googleDrive";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = requireAdminRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { jsonContent, csvContent, timestamp, counts } = await buildBackup();

    const jsonName = `hyfin-backup-${timestamp}.json`;
    const csvName = `hyfin-applicants-${timestamp}.csv`;

    const jsonFile = await uploadToDrive({
      name: jsonName,
      mimeType: "application/json",
      content: jsonContent,
    });
    const csvFile = await uploadToDrive({
      name: csvName,
      mimeType: "text/csv",
      content: csvContent,
    });

    return NextResponse.json({
      success: true,
      timestamp,
      counts,
      files: [
        { name: jsonName, webViewLink: jsonFile.webViewLink },
        { name: csvName, webViewLink: csvFile.webViewLink },
      ],
    });
  } catch (err) {
    console.error("[backup] 실패:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
