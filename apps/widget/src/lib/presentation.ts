const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  cache: "кэш приложения",
  log: "журнал приложения",
  webkit: "веб-данные приложения",
  http_storage: "веб-хранилище приложения",
  saved_state: "сохранённое состояние приложения",
  application_support: "служебные данные приложения",
  container: "контейнер приложения",
  group_container: "общий контейнер приложения",
  preference: "настройки приложения",
  database: "база данных",
  sync_data: "данные синхронизации",
  vpn_data: "данные VPN",
  personal_file: "личные данные",
  autostart: "элемент автозапуска",
  unknown: "тип не определён",
};

const SUPPORT_LABELS: Readonly<Record<string, string>> = {
  candidate: "можно проверить и переместить в карантин",
  analysis_only: "только просмотр",
  unsupported_manual: "нужна ручная проверка",
};

const FINDING_LABELS: Readonly<Record<string, string>> = {
  active_required: "используется сейчас",
  idle_reproducible: "можно пересоздать при необходимости",
  orphaned: "остаток удалённого приложения",
  duplicate: "дубликат",
  unknown: "назначение не определено",
};

const CONFIDENCE_LABELS: Readonly<Record<string, string>> = {
  high: "высокая",
  medium: "средняя",
  low: "низкая",
};

const RISK_LABELS: Readonly<Record<string, string>> = {
  low: "низкий",
  medium: "средний",
  high: "высокий",
};

const TEMPORAL_LABELS: Readonly<Record<string, string>> = {
  current: "данные актуальны",
  stale: "данные могли устареть",
  unknown: "актуальность не подтверждена",
};

const PRESENCE_LABELS: Readonly<Record<string, string>> = {
  present: "обнаружено",
  absent: "не обнаружено",
  unknown: "не удалось проверить",
};

const REMOVAL_METHOD_LABELS: Readonly<Record<string, string>> = {
  quarantine: "переместить в карантин",
  official_uninstaller: "использовать официальное средство удаления",
  close_and_recheck: "закрыть приложение и проверить снова",
  advanced_mode: "проверить вручную в расширенном режиме",
  inspect_only: "только просмотреть",
};

const STARTUP_KIND_LABELS: Readonly<Record<string, string>> = {
  login_item: "запуск при входе",
  background_item: "фоновый элемент",
  launch_agent: "пользовательская служба запуска",
  launch_daemon: "системная служба запуска",
  unknown: "неизвестный элемент запуска",
};

const SENSITIVITY_LABELS: Readonly<Record<string, string>> = {
  credentials: "учётные данные",
  tokens: "ключи доступа",
  subscription_url: "адрес подписки",
  personal_data: "личные данные",
  database: "база данных",
  local_project: "локальный проект",
};

const RECLAIM_BASIS_LABELS: Readonly<Record<string, string>> = {
  observed_physical_size: "размер на диске во время проверки",
  allocated_blocks: "занятые блоки файловой системы",
  metadata_only: "только сведения о файле",
  unknown: "недостаточно данных",
};

const RECLAIM_LIMITATION_LABELS: Readonly<Record<string, string>> = {
  snapshot_estimate: "оценка сделана по снимку состояния",
  apfs_shared_blocks: "файловая система macOS может совместно использовать место",
  stale_observation: "наблюдение могло устареть",
  metadata_only: "доступны только сведения о файле",
  unknown: "есть неизвестные ограничения",
};

const EVIDENCE_INPUT_LABELS: Readonly<Record<string, string>> = {
  owner: "владелец объекта",
  activity: "активность приложения",
  receipt: "сведения об установке",
  dependency: "зависимости",
  temporal: "актуальность данных",
  data_kind: "тип данных",
  capability: "доступность проверки",
};

const EVIDENCE_SOURCE_LABELS: Readonly<Record<string, string>> = {
  application_inventory: "список установленных приложений",
  user_library_artifacts: "пользовательская библиотека",
  process_activity: "запущенные процессы",
  open_files: "открытые файлы",
  startup_items: "элементы автозапуска",
  package_receipts: "сведения установщика macOS",
  protected_containers: "защищённые контейнеры",
  filesystem_metadata: "сведения файловой системы",
};

const EVIDENCE_OUTCOME_LABELS: Readonly<Record<string, string>> = {
  confirmed: "подтверждено",
  contradicted: "не подтверждено",
  unknown: "не удалось проверить",
};

const ARTIFACT_KIND_LABELS: Readonly<Record<string, string>> = {
  file: "файл",
  directory: "папка",
  bundle: "приложение или пакет",
  plist: "настройки macOS",
  launch_item: "элемент автозапуска",
  receipt: "сведения установщика",
  unknown: "объект неизвестного типа",
};

const EXCLUSION_REASON_LABELS: Readonly<Record<string, string>> = {
  user_choice: "оставить по моему выбору",
  false_positive: "объект определён ошибочно",
  keep_data: "сохранить данные",
  other: "другая причина",
};

const BLOCKING_REASON_LABELS: Readonly<Record<string, string>> = {
  POLICY_RISK_CATEGORY: "категория требует ручной проверки",
  SYSTEM_SCOPE_UNSUPPORTED: "системная область не поддерживается в этой версии",
  POLICY_CORRELATION_REVISION_REQUIRED: "нужно завершить новую проверку",
  POLICY_CORRELATION_BINDING_MISMATCH: "не удалось надёжно подтвердить владельца",
  POLICY_REQUIREMENT_PROFILE_UNSUPPORTED: "этот тип объекта пока не поддерживается",
  POLICY_CORRELATION_SNAPSHOT_STALE: "данные изменились во время проверки",
  POLICY_CLASSIFICATION_EVIDENCE_MISMATCH: "классификация не совпала с доказательствами",
  POLICY_SUPPORT_LEVEL_MISMATCH: "уровень поддержки не подтверждён",
  POLICY_SUPPORT_LEVEL: "для объекта доступен только просмотр",
  POLICY_UNKNOWN_CATEGORY: "тип данных не определён",
  POLICY_ANALYSIS_ONLY_CATEGORY: "для этой категории доступен только просмотр",
  POLICY_SENSITIVE_DATA: "обнаружены потенциально личные или секретные данные",
  POLICY_CLASSIFICATION_NOT_ACTIONABLE: "недостаточно доказательств для безопасного действия",
  POLICY_OWNER_IDENTITY_MISSING: "не удалось определить владельца объекта",
  POLICY_OWNER_MISMATCH: "владелец объекта не совпал с ожидаемым",
  POLICY_TARGET_MISSING: "объект больше не найден",
  POLICY_TARGET_EXISTENCE_UNKNOWN: "не удалось подтвердить существование объекта",
  POLICY_INSTALLED_OWNER_PRESENT: "приложение-владелец всё ещё установлено",
  POLICY_INSTALLED_STATE_UNKNOWN: "не удалось проверить, установлено ли приложение",
  POLICY_OWNER_EXECUTABLE_PRESENT: "исполняемый файл владельца всё ещё существует",
  POLICY_OWNER_EXECUTABLE_UNKNOWN: "не удалось проверить исполняемый файл владельца",
  POLICY_ACTIVE_PROCESS: "приложение или связанный процесс сейчас запущен",
  POLICY_ACTIVITY_UNKNOWN: "не удалось проверить активные процессы",
  POLICY_OPEN_FILE: "объект используется открытым файлом",
  POLICY_OPEN_FILE_UNKNOWN: "не удалось проверить открытые файлы",
  POLICY_STARTUP_TARGET_PRESENT: "объект используется автозапуском",
  POLICY_STARTUP_TARGET_UNKNOWN: "не удалось проверить автозапуск",
  POLICY_RECEIPT_PRESENT: "установщик macOS считает приложение установленным",
  POLICY_RECEIPT_UNKNOWN: "не удалось проверить сведения установщика",
  POLICY_OFFICIAL_UNINSTALLER_REQUIRED: "нужно использовать официальное средство удаления",
  POLICY_OFFICIAL_UNINSTALLER_UNKNOWN: "не удалось найти официальное средство удаления",
  POLICY_DEPENDENCY_PRESENT: "объект нужен другой установленной программе",
  POLICY_DEPENDENCY_UNKNOWN: "не удалось проверить зависимости",
  POLICY_STALE_EVIDENCE: "данные проверки устарели",
  POLICY_TEMPORAL_UNKNOWN: "не удалось подтвердить актуальность данных",
  POLICY_DATA_KIND_UNKNOWN: "тип данных не удалось безопасно определить",
  POLICY_CAPABILITY_MISSING: "не все необходимые источники доступны",
  POLICY_USER_EXCLUSION_MATCHED: "объект добавлен в пользовательские исключения",
  POLICY_EXCLUSION_STATE_INVALID: "состояние исключения повреждено или устарело",
  POLICY_NON_QUARANTINE_REMOVAL_METHOD: "для объекта нужен другой способ удаления",
  POLICY_STALE_FINGERPRINT: "объект изменился после проверки",
  PROTECTED_SCOPE: "объект находится в защищённой области",
  SYMLINK_BOUNDARY: "путь ведёт через ссылку на другую папку",
  PATH_OWNER_MISMATCH: "владелец файла изменился",
};

function translated(value: string, labels: Readonly<Record<string, string>>, fallback: string): string {
  return labels[value] ?? fallback;
}

export const categoryLabel = (value: string): string =>
  translated(value, CATEGORY_LABELS, "тип не определён");

export const supportLevelLabel = (value: string): string =>
  translated(value, SUPPORT_LABELS, "доступность действия не определена");

export const findingLabel = (value: string): string =>
  translated(value, FINDING_LABELS, "назначение не определено");

export const confidenceLabel = (value: string): string =>
  translated(value, CONFIDENCE_LABELS, "не определена");

export const riskLabel = (value: string): string =>
  translated(value, RISK_LABELS, "не определён");

export const temporalLabel = (value: string): string =>
  translated(value, TEMPORAL_LABELS, "актуальность не подтверждена");

export const presenceLabel = (value: string): string =>
  translated(value, PRESENCE_LABELS, "не удалось проверить");

export const removalMethodLabel = (value: string): string =>
  translated(value, REMOVAL_METHOD_LABELS, "только просмотреть");

export const startupKindLabel = (value: string): string =>
  translated(value, STARTUP_KIND_LABELS, "неизвестный элемент запуска");

export const sensitivityLabel = (value: string): string =>
  translated(value, SENSITIVITY_LABELS, "чувствительные данные");

export const reclaimBasisLabel = (value: string): string =>
  translated(value, RECLAIM_BASIS_LABELS, "недостаточно данных");

export const reclaimLimitationLabel = (value: string): string =>
  translated(value, RECLAIM_LIMITATION_LABELS, "есть неизвестные ограничения");

export const evidenceInputLabel = (value: string): string =>
  translated(value, EVIDENCE_INPUT_LABELS, "дополнительная проверка");

export const evidenceSourceLabel = (value: string): string =>
  translated(value, EVIDENCE_SOURCE_LABELS, "локальный источник macOS");

export const evidenceOutcomeLabel = (value: string): string =>
  translated(value, EVIDENCE_OUTCOME_LABELS, "не удалось проверить");

export const evidenceSummary = (value: string): string => {
  const subject = evidenceInputLabel(value);
  return `Проверено: ${subject}.`;
};

export const artifactKindLabel = (value: string): string =>
  translated(value, ARTIFACT_KIND_LABELS, "объект неизвестного типа");

export const exclusionReasonLabel = (value: string): string =>
  translated(value, EXCLUSION_REASON_LABELS, "другая причина");

export const quarantineStateLabel = (value: string): string =>
  value === "moved" ? "в карантине" : "состояние не определено";

export function blockingReasonLabel(value: string): string {
  const mapped = BLOCKING_REASON_LABELS[value];
  if (mapped !== undefined) return mapped;
  return /[А-Яа-яЁё]/u.test(value)
    ? value
    : "действие заблокировано проверкой безопасности";
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "дата не указана" : DATE_TIME_FORMATTER.format(date);
}
