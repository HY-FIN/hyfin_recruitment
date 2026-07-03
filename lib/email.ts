import nodemailer from "nodemailer";
import { getEmailTemplate, EmailType, EmailTemplateOptions } from "./emailTemplates";

const transporter = nodemailer.createTransport({
  service: "gmail",
  // 대량 발송 시 매번 새 SMTP 연결을 열지 않도록 커넥션 풀 사용 (Gmail 동시 연결 제한 대응)
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export type { EmailType };

interface SendEmailOptions extends EmailTemplateOptions {
  to: string;
  type: EmailType;
}

export async function sendEmail(options: SendEmailOptions) {
  const { to, type, ...templateOptions } = options;
  const from = `${process.env.EMAIL_FROM_NAME ?? "HYFIN"} <${process.env.GMAIL_USER}>`;
  const { subject, html } = getEmailTemplate(type, templateOptions);
  await transporter.sendMail({ from, to, subject, html });
}
