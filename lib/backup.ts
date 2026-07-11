import { prisma } from "@/lib/prisma";

// CSV 셀 이스케이프: 특수문자 포함 시 큰따옴표로 감싸고 내부 " 는 "" 로 치환
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str: string;
  if (value instanceof Date) {
    str = value.toISOString();
  } else {
    str = String(value);
  }
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// KST(UTC+9) 기준 YYYY-MM-DD_HHmmss 파일명용 타임스탬프
function kstTimestamp(): string {
  // "sv-SE" 로케일은 "YYYY-MM-DD HH:mm:ss" 형식을 반환
  const s = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
  const [datePart, timePart] = s.split(" ");
  const time = timePart.replace(/:/g, "");
  return `${datePart}_${time}`;
}

const APPLICANT_COLUMNS = [
  "id",
  "name",
  "phone",
  "birthDate",
  "email",
  "address",
  "gender",
  "militaryStatus",
  "studentId",
  "grade",
  "major",
  "gpa",
  "subMajor",
  "graduationPlan",
  "enrollmentStatus",
  "careers",
  "essay1",
  "essay2",
  "essay3",
  "essay4",
  "essay5",
  "stage",
  "docResult",
  "finalResult",
  "appliedAt",
  "interviewPreferences",
  "interviewSlotId",
] as const;

export async function buildBackup(): Promise<{
  jsonContent: string;
  csvContent: string;
  timestamp: string;
  counts: Record<string, number>;
}> {
  const [
    applicants,
    evaluations,
    interviewSlots,
    commonQuestions,
    finalQuestions,
    notificationLogs,
  ] = await Promise.all([
    prisma.applicant.findMany(),
    prisma.evaluation.findMany(),
    prisma.interviewSlot.findMany(),
    prisma.commonQuestion.findMany(),
    prisma.finalQuestion.findMany(),
    prisma.notificationLog.findMany(),
  ]);

  const exportedAt = new Date().toISOString();

  const jsonContent = JSON.stringify(
    {
      exportedAt,
      tables: {
        applicants,
        evaluations,
        interviewSlots,
        commonQuestions,
        finalQuestions,
        notificationLogs,
      },
    },
    null,
    2
  );

  // 지원자 CSV
  const headerLine = APPLICANT_COLUMNS.join(",");
  const rows = applicants.map((a) =>
    APPLICANT_COLUMNS.map((col) => csvEscape((a as Record<string, unknown>)[col])).join(",")
  );
  // UTF-8 BOM 으로 엑셀 한글 깨짐 방지
  const csvContent = "﻿" + [headerLine, ...rows].join("\r\n");

  const counts: Record<string, number> = {
    applicants: applicants.length,
    evaluations: evaluations.length,
    interviewSlots: interviewSlots.length,
    commonQuestions: commonQuestions.length,
    finalQuestions: finalQuestions.length,
    notificationLogs: notificationLogs.length,
  };

  return {
    jsonContent,
    csvContent,
    timestamp: kstTimestamp(),
    counts,
  };
}
