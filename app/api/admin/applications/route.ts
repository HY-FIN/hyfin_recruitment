import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRequest } from "@/lib/auth";

const VALID_STAGES = ["SUBMITTED", "DOC_REVIEWING", "DOC_COMPLETED", "DOC_REJECTED", "INTERVIEW_READY", "INTERVIEW_SET", "FINISHED"] as const;
type ApplicationStage = typeof VALID_STAGES[number];

export async function GET(req: NextRequest) {
  const user = verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const search = searchParams.get("search");

  const applicants = await prisma.applicant.findMany({
    where: {
      ...(stage && (VALID_STAGES as readonly string[]).includes(stage)
        ? { stage: stage as ApplicationStage }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
              { major: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      evaluations: true,
      notifications: { orderBy: { sentAt: "desc" }, take: 5 },
    },
    orderBy: { appliedAt: "desc" },
  });

  return NextResponse.json(applicants);
}
