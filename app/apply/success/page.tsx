export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">지원서가 접수되었습니다</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            HYFIN에 지원해 주셔서 감사합니다.<br />
            접수 확인 이메일을 발송해 드렸습니다.<br />
            서류 심사 결과는 이메일로 안내드릴 예정입니다.
          </p>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
            문의: hyu.hyfin@gmail.com
          </div>
        </div>
      </div>
    </div>
  );
}
