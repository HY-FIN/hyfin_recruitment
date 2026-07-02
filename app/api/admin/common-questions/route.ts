import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRequest, requireAdminRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 없으면 자동 생성
  const existing = await prisma.commonQuestion.findMany({ orderBy: { day: "asc" } });
  if (existing.length < 3) {
    const existingDays = new Set(existing.map((q) => q.day));
    for (const day of [1, 2, 3]) {
      if (!existingDays.has(day)) {
        await prisma.commonQuestion.create({ data: { day, questions: "[]" } });
      }
    }
    const all = await prisma.commonQuestion.findMany({ orderBy: { day: "asc" } });
    return NextResponse.json(all);
  }

  return NextResponse.json(existing);
}

export async function PATCH(req: NextRequest) {
  const user = requireAdminRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { day, questions, location } = await req.json();
  if (!day) {
    return NextResponse.json({ error: "day가 필요합니다." }, { status: 400 });
  }

  const updateData: { questions?: string; location?: string } = {};
  if (Array.isArray(questions)) updateData.questions = JSON.stringify(questions);
  if (typeof location === "string") updateData.location = location;

  const updated = await prisma.commonQuestion.upsert({
    where: { day },
    create: { day, questions: JSON.stringify(questions ?? []), location: location ?? null },
    update: updateData,
  });

  return NextResponse.json(updated);
}
