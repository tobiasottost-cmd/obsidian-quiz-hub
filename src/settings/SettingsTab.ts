import { App, Notice, PluginSettingTab, Setting, SettingDefinitionItem, TFile } from 'obsidian';
import type ExamQuizHubPlugin from '../main';
import { BlockIdAutoAssigner } from '../parser/BlockIdAutoAssigner';

const AI_CONVERTER_PROMPT = `Du bist ein Experte für didaktische Prüfungserstellung und Markdown-Formatierung.
Wandle die folgenden Lerninhalte, Altfragen oder Prüfungsfragen in das exakte Format für das Obsidian Plugin "Exam and Quiz Hub" um.

WICHTIGE REGELN & SYNTAX:
1. Dateikopf (YAML Frontmatter) ganz oben:
---
type: exam
module: [Modulkürzel, z.B. M1 oder Biologie]
semester: [Optional, z.B. WiSe26/27]
title: [Aussagekräftiger Klausurtitel]
timeLimitMinutes: [Zeitlimit in Minuten, z.B. 90]
passingScore: 75%
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
timeLimitMinutes: 90
passingScore: 75%
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

    public override getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                name: 'Klausuren-Ordner',
                desc: 'Verzeichnis im Vault, in dem Prüfungs- und Quiz-Notizen gesucht werden.',
                aliases: ['klausuren', 'prüfungen', 'ordner', 'exams', 'folder', 'path'],
                control: {
                    type: 'text',
                    key: 'examsFolderPath',
                    placeholder: 'exams',
                    defaultValue: 'exams',
                },
            },
            {
                name: 'Ergebnisberichte-Ordner',
                desc: 'Verzeichnis, in dem Klausurauswertungen als Markdown-Notizen abgelegt werden.',
                aliases: ['ergebnisse', 'berichte', 'results', 'reports', 'auswertung', 'folder'],
                control: {
                    type: 'text',
                    key: 'resultsFolderPath',
                    placeholder: 'exams/results',
                    defaultValue: 'exams/results',
                },
            },
            {
                name: 'Standard-Bestehensgrenze (%)',
                desc: 'Prozentsatz, ab dem eine Klausur als bestanden gilt (wenn nicht in Notiz definiert).',
                aliases: ['bestehen', 'grenze', 'passing', 'score', 'prozent'],
                control: {
                    type: 'slider',
                    key: 'defaultPassingScore',
                    min: 40,
                    max: 90,
                    step: 5,
                    defaultValue: 75,
                    displayFormat: (val: number) => `${val}%`,
                },
            },
            {
                type: 'group',
                heading: 'Audio & Gamification',
                items: [
                    {
                        name: 'Soundeffekte aktivieren',
                        desc: 'Synthetisierte Web-Audio-Klänge bei Bestehen, Fehler und Klicks abspielen (100% offline).',
                        aliases: ['sound', 'audio', 'töne', 'klang', 'effekte'],
                        control: {
                            type: 'toggle',
                            key: 'enableSoundEffects',
                            defaultValue: true,
                        },
                    },
                    {
                        name: 'Sound-Lautstärke',
                        desc: 'Lautstärke der synthetisierten Klänge anpassen.',
                        aliases: ['volume', 'lautstärke', 'sound', 'audio'],
                        control: {
                            type: 'slider',
                            key: 'soundVolume',
                            min: 0.1,
                            max: 1.0,
                            step: 0.1,
                            defaultValue: 0.5,
                            displayFormat: (val: number) => `${Math.round(val * 100)}%`,
                        },
                    },
                    {
                        name: 'Konfetti-Animation aktivieren',
                        desc: 'Canvas-Konfetti beim Bestehen einer Klausur anzeigen.',
                        aliases: ['confetti', 'konfetti', 'animation', 'bestehen'],
                        control: {
                            type: 'toggle',
                            key: 'enableConfetti',
                            defaultValue: true,
                        },
                    },
                ],
            },
            {
                type: 'group',
                heading: 'Daten & Speicher',
                items: [
                    {
                        name: 'Lerndaten im Vault synchronisieren (Mobil & Desktop)',
                        desc: 'Speichert Fehlerspeicher, XP und Lernfortschritt in einer synchronisierbaren Vault-Datei (.quiz-learning-data.json) für automatischen Abgleich über Obsidian Sync, iCloud oder Git.',
                        aliases: ['sync', 'synchronisation', 'mobile', 'desktop', 'abgleich', 'cloud'],
                        control: {
                            type: 'toggle',
                            key: 'syncLearningDataInVault',
                            defaultValue: true,
                        },
                    },
                    {
                        name: 'Jetzt mit Vault-Datei abgleichen',
                        desc: 'Liest die Lerndaten aus der Vault-Datei ein und führt sie verlustfrei mit diesem Gerät zusammen.',
                        aliases: ['sync', 'abgleichen', 'aktualisieren', 'reload'],
                        render: (setting) => {
                            setting.addButton(btn => {
                                btn.setButtonText('🔄 Jetzt synchronisieren');
                                btn.onClick(async () => {
                                    btn.setButtonText('⏳ Synchronisiere...');
                                    btn.setDisabled(true);
                                    const changed = await this.plugin.learningSyncManager.loadAndMerge(true);
                                    this.refreshSettingsTab();
                                    if (!changed) {
                                        new Notice('✅ Bereits auf dem neuesten Stand!');
                                    }
                                    btn.setButtonText('🔄 Jetzt synchronisieren');
                                    btn.setDisabled(false);
                                });
                            });
                        },
                    },
                    {
                        name: 'Fehlerspeicher zurücksetzen',
                        desc: `Aktuell befinden sich ${Object.keys(this.plugin.settings.errorPool).length} Frage(n) im Fehlerspeicher.`,
                        aliases: ['fehlerspeicher', 'error pool', 'fehler', 'leeren', 'reset'],
                        render: (setting) => {
                            setting.addButton(btn => {
                                btn.setButtonText('Fehlerspeicher leeren');
                                btn.setClass('mod-warning');
                                btn.onClick(async () => {
                                    this.plugin.settings.errorPool = {};
                                    this.plugin.settings.resolvedPool = {};
                                    await this.plugin.saveSettings();
                                    await this.plugin.learningSyncManager.saveLearningData(true);
                                    new Notice('Fehlerspeicher wurde geleert.');
                                    this.refreshSettingsTab();
                                });
                            });
                        },
                    },
                    {
                        name: 'Fortschritt & Statistiken zurücksetzen',
                        desc: `Level ${this.plugin.settings.userLevel} (${this.plugin.settings.userXP} XP), Streak: ${this.plugin.settings.streakDays} Tage.`,
                        aliases: ['xp', 'level', 'streak', 'fortschritt', 'statistiken', 'fsrs', 'reset'],
                        render: (setting) => {
                            setting.addButton(btn => {
                                btn.setButtonText('Statistiken zurücksetzen');
                                btn.setClass('mod-warning');
                                btn.onClick(async () => {
                                    this.plugin.settings.userXP = 0;
                                    this.plugin.settings.userLevel = 1;
                                    this.plugin.settings.streakDays = 0;
                                    this.plugin.settings.lastActiveDate = '';
                                    this.plugin.settings.fsrsData = {};
                                    await this.plugin.saveSettings();
                                    await this.plugin.learningSyncManager.saveLearningData(true);
                                    new Notice('Statistiken wurden zurückgesetzt.');
                                    this.refreshSettingsTab();
                                });
                            });
                        },
                    },
                ],
            },
            {
                type: 'group',
                heading: '⚡ Automatisierung & Block-IDs',
                items: [
                    {
                        name: 'Fehlende Frage-Block-IDs automatisch ergänzen',
                        desc: 'Fügt allen Fragen in Klausurnotizen, die noch keine Block-ID haben, automatisch eine saubere ID an (z.B. ^q-m1-01). Bestehende IDs bleiben unberührt. (Tipp: Auch per Rechtsklick in Notizen oder über die Befehlspalette verfügbar).',
                        aliases: ['blockid', 'block-id', 'automatisch', 'generieren', 'fragen', 'id', 'prefix'],
                        render: (setting) => {
                            setting.addButton(btn => {
                                btn.setButtonText('⚡ Block-IDs in allen Klausuren ergänzen');
                                btn.setCta();
                                btn.onClick(async () => {
                                    btn.setButtonText('⏳ Durchsuche Klausuren...');
                                    btn.setDisabled(true);
                                    try {
                                        const examFiles = this.plugin.indexer.getAllExamFiles();
                                        let totalAdded = 0;
                                        let filesUpdated = 0;
                                        for (const exam of examFiles) {
                                            const file = this.plugin.app.vault.getAbstractFileByPath(exam.sourceFilePath);
                                            if (file instanceof TFile) {
                                                const added = await BlockIdAutoAssigner.processFile(this.plugin.app, file);
                                                if (added > 0) {
                                                    totalAdded += added;
                                                    filesUpdated++;
                                                }
                                            }
                                        }
                                        if (totalAdded > 0) {
                                            new Notice(`✅ ${totalAdded} Block-ID(s) in ${filesUpdated} Klausurdatei(en) erfolgreich ergänzt!`);
                                        } else {
                                            new Notice('ℹ️ Alle Fragen in deinen Klausuren besitzen bereits eine Block-ID.');
                                        }
                                    } catch (err) {
                                        new Notice('❌ Fehler beim Ergänzen der Block-IDs.');
                                        console.error('Error auto-assigning block IDs:', err);
                                    } finally {
                                        btn.setButtonText('⚡ Block-IDs in allen Klausuren ergänzen');
                                        btn.setDisabled(false);
                                    }
                                });
                            });
                        },
                    },
                ],
            },
            {
                type: 'group',
                heading: '🤖 KI-Prompt & Markdown-Format',
                items: [
                    {
                        name: 'KI-Konverter Prompt',
                        desc: 'Kopiere diesen Prompt in ein beliebiges Sprachmodell zusammen mit deinen Inhalten.',
                        aliases: ['ki', 'ai', 'prompt', 'chatgpt', 'claude', 'gemini', 'konverter'],
                        render: (setting) => {
                            setting.settingEl.addClass('exam-hub-setting-wrap');
                            setting.addButton(btn => btn
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
                            const promptArea = setting.settingEl.createEl('textarea', {
                                cls: 'exam-hub-settings-code-preview',
                                attr: { readonly: 'true', rows: '8' }
                            });
                            promptArea.value = AI_CONVERTER_PROMPT;
                        },
                    },
                    {
                        name: 'Markdown-Beispieldatei',
                        desc: 'So muss eine Klausurdatei im Ordner "exams/" aufgebaut sein (Frontmatter, MC-Items mit [x], Freitext und Callouts).',
                        aliases: ['markdown', 'beispiel', 'example', 'format', 'syntax', 'muster'],
                        render: (setting) => {
                            setting.settingEl.addClass('exam-hub-setting-wrap');
                            setting.addButton(btn => btn
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
                            const sampleArea = setting.settingEl.createEl('textarea', {
                                cls: 'exam-hub-settings-code-preview',
                                attr: { readonly: 'true', rows: '10' }
                            });
                            sampleArea.value = SAMPLE_MARKDOWN_CODE;
                        },
                    },
                ],
            },
        ];
    }

    public override getControlValue(key: string): unknown {
        return (this.plugin.settings as unknown as Record<string, unknown>)[key];
    }

    public override async setControlValue(key: string, value: unknown): Promise<void> {
        if (key === 'examsFolderPath') {
            const folder = typeof value === 'string' ? value.trim() || 'exams' : 'exams';
            this.plugin.settings.examsFolderPath = folder;
            await this.plugin.saveSettings();
            await this.plugin.indexer.updateFolderPath(folder);
            return;
        }

        if (key === 'resultsFolderPath') {
            const folder = typeof value === 'string' ? value.trim() || 'exams/results' : 'exams/results';
            this.plugin.settings.resultsFolderPath = folder;
            await this.plugin.saveSettings();
            return;
        }

        if (key === 'defaultPassingScore') {
            const score = typeof value === 'number' ? value : Number(value) || 60;
            this.plugin.settings.defaultPassingScore = score;
            await this.plugin.saveSettings();
            return;
        }

        if (key === 'enableSoundEffects') {
            const enabled = Boolean(value);
            this.plugin.settings.enableSoundEffects = enabled;
            this.plugin.soundManager.updateSettings(enabled, this.plugin.settings.soundVolume);
            await this.plugin.saveSettings();
            return;
        }

        if (key === 'soundVolume') {
            const vol = typeof value === 'number' ? value : Number(value) || 0.5;
            this.plugin.settings.soundVolume = vol;
            this.plugin.soundManager.updateSettings(this.plugin.settings.enableSoundEffects, vol);
            await this.plugin.saveSettings();
            return;
        }

        if (key === 'enableConfetti') {
            this.plugin.settings.enableConfetti = Boolean(value);
            await this.plugin.saveSettings();
            return;
        }

        if (key === 'syncLearningDataInVault') {
            const enabled = Boolean(value);
            this.plugin.settings.syncLearningDataInVault = enabled;
            await this.plugin.saveSettings();
            if (enabled) {
                await this.plugin.learningSyncManager.saveLearningData();
            }
            return;
        }

        (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
        await this.plugin.saveSettings();
    }

    private refreshSettingsTab(): void {
        const tabWithUpdate = this as { update?: () => void };
        if (typeof tabWithUpdate.update === 'function') {
            tabWithUpdate.update();
        } else {
            this.renderSettings();
        }
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
                .setLimits(40, 95, 5)
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

        new Setting(containerEl)
            .setName('Lerndaten im Vault synchronisieren')
            .setDesc('Speichert Fehlerspeicher, XP und Lernfortschritt in einer synchronisierbaren Vault-Datei (.quiz-learning-data.json) für automatischen Abgleich über Obsidian Sync, iCloud oder Git.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.syncLearningDataInVault)
                .onChange(async (value) => {
                    this.plugin.settings.syncLearningDataInVault = value;
                    await this.plugin.saveSettings();
                    if (value) {
                        await this.plugin.learningSyncManager.saveLearningData();
                    }
                })
            );

        new Setting(containerEl)
            .setName('Jetzt mit Vault-Datei abgleichen')
            .setDesc('Liest die Lerndaten aus der Vault-Datei ein und führt sie verlustfrei mit diesem Gerät zusammen.')
            .addButton(btn => {
                btn.setButtonText('🔄 Jetzt synchronisieren');
                btn.onClick(async () => {
                    btn.setButtonText('⏳ Synchronisiere...');
                    btn.setDisabled(true);
                    const changed = await this.plugin.learningSyncManager.loadAndMerge(true);
                    this.refreshSettingsTab();
                    if (!changed) {
                        new Notice('✅ Bereits auf dem neuesten Stand!');
                    }
                    btn.setButtonText('🔄 Jetzt synchronisieren');
                    btn.setDisabled(false);
                });
            });

        const errorCount = Object.keys(this.plugin.settings.errorPool).length;
        new Setting(containerEl)
            .setName('Fehlerspeicher zurücksetzen')
            .setDesc(`Aktuell befinden sich ${errorCount} Frage(n) im Fehlerspeicher.`)
            .addButton(btn => {
                btn.setButtonText('Fehlerspeicher leeren');
                btn.setClass('mod-warning');
                btn.onClick(async () => {
                    this.plugin.settings.errorPool = {};
                    this.plugin.settings.resolvedPool = {};
                    await this.plugin.saveSettings();
                    await this.plugin.learningSyncManager.saveLearningData(true);
                    this.refreshSettingsTab();
                });
            });

        new Setting(containerEl)
            .setName('Fortschritt & Statistiken zurücksetzen')
            .setDesc(`Level ${this.plugin.settings.userLevel} (${this.plugin.settings.userXP} XP), Streak: ${this.plugin.settings.streakDays} Tage.`)
            .addButton(btn => {
                btn.setButtonText('Statistiken zurücksetzen');
                btn.setClass('mod-warning');
                btn.onClick(async () => {
                    this.plugin.settings.userXP = 0;
                    this.plugin.settings.userLevel = 1;
                    this.plugin.settings.streakDays = 0;
                    this.plugin.settings.lastActiveDate = '';
                    this.plugin.settings.fsrsData = {};
                    await this.plugin.saveSettings();
                    await this.plugin.learningSyncManager.saveLearningData(true);
                    this.refreshSettingsTab();
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
