# 🎓 Exam and Quiz Hub für Obsidian

**Die all-in-one Lern- und Klausursimulation direkt in deinem Obsidian-Vault.**  
Bereite dich optimal auf Prüfungen vor, simuliere echte Klausuren unter realistischem Zeitdruck, trainiere gezielt deine Wissenslücken mit dem intelligenten Fehlerspeicher und verfolge deinen Lernerfolg – **100 % offline, datenschutzsicher und auf Desktop, Smartphone & Tablet**.

---

## 🚀 Schnellstart in 3 Schritten

1. **Plugin öffnen:** Klicke auf das **Doktorhut-Icon** in der linken Obsidian-Seitenleiste (oder drücke `Strg + P` bzw. `Cmd + P` und wähle *„Exam and Quiz Hub: Klausur-Dashboard öffnen“*).
2. **Klausurnotiz anlegen:** Lege im Ordner `exams/` eine Markdown-Notiz an (z. B. `exams/Biologie/Zellbiologie.md`) mit deinen Prüfungsfragen.
3. **Training starten:** Öffne das Dashboard und klicke bei deiner Klausur auf **„Klausur starten“** – oder trainiere einen gemischten **Modul-Mix** bzw. deinen **Fehlerspeicher**.

---

## 💡 Wertvolle Tipps für deinen Prüfungserfolg

### 1. 🤖 Schnelle Fragenerstellung mit dem KI-Prompt
Du musst Fragen nicht mühsam von Hand abtippen:
* Öffne die **Plugin-Einstellungen** in Obsidian.
* Klicke ganz unten auf **„📋 Prompt kopieren“**.
* Füge den Prompt zusammen mit deinen Vorlesungsfolien, Altklausuren oder PDF-Zusammenfassungen in ein beliebiges Sprachmodell (z. B. **ChatGPT, Claude oder Gemini**) ein.
* Die KI liefert dir den fertigen Markdown-Code, den du einfach als Notiz in deinen `exams/`-Ordner kopierst.

### 2. 🎯 Der intelligente Fehlerspeicher (Gezieltes Meistern von Lücken)
* **Automatisches Sammeln:** Jede Frage, bei der du in einer Klausur Punkte verlierst, wandert automatisch in deinen persönlichen Fehlerspeicher.
* **Die 2×-Mastery-Regel:** Eine Frage gilt erst dann als dauerhaft verstanden und gemeistert, wenn du sie im Fehlerspeicher-Training **zweimal hintereinander fehlerfrei** beantwortest. Erst dann verlässt sie den Pool.
* **Tipp:** Starte jeden Lerntag mit einem kurzen Durchlauf des Fehlerspeichers auf dem Dashboard, um alte Schwachstellen dauerhaft auszumerzen!

### 3. 🔀 Modul-Mix: Die ultimative Prüfungssimulation
* In echten Klausuren kommen Fragen selten nach Themen sortiert.
* Nutze auf dem Dashboard den **Dynamischen Klausur-Generator**:
  * Wähle die Module aus, die abgeprüft werden sollen (z. B. `Anatomie + Physiologie`).
  * Stelle mit dem Schieberegler die gewünschte Fragenanzahl ein (z. B. 20 Fragen).
  * Das Plugin mischt die Fragen und berechnet automatisch das Zeitlimit.

### 4. 📱 Nahtlos unterwegs auf dem Smartphone lernen
* Das Plugin ist von Grund auf für Smartphones und Tablets optimiert:
  * Keine Überlagerung mit der Obsidian-Navigationsleiste oder der Smartphone-Statusleiste.
  * Schnelle Daumen-Navigation über die Kacheln (`1`, `2`, `3`...) und die Fußleiste.
  * Über die Schaltfläche **„Fragen-Matrix“ (▦)** kannst du jederzeit den Gesamtüberblick über alle Aufgaben aufrufen.
  * Flaggen-Funktion (`⚐ Markieren`): Markiere unsichere Fragen und überprüfe sie vor der Abgabe noch einmal.

### 5. ⌨️ Schneller navigieren am Desktop mit Tastenkürzeln
Am PC oder Mac kannst du Klausuren komplett ohne Maus bedienen:
| Taste | Aktion |
| :--- | :--- |
| `1`, `2`, `3`, `4`, `5` | Antwortoptionen A bis E an- oder abwählen |
| `J` oder `Pfeil rechts` | Nächste Frage |
| `K` oder `Pfeil links` | Vorherige Frage |
| `M` | Frage für spätere Überprüfung markieren / entmarkieren (`⚑`) |
| `Strg + Enter` / `Cmd + Enter` | Klausur abschließen und auswerten |

### 6. 📄 Detaillierte Ergebnisberichte speichern
* Nach jeder Klausur siehst du eine detaillierte Auswertung mit Prozentangabe, Notenstatus und Vergleich mit Musterlösungen.
* Klicke auf **„📄 Ergebnis als Vault-Notiz speichern“**, um die Auswertung dauerhaft im Ordner `exams/results/` abzulegen. So kannst du deine Entwicklung über das gesamte Semester nachverfolgen.

### 7. 🛡️ Crash-Schutz & Auto-Save
* Keine Angst vor leeren Akkus oder versehentlich geschlossenen Tabs: Der aktuelle Klausurstand wird alle 15 Sekunden sowie beim Wechseln von Apps automatisch zwischengespeichert.
* Beim nächsten Start fragt dich Obsidian sofort, ob du die unvollendete Klausur mit exakt verbleibender Restzeit fortsetzen möchtest.

---

## 📝 So formatierst du deine Prüfungsfragen

Alle Prüfungen liegen als Markdown-Dateien im Ordner `exams/` (oder Unterordnern wie `exams/Psychologie/`).

### 1. Kopfdaten (YAML Frontmatter)
Ganz oben in der Notiz legst du grundlegende Einstellungen fest:

```markdown
---
type: exam
module: M1
title: Probeklausur Grundlagen
timeLimitMinutes: 90
passingScore: 75%
shuffleQuestions: true
shuffleOptions: true
---
```

* **`module`**: Name oder Kürzel des Fachs (z. B. `M1`, `Biologie`, `Recht`).
* **`title`**: Titel der Prüfung.
* **`timeLimitMinutes`**: Zeitlimit in Minuten (Standard: **90 Minuten**).
* **`passingScore`**: Bestehensgrenze in Prozent (Standard: **75 %**).
* **`shuffleQuestions` / `shuffleOptions`**: Auf `true` setzen, um Fragen und Antworten bei jedem Durchlauf zufällig zu durchmischen.

---

### 2. Multiple-Choice-Fragen (5-Aussagen-Standard)
Jede Multiple-Choice-Frage beginnt mit einer `##`-Überschrift und enthält 5 Aussagen mit Checkboxen:

```markdown
## Welche Aussagen zur klassischen Konditionierung treffen zu? ^q-kond-01
type: multiple-choice
points: 5

- [x] Ein unkonditionierter Reiz (UCS) löst reflexartig eine UCR aus.
- [ ] Extinktion löscht die Gedächtnisspur vollständig und unwiderruflich.
- [x] Spontanerholung beschreibt das Wiederauftreten der CR nach einer Ruhepause.
- [ ] Reizgeneralisierung bedeutet, dass ausschließlich der identische Reiz wirkt.
- [x] Konditionierung höherer Ordnung baut auf einem konditionierten Reiz auf.

> [!explanation]
> Extinktion ist Hemmungslernen (Inhibition), keine Löschung. Generalisierung reagiert auch auf Reizähnlichkeiten.
```

> [!TIP]
> **Block-IDs (`^q-kond-01`):** Hänge an das Ende jeder Frage-Überschrift eine eindeutige ID (wie `^q-thema-01`). So erkennt das Plugin die Frage zuverlässig wieder – selbst wenn du später den Fragetext umformulierst!

---

### 3. Freitextfragen mit Musterlösung & Kriterien
Für offene Aufgaben, Definitionen oder Rechenwege:

```markdown
## Erkläre das Modell der Kognitiven Dissonanz nach Festinger. ^q-diss-02
type: freetext
points: 3

Musterloesung:
Kognitive Dissonanz beschreibt einen aversiven motivationalen Spannungszustand, der entsteht, wenn widersprüchliche Kognitionen vorliegen.

Kriterien:
1. Definition des aversiven Spannungszustands (1P)
2. Ursache: Widerspruch relevanter Kognitionen (1P)
3. Mindestens eine Reduktionsstrategie genannt (1P)

> [!explanation]
> Typische Reduktionsstrategien: Einstellungsänderung, Hinzufügen konsonanter Kognitionen oder Abwertung der Wichtigkeit.
```

In der Klausurauswertung kannst du deine getippte Antwort direkt mit der Musterlösung vergleichen und dir anhand der Kriterien selbst Punkte zuweisen (`0`, `0.5`, `1.0`, etc.).

---

### 4. Single-Choice-Fragen (Genau 1 richtige Antwort)
```markdown
## Welches Organ ist primär für die Insulinproduktion verantwortlich? ^q-bio-03
type: single-choice
points: 1

- [ ] Leber
- [x] Bauchspeicheldrüse (Pankreas)
- [ ] Milz
- [ ] Niere
```

---

## ⚙️ Einstellungen & Anpassung

Unter **Obsidian-Einstellungen > Community-Plugins > Exam and Quiz Hub** kannst du alles an deine Bedürfnisse anpassen:
* **Klausuren-Ordner:** Standardmäßig `exams` (kann auf jeden beliebigen Ordner geändert werden).
* **Standard-Bestehensgrenze:** Standardmäßig auf **75 %** voreingestellt.
* **Audio & Gamification:** Schalte Klick- und Erfolgstöne oder die Konfetti-Animation bei bestandenen Prüfungen ein oder aus.
* **Synchronisation:** Automatische Speicherung deines Lernfortschritts in `.quiz-learning-data.json`.

---

## 🔄 Gerätesynchronisation (PC, Mac, iPhone, iPad & Android)

Deine Lerndaten (Fehlerspeicher, Erfahrungs-Punkte, Level und Streaks) werden automatisch in einer synchronisierbaren Vault-Datei gespeichert. 
* Funktioniert ohne zusätzliche Konfiguration mit **Obsidian Sync, iCloud, Git, Syncthing oder Remotely Save**.
* Lerne morgens am Schreibtisch und wiederhole nachmittags in der Bahn auf dem Smartphone deine Fehlerfragen – dein Fortschritt bleibt immer aktuell.

---

## 📦 Manuelle Installation

1. Lade die neuesten Dateien (`main.js`, `manifest.json`, `styles.css`) herunter.
2. Öffne deinen Obsidian-Vault-Ordner und navigiere zu `.obsidian/plugins/`.
3. Erstelle einen Unterordner namens `exam-quiz-hub` und lege die 3 Dateien dort ab.
4. Starte Obsidian neu oder lade die Plugins unter **Einstellungen > Community-Plugins** neu.
5. Aktiviere **Exam and Quiz Hub**.

Viel Erfolg bei deiner Prüfungsvorbereitung! 🎓
