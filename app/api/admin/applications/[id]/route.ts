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
  const { stage, docResult, finalResult } = await req.json();

  const validStages = ["SUBMITTED", "DOC_REVIEWING", "DOC_COMPLETED", "DOC_REJECTED", "INTERVIEW_READY", "INTERVIEW_SET", "FINISHED"];
  const validResults = ["PASS", "FAIL"];

  const data: Record<string, string> = {};
  if (stage && validStages.includes(stage)) data.stage = stage;
  if (docResult && validResults.includes(docResult)) data.docResult = docResult;
  if (finalResult && validResults.includes(finalResult)) data.finalResult = finalResult;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }

  const updated = await prisma.applicant.update({ where: { id }, data });
  return NextResponse.json(updated);
}
