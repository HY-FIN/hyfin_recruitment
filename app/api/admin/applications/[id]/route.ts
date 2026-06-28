import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRequest, requireAdminRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const applicant = await prisma.applicant.findUnique({
    where: { id },
    include: { evaluations: true, notifications: { orderBy: { sentAt: "desc" } } },
  });
  if (!applicant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(applicant);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAdminRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { status } = await req.json();

  const validStatuses = ["PENDING", "DOC_PASS", "DOC_FAIL", "INTERVIEW", "FINAL_PASS", "FINAL_FAIL"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "유효하지 않은 상태입니다." }, { status: 400 });
  }

  const updated = await prisma.applicant.update({ where: { id }, data: { status } });
  return NextResponse.json(updated);
}
