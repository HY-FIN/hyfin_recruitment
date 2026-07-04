// 기존 applicant 레코드의 name/email/phone/studentId를 표준 정규화 규칙으로 백필한다.
// 실행법:
//   npx tsx scripts/backfill-normalize.ts --dry-run   (변경 예정만 출력)
//   npx tsx scripts/backfill-normalize.ts             (실제 UPDATE 수행)

import { PrismaClient } from "@prisma/client";
import { normalizeName, normalizeEmail, normalizePhone, normalizeStudentId } from "../lib/normalize";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(dryRun ? "[DRY RUN] 실제 변경 없음" : "[APPLY] 실제 UPDATE 수행");

  const applicants = await prisma.applicant.findMany({
    select: { id: true, name: true, email: true, phone: true, studentId: true },
  });

  let changed = 0;
  for (const a of applicants) {
    const cleanName = normalizeName(a.name);
    const cleanEmail = normalizeEmail(a.email);
    const cleanPhone = normalizePhone(a.phone);
    const cleanStudentId = normalizeStudentId(a.studentId);

    if (
      cleanName === a.name &&
      cleanEmail === a.email &&
      cleanPhone === a.phone &&
      cleanStudentId === a.studentId
    ) {
      continue;
    }

    changed++;
    console.log(`\n[${a.id}]`);
    if (cleanName !== a.name) console.log(`  name : "${a.name}" -> "${cleanName}"`);
    if (cleanEmail !== a.email) console.log(`  email: "${a.email}" -> "${cleanEmail}"`);
    if (cleanPhone !== a.phone) console.log(`  phone: "${a.phone}" -> "${cleanPhone}"`);
    if (cleanStudentId !== a.studentId) console.log(`  studentId: "${a.studentId}" -> "${cleanStudentId}"`);

    if (!dryRun) {
      await prisma.applicant.update({
        where: { id: a.id },
        data: { name: cleanName, email: cleanEmail, phone: cleanPhone, studentId: cleanStudentId },
      });
    }
  }

  console.log(`\n총 ${applicants.length}건 중 ${changed}건 ${dryRun ? "변경 예정" : "변경 완료"}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
