# Progress Tracker: Obsidian Exam & Quiz Hub

Dieses Dokument dient als kontinuierlicher Fortschritts- und Qualitätsnachweis für die Entwicklung des **Obsidian Exam & Quiz Hub** Community Plugins.

**Spezifikationsgrundlage:**
- `Obsidian_Exam_Quiz_Hub_Spezifikation_v3.md` (Verbindliche Architektur & Features)
- `mobile_desktop_compatibility_requirements.md` (Mobile Readiness & Review-Compliance)
- `LearningCoach v2` (UI/UX-Ansatz für Prüfungs- und Card-Layouts)

---

## 📌 Sprint 1: Foundation, Parser & Stable Question Identification

- [x] **1.1 Plugin Scaffold & Build-Pipeline**
  - [x] `package.json` mit TypeScript, esbuild, `@types/node` (nur devDependency), `obsidian`, `canvas-confetti`
  - [x] `tsconfig.json` mit striktem Type-Checking (`ES2020` / `ESNext`, `allowSyntheticDefaultImports`, `esModuleInterop`)
  - [x] `esbuild.config.mjs` (Reiner Universal-Build ohne externe Node-Module)
  - [x] `manifest.json` (`"isDesktopOnly": false`, `"minAppVersion": "1.5.0"`)
  - [x] `src/types.ts` mit allen Datenstrukturen gemäß Spezifikation v3
- [x] **1.2 Mobile-konforme Hashing- & Normalisierungs-Utilities (`HashUtils.ts`)**
  - [x] Deterministischer Web-Crypto SHA-256 bzw. FNV-1a / MurmurHash Fallback (Kein `import crypto from 'crypto'`)
  - [x] Sichere UUID-Generierung via `window.crypto.randomUUID()` mit reinem Browser-Fallback
- [x] **1.3 ExamParser mit robuster Question-ID (`ExamParser.ts`)**
  - [x] Chunking via H2-Trenner (`^##\s+(.+)$`)
  - [x] Priorität 1: Obsidian Block-IDs `^q-[id]` am Fragenende
  - [x] Priorität 2: Attribut `id: [id]`
  - [x] Priorität 3: Deterministischer Hash als Fallback
  - [x] Lookbehind-freie Regex-Patterns für MC-Items (`- [x]` / `- [ ]`), Freitext (`Musterloesung:`), Cloze & `> [!explanation]`
  - [x] Frontmatter-Parsing (YAML-Cache & Fallback)
- [x] **1.4 VaultIndexer mit Event-Handling (`VaultIndexer.ts`)**
  - [x] Überwachung des konfigurierten Ordners (`exams/`)
  - [x] Listener für `vault.on('create'|'modify'|'delete'|'rename')`
  - [x] Inkrementeller In-Memory Cache zur Vermeidung redundanter Disk-Scans
  - [x] Nicht-blockierende Batch-Indizierung mit `setTimeout(0)` für mobile Responsivität
- [x] **1.5 Natives MarkdownRenderer-Pipeline (`MarkdownUtils.ts`)**
  - [x] Render-Helper für Fragetexte und Erklärungen via `MarkdownRenderer.render()`
  - [x] Korrekte Auflösung relativer Pfade, Vault-Bilder (`![[...]]`), Wikilinks und MathJax/LaTeX

---

## 📌 Sprint 2: Session-Engine, Dynamic Generator & Crash-Recovery

- [x] **2.1 Dynamic Exam Generator (`ExamGenerator.ts`)**
  - [x] Filterung nach Modulen (z.B. Multi-Auswahl `M1`, `M7`)
  - [x] Konfigurierbare Fragenanzahl $N$ mit automatischer Zeitkalkulation (1,5 Min/Frage)
  - [x] Doppelter Fisher-Yates Shuffle (Level 1: Fragenpool, Level 2: 5er-MC-Items mit stabiler UUID)
  - [x] Fehlerspeicher-Klausur-Generator
- [x] **2.2 Session-Engine mit Auto-Save (`ExamSession.ts`)**
  - [x] Zustandshaltung (`sessionId`, `questions`, `currentQuestionIndex`, `userAnswers`, `remainingSeconds`, `flaggedQuestionIds`)
  - [x] Reaktive Antwortregistrierung (Checkboxen, Radios & Freitext)
  - [x] Auto-Save Engine: Periodisches Schreiben von `ActiveSessionState` in `data.json` alle 15 Sekunden
  - [x] Event-Listener auf `window.onbeforeunload` und `document.visibilitychange` zum Speichern vor App-Schließen
- [x] **2.3 Crash-Recovery Modal (`CrashRecoveryModal.ts`)**
  - [x] Erkennung unvollendeter aktiver Sessions bei Plugin-Initialisierung
  - [x] Benutzerdialog mit Detailangaben (Modul, Beantwortet X/Y, Restzeit)
  - [x] Aktionen: "Klausur fortsetzen" oder "Verwerfen"

---

## 📌 Sprint 3: Scoring, Desktop-Shortcuts & Notizen-Export

- [x] **3.1 5-Item MC-Scoring & Freitext-Evaluation (`ScoringEngine.ts`)**
  - [x] 5-Item-MC-Formel: 1 Punkt pro korrekter Auswahl oder Nicht-Auswahl (0 bis 5 Punkte, keine Minuspunkte)
  - [x] Freitext Self-Assessment Logik (Stufenlose Punktevergabe 0, 0.5, 1.0, ..., `maxPoints`)
  - [x] Prozentuale Gesamtauswertung und Bestehensprüfung (`passingScore`)
  - [x] XP-Berechnung (+10 Pkt./Frage, +5 Bonus für 5/5 MC, +50 Bestehen, +100 für $\ge 85\%$)
- [x] **3.2 Desktop-Tastatursteuerung & Shortcuts (`ExamRunnerView.ts`)**
  - [x] Ziffern `1`, `2`, `3`, `4`, `5`: Checkboxen A–E des aktiven MC-Blocks toggeln
  - [x] `J` / `Pfeil rechts`: Nächste Frage
  - [x] `K` / `Pfeil links`: Vorherige Frage
  - [x] `M`: Aktuelle Frage markieren ("Unsicher" / Flag)
  - [x] `Strg+Enter`: Klausur nach Sicherheitsbestätigung abgeben
- [x] **3.3 Automatischer Ergebnisexport als Markdown (`ResultExporter.ts`)**
  - [x] Formatierte Klausur-Notiz in `exams/results/YYYY-MM-DD_HH-mm_[Modul]_[Titel].md`
  - [x] Frontmatter-Metadaten (Score, Status, Dauer, Fehleranzahl)
  - [x] Zusammenfassung als Callout (`> [!info]`)
  - [x] Detailprotokoll aller fehlerhaften Aufgaben mit Musterlösung und eigener Antwort

---

## 📌 Sprint 4: Gamification, Web Audio & Intelligenter Fehlerspeicher

- [x] **4.1 Zero-Dependency Web Audio Synthesizer (`SoundManager.ts`)**
  - [x] Synthetisierung über native `AudioContext`-Oszillatoren (keine externen Audio-Dateien)
  - [x] Erfolgs-Akkord (C5–E5–G5–C6) mit dezentem Decay bei Bestehen
  - [x] Subtiler Fehlerton bei Nichtbestehen
  - [x] Klick-Feedback bei Item-Auswahl
  - [x] Lautstärkeregler und Mute-Option in den Settings
- [x] **4.2 Lokale Konfetti-Animation (`ConfettiTrigger.ts`)**
  - [x] `canvas-confetti` lokal im Bundle enthalten
  - [x] Standard-Burst bei $\ge 60\%$
  - [x] Großes zweistufiges Gold-Feuerwerk bei $\ge 90\%$
- [x] **4.3 Gamification- & Streak-Engine (`GamificationEngine.ts`)**
  - [x] Level-Progression nach $250 \times \text{Level}^{1.5}$
  - [x] Täglicher Streak-Zähler mit 48h-Inaktivitäts-Reset
  - [x] FSRS-Metadatenverwaltung im Storage (`stability`, `difficulty`, `reps`, `lapses`, `lastReview`)
- [x] **4.4 Intelligenter Fehlerspeicher (`ErrorPoolManager.ts`)**
  - [x] Automatische Aufnahme bei $< 5$ Punkten (MC) oder $< 50\%$ (Freitext)
  - [x] Verknüpfung über stabile Block-IDs / Hashes in `data.json`
  - [x] Mastery-Kriterium: Entlastung nach $2\times$ fehlerfreier Folgebeantwortung (`consecutiveSuccess >= 2`)

---

## 📌 Sprint 5: UI/UX Views, Mobile Hardening & Review-Compliance

- [x] **5.1 Plugin-Settings Tab (`SettingsTab.ts`)**
  - [x] Ordnerpfade (`exams/`, `exams/results/`), Bestehensgrenze, Audio-Lautstärke & Effekte
  - [x] KI-Konverter Prompt & Markdown-Formatierungsbeispiel mit 1-Klick-Zwischenablage in den Settings
- [x] **5.2 Dashboard View (`DashboardView.ts`)**
  - [x] Header mit Streak-Flamme, XP-Fortschrittsbalken, aktuellem Level
  - [x] Schnellzugriff auf Fehlerspeicher ("Fehlerspeicher trainieren (N Fragen)")
  - [x] Modul-Filter und Klausur-Akkordeon mit Modulordnern
  - [x] Klausur-Generator-Card mit Slider für Fragenanzahl und Modulauswahl
  - [x] Resume-Banner für unvollendete Klausuren
- [x] **5.3 Exam Runner View (`ExamRunnerView.ts`)**
  - [x] Sticky Header mit Countdown-Timer (Farbwechsel auf Warnung bei $< 5$ Min) und Progressbar
  - [x] Permanente Kachel-Leiste (`runner-question-tiles-strip`) zum schnellen Springen mit Live-Zustand (aktuell, beantwortet, markiert)
  - [x] Prominenter Markieren-Button (`⚐ Frage markieren (M)`) direkt auf der Aufgabenkarte
  - [x] Dynamischer Abgabe-Button auf der letzten Seite („Klausur abgeben ✓“) inklusive Shortcut-Unterstützung
  - [x] Touch-optimierte Karten für MC- und Freitext-Antworten ($\ge 44 \times 44\,\text{px}$)
  - [x] Auto-Scroll zum Fragenanfang bei Fragenwechsel
  - [x] Fokusmodus (Ablenkungsfreie Ansicht)
- [x] **5.4 Result & Review View (`ResultView.ts`)**
  - [x] Reines In-Tab-Rendering (Wiederverwendung des aktiven Runner-Tabs statt Tab-Spam)
  - [x] 100% flüssiges Scrollen auf allen Geräten via gekapseltem `.exam-result-container`
  - [x] Fragen-Schnellnavigationsleiste zur direkten Sprungnavigation in der Detailauswertung
  - [x] Große Score-Kachel mit Prozentwert, Punkten, Status, XP-Gewinn
  - [x] Interaktives Freitext-Self-Assessment mit Punkte-Buttons
  - [x] Aufklappbare Musterlösungen und `[!explanation]` Callouts
  - [x] Button: "Ergebnis als Vault-Notiz speichern"
- [x] **5.5 Mobile- & Desktop-Compliance Audit**
  - [x] Kein direkter Import von Node-Builtins (`fs`, `path`, `crypto`, `child_process`)
  - [x] Keine Regex-Lookbehinds im gesamten Quelltext
  - [x] Sichere `instanceof FileSystemAdapter` Typ-Guards
  - [x] Nutzung von `requestUrl()`, `normalizePath()`, `Platform.isMobile/isDesktop`
  - [x] Saubere Lifecycle-Bereinigung (`clearInterval`, Event-Listener) in `onunload()`
  - [x] Vollständige Theme-Neutralität (Light & Dark Mode via Obsidian CSS-Tokens)
  - [x] Erfolgreicher Produktions-Build (`npm run build`)
  - [x] Unit-Test Suite (`npm test`)
