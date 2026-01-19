'use client';

export default function TestPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Test</h1>
        <p className="text-gray-600">테스트 페이지입니다</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">테스트 페이지</h2>
            <p className="text-gray-600">
              이 페이지는 테스트용으로 생성되었습니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
