export type EmailType = "RECEIPT" | "DOC_RESULT" | "INTERVIEW" | "FINAL_RESULT";

export interface EmailTemplateOptions {
  name: string;
  passed?: boolean;
  interviewDate?: string;
  interviewLocation?: string;
}

const INTERVIEW_TIME_URL = "https://hyfin-recruitment.vercel.app/interview-time";

export function getEmailTemplate(
  type: EmailType,
  options: EmailTemplateOptions
): { subject: string; html: string } {
  const { name, passed, interviewDate, interviewLocation } = options;

  const contactBlock = `<p style="color:#555; font-size:13px;">학회장: 한민우 (010-4588-9918)<br/>집행부장: 강이원 (010-2150-3016)</p>`;
  const footer = `<hr style="border-color: #eee;"/>
          <p style="color: #888; font-size: 12px;">문의 사항은 본 메일에 회신해 주시기 바랍니다.</p>`;

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
      subject: "[한양대학교 재무금융학회 HY-FIN] 서류 모집 결과 안내",
      html: passed
        ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B3A6B;">HY-FIN 서류 모집 결과 안내</h2>
          <p>안녕하세요, ${name} 지원자님.</p>
          <p>한양대학교 재무금융학회 HY-FIN입니다.<br/>2026학년도 2학기 HY-FIN 서류 모집 결과 안내드립니다.</p>
          <p>이번 8기 신입 학회원 모집에 지원해주셔서 감사합니다.<br/><strong style="color:#16A34A;">1차 서류 전형 합격</strong>을 진심으로 축하드립니다.</p>
          <p>면접은 8월 19일(수)부터 21일(금)까지 3일간 진행될 예정입니다.<br/>원활한 면접 일정 조율을 위해 아래 버튼을 눌러 <strong>면접 가능 시간</strong>을 선택해 주시기 바랍니다.</p>
          <div style="margin: 16px 0;">
            <a href="${INTERVIEW_TIME_URL}" style="background:#1B3A6B; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
              면접 가능 시간 선택하기
            </a>
          </div>
          <p style="color: #666; font-size: 13px;">또는 아래 링크를 직접 복사하여 브라우저에 붙여넣기 해주세요:<br/>
          <a href="${INTERVIEW_TIME_URL}">${INTERVIEW_TIME_URL}</a></p>
          <p>면접 가능 시간을 선택해 주시면 확정된 면접 일시와 장소를 추후 메일로 안내드리겠습니다.</p>
          ${contactBlock}
          <p>감사합니다.<br/>한양대학교 재무금융학회 HY-FIN 드림</p>
          ${footer}
        </div>
      `
        : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B3A6B;">HY-FIN 서류 모집 결과 안내</h2>
          <p>안녕하세요, ${name} 지원자님.</p>
          <p>경영대학 재무금융학회 HY-FIN 서류 모집 결과 안내드립니다.<br/>이번 8기 신입 학회원 모집에 지원해주셔서 감사합니다.</p>
          <p>이번 전형에는 예상보다 많은 지원자가 몰려 치열한 심사가 진행되었습니다.</p>
          <p>보내주신 지원서에서 훌륭한 지원자님의 기본기를 확인할 수 있었습니다. 다만 한정된 인원으로 인해 아쉽게도 이번 1차 전형에서는 함께하지 못하게 되었습니다.</p>
          <p>소중한 시간과 정성을 들여 지원해주셔서 진심으로 감사드립니다. 앞으로의 도전을 응원하겠습니다.</p>
          <p>한양대학교 재무금융학회 HY-FIN 드림</p>
          ${footer}
        </div>
      `,
    },
    INTERVIEW: {
      subject: "[한양대학교 재무금융학회 HY-FIN] 면접 일정 안내",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B3A6B;">HY-FIN 면접 일정 안내</h2>
          <p>안녕하세요, ${name} 지원자님.<br/>한양대학교 재무금융학회 HY-FIN입니다.</p>
          <p>8월 19일(수)부터 21일(금)까지 3일간 진행될 면접에 대해 안내드리고자 관련 내용 보내드립니다.</p>
          <div style="background:#F4F5F7; padding:16px; border-radius:8px; margin:16px 0; line-height:1.8;">
            <p style="margin:0;"><strong>면접 일시:</strong> ${interviewDate || "추후 안내"}</p>
            <p style="margin:0;"><strong>면접 장소:</strong> ${interviewLocation || "추후 안내"}</p>
          </div>
          <p>면접 시간 최소 5분 전까지 도착해주셔서 대기해주시면 세부 사항 안내드릴 예정입니다.</p>
          <div style="background:#FFF7ED; border-left:4px solid #F59E0B; padding:12px 16px; border-radius:4px; margin:16px 0;">
            <p style="margin:4px 0;">안내드린 면접 시간이 가능하시다면, <strong>금일 자정까지 본 메일로 회신</strong> 부탁드립니다.</p>
            <p style="margin:4px 0;">회신이 없을 시, 자동으로 합격이 취소될 예정입니다.</p>
            <p style="margin:4px 0;">안내드린 시간이 불가능할 경우에도 금일 자정까지 본 메일로 회신 부탁드립니다.</p>
          </div>
          <p>면접은 작성해주신 지원서를 기반으로 투자, 재무 및 금융과 관련된 공통 질문으로 진행될 예정입니다.</p>
          ${contactBlock}
          <p>감사합니다.<br/>HY-FIN 드림</p>
          ${footer}
        </div>
      `,
    },
    FINAL_RESULT: {
      subject: "[한양대학교 재무금융학회 HY-FIN] 최종 결과 안내",
      html: passed
        ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B3A6B;">HY-FIN 최종 결과 안내</h2>
          <p>안녕하세요, ${name} 지원자님.<br/>한양대학교 재무금융학회 HY-FIN입니다.</p>
          <p>먼저, HY-FIN을 선택해 주셔서 진심으로 감사드립니다.</p>
          <p>면접 결과, 지원자님께서 2026학년도 2학기 HY-FIN <strong style="color:#16A34A;">최종 합격자</strong>로 선정되었음을 안내드립니다.</p>
          <p>HY-FIN의 일원으로 함께하게 된 것을 진심으로 환영하며, 앞으로 우수한 학회원들과 함께 성장해 나가길 기대하겠습니다.</p>
          <div style="background:#FFF7ED; border-left:4px solid #F59E0B; padding:12px 16px; border-radius:4px; margin:16px 0;">
            <p style="margin:4px 0;">금학기 HY-FIN의 일원으로 활동 의사가 있으시다면, <strong>금일 자정까지(23:59) 본 메일로 활동 의사 회신</strong> 부탁드립니다.</p>
          </div>
          <p>다시 한 번 합격을 진심으로 축하드립니다.</p>
          ${contactBlock}
          <p>한양대학교 재무금융학회 HY-FIN 드림</p>
          ${footer}
        </div>
      `
        : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B3A6B;">HY-FIN 최종 결과 안내</h2>
          <p>안녕하세요, ${name} 지원자님.</p>
          <p>경영대학 재무금융학회 HY-FIN 2026학년도 2학기 모집 최종 결과 안내드립니다.<br/>이번 8기 신입 학회원 모집에 지원해주셔서 감사합니다.</p>
          <p>이번 면접 전형에는 예상보다 많은 지원자가 몰려 치열한 심사가 진행되었습니다.</p>
          <p>면접 과정을 통해 훌륭한 지원자님의 기본기를 확인할 수 있었습니다. 다만 한정된 인원으로 인해 아쉽게도 최종적으로 저희 학회와 함께하지 못하게 되었습니다.</p>
          <p>소중한 시간과 정성을 들여 지원해주셔서 진심으로 감사드립니다. 앞으로도 HY-FIN이 지원자님의 도전을 진심으로 응원하겠습니다.</p>
          <p>한양대학교 재무금융학회 HY-FIN 드림</p>
          ${footer}
        </div>
      `,
    },
  };

  return templates[type];
}
