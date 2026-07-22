import { Badge } from "@/components/ui/badge";
import type { DashboardFinding } from "@/lib/dashboard-types";
import { supportLevelLabel } from "@/lib/presentation";

interface SupportLevelProps {
  readonly level: DashboardFinding["supportLevel"];
}

export function SupportLevel({ level }: SupportLevelProps) {
  const variant = level === "candidate" ? "secondary" : "outline";

  return <Badge variant={variant}>{supportLevelLabel(level)}</Badge>;
}
