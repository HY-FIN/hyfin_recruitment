import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRequest, requireAdminRequest } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ applicantId: string }> }
) {
  const user = verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { applicantId } = await params;
  const finalQ = await prisma.finalQuestion.findUnique({ where: { applicantId } });
  return NextResponse.json(finalQ ?? null);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ applicantId: string }> }
) {
  const user = requireAdminRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { applicantId } = await params;
  const { question } = await req.json();

  if (!question) {
    return NextResponse.json({ error: "question이 필요합니다." }, { status: 400 });
  }

  const updated = await prisma.finalQuestion.upsert({
    where: { applicantId },
    create: { applicantId, question },
    update: { question },
  });

  return NextResponse.json(updated);
}
