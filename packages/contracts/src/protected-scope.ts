import { z } from "zod";

import { ModelSafeTextSchema, OpaqueIdSchema } from "./common.js";

export const ProtectedScopeKindSchema = z.enum([
  "system_scope",
  "credential_store",
  "browser_profile",
  "personal_data",
  "current_project_root",
  "plugin_owned_state",
  "codex_state",
  "local_git_repository",
]);

export const ProtectedScopeEffectSchema = z.enum([
  "exclude_from_candidates",
  "block_mutation",
]);

export const ProtectedScopeRuleSchema = z
  .object({
    ruleId: OpaqueIdSchema,
    kind: ProtectedScopeKindSchema,
    effects: z
      .array(ProtectedScopeEffectSchema)
      .min(1)
      .refine((effects) => new Set(effects).size === effects.length, {
        message: "Эффекты protected scope не должны повторяться",
      })
      .readonly(),
    safeReason: ModelSafeTextSchema,
  })
  .strict()
  .readonly();

const UNIVERSAL_SCOPE_KINDS = ProtectedScopeKindSchema.options;

export const BUILT_IN_PROTECTED_SCOPE_RULES = Object.freeze(
  UNIVERSAL_SCOPE_KINDS.map((kind) =>
    ProtectedScopeRuleSchema.parse({
      ruleId: `PROTECT_${kind.toUpperCase()}`,
      kind,
      effects: ["exclude_from_candidates", "block_mutation"],
      safeReason: "Универсальная защищённая область",
    }),
  ),
);

export type ProtectedScopeRule = z.infer<typeof ProtectedScopeRuleSchema>;
