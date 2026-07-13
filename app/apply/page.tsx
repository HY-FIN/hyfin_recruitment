import { isApplicationClosed, APPLICATION_DEADLINE_LABEL } from "@/lib/deadline";
import ApplyForm from "./ApplyForm";

// 정적 프리렌더 시 마감 판정이 빌드 시점에 고정되는 것 방지
export const dynamic = "force-dynamic";

function ApplicationClosed() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-hyfin-blue text-white py-8">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-sm font-medium text-blue-200 mb-1">Hanyang University Finance Investment</p>
          <h1 className="text-3xl font-bold tracking-tight">HYFIN 8기 지원서</h1>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-20 flex justify-center">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center max-w-md w-full">
          <h2 className="text-xl font-bold text-gray-900 mb-3">서류 접수가 마감되었습니다</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            지원서 접수 기간이 종료되었습니다.
            <br />
            (마감: {APPLICATION_DEADLINE_LABEL})
          </p>
          <p className="text-sm text-gray-500 mt-4">
            관심 가져주셔서 감사합니다. 다음 리크루팅에서 만나요!
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  if (isApplicationClosed()) {
    return <ApplicationClosed />;
  }
  return <ApplyForm />;
}
