# Installation

## Schnellstart — Installer

```bash
curl -fsSL https://raw.githubusercontent.com/chloepriceless/dvhub/main/install.sh | sudo bash
```

Der Installer:

- installiert Node.js
- klont das Repo nach `/opt/dvhub`
- nutzt die App unter `/opt/dvhub/dvhub`
- migriert alte Installationen aus `/opt/dvhub/dv-control-webapp`
- richtet einen systemd-Service ein
- nutzt eine externe Config-Datei unter `/etc/dvhub/config.json`
- aktiviert Health-Checks und optionalen Restart aus der GUI
- legt die interne Telemetrie-Datenbank unter `/var/lib/dvhub/telemetry.sqlite` an
- startet `dvhub.service` nach dem Update automatisch neu

Wenn die Config-Datei noch fehlt oder ungültig ist, öffnet DVhub beim ersten Aufruf automatisch den Setup-Assistenten.

## Erster Aufruf

- Dashboard: `http://<host>:8080/`
- Historie: `http://<host>:8080/history.html`
- Einstellungen: `http://<host>:8080/settings.html`
- Setup: `http://<host>:8080/setup.html`
- Tools: `http://<host>:8080/tools.html`

---

## Manuelle Installation

```bash
sudo apt update
sudo apt install -y curl ca-certificates git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo apt install -y tcpdump jq
sudo mkdir -p /opt/dvhub /etc/dvhub /var/lib/dvhub
sudo useradd -r -s /usr/sbin/nologin dvhub
sudo git clone https://github.com/chloepriceless/dvhub.git /opt/dvhub
```

Danach:

```bash
sudo chown -R dvhub:dvhub /opt/dvhub /etc/dvhub /var/lib/dvhub
cd /opt/dvhub/dvhub
npm install --omit=dev
sudo cp config.example.json /etc/dvhub/config.json
sudo mkdir -p /etc/dvhub/hersteller
sudo cp hersteller/victron.json /etc/dvhub/hersteller/victron.json
sudo nano /etc/dvhub/config.json
```

Technische Victron-Werte wie Register, Port, Unit-ID oder Timeout werden nicht mehr in `/etc/dvhub/config.json` gepflegt.
Diese Werte liegen im Herstellerprofil unter `/etc/dvhub/hersteller/victron.json`.

Nur bei MQTT-Nutzung zusätzlich:

```bash
npm install mqtt
```

---

## systemd Service

Datei: `/etc/systemd/system/dvhub.service`

```ini
[Unit]
Description=DVhub DV Control
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=dvhub
Group=dvhub
WorkingDirectory=/opt/dvhub/dvhub
ExecStart=/usr/bin/node --experimental-sqlite /opt/dvhub/dvhub/server.js
Environment=NODE_ENV=production
Environment=DV_APP_CONFIG=/etc/dvhub/config.json
Environment=DV_ENABLE_SERVICE_ACTIONS=1
Environment=DV_SERVICE_NAME=dvhub.service
Environment=DV_SERVICE_USE_SUDO=1
Environment=DV_DATA_DIR=/var/lib/dvhub
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Service aktivieren:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dvhub
```

---

## Restart aus der GUI erlauben

```bash
SYSTEMCTL_PATH="$(command -v systemctl)"
echo "dvhub ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} restart dvhub.service" | sudo tee /etc/sudoers.d/dvhub-service-actions >/dev/null
echo "dvhub ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} is-active dvhub.service" | sudo tee -a /etc/sudoers.d/dvhub-service-actions >/dev/null
echo "dvhub ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} show dvhub.service *" | sudo tee -a /etc/sudoers.d/dvhub-service-actions >/dev/null
sudo chmod 440 /etc/sudoers.d/dvhub-service-actions
```

---

## Manueller Start

```bash
cd /opt/dvhub/dvhub
DV_APP_CONFIG=/etc/dvhub/config.json DV_DATA_DIR=/var/lib/dvhub npm start
```
