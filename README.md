# Obsidian Exam & Quiz Hub

Ein hochperformantes, vollständig offline- und mobile-taugliches Obsidian Community Plugin zur **Klausursimulation, Wissensüberprüfung und Spaced-Repetition-Wiederholung**.

Entwickelt gemäß **Projekt-Spezifikation v3** und strikt nach den **Mobile & Desktop Readiness Standards** für Obsidian Community Plugins.

---

## ✨ Features im Überblick

### 1. Single Source of Truth im Vault (`exams/`)
- Klausuren und Fragenpools werden als saubere Markdown-Dateien im Ordner `exams/` gepflegt.
- **Stabile Frage-Identifikation:** Schützt den Lernfortschritt vor Textänderungen durch:
  1. Obsidian Block-IDs `^q-[id]` am Ende der Überschrift
  2. YAML-/Attribut `id: [id]`
  3. Deterministischer FNV-1a Content-Hash als Fallback
- **Natives Asset-Rendering:** Vollständige Unterstützung von $\LaTeX$ / MathJax, internen Vault-Bildern (`![[...]]`), Wikilinks und Callouts (`> [!explanation]`) via Obsidians `MarkdownRenderer`.

### 2. Dynamischer Klausur-Generator & Shuffling
- **Doppelter Fisher-Yates-Shuffle:**
  - *Level 1:* Zufällige Mischung des Fragenpools
  - *Level 2:* Zufällige Mischung der 5 Aussagen pro MC-Aufgabe mit stabiler UUID-Nachverfolgung
- **Modul-Mix:** Wähle beliebige Module (z. B. `M1 + M7`) und eine Fragenanzahl via Schieberegler mit automatischer Zeitkalkulation (ca. 1,5 Min. pro Aufgabe).

### 3. Crash-Recovery & 15s Auto-Save Engine
- Der Zustand der aktiven Klausur (`ActiveSessionState`) wird alle 15 Sekunden sowie bei `beforeunload` und `visibilitychange` (z. B. App-Wechsel auf iOS/Android) im Storage gesichert.
- Beim Starten des Plugins erscheint bei unvollendeter Session automatisch ein **Wiederherstellungsdialog**:
  > *„Laufende Klausur fortsetzen? (18/30 beantwortet, ca. 22 Min Restzeit)“*

### 4. Universitärer 5-Item-MC-Scoring-Standard
- Jede MC-Aufgabe besteht aus 5 binären Aussagen:
  - $+1$ Punkt für jede korrekte Auswahl **oder** korrekte Nicht-Auswahl.
  - Summe: **0 bis 5 Punkte** pro Aufgabe (keine negativen Punkte).
- **Freitext Self-Assessment:** Interaktiver Button-Wähler (`0`, `0.5`, `1.0`, ..., `maxPoints`) mit direkter Gegenüberstellung von eigener Eingabe, Musterlösung und Bewertungsrubrik.

### 5. Gamification & Zero-Dependency Web Audio
- **XP- & Level-System:** $+10$ XP pro Frage, $+5$ XP Perfektionsbonus (5/5 MC), $+50$ XP Bestehen, $+100$ XP für $\ge 85\%$. Levelkurve nach $250 \times \text{Level}^{1.5}$.
- **Daily Streak:** Streak-Flamme mit 48h-Inaktivitäts-Reset.
- **Web Audio Synthesizer:** Reine Oszillator-Synthese über `AudioContext` (C5–E5–G5–C6 Erfolgsakkord, Fail-Ton, sanfter Klick) – **100% offline**, keine externen MP3-Dateien.
- **Canvas-Confetti:** Feierliches Konfetti bei $\ge 60\%$ und großes zweistufiges Gold-Feuerwerk bei $\ge 90\%$.
- **FSRS-Metadaten:** Speichert Stabilität, Difficulty und Reviews im Hintergrund.

### 6. Intelligenter Fehlerspeicher (Mastery-Prinzip)
- Fragen mit $< 5$ Punkten (MC) oder $< 50\%$ (Freitext) landen automatisch im Fehlerspeicher.
- **Entlastungskriterium:** Wird eine Frage im Fehlerspeicher-Modus **$2\times$ in Folge fehlerfrei** beantwortet (`consecutiveSuccess >= 2`), wird sie automatisch aus dem Pool entfernt.

### 7. Desktop-Shortcuts & Mobile Readiness
- **Desktop-Tasten:**
  - `1`, `2`, `3`, `4`, `5`: Optionen A–E umschalten
  - `J` / `Pfeil rechts`: Nächste Frage
  - `K` / `Pfeil links`: Vorherige Frage
  - `M`: Frage zur Überprüfung markieren (`⚑`)
  - `Strg + Enter`: Klausur abgeben
- **Mobile First:** Alle Klick- und Touch-Flächen $\ge 44 \times 44\,\text{px}$, responsive Fragen-Matrix im Drawer, Theme-Neutralität über Obsidian CSS-Tokens.

### 8. Automatischer Notizen-Export (`exams/results/`)
- Speichere Klausurberichte direkt per Knopfdruck als auditierbare Markdown-Notiz in `exams/results/YYYY-MM-DD_HH-mm_[Modul]_[Titel].md` mit Frontmatter, Callout-Zusammenfassung und Aufgabenprotokoll.

---

## 🚀 Installation & Testen im eigenen Vault

1. Navigiere in deinen Obsidian-Vault in das Plugin-Verzeichnis:
   ```text
   <Dein-Vault>/.obsidian/plugins/
   ```
   *(Hinweis: `.obsidian` ist ein versteckter Ordner. Im Windows Explorer ggf. unter „Ansicht“ > „Ausgeblendete Elemente“ aktivieren).*

2. Erstelle darin einen Ordner namens `exam-quiz-hub`:
   ```text
   <Dein-Vault>/.obsidian/plugins/exam-quiz-hub/
   ```

3. Kopiere die 3 kompilierten Release-Dateien aus diesem Projektverzeichnis in diesen Ordner:
   - `main.js`
   - `manifest.json`
   - `styles.css`

4. Kopiere für einen sofortigen Schnelltest den mitgelieferten Ordner `exams/` direkt in die Wurzel deines Vaults.

5. Öffne Obsidian:
   - Gehe zu **Einstellungen** (`Strg + ,`) > **Community-Plugins**.
   - Deaktiviere den eingeschränkten Modus („Restricted Mode“ ausschalten).
   - Klicke bei den installierten Plugins auf das Aktualisieren-Icon 🔄.
   - Aktiviere den Schalter bei **Exam & Quiz Hub**.
   - Klicke auf das neue Doktorhut-Icon in der linken Leiste oder drücke `Strg + P` > *„Exam & Quiz Hub: Klausur-Dashboard öffnen“*.

---

## 🛠️ Entwicklung & Build

```bash
# Abhängigkeiten installieren
npm install

# Test-Suite ausführen (Parser, Scoring, ErrorPool, Gamification)
npm test

# Produktions-Build erstellen (erzeugt main.js, styles.css, manifest.json)
npm run build
```

---

## 📋 Markdown Syntax Beispiel

```markdown
---
type: exam
module: M1
semester: WiSe26/27
title: Probeklausur Konditionierung
timeLimitMinutes: 45
passingScore: 60%
shuffleQuestions: true
shuffleOptions: true
---

## Welche Aussagen zur klassischen Konditionierung treffen zu? ^q-kond-01
type: multiple-choice
points: 5

- [x] Ein unkonditionierter Reiz (UCS) löst reflexartig eine UCR aus.
- [ ] Extinktion löscht die Gedächtnisspur vollständig.
- [x] Spontanerholung beschreibt das Wiederauftreten der CR nach einer Pause.
- [ ] Generalisierung bedeutet, dass nur der identische Reiz wirkt.
- [x] Konditionierung höherer Ordnung baut auf einem konditionierten Reiz auf.

> [!explanation]
> Extinktion ist Hemmungslernen (Inhibition). Generalisierung reagiert auch auf Reizähnlichkeiten.

---

## Erkläre das Modell der Kognitiven Dissonanz nach Festinger. ^q-diss-02
type: freetext
points: 3

Musterloesung:
Kognitive Dissonanz beschreibt einen aversiven Spannungszustand bei widersprüchlichen Kognitionen.
Kriterien:
1. Definition des aversiven Spannungszustands (1P)
2. Ursache: Widerspruch kognitiver Elemente (1P)
3. Mindestens eine Reduktionsstrategie genannt (1P)

> [!explanation]
> Maximale Punktzahl: 3 Punkte.
```
