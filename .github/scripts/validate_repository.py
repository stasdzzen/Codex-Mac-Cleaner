#!/usr/bin/env python3
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path, PurePosixPath, PureWindowsPath
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[2]

REQUIRED_FILES = (
    "AGENTS.md",
    "README.md",
    "LICENSE",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "SUPPORT.md",
    ".github/ISSUE_TEMPLATE/bug.yml",
    ".github/ISSUE_TEMPLATE/feature.yml",
    ".github/ISSUE_TEMPLATE/config.yml",
    ".github/pull_request_template.md",
    ".github/dependabot.yml",
    ".github/workflows/repository.yml",
    "docs/index.md",
    "docs/development/execution-contract.md",
    "docs/development/public-repository-policy.md",
    "docs/safety/safety-model.md",
    "docs/safety/threat-model.md",
)

TEXT_SUFFIXES = {
    ".json",
    ".js",
    ".jsx",
    ".md",
    ".mjs",
    ".py",
    ".sh",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}

ISSUE_KEYS = {
    "schema",
    "dependencies",
    "conflicts",
    "touched_paths",
    "risk",
    "parallel_safety",
    "execution_profile",
}
ENGLISH_SECTIONS = (
    "Goal",
    "Scope",
    "Acceptance criteria",
    "Verification",
    "Constraints",
)
RUSSIAN_SECTIONS = (
    "Цель",
    "Объём",
    "Критерии приёмки",
    "Проверка",
    "Ограничения",
)

ISSUE_BLOCK_RE = re.compile(r"```cto-issue[ \t]*\n(.*?)\n```", re.DOTALL)
LINK_RE = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
USES_RE = re.compile(r"^\s*-?\s*uses:\s*([^@\s]+)@([^\s#]+)", re.MULTILINE)
FULL_SHA_RE = re.compile(r"^[0-9a-f]{40}$")

PUBLIC_TEXT_RULES = (
    (re.compile(r"/Users/[A-Za-z0-9._-]+/"), "реальный домашний путь macOS"),
    (re.compile(r"/home/[A-Za-z0-9._-]+/"), "реальный домашний путь Linux"),
    (re.compile(r"[A-Za-z]:\\\\Users\\\\[A-Za-z0-9._-]+\\\\"), "реальный домашний путь Windows"),
    (re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"), "private key"),
    (re.compile(r"\bghp_[A-Za-z0-9]{20,}\b"), "GitHub token"),
    (re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b"), "GitHub fine-grained token"),
    (re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"), "API token"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "AWS access key"),
)

FORBIDDEN_TRACKED_NAMES = {
    ".DS_Store",
    ".env",
    ".env.local",
    "id_rsa",
    "id_ed25519",
}


def _repo_files(root: Path) -> tuple[Path, ...]:
    result = subprocess.run(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=root,
        check=True,
        capture_output=True,
    )
    return tuple(
        root / item.decode("utf-8")
        for item in result.stdout.split(b"\0")
        if item
    )


def validate_public_text(label: str, text: str) -> list[str]:
    errors: list[str] = []
    for pattern, description in PUBLIC_TEXT_RULES:
        if pattern.search(text):
            errors.append(f"{label}: обнаружен {description}")
    if "\x00" in text:
        errors.append(f"{label}: обнаружен NUL byte")
    return errors


def validate_workflow_text(label: str, text: str) -> list[str]:
    errors: list[str] = []
    if not re.search(r"^permissions:\s*$", text, re.MULTILINE):
        errors.append(f"{label}: отсутствует явный permissions block")
    if re.search(r"^\s*permissions:\s*write-all\s*$", text, re.MULTILINE):
        errors.append(f"{label}: write-all запрещён")
    if re.search(r"^\s*pull_request_target:\s*$", text, re.MULTILINE):
        errors.append(f"{label}: pull_request_target запрещён")
    if re.search(r"^\s*secrets:\s*inherit\s*$", text, re.MULTILINE):
        errors.append(f"{label}: secrets inherit запрещён")

    for action, reference in USES_RE.findall(text):
        if action.startswith("./"):
            continue
        if not action.startswith(("actions/", "github/")):
            errors.append(f"{label}: action {action} не принадлежит GitHub")
        if not FULL_SHA_RE.fullmatch(reference):
            errors.append(f"{label}: action {action} не закреплён полным SHA")
    return errors


def _safe_issue_path(value: str) -> bool:
    posix = PurePosixPath(value)
    windows = PureWindowsPath(value)
    return (
        bool(value)
        and not posix.is_absolute()
        and not windows.is_absolute()
        and not windows.drive
        and ".." not in posix.parts
        and ".." not in windows.parts
        and not any(marker in value for marker in "*?[]")
    )


def validate_issue_contract(label: str, text: str) -> list[str]:
    errors: list[str] = []
    blocks = ISSUE_BLOCK_RE.findall(text)
    if len(blocks) != 1:
        return [f"{label}: требуется ровно один cto-issue block"]

    metadata: dict[str, str] = {}
    for raw_line in blocks[0].splitlines():
        key, separator, value = raw_line.partition(":")
        key = key.strip()
        value = value.strip()
        if not separator or not key or not value or key in metadata:
            errors.append(f"{label}: некорректная metadata строка")
            continue
        metadata[key] = value

    if set(metadata) != ISSUE_KEYS:
        errors.append(f"{label}: неполный или неизвестный набор metadata keys")
        return errors
    if metadata["schema"] != "1":
        errors.append(f"{label}: поддерживается только schema 1")
    if metadata["risk"] not in {"low", "medium", "high"}:
        errors.append(f"{label}: неизвестный risk")
    if metadata["parallel_safety"] not in {"safe", "serial"}:
        errors.append(f"{label}: неизвестный parallel_safety")
    if metadata["execution_profile"] not in {"fast", "default", "deep"}:
        errors.append(f"{label}: неизвестный execution_profile")
    if metadata["risk"] == "high" and metadata["execution_profile"] == "fast":
        errors.append(f"{label}: high-risk Issue не может использовать fast")

    for field in ("dependencies", "conflicts"):
        value = metadata[field]
        if value != "none":
            references = [item.strip() for item in value.split(",")]
            if not references or any(not re.fullmatch(r"#[1-9][0-9]*", item) for item in references):
                errors.append(f"{label}: некорректные ссылки в {field}")
            if len(references) != len(set(references)):
                errors.append(f"{label}: дубли в {field}")

    touched_paths = [item.strip() for item in metadata["touched_paths"].split(";")]
    if any(not _safe_issue_path(item) for item in touched_paths):
        errors.append(f"{label}: небезопасный touched_path")
    if len(touched_paths) != len(set(touched_paths)):
        errors.append(f"{label}: touched_paths содержат дубли")

    if text.count("## English") != 1 or text.count("## Русский") != 1:
        errors.append(f"{label}: требуется английская часть и русское зеркало")
        return errors
    english_start = text.index("## English")
    russian_start = text.index("## Русский")
    if english_start >= russian_start:
        errors.append(f"{label}: нарушен порядок языковых секций")
        return errors
    english = text[english_start:russian_start]
    russian = text[russian_start:]
    english_headings = tuple(re.findall(r"^### (.+?)\s*$", english, re.MULTILINE))
    russian_headings = tuple(re.findall(r"^### (.+?)\s*$", russian, re.MULTILINE))
    if english_headings != ENGLISH_SECTIONS:
        errors.append(f"{label}: английские секции неканоничны")
    if russian_headings != RUSSIAN_SECTIONS:
        errors.append(f"{label}: русские секции неканоничны")
    return errors


def _visible_markdown(text: str) -> str:
    visible: list[str] = []
    inside_fence = False
    for line in text.splitlines():
        if line.startswith("```"):
            inside_fence = not inside_fence
            continue
        if not inside_fence:
            visible.append(line)
    return "\n".join(visible)


def validate_docs(root: Path) -> list[str]:
    errors: list[str] = []
    docs = root / "docs"
    taxonomy = (docs / "foundation/open-knowledge-format.md").read_text(encoding="utf-8")
    allowed_types = set(re.findall(r"^\* `([^`]+)`$", taxonomy, re.MULTILINE))

    for path in sorted(docs.rglob("*.md")):
        label = path.relative_to(root).as_posix()
        text = path.read_text(encoding="utf-8")
        if path.name not in {"index.md", "log.md"}:
            if not text.startswith("---\n"):
                errors.append(f"{label}: отсутствует frontmatter")
            else:
                end = text.find("\n---\n", 4)
                if end < 0:
                    errors.append(f"{label}: frontmatter не закрыт")
                else:
                    match = re.search(r"^type:\s*(.+?)\s*$", text[4:end], re.MULTILINE)
                    if not match:
                        errors.append(f"{label}: отсутствует type")
                    elif match.group(1).strip().strip("\"'") not in allowed_types:
                        errors.append(f"{label}: неизвестный type")
        if sum(line.startswith("```") for line in text.splitlines()) % 2:
            errors.append(f"{label}: незакрытый fenced block")

        for target in LINK_RE.findall(_visible_markdown(text)):
            target = target.strip().split(" ", 1)[0].strip("<>")
            if not target or target.startswith(("#", "http://", "https://", "mailto:")):
                continue
            relative = unquote(target.split("#", 1)[0].split("?", 1)[0])
            candidate = (path.parent / relative).resolve()
            try:
                candidate.relative_to(root)
            except ValueError:
                errors.append(f"{label}: ссылка выходит из репозитория: {target}")
                continue
            if not candidate.exists():
                errors.append(f"{label}: битая ссылка: {target}")
    return errors


def collect_errors(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    for relative in REQUIRED_FILES:
        path = root / relative
        if not path.is_file() or path.is_symlink():
            errors.append(f"{relative}: обязательный regular file отсутствует")

    files = _repo_files(root)
    for path in files:
        relative = path.relative_to(root).as_posix()
        if path.is_symlink():
            errors.append(f"{relative}: tracked symlink запрещён")
            continue
        if path.name in FORBIDDEN_TRACKED_NAMES or path.suffix in {".key", ".pem", ".p12"}:
            errors.append(f"{relative}: чувствительный тип файла запрещён")
        if path.suffix not in TEXT_SUFFIXES and path.name not in {"LICENSE", "Makefile"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError):
            errors.append(f"{relative}: текстовый файл не читается как UTF-8")
            continue
        errors.extend(validate_public_text(relative, text))

    for path in sorted((root / ".github/workflows").glob("*.y*ml")):
        errors.extend(validate_workflow_text(path.relative_to(root).as_posix(), path.read_text(encoding="utf-8")))
    for path in sorted((root / ".github/issue-specs").glob("CMC-*.md")):
        errors.extend(validate_issue_contract(path.relative_to(root).as_posix(), path.read_text(encoding="utf-8")))
    errors.extend(validate_docs(root))
    return errors


def main() -> int:
    errors = collect_errors()
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    issue_count = len(tuple((ROOT / ".github/issue-specs").glob("CMC-*.md")))
    docs_count = len(tuple((ROOT / "docs").rglob("*.md")))
    print(f"Repository contracts: OK — {issue_count} Issue specs, {docs_count} docs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
