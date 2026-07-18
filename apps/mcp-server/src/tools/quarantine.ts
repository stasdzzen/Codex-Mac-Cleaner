import {
  DiskObservationSchema,
  IsoDateTimeSchema,
  ModelSafeTextSchema,
  OpaqueIdSchema,
  ReclaimEstimateSchema,
  SafeIntegerSchema,
  StorageSummarySchema,
} from "@codex-mac-cleaner/contracts";
import { z } from "zod";

const AppOnlyMeta = { ui: { visibility: ["app"] } } as const;
const AppToolAnnotations = {
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
} as const;

export const QuarantineEntryModelSchema = z
  .object({
    quarantineEntryId: OpaqueIdSchema,
    displayName: ModelSafeTextSchema.max(160),
    physicalBytes: SafeIntegerSchema,
    movedAt: IsoDateTimeSchema,
    state: z.enum(["moved", "restored", "purged"]),
  })
  .strict();

const QuarantineSnapshotShape = {
  storageSummary: StorageSummarySchema,
  diskObservation: DiskObservationSchema,
  stateVersion: SafeIntegerSchema,
};

export const QuarantinePrepareMoveInputSchema = z
  .object({
    findingId: OpaqueIdSchema,
    auditRevision: SafeIntegerSchema.min(1),
  })
  .strict();

export const QuarantinePrepareMoveOutputSchema = z
  .object({
    previewToken: OpaqueIdSchema,
    expiresAt: IsoDateTimeSchema,
    findingId: OpaqueIdSchema,
    auditRevision: SafeIntegerSchema.min(1),
    displayName: ModelSafeTextSchema.max(160),
    reclaimEstimate: ReclaimEstimateSchema,
    stateVersion: SafeIntegerSchema,
  })
  .strict();

export const QuarantineMoveInputSchema = z
  .object({
    previewToken: OpaqueIdSchema,
    operationId: OpaqueIdSchema,
  })
  .strict();

export const QuarantineListInputSchema = z.object({}).strict();

export const QuarantineEntryInputSchema = z
  .object({ quarantineEntryId: OpaqueIdSchema })
  .strict();

export const QuarantineConfirmedEntryInputSchema = z
  .object({
    quarantineEntryId: OpaqueIdSchema,
    previewToken: OpaqueIdSchema,
  })
  .strict();

export const QuarantinePrepareEntryOutputSchema = z
  .object({
    previewToken: OpaqueIdSchema,
    expiresAt: IsoDateTimeSchema,
    quarantineEntry: QuarantineEntryModelSchema,
    stateVersion: SafeIntegerSchema,
  })
  .strict();

export const QuarantineActionOutputSchema = z
  .object({
    quarantineEntry: QuarantineEntryModelSchema,
    ...QuarantineSnapshotShape,
  })
  .strict();

export const QuarantineListOutputSchema = z
  .object({
    quarantineEntries: z.array(QuarantineEntryModelSchema),
    ...QuarantineSnapshotShape,
  })
  .strict();

export const APP_VISIBLE_QUARANTINE_TOOL_DEFINITIONS = {
  quarantine_prepare_move: {
    title: "Подготовить перемещение в карантин",
    description:
      "Подготавливает preview одного объекта после клика пользователя в Dashboard.",
    inputSchema: QuarantinePrepareMoveInputSchema,
    outputSchema: QuarantinePrepareMoveOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
  quarantine_move: {
    title: "Переместить в карантин",
    description:
      "Перемещает один подтверждённый объект по одноразовому preview token.",
    inputSchema: QuarantineMoveInputSchema,
    outputSchema: QuarantineActionOutputSchema,
    annotations: {
      ...AppToolAnnotations,
      readOnlyHint: false,
      destructiveHint: true,
    },
    _meta: AppOnlyMeta,
  },
  quarantine_list: {
    title: "Список карантина",
    description: "Возвращает безопасный список записей и серверные метрики.",
    inputSchema: QuarantineListInputSchema,
    outputSchema: QuarantineListOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: true },
    _meta: AppOnlyMeta,
  },
  quarantine_prepare_restore: {
    title: "Подготовить восстановление",
    description: "Подготавливает preview восстановления одной записи карантина.",
    inputSchema: QuarantineEntryInputSchema,
    outputSchema: QuarantinePrepareEntryOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
  quarantine_restore: {
    title: "Восстановить из карантина",
    description: "Восстанавливает одну подтверждённую запись без перезаписи.",
    inputSchema: QuarantineConfirmedEntryInputSchema,
    outputSchema: QuarantineActionOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
  quarantine_prepare_purge: {
    title: "Подготовить окончательное удаление",
    description: "Подготавливает preview необратимого удаления одной записи.",
    inputSchema: QuarantineEntryInputSchema,
    outputSchema: QuarantinePrepareEntryOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
  quarantine_purge: {
    title: "Удалить из карантина навсегда",
    description: "Необратимо удаляет один подтверждённый payload карантина.",
    inputSchema: QuarantineConfirmedEntryInputSchema,
    outputSchema: QuarantineActionOutputSchema,
    annotations: {
      ...AppToolAnnotations,
      readOnlyHint: false,
      destructiveHint: true,
    },
    _meta: AppOnlyMeta,
  },
} as const;

export type AppVisibleQuarantineToolName =
  keyof typeof APP_VISIBLE_QUARANTINE_TOOL_DEFINITIONS;

export interface QuarantineToolService {
  prepareMove(
    input: z.infer<typeof QuarantinePrepareMoveInputSchema>,
  ): Promise<z.infer<typeof QuarantinePrepareMoveOutputSchema>>;
  move(
    input: z.infer<typeof QuarantineMoveInputSchema>,
  ): Promise<z.infer<typeof QuarantineActionOutputSchema>>;
  list(
    input: z.infer<typeof QuarantineListInputSchema>,
  ): Promise<z.infer<typeof QuarantineListOutputSchema>>;
  prepareRestore(
    input: z.infer<typeof QuarantineEntryInputSchema>,
  ): Promise<z.infer<typeof QuarantinePrepareEntryOutputSchema>>;
  restore(
    input: z.infer<typeof QuarantineConfirmedEntryInputSchema>,
  ): Promise<z.infer<typeof QuarantineActionOutputSchema>>;
  preparePurge(
    input: z.infer<typeof QuarantineEntryInputSchema>,
  ): Promise<z.infer<typeof QuarantinePrepareEntryOutputSchema>>;
  purge(
    input: z.infer<typeof QuarantineConfirmedEntryInputSchema>,
  ): Promise<z.infer<typeof QuarantineActionOutputSchema>>;
}
