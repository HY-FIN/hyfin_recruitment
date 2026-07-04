import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminRequest } from "@/lib/auth";
import {
  computeAssignment,
  AssignApplicant,
  AssignSlot,
} from "@/lib/interviewAssign";

interface PoolApplicant {
  id: string;
  name: string;
  major: string;
  interviewPreferences: string;
  interviewSlotId: string | null;
}

interface SlotWithApplicants {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  maxCount: number;
  applicants: { id: string; stage: string }[];
}

function parsePreferences(raw: string): string[] {
  if (!raw || raw === "[]") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
    return [];
  } catch {
    return [];
  }
}

// GET/POST 공통 계산: 풀/제출 통계 + 배치 제안
async function buildPlan() {
  const pool = (await prisma.applicant.findMany({
    where: { stage: "INTERVIEW_READY" },
    select: {
      id: true,
      name: true,
      major: true,
      interviewPreferences: true,
      interviewSlotId: true,
    },
    orderBy: [{ appliedAt: "asc" }, { id: "asc" }],
  })) as PoolApplicant[];

  const slots = (await prisma.interviewSlot.findMany({
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      maxCount: true,
      applicants: { select: { id: true, stage: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  })) as SlotWithApplicants[];

  const submitters = pool.filter(
    (a) => parsePreferences(a.interviewPreferences).length >= 1
  );

  const poolCount = pool.length;
  const submittedCount = submitters.length;
  const allSubmitted = poolCount > 0 && submittedCount === poolCount;

  // 유효 잔여용량: 이미 확정(INTERVIEW_READY가 아닌 stage)된 지원자는 자리를 차지.
  // INTERVIEW_READY 지원자는 이번에 새로 배치하므로 제외.
  const slotCapacity = new Map<string, number>();
  for (const slot of slots) {
    const occupied = slot.applicants.filter((a) => a.stage !== "INTERVIEW_READY").length;
    slotCapacity.set(slot.id, Math.max(0, slot.maxCount - occupied));
  }

  const applicantInfo = new Map<string, { name: string; major: string }>();
  for (const a of pool) applicantInfo.set(a.id, { name: a.name, major: a.major });

  let assignments: Record<string, string> = {};
  let unassignedIds: string[] = [];

  if (allSubmitted) {
    const algoApplicants: AssignApplicant[] = submitters.map((a) => ({
      id: a.id,
      name: a.name,
      major: a.major,
      preferences: parsePreferences(a.interviewPreferences),
    }));
    const algoSlots: AssignSlot[] = slots.map((s) => ({
      id: s.id,
      capacity: slotCapacity.get(s.id) ?? 0,
    }));
    const result = computeAssignment(algoApplicants, algoSlots);
    assignments = result.assignments;
    unassignedIds = result.unassigned;
  }

  return {
    slots,
    poolCount,
    submittedCount,
    allSubmitted,
    assignments,
    unassignedIds,
    applicantInfo,
    slotCapacity,
  };
}

export async function GET(req: NextRequest) {
  const user = requireAdminRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const plan = await buildPlan();

    // 배치 결과를 슬롯별로 그룹핑
    const bySlot = new Map<string, { applicantId: string; name: string; major: string }[]>();
    for (const [applicantId, slotId] of Object.entries(plan.assignments)) {
      const info = plan.applicantInfo.get(applicantId);
      if (!info) continue;
      if (!bySlot.has(slotId)) bySlot.set(slotId, []);
      bySlot.get(slotId)!.push({ applicantId, name: info.name, major: info.major });
    }

    const proposalBySlot = plan.allSubmitted
      ? plan.slots.map((s) => ({
          slotId: s.id,
          date: s.date,
          startTime: s.startTime,
          endTime: s.endTime,
          maxCount: s.maxCount,
          capacity: plan.slotCapacity.get(s.id) ?? 0,
          assigned: bySlot.get(s.id) ?? [],
        }))
      : [];

    const unassigned = plan.allSubmitted
      ? plan.unassignedIds.map((id) => {
          const info = plan.applicantInfo.get(id);
          return { applicantId: id, name: info?.name ?? "", major: info?.major ?? "" };
        })
      : [];

    return NextResponse.json({
      poolCount: plan.poolCount,
      submittedCount: plan.submittedCount,
      allSubmitted: plan.allSubmitted,
      proposalBySlot,
      unassigned,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = requireAdminRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const plan = await buildPlan();

    if (!plan.allSubmitted) {
      return NextResponse.json(
        { error: "아직 모든 서류 합격자가 희망 시간을 제출하지 않았습니다." },
        { status: 400 }
      );
    }

    const entries = Object.entries(plan.assignments);
    await prisma.$transaction([
      // 재실행 대비: 이번 대상 pool 전원의 배정을 먼저 리셋한 뒤 개별 배정.
      prisma.applicant.updateMany({
        where: { stage: "INTERVIEW_READY" },
        data: { interviewSlotId: null },
      }),
      ...entries.map(([applicantId, slotId]) =>
        prisma.applicant.update({
          where: { id: applicantId },
          data: { interviewSlotId: slotId },
        })
      ),
    ]);

    return NextResponse.json({
      success: true,
      assignedCount: entries.length,
      unassignedCount: plan.unassignedIds.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "배치 반영 중 오류가 발생했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
