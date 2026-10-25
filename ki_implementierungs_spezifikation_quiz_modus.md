# Feature-Spezifikation & KI-Arbeitsanweisung: Erweiterung des Quiz-Modus (`type: quiz`)

## 1. Kontext & Zielsetzung
Das Obsidian-Plugin **Exam and Quiz Hub** (`obsidian-quiz-hub`) verfügt bereits über einen vollständig funktionierenden Klausur-Modus (`type: exam`). Nun soll die namensgebende **Quiz-Funktionalität (`type: quiz`)** ausgebaut und klar vom Klausur-Modus abgegrenzt werden.

**WICHTIGSTE REGEL (Non-Regression):**
Alle bestehenden Funktionen des `exam`-Modus (Timer, verdeckte Ergebnisse bis zur Abgabe, Klausur-Generator, 5-Item-MC-Scoring, Freitext-Self-Assessment, Crash-Recovery, Auto-Save, FSRS/Fehlerspeicher, Gamification und Vault-Sync in `exams/.quiz-learning-data.json`) **müssen zu 100 % unverändert und voll funktionsfähig bleiben**.

---

## 2. Kernunterschiede: `exam` vs. `quiz`

| Merkmal | Klausur (`type: exam`) - *BESTEHEND* | Quiz (`type: quiz`) - *NEU / ERWEITERT* |
| :--- | :--- | :--- |
| **Frontmatter-Attribut** | `type: exam` (Standard/Fallback) | `type: quiz` |
| **Zeitbegrenzung** | Ja (`timeLimitMinutes`, Countdown-Timer, Auto-Submit bei Ablauf) | **Keine Zeitbegrenzung** (Kein Countdown; `timeLimitMinutes` wird ignoriert oder ist optional/inaktiv) |
| **Ergebnis-Auflösung** | Erst ganz am Ende nach kompletter Klausur-Abgabe | **Direkte Auflösung (Instant Feedback)** unmittelbar nach Beantwortung/Prüfung jeder einzelnen Frage |
| **Dashboard-Darstellung** | Unter Kategorie/Filter „Klausuren“ (`Exam`) | Klare Differenzierung: Eigene Darstellung/Filterung als „Quiz“ im Dashboard |

---

## 3. Detaillierte technische Anforderungen

### 3.1. Datenmodell & Markdown-Parser (`type: quiz`)
1. **Frontmatter-Parsing:**
   - Unterstütze im YAML-Frontmatter der Markdown-Dateien (im Ordner `exams/`) explizit den Wert `type: quiz` neben `type: exam`.
   - Falls kein `type` angegeben ist, bleibt `exam` der Fallback, um Abwärtskompatibilität zu sichern.
   - Beispiel für ein Quiz-Frontmatter:
     ```yaml
     ---
     type: quiz
     module: M1
     semester: WiSe26/27
     title: Kurzquiz Klassische Konditionierung
     passingScore: 60%
     shuffleQuestions: true
     shuffleOptions: true
     ---
     ```
2. **Typ-Definitionen (TypeScript Interfaces):**
   - Erweitere die bestehenden Interfaces für Datei-Metadaten und `ActiveSessionState` um die klare Unterscheidung `mode: 'exam' | 'quiz'` (bzw. nutze das geparste `type`-Feld durchgängig in der Session-Engine).
   - Im Modus `quiz` darf `timeLimitMinutes` auf `null` / `0` / `undefined` gesetzt werden, ohne dass Validierungs- oder Berechnungsfehler auftreten.

---

### 3.2. Dashboard: Differenzierung zwischen Quiz und Klausur
Im Haupt-Dashboard müssen Nutzer klar zwischen **Klausuren (`exam`)** und **Quizzen (`quiz`)** unterscheiden können:
1. **Visuelle Kennzeichnung & Filterung:**
   - Füge im Dashboard eine klare Trennung ein (z. B. über Tabs `Alle | Klausuren | Quizze`, separate Sektionen oder deutliche Badges `[Klausur]` vs. `[Quiz]` auf den Karten).
   - Zeige bei Quiz-Einträgen **keine** Zeitangabe an (oder kennzeichne sie mit `⏱️ Ohne Zeitlimit` / `⚡ Direktes Feedback`).
2. **Dynamischer Generator / Modul-Mix:**
   - Biete beim Starten eines dynamischen Laufs (Modul-Mix oder Einzeldatei) die Möglichkeit bzw. erkenne anhand des Dateityps (`type: quiz`), ob der Lauf im **Klausur-Modus** (mit Timer & Endauswertung) oder im **Quiz-Modus** (ohne Timer & mit direkter Auflösung) gestartet wird.

---

### 3.3. Session-UI & Ablauf im Quiz-Modus (`mode === 'quiz'`)

#### A. Keine Zeitbegrenzung (Kein Timer)
- **Kein Countdown:** Die Timer-Komponente in der Kopfzeile der Session-Ansicht wird im `quiz`-Modus ausgeblendet oder zeigt lediglich „Quiz-Modus (Kein Zeitlimit)“ an.
- **Kein Auto-Submit:** Es läuft kein Hintergrund-Intervall, das die Session nach Ablauf einer Zeitspanne automatisch beendet.
- **Crash-Recovery / Auto-Save:** Die 15s Auto-Save Engine speichert auch laufende Quiz-Sessions (inkl. bereits aufgelöster Fragen). Im Wiederherstellungsdialog wird entsprechend *„Laufendes Quiz fortsetzen? (X/Y beantwortet)“* ohne Restzeit-Angabe angezeigt.

#### B. Direkte Auflösung der richtigen Ergebnisse (Instant Feedback pro Frage)
Im Gegensatz zur Klausur soll der Nutzer im Quiz-Modus bei jeder Frage **sofort erfahren, ob er richtig lag**:

1. **Multiple-Choice-Fragen (5-Item-Standard):**
   - Der Nutzer wählt seine Antworten (Optionen A–E) wie gewohnt per Klick oder Tasten `1`–`5` aus.
   - **Action-Button „Antwort prüfen“ (Check Answer):**
     - Solange die aktuelle Frage noch nicht geprüft wurde, gibt es einen Button **„Antwort prüfen“** (oder automatische Prüfung beim Klick auf „Weiter“, bevorzugt jedoch ein expliziter Prüfschritt, damit man mehrere der 5 Aussagen ankreuzen kann).
     - Sobald die Frage geprüft wird:
       1. **Sperren der Eingabe:** Die 5 Optionen dieser Frage werden gegen nachträgliches Ändern gesperrt (`locked` / `revealed`).
       2. **Visuelles Feedback pro Aussage:** Jede der 5 Aussagen zeigt sofort an, ob die Auswahl/Nicht-Auswahl korrekt war (z. B. grüne/rote Markierung, Häkchen/Kreuz und Anzeige der erreichten Punkte `X / 5 Punkte`).
       3. **Erklärung einblenden:** Falls ein `> [!explanation]` Callout zur Frage existiert, wird dieser **sofort unterhalb der Frage eingeblendet** (gerendert via `MarkdownRenderer`).
       4. **Audio/Gamification-Feedback (optional/dezent):** Falls aktiviert, kann das bestehende Web-Audio-Feedback (Erfolg/Klick) direkt beim Prüfen genutzt werden.

2. **Freitext-Fragen (`type: freetext`):**
   - Der Nutzer gibt seine Antwort in das Textfeld ein und klickt auf **„Lösung anzeigen / Prüfen“**.
   - **Sofortige Gegenüberstellung:** Musterlösung, Bewertungsrubrik (`Kriterien`) und `> [!explanation]` werden direkt unter dem Eingabefeld eingeblendet.
   - Der Nutzer wählt direkt im Anschluss über den bestehenden **Self-Assessment Button-Wähler** (`0`, `0.5`, `1.0`, ..., `maxPoints`) seine Punktzahl aus, bevor er zur nächsten Frage weitergeht.

3. **Navigation & Fragen-Matrix (Drawer):**
   - Bereits geprüfte Fragen werden in der Fragen-Matrix farblich nach Erfolg markiert (z. B. Grün bei voller Punktzahl, Gelb/Rot bei Teilpunkten/Fehlern).
   - Beim Zurückblättern (`K` / Pfeil links) zu einer bereits geprüften Frage bleibt deren aufgelöster Zustand inkl. Erklärung sichtbar, aber schreibgeschützt.
   - **Tastatur-Shortcuts:**
     - `1`–`5`: Optionen A–E umschalten (nur solange Frage noch nicht aufgelöst ist).
     - `Enter` oder `Space` (wenn nicht im Textfeld): Aktuelle Frage prüfen („Antwort prüfen“), oder falls bereits geprüft -> Nächste Frage (`J` / Pfeil rechts).

---

### 3.4. Abschluss, Fehlerspeicher, Gamification & Export
Wenn alle Fragen im Quiz beantwortet/geprüft wurden (oder der Nutzer auf „Quiz abschließen“ klickt):
1. **Zusammenfassungs-Ansicht (Result View):**
   - Zeige die gewohnte Endauswertung (Gesamtpunkte, Prozentwert, Bestehensstatus gemäß `passingScore`, Konfetti-Animation).
   - Da Freitext-Fragen im Quiz bereits während des Durchlaufs per Self-Assessment bewertet wurden, sind die Punkte hier bereits final berechnet (falls eine Freitext-Frage übersprungen wurde, kann sie wie gewohnt noch bewertet werden).
2. **Fehlerspeicher & FSRS (`exams/.quiz-learning-data.json`):**
   - Die Logik greift identisch: Fragen mit `< 5` Punkten (MC) oder `< 50 %` (Freitext) landen im Fehlerspeicher; gemeisterte Fragen werden aktualisiert und über den bestehenden Vault-Sync synchronisiert.
3. **XP & Streak:**
   - XP-Berechnung und Daily-Streak funktionieren genau wie im Exam-Modus.
4. **Markdown-Ergebnis-Export (`exams/results/`):**
   - Beim Exportieren des Berichts wird im Frontmatter bzw. Titel vermerkt, dass es sich um ein `quiz` handelte.

---

## 4. Checkliste für die KI-Umsetzung (Schritt-für-Schritt)
Bitte gehe bei der Implementierung in folgender Reihenfolge vor:

1. **Analyse:** Prüfe die bestehenden Dateien in `src/` (insbesondere Parser, Types, State-Management, Dashboard-View und Session/Exam-View).
2. **Types & Parser erweitern:** Erlaube `type: 'exam' | 'quiz'` im Frontmatter-Parser und im `ActiveSessionState` (inkl. `revealedQuestions: Record<string, boolean>` für bereits aufgelöste Fragen im Quiz-Modus).
3. **Dashboard anpassen:** Füge die visuelle Unterscheidung und Filterung zwischen `Quiz` und `Klausur` im Dashboard hinzu.
4. **Session-View für `quiz` erweitern:**
   - Deaktiviere den Timer, wenn `session.mode === 'quiz'`.
   - Implementiere den „Antwort prüfen“-Zustand pro Frage (MC-Sofortauswertung + Callout-Anzeige + Sperren der Optionen; Freitext-Sofortauflösung + direktes Self-Assessment).
5. **Tests & Build prüfen:**
   - Stelle sicher, dass bestehende Tests (`npm test`) weiterhin grün sind und ergänze Unit-Tests für das Parsing von `type: quiz` sowie den Quiz-Session-Ablauf.
   - Prüfe, dass `npm run build` fehlerfrei durchläuft und keine Obsidian-Lint-Regeln verletzt werden (insb. keine statischen Style-Zuweisungen, Mobile-Touch-Targets $\ge 44 \times 44\,\text{px}$, CSS-Klassen in `styles.css`).