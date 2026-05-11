import { Suspense } from "react";
import LoginClientPage from "./page-client";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 overflow-auto bg-[#F7F7F7] p-4">
          <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center rounded-[28px] border border-[#E8E8E8] bg-white px-8 py-24 text-sm text-[#666666] shadow-[0_24px_80px_rgba(17,17,17,0.08)]">
            正在加载登录环境...
          </div>
        </div>
      }
    >
      <LoginClientPage />
    </Suspense>
  );
}
