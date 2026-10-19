# Projekt-Spezifikation v3: Obsidian Exam & Quiz Hub (Community Plugin)

## 1. Executive Summary & Erweiterte Projektziele

Ziel des Projekts ist die Entwicklung eines hochperformanten, vollständig offline- und mobile-tauglichen Obsidian Community Plugins zur **Klausursimulation, Wissensüberprüfung und Spaced-Repetition-Wiederholung**.

Diese Version 3 integriert zusätzlich zu den Kernmodulen der Vorversionen:
* **Robuste Frage-Identifikation (Block-IDs & Stable Anchors):** Schutz des Fehlerspeichers und der Historie vor Datenverlust bei redaktionellen Änderungen im Markdown-Text.
* **Crash-Recovery & Session-State-Persistenz:** Nahtloses Wiederaufnehmen aktiver Klausuren bei App-Neustarts oder Hintergrund-Terminierung auf Mobilgeräten (iOS/Android).
* **Natives Obsidian-Rendering:** Sichere Darstellung von internen Vault-Assets, Bildern (`![[...]]`), Mermaid-Diagrammen und mathematischen Formeln (MathJax/LaTeX) via `MarkdownRenderer`.
* **Desktop-Power-User-Shortcuts:** Schnelle Tastatursteuerung für Checkboxen (1–5), Navigation (J/K bzw. Pfeiltasten) und Markierungen (M).
* **Automatisierter Markdown-Ergebnisexport:** Generierung auditierbarer Klausur-Reports direkt im Vault zur langfristigen Wissensdokumentation.
* **FSRS-kompatible Metadaten im Hintergrund:** Vorbereitung für nahtlose Spaced-Repetition-Abfragen nach dem Free Spaced Repetition Scheduler.

---

## 2. Modul-Architektur & Systemübersicht

```
+-----------------------------------------------------------------------------------+
|                                  OBSIDIAN VAULT                                   |
|   +---------------------------------------------------------------------------+   |
|   | Ordner: exams/ (Klausuren & Fragenpools mit Frontmatter & Callouts)       |   |
|   | Ordner: exams/results/ (Automatisch generierte Klausurberichte)           |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
                                          | (Lesender/Schreibender Zugriff via Vault-API)
                                          v
+-----------------------------------------------------------------------------------+
|                        MODUL 1: PARSER & VAULT-INDEXER                            |
|   - Regex-basiertes Chunking (H2-Trenner & optionale Block-IDs ^q-id)             |
|   - Extraktion von Frontmatter, MC-Items (5er-Block), Freitext, Cloze & Callouts   |
|   - In-Memory Cache mit Event-getriebener Re-Indizierung                          |
|   - Native MarkdownRenderer-Pipeline (LaTeX, Vault-Bilder, Wikilinks)             |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                   MODUL 2: SESSION-ENGINE & GENERATOR                             |
|   - Dynamic Exam Builder (Modul-Mix, konfigurierbare Fragenanzahl)                |
|   - Doppelter Fisher-Yates Shuffle (Fragenpool & 5er MC-Items)                    |
|   - Auto-Save Engine: Persistenz aktiver Klausurzustände in SessionState          |
|   - Crash-Recovery: Automatischer Wiederherstellungsdialog bei App-Resume         |
+-----------------------------------------------------------------------------------+
          |                                                       |
          v                                                       v
+---------------------------------------+       +-----------------------------------+
|    MODUL 3: SCORING & EVALUATION      |       |       MODUL 4: GAMIFICATION       |
| - 5-Item MC-Logik (0-5 Punkte)        |       | - XP-, Level- & Streak-System     |
| - Freitext Self-Assessment (stufenlos)|       | - Web Audio Synthesizer (SFX)     |
| - Prozentrechnung & Bestehensprüfung  |       | - Canvas-Confetti Trigger         |
| - Markdown-Exporteur für Notizen      |       | - FSRS-Metadatenpflege im Storage |
+---------------------------------------+       +-----------------------------------+
          \                                                       /
           \                                                     /
            v                                                   v
+-----------------------------------------------------------------------------------+
|                         MODUL 5: INTELLIGENTER FEHLERSPEICHER                     |
|   - Permanente Verknüpfung über stabile Block-IDs / Content-Hashes                |
|   - Automatische Erfassung fehlerhafter Items (< Max-Punkte)                      |
|   - Rekonstruktion & Dediziertes Re-Training                                      |
|   - Entlastungskriterium: 2x fehlerfreie Folgebeantwortung                        |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                     MODUL 6: BENUTZEROBERFLÄCHE (UI/UX)                           |
|   - Dashboard (Modul-Filter, Badges, Quick-Actions, Recovery-Banner)              |
|   - Exam Runner View (Timer, Fragen-Matrix, Touch >= 44px, Tastatur-Shortcuts)    |
|   - Result & Review View (Detailaufschlüsselung, Musterlösung, Notizen-Export)    |
|   - Native Obsidian CSS-Tokens & Barrierefreiheit                                 |
+-----------------------------------------------------------------------------------+
```

---

## 3. Spezifikation der Funktionsmodule

### Modul 1: Erweiterter Parser & Vault-Indexer (`ExamParser.ts`, `VaultIndexer.ts`)

#### 1.1 Stabile Frage-Identifikation (Block-IDs & Fallbacks)
Um zu verhindern, dass redaktionelle Änderungen (Tippfehlerkorrekturen) im Fragetext bestehende Lernhistorien und Fehlerspeichereinträge entwerten, unterstützt der Parser explizite IDs:
1. **Priorität 1: Obsidian Block-Referenz:** `^q-[eindeutige-id]` am Ende der Frageüberschrift.
2. **Priorität 2: Explizites YAML-/Body-Attribut:** `id: [eindeutige-id]`.
3. **Priorität 3: Deterministischer Inhalts-Hash:** Falls keine ID vergeben wurde, wird ein SHA-256 (bzw. MurmurHash3) aus dem bereinigten Text gebildet.

#### 1.2 Syntax-Spezifikation (Markdown)
```markdown
---
type: exam              # 'exam' (mit Timer & Endauswertung) | 'quiz' (Sofortfeedback)
module: M1              # Modulkennung
semester: WiSe26/27     # Optionales Semester
title: Probeklausur     # Anzeigename
timeLimitMinutes: 45    # Zeitlimit
passingScore: 60%       # Bestehensgrenze in Prozent
shuffleQuestions: true  # Fragen-Reihenfolge durchmischen
shuffleOptions: true    # MC-Items innerhalb der Aufgaben durchmischen
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
> ![[assets/konditionierungs_schema.png]]

---

## Erkläre das Modell der Kognitiven Dissonanz nach Festinger. ^q-diss-02
type: freetext
points: 3

Musterloesung:
Kognitive Dissonanz beschreibt einen aversiven Spannungszustand bei widersprüchlichen Kognitionen oder Kognition und Verhalten.
Kriterien:
1. Definition des aversiven Spannungszustands (1P)
2. Ursache: Widerspruch kognitiver Elemente (1P)
3. Mindestens eine Reduktionsstrategie genannt (1P)

> [!explanation]
> Maximale Punktzahl: 3 Punkte.
```

#### 1.3 Natives Asset-Rendering
Alle Fragetexte und Erklärungstexte werden über Obsidians internen `MarkdownRenderer.render()` verarbeitet:
* Automatische Auflösung von Wikilinks (`![[image.png]]`).
* Natives MathJax/LaTeX-Rendering (`$...$` und `$$...$$`).
* Korrekte Pfadauflösung für relative Pfade basierend auf `sourceFilePath`.

---

### Modul 2: Session-Engine, Auto-Save & Generator (`ExamSession.ts`, `ExamGenerator.ts`)

#### 2.1 Dynamischer Klausur-Generator (Multi-Modul-Mix)
* **Filter:** Auswahl beliebiger Kombinationen von Modulen (z. B. `M1` + `M7`).
* **Fragenanzahl:** Frei wählbar via Slider oder Eingabefeld (z. B. 15, 30, 50 Fragen).
* **Zufallsauswahl & Shuffling:**
  * **Level 1 (Fragenpool):** Fisher-Yates-Shuffle über den selektierten Gesamtpool.
  * **Level 2 (Antwort-Optionen):** Fisher-Yates-Shuffle der 5 Aussagen pro MC-Aufgabe mit Beibehaltung stabiler UUIDs.
* **Zeitberechnung:** Automatische Allokation von z. B. $1{,}5$ Minuten pro Aufgabe (Standardwert, konfigurierbar).

#### 2.2 Crash-Recovery & Session Auto-Save
Um Datenverlust bei Betriebssystem-Kill (iOS/Android Multitasking) zu verhindern:
* **Session-State-Serialisierung:** Jeder Klick auf ein Checkbox-Element, jede Tastatureingabe bei Freitext sowie die verbleibende Restzeit werden im Plugin-State gepuffert.
* **Auto-Save:** Synchronisation des Status alle 15 Sekunden sowie beim Trigger `window.onbeforeunload` / `document.visibilitychange`.
* **Wiederherstellung:** Beim Öffnen des Plugins wird geprüft, ob eine unvollendete Session existiert. Falls ja, erscheint ein modaler Hinweis:
  > **Laufende Klausur fortsetzen?**  
  > *Es wurde eine unvollendete Klausur ("M1 - Probeklausur", 18/30 beantwortet, 22 Min Restzeit) gefunden.*  
  > `[Klausur fortsetzen]` `[Verwerfen]`

---

### Modul 3: Bewertungssystem, Notizen-Export & Scoring (`ScoringEngine.ts`, `ResultExporter.ts`)

#### 3.1 Das 5-Item-MC-Scoring
* Jede MC-Aufgabe umfasst exakt 5 binäre Entscheidungen:
  $$	ext{Item-Punkte} = egin{cases} 1, & 	ext{wenn (Nutzer gewählt} \land 	ext{Item wahr) } \lor 	ext{ (Nutzer nicht gewählt} \land 	ext{Item falsch)} \ 0, & 	ext{andernfalls} \end{cases}$$
* Summe der Einzelentscheidungen: $0 	ext{ bis } 5	ext{ Punkte}$ pro Block (keine Minuspunkte).

#### 3.2 Freitext-Selbstevaluation
* Gegenüberstellung von Nutzereingabe und Musterlösung.
* Stufenlose manuelle Punktevergabe via Button-Bar (`0`, `0.5`, `1.0`, ..., `maxPoints`).

#### 3.3 Automatischer Ergebnisexport als Markdown-Notiz
Auf dem Result-Screen steht ein Button **"Ergebnis als Vault-Notiz speichern"** zur Verfügung. Das Plugin legt eine formatierte Markdown-Datei an:
* **Speicherort:** `exams/results/YYYY-MM-DD_HH-mm_[Modul]_[Titel].md`.
* **Inhalt:**
  * Frontmatter mit Metadaten (Score, Bestehensstatus, Dauer, Fehleranzahl).
  * Zusammenfassung mit Callout (`> [!info]`).
  * Detailprotokoll aller fehlerhaft beantworteten Aufgaben inklusive Musterlösung und eigener Antwort zur direkten Einarbeitung in die Notizen.

---

### Modul 4: Didaktische Gamification & Spaced Repetition (`GamificationEngine.ts`, `SoundManager.ts`)

#### 4.1 Progression & Metriken
* **XP-System:** $+10$ XP pro beantworteter Aufgabe, $+5$ XP für 5/5 Punkte in MC, $+50$ XP bei bestandener Klausur, $+100$ XP für $\ge 85\%$.
* **Level-Kurve:** $250 	imes 	ext{Level}^{1.5}$.
* **Streak-Tracking:** Inkrementierung bei täglicher Aktivität ($\ge 10$ Fragen oder 1 Klausur); automatischer Reset nach 48h Inaktivität.
* **Achievements:** Freischaltbare Abzeichen (z. B. *Scharfschütze*, *Fehlerfresser*, *Master of Time*).

#### 4.2 Web Audio Sound-Synthesizer (Zero-Dependency)
* Native Oszillator-Synthese über `AudioContext` (keine externen MP3/WAV-Dateien).
* Erfolgs-Akkord (C5–E5–G5–C6) mit dezentem Decay bei Bestehen.
* Subtiler Fehlerton bei Nicht-Bestehen.
* Lautstärkeregelung und Deaktivierungsoption in den Settings.

#### 4.3 FSRS-Vorbereitung (Spaced Repetition Metadaten)
Für jede absolvierte Frage werden im internen Datenspeicher Metadaten nach FSRS gepflegt:
```typescript
interface FSRSRecord {
    stability: number;      // Gedächtnisstabilität in Tagen
    difficulty: number;     // Schwierigkeitsgrad 1-10
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    lastReview: number;     // Timestamp
}
```

---

### Modul 5: Intelligenter Fehlerspeicher (`ErrorPoolManager.ts`)

#### 5.1 Fehler-Erfassung & Entlastung
* **Aufnahmekriterium:** MC-Aufgaben mit $< 5	ext{ Punkten}$ oder Freitextaufgaben mit $< 50\%$ der Maximalpunktzahl.
* **Referenzierung:** Verknüpfung primär über die stabile Block-ID (`^q-...`).
* **Löschkriterium (Mastery-Prinzip):** Wird eine Frage im Fehlerspeicher-Modus **zweimal in Folge fehlerfrei** beantwortet (`consecutiveSuccess >= 2`), wird sie aus dem Pool entfernt.

---

### Modul 6: Benutzeroberfläche & Desktop-Shortcuts (`DashboardView.ts`, `ExamRunnerView.ts`, `ResultView.ts`)

#### 6.1 Desktop-Tastatursteuerung
Im Prüfungsmodus stehen folgende Shortcuts zur Verfügung:
* `1`, `2`, `3`, `4`, `5`: Schaltet die Checkboxen A–E des aktuellen MC-Blocks um.
* `J` / `Pfeil rechts`: Nächste Frage.
* `K` / `Pfeil links`: Vorherige Frage.
* `M`: Aktuelle Frage für Review markieren ("Unsicher").
* `Enter` (mit Bestätigung): Klausur abgeben.

#### 6.2 Mobile- & Touch-Optimierung
* Touch-Targets für Checkboxen und Aktionsbuttons mindestens $44 	imes 44	ext{ Pixel}$.
* Automatisches Scrollen zum Fragenanfang beim Navigieren.
* Responsive Matrix-Navigation (Dropdown auf Mobile, Raster auf Desktop).

---

## 4. Vollständige TypeScript Datenstrukturen (`types.ts`)

```typescript
export type QuestionType = 'multiple-choice' | 'single-choice' | 'freetext' | 'cloze';

export interface ChoiceItem {
    id: string;             // Stabile UUID für Shuffling
    text: string;
    isCorrect: boolean;     // Im Markdown mit [x] definiert
    userSelected?: boolean; // Nutzereingabe
}

export interface QuestionDefinition {
    id: string;             // Block-ID (z.B. q-kond-01) oder Deterministischer Hash
    type: QuestionType;
    prompt: string;
    points: number;         // Standard bei MC: 5
    options?: ChoiceItem[];
    modelAnswer?: string;   // Freitext-Musterlösung
    rubric?: string[];      // Bewertungskriterien
    explanation?: string;   // Inhalt des [!explanation] Callouts
    sourceFilePath: string;
    blockId?: string;       // Obsidian Block-Referenz
}

export interface ActiveSessionState {
    sessionId: string;
    examTitle: string;
    module: string;
    sourceFilePath?: string;
    startTime: number;
    timeLimitSeconds: number;
    remainingSeconds: number;
    currentQuestionIndex: number;
    questions: QuestionDefinition[];
    flaggedQuestionIds: string[];
    userAnswers: Record<string, {
        selectedOptionIds?: string[];
        freetextAnswer?: string;
        clozeAnswers?: Record<string, string>;
    }>;
}

export interface PluginSettingsData {
    examsFolderPath: string;
    resultsFolderPath: string;
    defaultPassingScore: number;
    enableSoundEffects: boolean;
    enableConfetti: boolean;
    soundVolume: number;
    userXP: number;
    userLevel: number;
    streakDays: number;
    lastActiveDate: string; // YYYY-MM-DD
    activeSession: ActiveSessionState | null;
    errorPool: Record<string, {
        filePath: string;
        questionId: string;
        failCount: number;
        consecutiveSuccess: number;
        lastFailedAt: number;
    }>;
    fsrsData: Record<string, {
        stability: number;
        difficulty: number;
        reps: number;
        lapses: number;
        lastReview: number;
    }>;
}
```

---

## 5. Aktualisierte Implementierungs-Roadmap

```text
=============================================================================
SPRINT 1: PARSER & STABLE IDENTIFIERS
-----------------------------------------------------------------------------
[x] VaultIndexer mit Ordnerüberwachung (exams/)
[x] ExamParser mit Unterstützung für Block-IDs (^q-xxx) & Asset-Rendering
[x] Fallback-Hashing für ID-Stabilität bei Textänderungen
[x] Integration von MarkdownRenderer für Wikilinks und LaTeX

=============================================================================
SPRINT 2: SESSION ENGINE, AUTO-SAVE & GENERATOR
-----------------------------------------------------------------------------
[x] Doppelter Fisher-Yates Shuffle (Pool & 5er MC-Items)
[x] Generator für Modul-Mix mit konfigurierbarer Fragenanzahl
[x] Auto-Save Engine: Periodisches Schreiben von ActiveSessionState in data.json
[x] Crash-Recovery-Modal beim Plugin-Start

=============================================================================
SPRINT 3: SCORING, SHORTCUTS & ERGEBNISEXPORT
-----------------------------------------------------------------------------
[x] 5-Item-MC-Scoring (0-5 Punkte) und Freitext Self-Assessment
[x] Desktop-Tastatursteuerung (Ziffern 1-5, J/K Navigation, M Markierung)
[x] Result-Screen mit Prozentanzeige und Detailaufschlüsselung
[x] Automatisierter Export von Klausurberichten in exams/results/*.md

=============================================================================
SPRINT 4: GAMIFICATION, SOUND & FEHLERTRAINING
-----------------------------------------------------------------------------
[x] Zero-Dependency Web Audio Synthesizer (Sieg-/Niederlageakkorde)
[x] Offline-Konfetti via canvas-confetti
[x] XP-, Level- und Streak-Engine
[x] Fehlerspeicher-Re-Training mit 2x-Folgeerfolg-Kriterium

=============================================================================
SPRINT 5: MOBILE HARDENING & REVIEW COMPLIANCE
-----------------------------------------------------------------------------
[x] Mobile-Audit: Touch-Targets >= 44px, keine synchronen Node.js-APIs
[x] Memory-Leak-Audit (Prüfung von setInterval, window-Events, onunload)
[x] Theme-Audit mit Light- und Dark-Mode CSS-Tokens
[x] Release-Build (main.js, manifest.json, styles.css)
=============================================================================
```