import { AuditDashboard } from "@/components/audit-dashboard";
import { Toaster } from "@/components/ui/sonner";
import { createStandaloneBridge } from "@/lib/bridge";
import { standaloneFixture } from "@/lib/standalone-fixture";

const standaloneBridge = createStandaloneBridge();

export function App() {
  return (
    <>
      <AuditDashboard snapshot={standaloneFixture} bridge={standaloneBridge} />
      <Toaster position="bottom-right" />
    </>
  );
}
