import {
  BUILT_IN_PROTECTED_SCOPE_RULES,
  type ProtectedScopeRule,
} from "@codex-mac-cleaner/contracts";

export type ProtectedScopeKind = ProtectedScopeRule["kind"];

export const PROTECTED_SCOPE_REGISTRY: readonly ProtectedScopeRule[] =
  BUILT_IN_PROTECTED_SCOPE_RULES;

export function protectedRuleId(kind: ProtectedScopeKind): string {
  const rule = PROTECTED_SCOPE_REGISTRY.find((candidate) => candidate.kind === kind);
  if (rule === undefined) throw new Error("Неизвестный universal protected scope");
  return rule.ruleId;
}
