import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export type EmailType = "RECEIPT" | "DOC_RESULT" | "INTERVIEW" | "FINAL_RESULT";

interface SendEmailOptions {
  to: string;
  name: string;
  type: EmailType;
  passed?: boolean;
  interviewDate?: string;
}

export async function sendEmail(options: SendEmailOptions) {
  const { to, name, type, passed, interviewDate } = options;
  const from = `${process.env.EMAIL_FROM_NAME ?? "HYFIN"} <${process.env.GMAIL_USER}>`;

  const templates: Record<EmailType, { subject: string; html: string }> = {
    RECEIPT: {
      subject: "[HYFIN] 지원서 접수 확인",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B3A6B;">HYFIN 지원서 접수 확인</h2>
          <p>${name} 님, 안녕하세요.</p>
          <p>HYFIN에 지원해 주셔서 감사합니다.<br/>
          지원서가 정상적으로 접수되었습니다.</p>
          <p>서류 심사 결과는 별도로 안내드릴 예정입니다.</p>
          <hr style="border-color: #eee;"/>
          <p style="color: #888; font-size: 12px;">본 메일은 발신 전용입니다. 문의: hyu.hyfin@gmail.com</p>
        </div>
      `,
    },
    DOC_RESULT: {
      subject: `[HYFIN] 서류 심사 결과 안내`,
      html: passed
        ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B3A6B;">HYFIN 서류 심사 결과</h2>
          <p>${name} 님, 안녕하세요.</p>
          <p>HYFIN 서류 심사 결과, <strong style="color:#16A34A;">합격</strong>하셨습니다. 🎉</p>
          <p>면접 일정은 추후 별도로 안내드릴 예정입니다.</p>
          <hr style="border-color: #eee;"/>
          <p style="color: #888; font-size: 12px;">본 메일은 발신 전용입니다. 문의: hyu.hyfin@gmail.com</p>
        </div>
      `
        : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B3A6B;">HYFIN 서류 심사 결과</h2>
          <p>${name} 님, 안녕하세요.</p>
          <p>아쉽게도 이번 HYFIN 서류 심사에서 <strong style="color:#DC2626;">불합격</strong>하셨습니다.</p>
          <p>귀한 시간을 내어 지원해 주셔서 감사합니다.<br/>다음에 더 좋은 인연으로 만날 수 있기를 바랍니다.</p>
          <hr style="border-color: #eee;"/>
          <p style="color: #888; font-size: 12px;">본 메일은 발신 전용입니다. 문의: hyu.hyfin@gmail.com</p>
        </div>
      `,
    },
    INTERVIEW: {
      subject: "[HYFIN] 면접 안내",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B3A6B;">HYFIN 면접 안내</h2>
          <p>${name} 님, 안녕하세요.</p>
          <p>면접 일정을 안내드립니다.</p>
          <div style="background:#F4F5F7; padding:16px; border-radius:8px; margin:16px 0;">
            <strong>면접 일시:</strong> ${interviewDate ?? "추후 안내"}
          </div>
          <p>궁금하신 사항은 hyu.hyfin@gmail.com으로 문의해 주세요.</p>
          <hr style="border-color: #eee;"/>
          <p style="color: #888; font-size: 12px;">본 메일은 발신 전용입니다.</p>
        </div>
      `,
    },
    FINAL_RESULT: {
      subject: "[HYFIN] 최종 합격 결과 안내",
      html: passed
        ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B3A6B;">HYFIN 최종 합격 결과</h2>
          <p>${name} 님, 안녕하세요.</p>
          <p>HYFIN의 <strong style="color:#16A34A;">최종 합격</strong>을 진심으로 축하드립니다! 🎉</p>
          <p>오리엔테이션 일정 등 추후 일정은 별도로 안내드릴 예정입니다.</p>
          <hr style="border-color: #eee;"/>
          <p style="color: #888; font-size: 12px;">본 메일은 발신 전용입니다. 문의: hyu.hyfin@gmail.com</p>
        </div>
      `
        : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B3A6B;">HYFIN 최종 결과 안내</h2>
          <p>${name} 님, 안녕하세요.</p>
          <p>아쉽게도 이번 HYFIN 최종 면접에서 <strong style="color:#DC2626;">불합격</strong>하셨습니다.</p>
          <p>면접에 참여해 주셔서 진심으로 감사드립니다.<br/>앞으로의 활동에 응원을 보냅니다.</p>
          <hr style="border-color: #eee;"/>
          <p style="color: #888; font-size: 12px;">본 메일은 발신 전용입니다. 문의: hyu.hyfin@gmail.com</p>
        </div>
      `,
    },
  };

  const { subject, html } = templates[type];

  await transporter.sendMail({ from, to, subject, html });
}
