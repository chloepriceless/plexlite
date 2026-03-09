# DVhub Installer Update Flow Design

**Context:** `install.sh` already refreshes an existing Git checkout, but the behavior is not presented as a first-class update flow, the detection is implicit and undocumented, and the README only explains installation. Users currently have no clear promise about what happens to config, data, and service setup when they run the installer again.

**Scope:** Turn `install.sh` into a single entrypoint that automatically detects an existing DVhub installation and performs a safe update, and document the behavior clearly in `README.md`.

**Goals**

- Keep one installer command for both first install and update.
- Detect an existing DVhub installation automatically and switch to update mode without extra flags.
- Preserve external config and persisted data during updates.
- Reapply service and sudoers setup during updates so operational improvements ship forward.
- Fail clearly when the target directory is non-empty but not a recognizable DVhub installation.

**Audience**

- Primary: admins and operators installing DVhub on Debian/Ubuntu systems.
- Secondary: users who rerun the same installer command later and expect an update, not a reinstall.

**Design Principles**

- One command, two safe paths: install or update.
- Never overwrite user config or telemetry data implicitly.
- Use explicit detection rules, not guesswork.
- Print clear mode information so the operator sees whether install or update is running.
- Keep the update path idempotent as far as practical.

**Detection Rules**

The installer should enter update mode only if all of these are true:

- `${INSTALL_DIR}/.git` exists
- `${APP_DIR}/package.json` exists
- the Git remote `origin` matches or is compatible with the configured DVhub repository URL

If `${INSTALL_DIR}` is missing or empty, the script performs a fresh install.

If `${INSTALL_DIR}` exists but does not match the expected DVhub structure, the script aborts with a clear error instead of trying to reuse the directory.

**Install Mode**

- install prerequisites
- install or verify Node.js
- create service user if missing
- clone the repo
- install runtime dependencies
- create config and data directories
- write sudoers and systemd unit
- enable and start the service

**Update Mode**

- install prerequisites if missing
- verify Node.js
- fetch the configured branch from `origin`
- fast-forward to the target branch
- reinstall runtime dependencies with `npm install --omit=dev`
- preserve `${CONFIG_PATH}`
- preserve `${DATA_DIR}`
- rewrite sudoers and systemd unit in case defaults changed
- run `systemctl daemon-reload`
- restart the service

**What Must Be Preserved**

- `${CONFIG_PATH}`
- `${DATA_DIR}`
- existing telemetry database files
- service user and systemd service name unless the user explicitly overrides them via environment or arguments

**User Feedback**

The script should print a short mode banner:

- `Modus: Neuinstallation`
- `Modus: Update`

The final summary should also reflect the path taken:

- install summary for fresh systems
- update summary for existing installations, including service restart confirmation

**README Changes**

The README should be updated to explain:

- the single installer command
- automatic install/update detection
- a dedicated `Update` section
- what is preserved during updates
- how custom paths or branches affect the update target

The wording should also reflect the current UI terminology:

- `Einrichtung`
- `Wartung`

**Risks and Mitigations**

- Accidental update of the wrong directory
  - mitigate with Git and app-structure checks before update mode
- Dirty local checkout blocks fast-forward update
  - mitigate with a clear error and guidance instead of forcing a reset
- Service file drift between releases
  - mitigate by rewriting the unit file and reloading systemd every run

**Testing Impact**

- Add installer tests or shell checks for install-vs-update detection where feasible.
- At minimum, verify shell syntax and guard logic.
- Update README sections that describe installation and admin behavior so they match the new flow.

