import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { normalizePhone, normalizeEmail, normalizeName, normalizeStudentId, isValidEmail, isValidPhone } from "@/lib/normalize";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, phone, birthDate, email, address, gender,
      studentId, grade, major, gpa, subMajor, graduationPlan,
      careers,
      essay1, essay2, essay3, essay4,
    } = body;

    const required = { name, phone, birthDate, email, gender, studentId, grade, major, gpa, essay1, essay2, essay3, essay4 };
    for (const [key, val] of Object.entries(required)) {
      if (!val || !String(val).trim()) {
        return NextResponse.json({ error: `${key} 필드가 누락되었습니다.` }, { status: 400 });
      }
    }

    const cleanName = normalizeName(name);
    const cleanEmail = normalizeEmail(email);
    const cleanPhone = normalizePhone(phone);
    const cleanStudentId = normalizeStudentId(studentId);

    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json({ error: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
    }
    if (!isValidPhone(cleanPhone)) {
      return NextResponse.json({ error: "전화번호 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const applicant = await prisma.applicant.create({
      data: {
        name: cleanName, phone: cleanPhone, birthDate, email: cleanEmail, address: address || null, gender,
        studentId: cleanStudentId, grade, major, gpa,
        subMajor: subMajor || null,
        graduationPlan: graduationPlan || null,
        careers: JSON.stringify(careers ?? []),
        essay1, essay2, essay3, essay4,
        // stage defaults to SUBMITTED via schema default
      },
    });

    try {
      await sendEmail({ to: cleanEmail, name: cleanName, type: "RECEIPT" });
      await prisma.notificationLog.create({
        data: { applicantId: applicant.id, type: "RECEIPT", channel: "email", success: true },
      });
    } catch (emailErr) {
      console.error("[RECEIPT EMAIL ERROR]", emailErr);
      await prisma.notificationLog.create({
        data: { applicantId: applicant.id, type: "RECEIPT", channel: "email", success: false },
      });
    }

    return NextResponse.json({ id: applicant.id }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
