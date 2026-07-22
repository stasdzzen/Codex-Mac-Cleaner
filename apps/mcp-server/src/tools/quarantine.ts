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
const LegacyOpaqueActionHandleSchema = OpaqueIdSchema.describe(
  "Поле previewToken содержит непрозрачный идентификатор действия (opaque action handle); секрет остаётся только на сервере; повтор с тем же operationId возвращает прежний результат.",
);

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
    previewToken: LegacyOpaqueActionHandleSchema,
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
    previewToken: LegacyOpaqueActionHandleSchema,
    operationId: OpaqueIdSchema,
  })
  .strict();

export const QuarantineListInputSchema = z.object({}).strict();

export const QuarantineEntryInputSchema = z
  .object({ operationId: OpaqueIdSchema })
  .strict();

export const QuarantineConfirmedEntryInputSchema = z
  .object({
    operationId: OpaqueIdSchema,
    previewToken: LegacyOpaqueActionHandleSchema,
  })
  .strict();

export const QuarantinePrepareEntryOutputSchema = z
  .object({
    previewToken: LegacyOpaqueActionHandleSchema,
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
      "Повторно проверяет один объект после нажатия пользователя в окне проверки.",
    inputSchema: QuarantinePrepareMoveInputSchema,
    outputSchema: QuarantinePrepareMoveOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
  quarantine_move: {
    title: "Переместить в карантин",
    description:
      "Перемещает только один подтверждённый объект. Повтор того же запроса возвращает прежний результат.",
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
    description: "Повторно проверяет одну запись карантина перед восстановлением.",
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
    description: "Повторно проверяет одну запись перед необратимым удалением.",
    inputSchema: QuarantineEntryInputSchema,
    outputSchema: QuarantinePrepareEntryOutputSchema,
    annotations: { ...AppToolAnnotations, readOnlyHint: false },
    _meta: AppOnlyMeta,
  },
  quarantine_purge: {
    title: "Удалить из карантина навсегда",
    description: "Необратимо удаляет содержимое одной подтверждённой записи карантина.",
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
