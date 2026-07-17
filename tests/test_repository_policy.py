from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / ".github/scripts/validate_repository.py"
SPEC = importlib.util.spec_from_file_location("validate_repository", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


class RepositoryPolicyTests(unittest.TestCase):
    def test_repository_contracts_are_valid(self) -> None:
        self.assertEqual(VALIDATOR.collect_errors(ROOT), [])

    def test_workflow_rejects_unpinned_or_third_party_actions(self) -> None:
        text = """permissions:\n  contents: read\nsteps:\n  - uses: vendor/action@v1\n"""
        errors = VALIDATOR.validate_workflow_text("workflow.yml", text)
        self.assertTrue(any("не принадлежит GitHub" in error for error in errors))
        self.assertTrue(any("не закреплён полным SHA" in error for error in errors))

    def test_workflow_accepts_pinned_github_action(self) -> None:
        text = """permissions:\n  contents: read\nsteps:\n  - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0\n"""
        self.assertEqual(VALIDATOR.validate_workflow_text("workflow.yml", text), [])

    def test_public_text_rejects_home_path(self) -> None:
        value = "/Users/" + "example-user" + "/Library/private"
        errors = VALIDATOR.validate_public_text("fixture.md", value)
        self.assertTrue(any("домашний путь macOS" in error for error in errors))

    def test_issue_contract_requires_bilingual_sections(self) -> None:
        body = """```cto-issue
schema: 1
dependencies: none
conflicts: none
touched_paths: docs/
risk: low
parallel_safety: safe
execution_profile: fast
```
"""
        errors = VALIDATOR.validate_issue_contract("CMC-99.md", body)
        self.assertTrue(any("английская часть" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
