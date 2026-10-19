# Technische Spezifikation: Mobile & Desktop Readiness für Obsidian Plugins

Dieses Dokument definiert verbindliche Architektur- und Implementierungsstandards, um sicherzustellen, dass ein Obsidian-Community-Plugin nahtlos sowohl auf Desktop-Systemen (macOS, Windows, Linux via Electron) als auch auf Mobilgeräten (iOS, iPadOS, Android via Capacitor) fehlerfrei und regelkonform ausgeführt wird.

---

## 1. Übersicht & Kernproblem

Obsidian nutzt auf dem Desktop **Electron** (vollständige Node.js-Laufzeitumgebung), auf Mobilgeräten hingegen **Capacitor** (reine Web-Laufzeitumgebung via Safari WebKit / Android WebView).

Wenn im `manifest.json` die Option `"isDesktopOnly": false` deklariert ist, wird das Plugin auf mobilen Geräten geladen. Enthält das Bundle ungeschützte Zugriffe auf Node.js-APIs oder inkompatible NPM-Pakete, stürzt das Plugin beim Start unweigerlich mit `ReferenceError: process is not defined` oder `Module not found` ab.

---

## 2. Manifest-Konfiguration

In der `manifest.json` muss Mobile-Readiness explizit deklariert werden:

```json
{
  "id": "my-universal-plugin",
  "name": "My Universal Tool",
  "version": "1.0.0",
  "minAppVersion": "1.5.0",
  "description": "Cross-platform plugin running identically on desktop and mobile devices.",
  "author": "Dein Name",
  "isDesktopOnly": false
}
```

> **Wichtig:** Setze `isDesktopOnly` nur dann auf `true`, wenn eine Funktion ohne tiefe Betriebssystem-Interaktion (z. B. lokale CLI-Binaries, native C++-Bindings) technisch unmöglich ist.

---

## 3. Node.js & NPM-Pakete (Der kritische Pfad)

### 3.1 Verbot von Top-Level Node-Imports
Kein Node-Modul darf auf Modulebene importiert werden:

```typescript
// ❌ STRENG VERBOTEN (bringt Mobile sofort zum Absturz):
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import crypto from 'crypto';
```

### 3.2 NPM-Paket-Audit vor Installation
Vor jeder Installation eines Drittanbieter-Pakets via npm oder pnpm muss geprüft werden:
1. **Keine Node-Builtins:** Das Paket darf weder direkt noch transitiv `fs`, `path`, `os`, `stream`, `buffer` oder `child_process` verwenden.
2. **Reine Browser-/JS-Kompatibilität:** Geeignet sind Pakete mit ESM/Universal-Fokus (z. B. `fsrs.js`, `date-fns`, `canvas-confetti`, `zod`).
3. **esbuild-Konfiguration:** Externe Node-Module dürfen nicht im Build erwartet werden.

### 3.3 Umgang mit optionalen Desktop-Features (Dynamic Requires)
Benötigt ein Feature auf dem Desktop zwingend Node.js, muss es dynamisch geladen und zwingend mit `Platform.isDesktopApp` abgesichert werden:

```typescript
import { Platform } from 'obsidian';

export function executeDesktopAction() {
  if (!Platform.isDesktopApp) {
    // Sicheres Verhalten auf Mobilgeräten
    return;
  }

  try {
    // Dynamic import oder require erst zur Laufzeit
    // @ts-ignore
    const nodeFs = window.require('fs');
    // Desktop-Logik...
  } catch (error) {
    console.error("Node API nicht verfügbar:", error);
  }
}
```

---

## 4. Obsidian SDK vs. Node / Web APIs

Die folgende Matrix regelt, welche APIs plattformübergreifend zulässig sind:

| Bereich | ❌ Verboten (Desktop-only) | ✅ Verbindlicher Standard (Cross-Platform) |
| :--- | :--- | :--- |
| **HTTP / REST** | `fetch()`, `axios`, `http.get` (leiden unter CORS auf Mobilgeräten) | `requestUrl()` aus dem Obsidian SDK (umgeht CORS plattformübergreifend) |
| **Pfade & Slashing** | `path.join()`, `path.normalize()`, manuelle Slashes `/` | `normalizePath()` aus dem Obsidian SDK |
| **Plattformprüfung** | `process.platform`, `navigator.userAgent` | `Platform.isDesktop`, `Platform.isMobile`, `Platform.isIosApp`, `Platform.isAndroidApp` |
| **Zwischenablage** | `electron.clipboard` | `navigator.clipboard.writeText()` / `.readText()` |
| **Dateisystem-Adapter** | Ungeprüftes Casting: `app.vault.adapter as FileSystemAdapter` | Type-Guard mit `instanceof FileSystemAdapter` (Mobile nutzt `CapacitorAdapter`) |
| **Dateimodifikation** | `fs.writeFileSync()`, ungeprüftes `vault.modify()` | `app.vault.process()` (Hintergrund) oder `editor.replaceRange()` (aktiver Tab) |
| **Metadaten/YAML** | Manuelles Regex-Ersetzen in der Markdown-Datei | `app.fileManager.processFrontMatter()` |
| **Dateilöschung** | `fs.unlink()`, `vault.delete()` | `app.vault.trash(file, true)` (respektiert Nutzer-Papierkorbeinstellungen) |

---

## 5. Dateisystem-Adapter: Der `instanceof` Fallstrick

Auf dem Desktop ist `app.vault.adapter` eine Instanz von `FileSystemAdapter`. Auf iOS und Android handelt es sich hingegen um einen internen `CapacitorAdapter`. 

```typescript
// ❌ FALSCH: Führt auf dem Smartphone zu Laufzeitfehlern
const adapter = this.app.vault.adapter as FileSystemAdapter;
const fullPath = adapter.getFullPath(file.path);

// ✅ RICHTIG: Sicherer Guard mit Typ-Verzweigung
import { FileSystemAdapter } from 'obsidian';

if (this.app.vault.adapter instanceof FileSystemAdapter) {
  // Nur auf Desktop aufrufen
  const fullPath = this.app.vault.adapter.getFullPath(file.path);
} else {
  // Mobile Fallback: Ausschließlich mit relativen Vault-Pfaden arbeiten!
  const vaultRelativePath = file.path;
}
```

---

## 6. JavaScript & WebKit Restriktionen (iOS-Besonderheiten)

### 6.1 Regex Lookbehind-Restriktion
* **Problem:** iOS-Versionen vor Version 16.4 unterstützen keine Regex *Lookbehinds* (`(?<=...)` oder `(?<!...)`). Ihre Nutzung führt zum vollständigen Absturz des JavaScript-Parsers beim Plugin-Laden.
* **Vorschrift:** Verwende reguläre Capturing Groups `(...)` anstelle von Lookbehinds.

```typescript
// ❌ GEFÄHRDUNG FÜR ÄLTERE iOS-GERÄTE:
const match = text.match(/(?<=#tag:)[a-zA-Z]+/);

// ✅ KOMPATIBEL:
const match = text.match(/#tag:([a-zA-Z]+)/);
const tag = match ? match[1] : null;
```

### 6.2 Arbeitsspeicher & Garbage Collection
Mobilgeräte besitzen strenge RAM-Limits (insbesondere iOS Safari WebKit terminated Web-Prozesse aggressiv bei Überschreitung des Speicherkontingents):
* **Keine In-Memory Caches unbegrenzter Größe:** Caches müssen über LRU (Least Recently Used) oder Größenbeschränkungen verfügen.
* **Keine blockierenden Vault-Durchläufe:** Beim Scannen aller Vault-Dateien (`vault.getFiles()`) müssen Chunks mit `setTimeout` oder `requestIdleCallback` zerlegt werden.

---

## 7. UI- & Touch-Anforderungen

Die Benutzeroberfläche muss sich adaptiv an Maus-, Tastatur- und Touch-Eingaben anpassen:

1. **Touch-Target-Größe:** Interaktive Elemente (Buttons, Icons) müssen auf Mobilgeräten eine Mindest-Klickfläche von mindestens **44 × 44 Pixeln** besitzen.
2. **Keine Hover-Abhängigkeiten:** Wichtige Aktionen oder Informationen dürfen niemals ausschließlich über CSS `:hover`-Zustände erreichbar sein.
3. **Workspace-Integration:**
   * Verwende für Modals die Obsidian-Klasse `Modal`. Auf Mobilgeräten rendert Obsidian diese automatisch als bildschirmfüllende Sheets.
   * Views sollten für mobile Bildschirme per Flexbox/Grid responsiv umbrechen (`flex-direction: column` auf schmalen Screens).
4. **CSS-Variablen:** Verwende ausnahmslos native CSS-Variablen:
   * `--background-primary`, `--background-secondary`
   * `--text-normal`, `--text-muted`, `--text-accent`
   * `--interactive-accent`, `--interactive-hover`
   * `--nav-item-size`

---

## 8. Automatisierte Validierungs-Checkliste

Vor jedem Release muss die folgende Checkliste vollständig erfüllt sein:

- [ ] **Build-Test:** `npm run build` erzeugt fehlerfrei `main.js` ohne externe ungebündelte Abhängigkeiten.
- [ ] **Grep-Check nach Node-Builtins:**
  ```bash
  grep -rnE "from ['\"](fs|path|os|crypto|child_process)['\"]" src/
  ```
  *(Ergebnis muss leer sein!)*
- [ ] **Grep-Check nach process.platform:**
  ```bash
  grep -rn "process.platform" src/
  ```
  *(Muss durch `Platform.is...` ersetzt sein!)*
- [ ] **Grep-Check nach fetch / axios:**
  ```bash
  grep -rnE "(fetch\(|axios)" src/
  ```
  *(Muss durch `requestUrl()` ersetzt sein!)*
- [ ] **Adapter-Check:** Keine ungeprüften Type-Casts auf `FileSystemAdapter`.
- [ ] **Regex-Check:** Keine Lookbehinds `(?<=` oder `(?<!` im gesamten Quelltext.
- [ ] **Praxistest Mobile:** Plugin im Vault auf einem physischen Smartphone (iOS oder Android) oder im Simulator aktivieren und Konsole via USB-Debugging auf Fehler prüfen.