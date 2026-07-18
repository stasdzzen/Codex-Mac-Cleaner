import type { QuarantineController } from "./move.js";
import type { PreviewToken } from "./preview-token.js";
import type { QuarantineActionResult } from "./summary.js";

export interface PrepareRestoreInput {
  readonly operationId: string;
  readonly uiSessionId: string;
}

export interface RestoreFromQuarantineInput extends PrepareRestoreInput {
  readonly token: string;
}

export async function prepareRestore(
  controller: QuarantineController,
  input: PrepareRestoreInput,
): Promise<PreviewToken> {
  return controller.prepareRestore(input);
}

export async function restoreFromQuarantine(
  controller: QuarantineController,
  input: RestoreFromQuarantineInput,
): Promise<QuarantineActionResult> {
  return controller.restoreFromQuarantine(input);
}
