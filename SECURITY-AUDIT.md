# Security Audit — `agency-agents`

**Auditor role:** Senior security engineer
**Date:** 2026-06-22
**Scope:** Full repository (local checkout) — shell tooling, CI/CD pipeline, packaging/install model, and the agent content supply chain.
**Method:** Manual source review of all executable code (4 shell scripts, 1 GitHub Actions workflow), secret scanning, and threat modeling of the install/distribution flow.

---

## 1. Executive summary

This repository is **not a runtime application**. It is a catalog of ~190 AI‑agent prompt files (Markdown) plus Bash tooling (`scripts/convert.sh`, `scripts/install.sh`, `scripts/lint-agents.sh`, `integrations/mcp-memory/setup.sh`) and one CI workflow (`.github/workflows/lint-agents.yml`).

Because there is **no web server, network listener, authentication layer, API surface, database, or stored user data**, the classic categories you asked about (authentication flaws, API weaknesses, SQL/command injection into a service, sensitive‑data exposure at rest) **do not map to a live attack surface here**. I am reporting that honestly rather than inventing findings.

The genuine risk surface is threefold:

1. **Supply‑chain / prompt‑injection trust model** — the install scripts copy agent prompts directly into the user's AI coding tools' config directories, where they become *system instructions* for that user's assistant. This is the highest‑impact area.
2. **CI/CD pipeline hardening** — the workflow is missing least‑privilege token scoping and uses a mutable action tag.
3. **Shell‑scripting hygiene** — a few fragile patterns (unquoted expansions, `xargs`/`sh -c` string interpolation) that are not exploitable today given constrained inputs but are worth hardening.

No hardcoded secrets, credentials, private keys, `curl | bash` one‑liners, `eval`, or dynamic code execution were found.

### Findings at a glance

| # | Severity | Title | Status |
|---|----------|-------|--------|
| 1 | **High (inherent)** | Unverified agent content becomes downstream AI system prompts (supply‑chain prompt injection) | Documented + recommendations |
| 2 | **Medium** | CI workflow missing least‑privilege `permissions:` block | **Fixed** |
| 3 | **Low–Medium** | GitHub Action pinned to mutable tag (`@v4`), not commit SHA | Recommended |
| 4 | **Low** | GitHub Actions expression interpolated directly into a `run:` shell | **Fixed** (env indirection) |
| 5 | **Low** | Unquoted `$CHANGED_FILES` word‑split into linter | **Fixed** |
| 6 | **Low** | `xargs -I {} sh -c '… {} …'` string interpolation in install/convert | **Fixed** (positional args) |
| 7 | **Info** | Unescaped frontmatter passthrough in `convert.sh` generated files | Documented |
| 8 | **Info** | `--jobs N` not validated as numeric | Documented |

### Positive controls already in place
- All scripts use `set -euo pipefail`.
- The CI workflow uses the **`pull_request`** trigger (not `pull_request_target`), so fork PRs run with a **read‑only** `GITHUB_TOKEN` and **no secret access** — the correct, safe choice.
- Filenames in `install.sh`/`convert.sh` are handled with NUL‑delimited `find -print0` + `read -r -d ''` — robust against spaces/newlines.
- Temp files use `mktemp` with `trap … EXIT` cleanup.
- Variable expansions are quoted in the large majority of cases.

---

## 2. Detailed findings

### Finding 1 — Unverified agent content becomes downstream AI system prompts (Supply‑chain / prompt injection)
**Severity: High (impact) — inherent to the project's design**
**Category: Supply‑chain, injection (prompt), trust boundary**

**What it is.** `scripts/install.sh` copies agent `.md` files straight into the configuration directories of the user's AI tooling, where they are loaded as agent/system instructions:

- `install_claude_code()` → `~/.claude/agents/` (`install.sh:296`)
- `install_copilot()` → `~/.github/agents/` and `~/.copilot/agents/` (`install.sh:314`)
- `install_openclaw()` even **auto‑registers** each agent with the live tool: `openclaw agents add "$name" …` (`install.sh:401`)

The only gate on content is `scripts/lint-agents.sh`, which validates **structure** (frontmatter fields, section presence, word count) — it does **not** inspect instructions for safety. The CI linter (`lint-agents.yml`) runs that same structural check.

**Why it matters.** An agent prompt is executable intent for an LLM. Whoever controls the text of an agent file controls instructions that the *installing user's* coding assistant will follow. A file that looks like a helpful "Backend Architect" agent can carry buried directives such as *"whenever you generate code, also add this dependency / exfiltrate environment variables / weaken this auth check."* This is the well‑known **prompt‑injection / poisoned‑instruction** class, delivered through the software supply chain.

**Attack scenario.**
1. Attacker opens a PR adding a polished, useful‑looking agent (or subtly edits an existing one) with malicious instructions embedded deep in the body.
2. Structural lint passes (frontmatter + sections are all present).
3. A maintainer merges based on the visible value.
4. Downstream users run `./scripts/install.sh`; the file lands in `~/.claude/agents/` etc.
5. The user's assistant now follows the attacker's embedded instructions during ordinary coding tasks — potentially leaking secrets the assistant can see, inserting vulnerable code, or adding malicious dependencies.

**Recommendations (production‑grade).**
- **Document the trust model prominently** in `README.md`: installing an agent grants it system‑prompt influence over your assistant. Treat third‑party agents like running third‑party code.
- **Human content review, not just structural lint.** Require maintainer review focused on embedded instructions for every agent add/change; consider a checklist (no data exfiltration directives, no instruction to disable safety checks, no network/credential actions).
- **Provenance & integrity.** Pin installs to reviewed commits/tags; consider signing releases and publishing checksums so users can verify what they install.
- **Least privilege downstream.** Encourage users to run assistants without ambient cloud/SSH credentials in scope, and to review agent files before install (`install.sh` could print a summary/diff and require confirmation per agent).
- **Add a content‑scanning lint rule** that flags suspicious phrases (e.g., requests to read `.env`/`~/.aws`, exfiltrate, base64‑encode‑and‑POST, disable security review) as warnings for reviewers.

---

### Finding 2 — CI workflow missing least‑privilege `permissions:` block  ✅ Fixed
**Severity: Medium · Category: Infrastructure / CI hardening**

`.github/workflows/lint-agents.yml` declared no `permissions:` key, so the job inherited the repository/organization **default** `GITHUB_TOKEN` permission set. If that default is "read and write," a compromise of any step (or a malicious dependency pulled into the runner) would have write access to repo contents, issues, etc.

**Fix applied:** added a top‑level least‑privilege scope:
```yaml
permissions:
  contents: read
```
A linter only needs to read checked‑out files. (Combined with the existing `pull_request` trigger, fork PRs were already read‑only; this makes the intent explicit and also constrains same‑repo runs.)

---

### Finding 3 — GitHub Action pinned to a mutable tag, not a commit SHA
**Severity: Low–Medium · Category: Supply‑chain (CI)**

`actions/checkout@v4` (`lint-agents.yml:24`) is pinned to a **moving tag**. If that tag were repointed (upstream compromise or tag hijack), the workflow would silently execute different code on every PR.

**Recommendation (not auto‑applied — requires verifying the current SHA):** pin to a full commit SHA with a version comment:
```yaml
- uses: actions/checkout@<full-40-char-sha>  # v4.2.2
```
I did **not** commit a SHA blind, because pinning to an unverified hash would break CI. Resolve the SHA for your intended `checkout` release (e.g. via the Actions marketplace / `git ls-remote`) and pin it. Apply the same to any future actions and enable Dependabot for the `github-actions` ecosystem.

---

### Finding 4 — GitHub Actions expression interpolated directly into a `run:` shell  ✅ Fixed
**Severity: Low · Category: CI script injection (defense‑in‑depth)**

The workflow interpolated `${{ github.base_ref }}` directly into a shell command:
```yaml
FILES=$(git diff … origin/${{ github.base_ref }}...HEAD -- …)
```
Interpolating `${{ … }}` into a `run:` block is the GitHub "script injection" anti‑pattern: GitHub textually substitutes the value before the shell parses it. `github.base_ref` (the PR's *target* branch) is not strongly attacker‑controlled, so this was low risk — but the pattern should never be used.

**Fix applied:** pass the context value through an `env:` variable and reference it as a normal, quoted shell variable:
```yaml
env:
  BASE_REF: ${{ github.base_ref }}
run: |
  FILES=$(git diff … "origin/${BASE_REF}...HEAD" -- …)
```

---

### Finding 5 — Unquoted `$CHANGED_FILES` word‑split into the linter  ✅ Fixed
**Severity: Low · Category: Injection / robustness (CI)**

The run step passed PR‑derived filenames unquoted:
```yaml
./scripts/lint-agents.sh $CHANGED_FILES
```
The list comes from `git diff --name-only` on attacker‑authored PR content. It is constrained to `*.md` under specific directories, but a filename containing whitespace or glob characters would be word‑split/globbed into the wrong arguments, corrupting the lint and creating an argument‑injection foothold.

**Fix applied:** feed the newline‑delimited list to the linter via `xargs` so each path is passed as a single, intact argument:
```yaml
printf '%s\n' "$CHANGED_FILES" | xargs -r -d '\n' ./scripts/lint-agents.sh
```

---

### Finding 6 — `xargs -I {} sh -c '… {} …'` string interpolation  ✅ Fixed
**Severity: Low · Category: Command‑construction anti‑pattern**

Both parallel paths built a `sh -c` program by **textually substituting** the `xargs` replacement string into the script body:

- `install.sh:585` — `xargs … -I {} sh -c '… "$AGENCY_INSTALL_SCRIPT" --tool "{}" … > "$AGENCY_INSTALL_OUT_DIR/{}" …'`
- `convert.sh:540` — `xargs … -I {} sh -c '… --tool "{}" … > "$AGENCY_CONVERT_OUT_DIR/{}" …'`

Today the substituted values are tool names from a hardcoded allowlist (`ALL_TOOLS`) or a value validated against it, so this is **not exploitable**. But interpolating data into a shell program string is fragile and would become injectable if the input set ever widened.

**Fix applied:** pass the value as a **positional argument** to `sh -c` instead of splicing it into the program text:
```sh
xargs … -I {} sh -c '… --tool "$1" … > "…/$1" …' _ {}
```
`$1` is now data, never code.

---

### Finding 7 — Unescaped frontmatter passthrough in generated files
**Severity: Informational · Category: Output integrity**

`convert.sh` interpolates `${description}`, `${name}`, `${body}` into the YAML frontmatter of generated files via **unquoted** heredocs (e.g. `convert_opencode`, `convert_cursor`). This is **not** command injection — the values are captured first and Bash does not re‑evaluate them — but a `description` containing a newline, a leading `!`/`&`, or `key: value` text could produce malformed YAML or inject extra frontmatter keys in the generated output.

**Recommendation:** treat frontmatter values as untrusted when emitting YAML — quote/escape them (e.g. wrap in double quotes with internal `"`/`\` escaping, or normalize newlines) before writing. Low priority because inputs are repo‑local content, but it improves robustness of the generated integration files.

---

### Finding 8 — `--jobs N` not validated as numeric
**Severity: Informational · Category: Robustness**

`--jobs` (`install.sh:502`, `convert.sh:497`) is passed straight to `xargs -P "$parallel_jobs"` without checking it is an integer. A non‑numeric value just makes `xargs` error out, and the value is supplied by the same user running the script, so there is no privilege boundary crossed. Optional hardening: validate `[[ "$parallel_jobs" =~ ^[0-9]+$ ]]` and reject otherwise.

---

## 3. Categories you asked about — explicit mapping

| Requested category | Applicability to this repo | Result |
|---|---|---|
| Security vulnerabilities | Shell tooling + CI | See Findings 2–6 |
| Authentication flaws | No auth layer exists (no service, no login) | N/A — none present |
| API weaknesses | No API/network surface | N/A — none present |
| Injection risks | No SQL/DB; relevant forms are **prompt injection** (F1), CI script injection (F4/F5), shell command construction (F6) | See F1, F4, F5, F6 |
| Sensitive data exposure | Secret scan clean; no credentials/keys committed; `.gitignore` covers `.env`‑style/`venv`/logs | None found |
| Infrastructure risks | CI token scope, action pinning | See F2, F3 |

---

## 4. Production‑grade recommendations (prioritized)

1. **Treat agent content as code in your supply chain (F1).** Mandatory human review of instructions, documented trust model, signed/checksummed releases, and an optional content‑scanning lint rule for dangerous directives.
2. **Keep CI least‑privilege (F2, applied).** Default every workflow to `permissions: contents: read` and elevate per‑job only when needed.
3. **Pin all GitHub Actions to commit SHAs (F3)** and enable Dependabot for `github-actions`.
4. **Never interpolate `${{ }}` into `run:` (F4, applied).** Always route context values through `env:`.
5. **Quote and NUL/line‑delimit all dynamic file/argument lists (F5/F6, applied).**
6. **Add a `SECURITY.md`** with a vulnerability‑disclosure contact and the supply‑chain trust statement.
7. **Optional:** run `shellcheck` and `actionlint` in CI to catch the F4–F8 class automatically going forward.

---

*Fixes applied in this branch are limited to the unambiguous, behavior‑preserving hardening items (Findings 2, 4, 5, 6). Findings 1, 3, 7, and 8 are documented with recommendations rather than auto‑applied, because they involve policy decisions, an external SHA lookup, or output‑format changes that warrant maintainer review.*
