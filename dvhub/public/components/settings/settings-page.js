import { html } from 'htm/preact';
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { apiFetch } from '../shared/use-api.js';
import { SettingsSection } from './settings-section.js';
import { SettingsField } from './settings-field.js';

const rawConfig = signal({});
const effectiveConfig = signal({});
const draftConfig = signal({});
const definition = signal(null);
const meta = signal(null);
const loading = signal(true);
const saving = signal(false);
const toast = signal(null);
const error = signal(null);

async function loadConfig() {
  loading.value = true;
  error.value = null;
  try {
    const res = await apiFetch('/api/config');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (!payload.ok) throw new Error(payload.error || 'config load failed');
    rawConfig.value = payload.config || {};
    effectiveConfig.value = payload.effectiveConfig || {};
    draftConfig.value = JSON.parse(JSON.stringify(payload.config || {}));
    definition.value = payload.definition || null;
    meta.value = payload.meta || null;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function saveConfig() {
  saving.value = true;
  try {
    const res = await apiFetch('/api/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: draftConfig.value }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (!payload.ok) throw new Error(payload.error || 'save failed');
    rawConfig.value = payload.config || {};
    effectiveConfig.value = payload.effectiveConfig || {};
    draftConfig.value = JSON.parse(JSON.stringify(payload.config || {}));
    showToast('Konfiguration gespeichert', 'success');
  } catch (err) {
    showToast(`Fehler: ${err.message}`, 'error');
  } finally {
    saving.value = false;
  }
}

function showToast(message, type) {
  toast.value = { message, type };
  setTimeout(() => { toast.value = null; }, 3000);
}

function getPath(obj, path, fallback) {
  if (!obj || !path) return fallback;
  const parts = path.split('.');
  let current = obj;
  for (const p of parts) {
    if (current == null || typeof current !== 'object') return fallback;
    current = current[p];
  }
  return current === undefined ? fallback : current;
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function getDraftValue(path) {
  const draft = getPath(draftConfig.value, path);
  if (draft !== undefined) return draft;
  return getPath(effectiveConfig.value, path);
}

function updateDraft(path, value) {
  const clone = JSON.parse(JSON.stringify(draftConfig.value));
  setPath(clone, path, value);
  draftConfig.value = clone;
}

function onFieldChange(path) {
  return ({ value }) => updateDraft(path, value);
}

function renderFieldForDef(field) {
  const value = getDraftValue(field.path);
  const inherited = getPath(effectiveConfig.value, field.path);

  if (field.type === 'boolean') {
    return html`<${SettingsField}
      type="toggle"
      name=${field.path}
      label=${field.label}
      value=${Boolean(value)}
      onChange=${onFieldChange(field.path)}
      hint=${field.help || ''}
    />`;
  }

  if (field.type === 'select') {
    return html`<${SettingsField}
      type="select"
      name=${field.path}
      label=${field.label}
      value=${value ?? ''}
      onChange=${onFieldChange(field.path)}
      options=${(field.options || []).map(o => ({ value: String(o.value), label: o.label }))}
      hint=${field.help || ''}
    />`;
  }

  const inputType = field.type === 'number' ? 'number' : field.type === 'time' ? 'time' : 'text';
  const placeholder = inherited != null && field.empty === 'delete' ? `Vererbt: ${inherited}` : '';

  return html`<${SettingsField}
    type=${inputType}
    name=${field.path}
    label=${field.label}
    value=${value ?? ''}
    onChange=${onFieldChange(field.path)}
    min=${field.min}
    max=${field.max}
    step=${field.step}
    hint=${field.help || ''}
    placeholder=${placeholder}
  />`;
}

function isFieldVisible(field) {
  if (field.visibleWhenPath) {
    const val = getDraftValue(field.visibleWhenPath.path);
    if (String(val) !== String(field.visibleWhenPath.equals)) return false;
  }
  if (Array.isArray(field.visibleWhenTransport) && field.visibleWhenTransport.length) {
    const transport = getDraftValue('victron.transport');
    if (!field.visibleWhenTransport.includes(transport)) return false;
  }
  return true;
}

async function handleExport() {
  try {
    const res = await apiFetch('/api/config/export');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dvhub-config.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export erfolgreich', 'success');
  } catch (err) {
    showToast(`Export fehlgeschlagen: ${err.message}`, 'error');
  }
}

async function handleImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const importConfig = JSON.parse(text);
    const res = await apiFetch('/api/config/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config: importConfig }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast('Import erfolgreich – lade Konfiguration neu...', 'success');
    loadConfig();
  } catch (err) {
    showToast(`Import fehlgeschlagen: ${err.message}`, 'error');
  }
}

export function SettingsPage() {
  useEffect(() => { loadConfig(); }, []);

  const defn = definition.value;
  const sections = defn?.sections || [];
  const fields = defn?.fields || [];

  // Group fields by section
  const sectionMap = {};
  for (const section of sections) {
    sectionMap[section.id] = {
      ...section,
      fields: fields.filter(f => f.section === section.id)
    };
  }

  // Group fields within a section by their group property
  function renderSectionFields(sectionFields) {
    const groups = {};
    for (const field of sectionFields) {
      if (!isFieldVisible(field)) continue;
      const groupKey = field.group || 'main';
      if (!groups[groupKey]) groups[groupKey] = { label: field.groupLabel || groupKey, fields: [] };
      if (!groups[groupKey].label || groups[groupKey].label === groupKey) {
        groups[groupKey].label = field.groupLabel || groupKey;
      }
      groups[groupKey].fields.push(field);
    }

    return Object.entries(groups).map(([key, group]) => {
      if (group.fields.length === 0) return null;
      return html`
        <div class="settings-group" key=${key}>
          ${key !== 'main' ? html`<h4 class="settings-group-title">${group.label}</h4>` : null}
          ${group.fields.map(f => renderFieldForDef(f))}
        </div>
      `;
    });
  }

  const m = meta.value;
  const metaText = m
    ? `Datei: ${m.path || '-'} | Vorhanden: ${m.exists ? 'Ja' : 'Nein'} | Gueltig: ${m.valid ? 'Ja' : 'Nein'}`
    : '';

  return html`
    <header class="panel compact-topbar reveal">
      <div class="compact-topbar-copy">
        <p class="page-kicker">Konfiguration</p>
        <h1 class="page-title">DVhub Einrichtung</h1>
        <p class="page-subtitle">Verbindung, Steuerung und Datendienste.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost" onClick=${() => loadConfig()}>Neu laden</button>
        <button class="btn btn-primary" onClick=${saveConfig} disabled=${saving.value}>
          ${saving.value ? 'Wird gespeichert...' : 'Speichern'}
        </button>
      </div>
    </header>

    ${toast.value && html`
      <div style=${`
        position: fixed; top: 1rem; right: 1rem; z-index: 9999;
        padding: 0.75rem 1.25rem; border-radius: 6px;
        background: ${toast.value.type === 'success' ? 'var(--dvhub-green, #4ade80)' : 'var(--dvhub-red, #f87171)'};
        color: #000; font-weight: 500;
      `}>${toast.value.message}</div>
    `}

    ${metaText && html`<p class="meta" style="padding: 0 1rem; opacity: 0.6; font-size: 0.8rem;">${metaText}</p>`}

    ${loading.value && html`<section class="panel span-12 reveal"><p class="meta">Konfiguration wird geladen...</p></section>`}
    ${error.value && html`<section class="panel span-12 reveal"><p class="meta" style="color: var(--dvhub-red, #f87171);">${error.value}</p></section>`}

    ${!loading.value && !error.value && html`
      <main class="dashboard-grid">
        ${sections.map(section => {
          const sectionFields = sectionMap[section.id]?.fields || [];
          const visibleFields = sectionFields.filter(f => isFieldVisible(f));
          if (visibleFields.length === 0) return null;

          return html`
            <section class="span-12" key=${section.id}>
              <${SettingsSection}
                title=${section.label}
                description=${section.description || ''}
              >
                ${renderSectionFields(sectionFields)}
              <//>
            </section>
          `;
        })}

        <!-- Import/Export -->
        <section class="span-12">
          <${SettingsSection} title="Import / Export" description="Konfiguration sichern oder wiederherstellen" collapsible=${false}>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
              <button class="btn btn-ghost" onClick=${handleExport}>Konfiguration exportieren</button>
              <label class="btn btn-ghost" style="cursor: pointer;">
                Konfiguration importieren
                <input type="file" accept=".json,application/json" style="display: none;" onChange=${handleImport} />
              </label>
            </div>
          <//>
        </section>
      </main>
    `}
  `;
}
