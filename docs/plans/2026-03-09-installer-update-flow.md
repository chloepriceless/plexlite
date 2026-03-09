# DVhub Installer Update Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend `install.sh` so the same command automatically performs a fresh install or an update for an existing DVhub installation, and document the new behavior in the README.

**Architecture:** Keep the installer as a single Bash entrypoint, add explicit install/update mode detection around the existing Git checkout logic, preserve external config and data paths, and refresh service artifacts on every run. Update the README so installation and update behavior are described from the operator’s perspective.

**Tech Stack:** Bash, systemd, Git, npm, Markdown documentation

---

### Task 1: Add failing documentation tests by defining the expected update behavior in README wording

**Files:**
- Modify: `Plexlite/README.md`
- Modify: `Plexlite/install.sh`

**Step 1: Write the failing expectation**

Document these expectations before implementation:

```md
## Update

Der gleiche Installer-Befehl erkennt bestehende DVhub-Installationen automatisch
und führt dann ein Update aus.
```

**Step 2: Verify the current docs are missing it**

Run: `rg -n "^### Update|automatisch.*Update|gleiche Installer-Befehl" /Volumes/My\ Shared\ Files/CODEX/Plexlite/README.md`
Expected: no matching update section yet.

**Step 3: Write minimal implementation**

Add a dedicated update section and adjust the installation section so it explains the dual behavior.

**Step 4: Verify the docs now include it**

Run: `rg -n "^### Update|automatisch.*Update|gleiche Installer-Befehl" /Volumes/My\ Shared\ Files/CODEX/Plexlite/README.md`
Expected: matching lines in the README.

### Task 2: Add explicit install/update mode detection to the installer

**Files:**
- Modify: `Plexlite/install.sh`

**Step 1: Define the failing behavior with shell checks**

The script should expose clear mode variables and messages such as:

```bash
MODE="install"
if is_existing_dvhub_installation; then
  MODE="update"
fi
```

**Step 2: Verify the current script does not have a clear mode concept**

Run: `rg -n "MODE=|Neuinstallation|Modus: Update|is_existing_dvhub_installation" /Volumes/My\ Shared\ Files/CODEX/Plexlite/install.sh`
Expected: no dedicated mode-detection structure yet.

**Step 3: Write minimal implementation**

Add helper functions such as:

```bash
is_existing_dvhub_installation() { ... }
print_mode_banner() { ... }
```

**Step 4: Verify the new detection logic is present**

Run: `rg -n "MODE=|Neuinstallation|Modus: Update|is_existing_dvhub_installation" /Volumes/My\ Shared\ Files/CODEX/Plexlite/install.sh`
Expected: matching mode-detection lines.

### Task 3: Harden update recognition so foreign directories abort safely

**Files:**
- Modify: `Plexlite/install.sh`

**Step 1: Define the failing expectation**

The script should refuse to reuse a non-empty directory unless it looks like DVhub.

Example guard:

```bash
if [[ -d "$INSTALL_DIR" && -n "$(ls -A "$INSTALL_DIR")" ]] && ! is_existing_dvhub_installation; then
  echo "..."
  exit 1
fi
```

**Step 2: Verify the current script only distinguishes git vs non-git directories**

Run: `rg -n "nicht leer und kein Git-Repository|package.json|remote get-url" /Volumes/My\ Shared\ Files/CODEX/Plexlite/install.sh`
Expected: only the older git/non-git distinction exists.

**Step 3: Write minimal implementation**

Require:
- `.git`
- `package.json`
- compatible `origin` remote

**Step 4: Verify the safety guards are present**

Run: `rg -n "remote get-url|package.json|nicht als DVhub-Installation erkannt|is_existing_dvhub_installation" /Volumes/My\ Shared\ Files/CODEX/Plexlite/install.sh`
Expected: matching safety checks.

### Task 4: Split repository provisioning into install and update messaging without duplicating the flow

**Files:**
- Modify: `Plexlite/install.sh`

**Step 1: Define the failing expectation**

The installer output should explicitly show whether it is cloning or updating.

Expected messages:

```bash
echo "Modus: Neuinstallation"
echo "Modus: Update"
```

**Step 2: Verify the current script has no explicit mode-specific output**

Run: `rg -n "Modus: Neuinstallation|Modus: Update|Repository aktualisieren|Repository klonen" /Volumes/My\ Shared\ Files/CODEX/Plexlite/install.sh`
Expected: no matching mode output yet.

**Step 3: Write minimal implementation**

Use one repository step with mode-specific branches for:
- clone
- fetch/checkout/pull

**Step 4: Verify the new output strings exist**

Run: `rg -n "Modus: Neuinstallation|Modus: Update|Repository aktualisieren|Repository klonen" /Volumes/My\ Shared\ Files/CODEX/Plexlite/install.sh`
Expected: matching output strings.

### Task 5: Ensure updates preserve config/data but still refresh service artifacts

**Files:**
- Modify: `Plexlite/install.sh`
- Modify: `Plexlite/README.md`

**Step 1: Define the failing expectation**

The documentation and script should both make clear that updates preserve config and data.

Expected wording and behavior:

```md
- Config unter /etc/dvhub/config.json bleibt erhalten
- Daten unter /var/lib/dvhub bleiben erhalten
```

**Step 2: Verify this preservation is not documented clearly today**

Run: `rg -n "bleibt erhalten|Update.*Config|Update.*Daten" /Volumes/My\ Shared\ Files/CODEX/Plexlite/README.md`
Expected: no clear preservation bullets yet.

**Step 3: Write minimal implementation**

Document preserved paths and keep the existing directory preparation non-destructive during update mode.

**Step 4: Verify the preservation wording now exists**

Run: `rg -n "bleibt erhalten|Update.*Config|Update.*Daten" /Volumes/My\ Shared\ Files/CODEX/Plexlite/README.md`
Expected: matching preservation wording.

### Task 6: Verify shell syntax and README content

**Files:**
- Modify: `Plexlite/install.sh`
- Modify: `Plexlite/README.md`

**Step 1: Run shell syntax check**

```bash
bash -n /Volumes/My\ Shared\ Files/CODEX/Plexlite/install.sh
```

Expected: exit 0

**Step 2: Run targeted README checks**

```bash
rg -n "^### Installation|^### Update|automatisch.*Update|bleibt erhalten" /Volumes/My\ Shared\ Files/CODEX/Plexlite/README.md
```

Expected: installation and update sections both present with preservation wording.

**Step 3: Inspect final installer diff**

```bash
git -C /Volumes/My\ Shared\ Files/CODEX/Plexlite diff -- install.sh README.md
```

Expected: clear install/update mode handling, safety guards, and updated documentation.
