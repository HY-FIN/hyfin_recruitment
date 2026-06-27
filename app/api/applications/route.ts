import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, phone, birthDate, email, address,
      university, grade, major, gpa, subMajor, graduationPlan,
      careers,
      essay1, essay2, essay3, essay4,
    } = body;

    const required = { name, phone, birthDate, email, address, university, grade, major, gpa, essay1, essay2, essay3, essay4 };
    for (const [key, val] of Object.entries(required)) {
      if (!val || !String(val).trim()) {
        return NextResponse.json({ error: `${key} 필드가 누락되었습니다.` }, { status: 400 });
      }
    }

    const applicant = await prisma.applicant.create({
      data: {
        name, phone, birthDate, email, address,
        university, grade, major, gpa,
        subMajor: subMajor || null,
        graduationPlan: graduationPlan || null,
        careers: JSON.stringify(careers ?? []),
        essay1, essay2, essay3, essay4,
      },
    });

    // 접수 확인 이메일 발송 (비동기, 실패해도 응답은 성공)
    sendEmail({ to: email, name, type: "RECEIPT" })
      .then(() =>
        prisma.notificationLog.create({
          data: { applicantId: applicant.id, type: "RECEIPT", channel: "email", success: true },
        })
      )
      .catch((err) => {
        console.error("[RECEIPT EMAIL ERROR]", err);
        return prisma.notificationLog.create({
          data: { applicantId: applicant.id, type: "RECEIPT", channel: "email", success: false },
        });
      });

    return NextResponse.json({ id: applicant.id }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
