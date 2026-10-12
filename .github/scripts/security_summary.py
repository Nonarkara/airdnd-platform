#!/usr/bin/env python3
"""Build a report-only security summary. Never prints secret values."""

from __future__ import annotations

import copy
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

SEVERITIES = ("CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN")
SEVERITY_RANK = {name: i for i, name in enumerate(SEVERITIES)}

SEMGREP_SEVERITY = {
    "CRITICAL": "CRITICAL",
    "ERROR": "HIGH",
    "HIGH": "HIGH",
    "WARNING": "MEDIUM",
    "MEDIUM": "MEDIUM",
    "INFO": "LOW",
    "LOW": "LOW",
}

# Known credential shapes. Applied to every string we keep. Generic long
# base64 is intentionally omitted so package hashes are not destroyed.
TOKEN_RES = [
    re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}", re.I),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}", re.I),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bASIA[0-9A-Z]{16}\b"),
    re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}", re.I),
    re.compile(r"\bsk-[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bAIza[0-9A-Za-z\-_]{20,}\b"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}", re.I),
    re.compile(r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----"),
    re.compile(r"\b\d{8,12}:[A-Za-z0-9_-]{30,}\b"),
    re.compile(r"(?i)\b(npm_[A-Za-z0-9]{20,}|sbp_[A-Za-z0-9]{20,}|rk_live_[A-Za-z0-9]{10,})"),
    re.compile(
        r"(?i)\b(password|passwd|secret|api[_-]?key|access[_-]?key|token|session)\b"
        r"\s*[:=]\s*['\"]?[^\s'\"]{6,}"
    ),
]

SECRET_RULE_RE = re.compile(
    r"(secrets?(?:\.|$)|detected-(?:generic-)?secret|hardcoded[-_.]|"
    r"private[-_]?key|api[-_]?key|aws[-_]?access|github[-_]?(?:pat|token)|"
    r"credential|passwd)",
    re.I,
)

DROP_STRING_KEYS = {
    "match",
    "lines",
    "fixed_lines",
    "metavars",
    "dataflow_trace",
    "code",
    "abstract_content",
    "fingerprint",
    "raw",
}


def scrub(text: str) -> str:
    if not text:
        return ""
    cleaned = str(text)
    for pattern in TOKEN_RES:
        cleaned = pattern.sub("[redacted]", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def is_secret_rule(rule_id: str, metadata: dict | None = None) -> bool:
    rule = rule_id or ""
    if SECRET_RULE_RE.search(rule):
        return True
    md = metadata or {}
    blob = " ".join(
        str(md.get(key) or "")
        for key in ("category", "subcategory", "subcategories", "product", "technology", "owasp")
    )
    if re.search(r"secret", blob, re.I):
        return True
    cwe = md.get("cwe") or []
    if isinstance(cwe, str):
        cwe = [cwe]
    return any("798" in str(item) for item in cwe)


def semgrep_severity(extra: dict) -> str:
    raw = str(extra.get("severity") or "").upper()
    mapped = SEMGREP_SEVERITY.get(raw, "UNKNOWN")
    metadata = extra.get("metadata") if isinstance(extra.get("metadata"), dict) else {}
    impact = str(metadata.get("impact") or "").upper()
    likelihood = str(metadata.get("likelihood") or "").upper()
    if mapped == "HIGH" and impact == "HIGH" and likelihood == "HIGH":
        return "CRITICAL"
    return mapped


def finding_location(path: str, line: int | None) -> str:
    path = path or "(unknown)"
    if line:
        return f"{path}:{line}"
    return path


def parse_semgrep(doc: dict) -> list[dict]:
    findings = []
    for result in doc.get("results") or []:
        extra = result.get("extra") if isinstance(result.get("extra"), dict) else {}
        metadata = extra.get("metadata") if isinstance(extra.get("metadata"), dict) else {}
        rule = str(result.get("check_id") or "semgrep")
        secret = is_secret_rule(rule, metadata)
        start = result.get("start") if isinstance(result.get("start"), dict) else {}
        line = start.get("line")
        message = "" if secret else scrub(str(extra.get("message") or ""))[:240]
        findings.append(
            {
                "source": "semgrep",
                "kind": "secret" if secret else "sast",
                "severity": semgrep_severity(extra),
                "path": str(result.get("path") or ""),
                "line": int(line) if isinstance(line, int) else None,
                "rule": rule,
                "message": message,
            }
        )
    return findings


def parse_trivy(doc: dict) -> list[dict]:
    findings = []
    for result in doc.get("Results") or []:
        target = str(result.get("Target") or "")
        for vuln in result.get("Vulnerabilities") or []:
            severity = str(vuln.get("Severity") or "UNKNOWN").upper()
            if severity not in SEVERITY_RANK:
                severity = "UNKNOWN"
            pkg = scrub(str(vuln.get("PkgName") or ""))
            installed = scrub(str(vuln.get("InstalledVersion") or ""))
            fixed = scrub(str(vuln.get("FixedVersion") or ""))
            title = scrub(str(vuln.get("Title") or ""))[:180]
            fix = f" fix {fixed}" if fixed else ""
            message = scrub(f"{title} ({pkg} {installed}{fix})".strip())[:240]
            findings.append(
                {
                    "source": "trivy",
                    "kind": "vuln",
                    "severity": severity,
                    "path": target,
                    "line": None,
                    "rule": str(vuln.get("VulnerabilityID") or vuln.get("PkgID") or "vuln"),
                    "message": message,
                }
            )
        for secret in result.get("Secrets") or []:
            severity = str(secret.get("Severity") or "HIGH").upper()
            if severity not in SEVERITY_RANK:
                severity = "HIGH"
            line = secret.get("StartLine")
            findings.append(
                {
                    "source": "trivy",
                    "kind": "secret",
                    "severity": severity,
                    "path": target,
                    "line": int(line) if isinstance(line, int) else None,
                    "rule": str(secret.get("RuleID") or secret.get("Category") or "secret"),
                    "message": "",
                }
            )
        for misconf in result.get("Misconfigurations") or []:
            status = str(misconf.get("Status") or "FAIL").upper()
            if status not in ("FAIL", "FAILURE"):
                continue
            severity = str(misconf.get("Severity") or "UNKNOWN").upper()
            if severity not in SEVERITY_RANK:
                severity = "UNKNOWN"
            cause = misconf.get("CauseMetadata") if isinstance(misconf.get("CauseMetadata"), dict) else {}
            line = cause.get("StartLine")
            title = scrub(str(misconf.get("Title") or misconf.get("Description") or ""))[:240]
            findings.append(
                {
                    "source": "trivy",
                    "kind": "misconfig",
                    "severity": severity,
                    "path": target,
                    "line": int(line) if isinstance(line, int) else None,
                    "rule": str(misconf.get("ID") or misconf.get("AVDID") or "misconfig"),
                    "message": title,
                }
            )
    return findings


def count_by_severity(findings: list[dict]) -> Counter:
    counts = Counter({name: 0 for name in SEVERITIES})
    for finding in findings:
        counts[finding["severity"]] += 1
    return counts


def redact_semgrep(doc: dict) -> dict:
    cleaned = copy.deepcopy(doc)
    for result in cleaned.get("results") or []:
        extra = result.get("extra") if isinstance(result.get("extra"), dict) else {}
        metadata = extra.get("metadata") if isinstance(extra.get("metadata"), dict) else {}
        rule = str(result.get("check_id") or "")
        secret = is_secret_rule(rule, metadata)
        if secret:
            for key in list(extra):
                if key.lower() in DROP_STRING_KEYS or key in ("message", "lines", "fixed_lines"):
                    extra.pop(key, None)
            extra["message"] = "Secret finding. Value omitted."
        else:
            if isinstance(extra.get("message"), str):
                extra["message"] = scrub(extra["message"])
            if isinstance(extra.get("lines"), str):
                extra["lines"] = scrub(extra["lines"])
            extra.pop("metavars", None)
            extra.pop("dataflow_trace", None)
        result["extra"] = extra
    return cleaned


def _scrub_tree(value, secret_context: bool = False):
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            if key == "Secrets":
                out[key] = [_scrub_tree(secret, True) for secret in (item or [])]
                continue
            if secret_context and (key.lower() in DROP_STRING_KEYS or key in ("Match", "Code")):
                continue
            if secret_context and key == "Title":
                out[key] = "Secret finding. Value omitted."
                continue
            out[key] = _scrub_tree(item, secret_context)
        return out
    if isinstance(value, list):
        return [_scrub_tree(item, secret_context) for item in value]
    if isinstance(value, str):
        return scrub(value)
    return value


def redact_trivy(doc: dict) -> dict:
    return _scrub_tree(copy.deepcopy(doc), False)


def markdown_table(counts: Counter) -> str:
    lines = ["| Severity | Count |", "| --- | ---: |"]
    for name in SEVERITIES:
        lines.append(f"| {name} | {counts[name]} |")
    lines.append(f"| Total | {sum(counts.values())} |")
    return "\n".join(lines)


def render_markdown(findings: list[dict], notes: list[str]) -> str:
    semgrep = [item for item in findings if item["source"] == "semgrep"]
    trivy = [item for item in findings if item["source"] == "trivy"]
    top = [
        item
        for item in findings
        if item["severity"] in ("CRITICAL", "HIGH")
    ]
    top.sort(key=lambda item: (SEVERITY_RANK[item["severity"]], item["source"], item["path"], item["rule"]))
    shown = top[:25]
    lines = [
        "## Security scan (report-only)",
        "",
        "GitHub code scanning is not available on this private personal repository "
        "(the code scanning API returns 403; GitHub Code Security is not enabled). "
        "Results are uploaded as workflow artifacts. Scans do not fail the job.",
        "",
        f"Semgrep OSS {os.environ.get('SEMGREP_VERSION', 'pinned')} · "
        f"Trivy {os.environ.get('TRIVY_VERSION', 'pinned')}",
        "",
        "### Semgrep",
        "",
        markdown_table(count_by_severity(semgrep)),
        "",
        "### Trivy",
        "",
        markdown_table(count_by_severity(trivy)),
        "",
    ]
    for kind in ("vuln", "secret", "misconfig"):
        subset = [item for item in trivy if item["kind"] == kind]
        if not subset and kind != "secret":
            continue
        lines.append(f"Trivy {kind}: {sum(count_by_severity(subset).values())}")
    lines.extend(["", "### Top critical and high findings", ""])
    if not shown:
        lines.append("No critical or high findings.")
    for item in shown:
        loc = finding_location(item["path"], item["line"])
        if item["kind"] == "secret":
            lines.append(
                f"- **{item['severity']}** `{loc}` `{item['rule']}` "
                f"({item['source']} secret; value omitted)"
            )
        else:
            detail = f" — {item['message']}" if item["message"] else ""
            lines.append(
                f"- **{item['severity']}** `{loc}` `{item['rule']}` "
                f"({item['source']} {item['kind']}){detail}"
            )
    if len(top) > len(shown):
        lines.append(f"- {len(top) - len(shown)} more critical/high findings are in the JSON artifact.")
    if notes:
        lines.extend(["", "### Scan notes", ""])
        lines.extend(f"- {note}" for note in notes)
    lines.append("")
    return "\n".join(lines)


def load_json(path: Path) -> tuple[dict | None, str | None]:
    if not path.exists():
        return None, f"{path.name} was not produced."
    try:
        return json.loads(path.read_text(encoding="utf-8")), None
    except json.JSONDecodeError:
        return None, f"{path.name} is not valid JSON."


def main() -> int:
    root = Path(os.environ.get("SECURITY_REPORT_DIR", "."))
    semgrep_path = Path(os.environ.get("SEMGREP_JSON", root / "semgrep.json"))
    trivy_path = Path(os.environ.get("TRIVY_JSON", root / "trivy.json"))
    summary_path = Path(os.environ.get("SUMMARY_MD", "security-summary.md"))
    findings_path = Path(os.environ.get("FINDINGS_JSON", "security-findings.json"))
    semgrep_redacted_path = Path(os.environ.get("SEMGREP_REDACTED", "semgrep.redacted.json"))
    trivy_redacted_path = Path(os.environ.get("TRIVY_REDACTED", "trivy.redacted.json"))

    notes = []
    findings: list[dict] = []

    semgrep_doc, semgrep_note = load_json(semgrep_path)
    if semgrep_note:
        notes.append(semgrep_note)
    elif semgrep_doc is not None:
        findings.extend(parse_semgrep(semgrep_doc))
        errors = semgrep_doc.get("errors") or []
        if errors:
            notes.append(f"Semgrep reported {len(errors)} file errors (timeouts or parse skips).")
        redacted = redact_semgrep(semgrep_doc)
        semgrep_redacted_path.write_text(json.dumps(redacted, indent=2) + "\n", encoding="utf-8")
        semgrep_path.unlink(missing_ok=True)

    trivy_doc, trivy_note = load_json(trivy_path)
    if trivy_note:
        notes.append(trivy_note)
    elif trivy_doc is not None:
        findings.extend(parse_trivy(trivy_doc))
        redacted = redact_trivy(trivy_doc)
        trivy_redacted_path.write_text(json.dumps(redacted, indent=2) + "\n", encoding="utf-8")
        trivy_path.unlink(missing_ok=True)

    for label, filename in (("Semgrep exit", "semgrep.exit"), ("Trivy outcome", "trivy.outcome")):
        path = root / filename
        if path.exists():
            value = path.read_text(encoding="utf-8").strip()
            notes.append(f"{label}: {value}")

    summary = render_markdown(findings, notes)
    summary_path.write_text(summary, encoding="utf-8")
    payload = {
        "counts": {
            "all": dict(count_by_severity(findings)),
            "semgrep": dict(count_by_severity([item for item in findings if item["source"] == "semgrep"])),
            "trivy": dict(count_by_severity([item for item in findings if item["source"] == "trivy"])),
        },
        "critical_high": [
            item for item in findings if item["severity"] in ("CRITICAL", "HIGH")
        ],
        "secrets": [item for item in findings if item["kind"] == "secret"],
    }
    findings_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a", encoding="utf-8") as handle:
            handle.write(summary)
    else:
        sys.stdout.write(summary)
    return 0


def self_test() -> None:
    secret = "ghp_" + "A" * 36
    telegram = "123456789:AA" + "b" * 35
    semgrep = {
        "results": [
            {
                "check_id": "generic.secrets.security.detected-github-pat",
                "path": "config/example.js",
                "start": {"line": 12},
                "extra": {
                    "severity": "ERROR",
                    "message": f"Found token {secret}",
                    "lines": f"const token = '{secret}'",
                    "metadata": {"category": "security", "cwe": "CWE-798"},
                    "metavars": {"$T": {"abstract_content": secret}},
                },
            },
            {
                "check_id": "javascript.express.security.audit.xss.mustache.escape",
                "path": "server.js",
                "start": {"line": 40},
                "extra": {
                    "severity": "ERROR",
                    "message": "User input rendered without escaping.",
                    "metadata": {"impact": "HIGH", "likelihood": "HIGH"},
                    "lines": "res.send(req.query.q)",
                },
            },
        ]
    }
    trivy = {
        "Results": [
            {
                "Target": "package-lock.json",
                "Vulnerabilities": [
                    {
                        "VulnerabilityID": "CVE-2026-0001",
                        "PkgName": "left-pad",
                        "InstalledVersion": "1.0.0",
                        "FixedVersion": "1.0.1",
                        "Severity": "HIGH",
                        "Title": "Prototype pollution",
                    }
                ],
            },
            {
                "Target": ".env",
                "Secrets": [
                    {
                        "RuleID": "telegram-bot-token",
                        "Category": "Telegram",
                        "Severity": "CRITICAL",
                        "Title": f"bot {telegram}",
                        "StartLine": 3,
                        "Match": telegram,
                        "Code": {"Lines": [{"Content": telegram}]},
                    }
                ],
            },
        ]
    }
    findings = parse_semgrep(semgrep) + parse_trivy(trivy)
    text = render_markdown(findings, [])
    redacted_s = json.dumps(redact_semgrep(semgrep))
    redacted_t = json.dumps(redact_trivy(trivy))
    blob = text + redacted_s + redacted_t + json.dumps(findings)
    for leaked in (secret, telegram):
        if leaked in blob:
            raise SystemExit(f"secret value leaked into report: {leaked[:6]}…")
    if "config/example.js:12" not in text or "generic.secrets.security.detected-github-pat" not in text:
        raise SystemExit("secret finding missing file:line or rule")
    if ".env:3" not in text or "telegram-bot-token" not in text:
        raise SystemExit("trivy secret missing file:line or rule")
    if "server.js:40" not in text or "CVE-2026-0001" not in text:
        raise SystemExit("non-secret findings missing")
    if "value omitted" not in text:
        raise SystemExit("secret findings should say the value was omitted")
    print("self-test ok")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    else:
        raise SystemExit(main())
