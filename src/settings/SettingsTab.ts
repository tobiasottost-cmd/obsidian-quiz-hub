import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type ExamQuizHubPlugin from '../main';

const AI_CONVERTER_PROMPT = `Du bist ein Experte für didaktische Prüfungserstellung und Markdown-Formatierung.
Wandle die folgenden Lerninhalte, Altfragen oder Prüfungsfragen in das exakte Format für das Obsidian Plugin "Exam and Quiz Hub" um.

WICHTIGE REGELN & SYNTAX:
1. Dateikopf (YAML Frontmatter) ganz oben:
---
type: exam
module: [Modulkürzel, z.B. M1 oder Biologie]
semester: [Optional, z.B. WiSe26/27]
title: [Aussagekräftiger Klausurtitel]
timeLimitMinutes: [Zeitlimit in Minuten, z.B. 45]
passingScore: 60%
shuffleQuestions: true
shuffleOptions: true
---

2. Frageüberschriften:
- Jede Aufgabe MUSS mit einer H2-Überschrift beginnen: '## [Fragetext] ^q-[id]'
- Am Ende der Überschrift MUSS eine stabile Block-ID stehen, z.B. ^q-bio-01 oder ^q-kond-02.
- Trenne Aufgaben jeweils mit drei Bindestrichen '---'.

3. Multiple-Choice Aufgaben (Universitärer 5-Aussagen-Standard):
- type: multiple-choice
- points: 5
- Exakt 5 binäre Aussagen als Checkboxen:
  - [x] für wahre/zutreffende Aussagen
  - [ ] für falsche/unzutreffende Aussagen
- Erklärungs-Callout direkt darunter:
  > [!explanation]
  > Ausführliche Erklärung zur Musterlösung und zu den einzelnen Aussagen.

4. Freitext-Aufgaben:
- type: freetext
- points: [Maximalpunkte, z.B. 3]
- Musterloesung: [Vollständige Musterantwort]
- Kriterien:
  1. [Kriterium 1] (1P)
  2. [Kriterium 2] (1P)
- Erklärungs-Callout:
  > [!explanation]
  > Didaktische Hinweise zur Punktevergabe.

---
HIER SIND DIE ZU KONVERTIERENDEN FRAGEN/INHALTE:
[Füge hier deine Fragen, PDF-Texte oder Altfragen ein]`;

const SAMPLE_MARKDOWN_CODE = `---
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
> Maximale Punktzahl: 3 Punkte. Wichtiges Paradigma: Festinger & Carlsmith (1959).`;

export class SettingsTab extends PluginSettingTab {
    private plugin: ExamQuizHubPlugin;

    constructor(app: App, plugin: ExamQuizHubPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    public display(): void {
        this.renderSettings();
    }

    private renderSettings(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl).setName('Allgemeine Einstellungen').setHeading();

        new Setting(containerEl)
            .setName('Klausuren-Ordner')
            .setDesc('Verzeichnis im Vault, in dem Prüfungs- und Quiz-Notizen gesucht werden.')
            .addText(text => text
                .setPlaceholder('exams')
                .setValue(this.plugin.settings.examsFolderPath)
                .onChange(async (value) => {
                    this.plugin.settings.examsFolderPath = value.trim() || 'exams';
                    await this.plugin.saveSettings();
                    await this.plugin.indexer.updateFolderPath(this.plugin.settings.examsFolderPath);
                })
            );

        new Setting(containerEl)
            .setName('Ergebnisberichte-Ordner')
            .setDesc('Verzeichnis, in dem Klausurauswertungen als Markdown-Notizen abgelegt werden.')
            .addText(text => text
                .setPlaceholder('exams/results')
                .setValue(this.plugin.settings.resultsFolderPath)
                .onChange(async (value) => {
                    this.plugin.settings.resultsFolderPath = value.trim() || 'exams/results';
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Standard-Bestehensgrenze (%)')
            .setDesc('Prozentsatz, ab dem eine Klausur als bestanden gilt (wenn nicht in Notiz definiert).')
            .addSlider(slider => slider
                .setLimits(40, 90, 5)
                .setValue(this.plugin.settings.defaultPassingScore)
                .onChange(async (value) => {
                    this.plugin.settings.defaultPassingScore = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl).setName('Audio & Gamification').setHeading();

        new Setting(containerEl)
            .setName('Soundeffekte aktivieren')
            .setDesc('Synthetisierte Web-Audio-Klänge bei Bestehen, Fehler und Klicks abspielen (100% offline).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSoundEffects)
                .onChange(async (value) => {
                    this.plugin.settings.enableSoundEffects = value;
                    this.plugin.soundManager.updateSettings(value, this.plugin.settings.soundVolume);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Sound-Lautstärke')
            .setDesc('Lautstärke der synthetisierten Klänge anpassen.')
            .addSlider(slider => slider
                .setLimits(0.1, 1.0, 0.1)
                .setValue(this.plugin.settings.soundVolume)
                .onChange(async (value) => {
                    this.plugin.settings.soundVolume = value;
                    this.plugin.soundManager.updateSettings(this.plugin.settings.enableSoundEffects, value);
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Konfetti-Animation aktivieren')
            .setDesc('Canvas-Konfetti beim Bestehen einer Klausur anzeigen.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableConfetti)
                .onChange(async (value) => {
                    this.plugin.settings.enableConfetti = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl).setName('Daten & Speicher').setHeading();

        const errorCount = Object.keys(this.plugin.settings.errorPool).length;
        new Setting(containerEl)
            .setName('Fehlerspeicher zurücksetzen')
            .setDesc(`Aktuell befinden sich ${errorCount} Frage(n) im Fehlerspeicher.`)
            .addButton(btn => {
                btn.setButtonText('Fehlerspeicher leeren');
                btn.setClass('mod-warning');
                btn.onClick(() => {
                    this.plugin.settings.errorPool = {};
                    void this.plugin.saveSettings();
                    this.renderSettings();
                });
            });

        new Setting(containerEl)
            .setName('Fortschritt & Statistiken zurücksetzen')
            .setDesc(`Level ${this.plugin.settings.userLevel} (${this.plugin.settings.userXP} XP), Streak: ${this.plugin.settings.streakDays} Tage.`)
            .addButton(btn => {
                btn.setButtonText('Statistiken zurücksetzen');
                btn.setClass('mod-warning');
                btn.onClick(() => {
                    this.plugin.settings.userXP = 0;
                    this.plugin.settings.userLevel = 1;
                    this.plugin.settings.streakDays = 0;
                    this.plugin.settings.lastActiveDate = '';
                    this.plugin.settings.fsrsData = {};
                    void this.plugin.saveSettings();
                    this.renderSettings();
                });
            });

        // --- AI CONVERTER & MARKDOWN FORMAT SECTION ---
        this.displayAIConverterSection(containerEl);
    }

    private displayAIConverterSection(containerEl: HTMLElement): void {
        new Setting(containerEl).setName('🤖 KI-Prompt & Markdown-Format').setHeading();

        containerEl.createEl('p', {
            cls: 'text-muted',
            text: 'Nutze diesen optimierten Prompt für ChatGPT, Claude oder Gemini, um Vorlesungsfolien, Altklausuren oder PDF-Notizen direkt in das für dieses Plugin erforderliche Format umzuwandeln.'
        });

        // AI Prompt Setting
        new Setting(containerEl)
            .setName('KI-Konverter Prompt')
            .setDesc('Kopiere diesen Prompt in ein beliebiges Sprachmodell zusammen mit deinen Inhalten.')
            .addButton(btn => btn
                .setButtonText('📋 Prompt kopieren')
                .setCta()
                .onClick(() => {
                    this.copyTextToClipboard(AI_CONVERTER_PROMPT);
                    new Notice('✅ KI-Prompt erfolgreich in die Zwischenablage kopiert!');
                    btn.setButtonText('✅ Kopiert!');
                    window.setTimeout(() => {
                        btn.setButtonText('📋 Prompt kopieren');
                    }, 2500);
                })
            );

        // Prompt Preview Textarea
        const promptArea = containerEl.createEl('textarea', {
            cls: 'exam-hub-settings-code-preview',
            attr: { readonly: 'true', rows: '8' }
        });
        promptArea.value = AI_CONVERTER_PROMPT;

        // Sample Markdown Setting
        new Setting(containerEl)
            .setName('Markdown-Beispieldatei')
            .setDesc('So muss eine Klausurdatei im Ordner "exams/" aufgebaut sein (Frontmatter, MC-Items mit [x], Freitext und Callouts).')
            .addButton(btn => btn
                .setButtonText('📄 Beispiel kopieren')
                .onClick(() => {
                    this.copyTextToClipboard(SAMPLE_MARKDOWN_CODE);
                    new Notice('✅ Markdown-Beispiel in die Zwischenablage kopiert!');
                    btn.setButtonText('✅ Kopiert!');
                    window.setTimeout(() => {
                        btn.setButtonText('📄 Beispiel kopieren');
                    }, 2500);
                })
            );

        // Sample Preview Textarea
        const sampleArea = containerEl.createEl('textarea', {
            cls: 'exam-hub-settings-code-preview',
            attr: { readonly: 'true', rows: '10' }
        });
        sampleArea.value = SAMPLE_MARKDOWN_CODE;
    }

    private copyTextToClipboard(text: string): void {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            void navigator.clipboard.writeText(text);
        }
    }
}
