import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAdmin(req: NextRequest) {
  const token = req.headers.get("x-admin-token");
  return token === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
