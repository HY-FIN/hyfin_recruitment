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
    // docResult 저장 시 서류 단계 이하일 때만 DOC_COMPLETED로 정렬한다.
    // 이미 면접/최종 단계인 지원자의 결과 정정으로 stage가 서류로 회귀하지 않도록,
    // stage 갱신을 별도 updateMany로 분리(조건 불일치 시 조용히 0건).
    if (u.docResult !== undefined) {
      operations.push(
        prisma.applicant.updateMany({
          where: {
            id: u.id,
            stage: { in: ["SUBMITTED", "DOC_REVIEWING", "DOC_COMPLETED", "DOC_REJECTED"] },
          },
          data: { stage: "DOC_COMPLETED" },
        })
      );
    }
  }

  try {
    await prisma.$transaction(operations);
    return NextResponse.json({ updated: updates.length });
  } catch (err) {
    console.error("[BATCH UPDATE ERROR]", err);
    return NextResponse.json({ error: "일괄 저장에 실패했습니다." }, { status: 500 });
  }
}
