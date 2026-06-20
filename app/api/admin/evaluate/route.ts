import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { applicantId, staffName, score, comment } = await req.json();

  if (!applicantId || !staffName || score == null) {
    return NextResponse.json({ error: "필수 값이 누락되었습니다." }, { status: 400 });
  }

  const evaluation = await prisma.evaluation.upsert({
    where: { applicantId_staffName: { applicantId, staffName } },
    create: { applicantId, staffName, score: Number(score), comment },
    update: { score: Number(score), comment },
  });

  return NextResponse.json(evaluation);
}
