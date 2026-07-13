import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminRequest } from "@/lib/auth";

const VALID_RESULTS = ["PASS", "FAIL"];

interface BatchUpdate {
  id: string;
  docResult?: string;
  finalResult?: string;
}

export async function PATCH(req: NextRequest) {
  const user = requireAdminRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let updates: BatchUpdate[];
  try {
    const body = await req.json();
    updates = body?.updates;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "updates가 비어있습니다." }, { status: 400 });
  }

  const operations = [];
  for (const u of updates) {
    if (!u || typeof u.id !== "string" || !u.id) {
      return NextResponse.json({ error: "id가 없는 항목이 있습니다." }, { status: 400 });
    }
    const data: Record<string, string> = {};
    if (u.docResult !== undefined) {
      if (!VALID_RESULTS.includes(u.docResult)) {
        return NextResponse.json({ error: "docResult 값이 올바르지 않습니다." }, { status: 400 });
      }
      data.docResult = u.docResult;
      data.stage = "DOC_COMPLETED";
    }
    if (u.finalResult !== undefined) {
      if (!VALID_RESULTS.includes(u.finalResult)) {
        return NextResponse.json({ error: "finalResult 값이 올바르지 않습니다." }, { status: 400 });
      }
      data.finalResult = u.finalResult;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "변경할 필드가 없는 항목이 있습니다." }, { status: 400 });
    }
    operations.push(prisma.applicant.update({ where: { id: u.id }, data }));
  }

  try {
    await prisma.$transaction(operations);
    return NextResponse.json({ updated: operations.length });
  } catch (err) {
    console.error("[BATCH UPDATE ERROR]", err);
    return NextResponse.json({ error: "일괄 저장에 실패했습니다." }, { status: 500 });
  }
}
