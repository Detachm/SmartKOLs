"use client";

import { useCallback, useEffect, useState } from "react";
import AccountNav from "@/components/layout/AccountNav";
import AccountReadinessStrip from "@/components/accounts/AccountReadinessStrip";
import { getAccountSurface, type BackendAccount } from "@/lib/live-api";
import { useParams } from "next/navigation";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const id = params.id as string;
  const [account, setAccount] = useState<BackendAccount | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    setAccountError(null);
    try {
      const surface = await getAccountSurface(id);
      setAccount(surface.account);
    } catch (cause) {
      setAccount(null);
      setAccountError(cause instanceof Error ? cause.message : "加载账号资料失败");
    }
  }, [id]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  const avatarSeed = account?.handle.replace(/^@/, "") || account?.avatar_url || "smartkols";

  return (
    <div>
      {/* Account Header */}
      <div className="border-b border-[#E8E8E8] bg-[#F7F7F7]/90 backdrop-blur">
        <div className="px-6 pt-5 pb-0">
          <div className="flex items-center gap-3 mb-4">
            {account && (
              <>
                <img
                  src={account.avatar_url || `https://unavatar.io/twitter/${avatarSeed}`}
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`; }}
                  alt={account.display_name}
                  className="w-8 h-8 rounded-full bg-[#E8E8E8]"
                />
                <div>
                  <p className="text-[#111111] font-semibold text-sm">{account.display_name}</p>
                  <p className="text-[#999999] text-xs">{account.handle}</p>
                </div>
              </>
            )}
            {!account && !accountError ? (
              <div>
                <p className="text-[#111111] font-semibold text-sm">加载账号中...</p>
                <p className="text-[#999999] text-xs">{id.slice(0, 8)}</p>
              </div>
            ) : null}
            {accountError ? (
              <div>
                <p className="text-[#D93025] font-semibold text-sm">账号资料加载失败</p>
                <p className="text-[#999999] text-xs">{accountError}</p>
              </div>
            ) : null}
          </div>
          <div className="mb-4">
            <AccountReadinessStrip accountId={id} />
          </div>
          <AccountNav accountId={id} />
        </div>
      </div>

      <div className="p-8">{children}</div>
    </div>
  );
}
