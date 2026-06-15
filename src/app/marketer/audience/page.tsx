"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AudiencePageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/marketer/campaigns?tab=audience");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-4" />
      <p className="text-gray-500">Redirecting to Campaigns & Audiences...</p>
    </div>
  );
}
