import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = verifyRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const applicants = await prisma.applicant.findMany({
    where: {
      ...(status ? { status } : {}),
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
