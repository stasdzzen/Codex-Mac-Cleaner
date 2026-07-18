import type { QuarantineController } from "./move.js";
import type { PreviewToken } from "./preview-token.js";
import type { QuarantineActionResult } from "./summary.js";

export interface PreparePurgeInput {
  readonly operationId: string;
  readonly uiSessionId: string;
}

export interface PurgeQuarantineEntryInput extends PreparePurgeInput {
  readonly token: string;
}

export async function preparePurge(
  controller: QuarantineController,
  input: PreparePurgeInput,
): Promise<PreviewToken> {
  return controller.preparePurge(input);
}

export async function purgeQuarantineEntry(
  controller: QuarantineController,
  input: PurgeQuarantineEntryInput,
): Promise<QuarantineActionResult> {
  return controller.purgeQuarantineEntry(input);
}
