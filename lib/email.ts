import nodemailer from "nodemailer";
import type SMTPPool from "nodemailer/lib/smtp-pool";
import { getEmailTemplate, EmailType, EmailTemplateOptions } from "./emailTemplates";

// satisfies로 필드명 오타는 컴파일 에러로 잡으면서 pool + OAuth2 오버로드를 만족시킴
const transportOptions = {
  service: "gmail",
  // 대량 발송 시 매번 새 SMTP 연결을 열지 않도록 커넥션 풀 사용 (Gmail 동시 연결 제한 대응)
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  auth: {
    type: "OAuth2" as const,
    user: process.env.GMAIL_USER,
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_OAUTH_REFRESH_TOKEN,
  },
} satisfies SMTPPool.Options;

const transporter = nodemailer.createTransport(transportOptions);

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
