'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The Shareables library now lives in the app as the `shareables` step.
 * This route only exists so earlier /shareables links keep working.
 */
export default function ShareablesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?step=shareables');
  }, [router]);
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <p className="text-sm font-bold text-slate-500">
        Opening your Shareables library…
      </p>
    </div>
  );
}
