import { redirect } from 'next/navigation';

/**
 * The Shareables library now lives in the app as the `shareables` step.
 * This route only exists so earlier /shareables links keep working.
 * Server-side redirect: a full document load, so the app boots with the
 * step applied (a client-side router.replace raced the boot sequence and
 * could land on the splash page instead).
 */
export default function ShareablesRedirectPage() {
  redirect('/?step=shareables');
}
