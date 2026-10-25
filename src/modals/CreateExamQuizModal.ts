import { App, Modal, Notice, normalizePath, setIcon, TFile } from 'obsidian';
import type ExamQuizHubPlugin from '../main';
import { BlockIdAutoAssigner } from '../parser/BlockIdAutoAssigner';
import { generateExamFrontmatter, generateQuizFrontmatter, generateSampleExamNote, generateSampleQuizNote } from '../editor/SnippetTemplates';

export class CreateExamQuizModal extends Modal {
    private plugin: ExamQuizHubPlugin;
    private selectedType: 'quiz' | 'exam' = 'quiz';
    private titleVal: string = '';
    private moduleVal: string = '';
    private timeLimitVal: number = 90;
    private passingScoreVal: number = 75;
    private onCreated?: (filePath: string) => void;

    constructor(app: App, plugin: ExamQuizHubPlugin, initialType?: 'quiz' | 'exam', onCreated?: (filePath: string) => void) {
        super(app);
        this.plugin = plugin;
        if (initialType) {
            this.selectedType = initialType;
        }
        this.onCreated = onCreated;
    }

    public onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('create-exam-quiz-modal');

        this.renderModalContent();
    }

    private renderModalContent(): void {
        const { contentEl } = this;
        contentEl.empty();

        // 1. Header
        const header = contentEl.createDiv({ cls: 'create-modal-header' });
        const iconSpan = header.createSpan({ cls: 'create-modal-icon' });
        setIcon(iconSpan, this.selectedType === 'quiz' ? 'zap' : 'graduation-cap');

        const titleCol = header.createDiv({ cls: 'create-modal-titles' });
        titleCol.createEl('h2', { text: this.selectedType === 'quiz' ? 'Neues Quiz anlegen' : 'Neue Klausur anlegen' });
        titleCol.createEl('p', {
            cls: 'create-modal-desc',
            text: 'Wähle den Modus und erstelle im Handumdrehen eine spielfertige Übungsnotiz.'
        });

        // 2. Type Selector Tabs
        const typeSelector = contentEl.createDiv({ cls: 'create-type-selector' });

        const quizBtn = typeSelector.createDiv({
            cls: `type-select-card ${this.selectedType === 'quiz' ? 'is-selected' : ''}`
        });
        const quizIcon = quizBtn.createSpan({ cls: 'card-type-icon' });
        setIcon(quizIcon, 'zap');
        const quizInfo = quizBtn.createDiv({ cls: 'card-type-info' });
        quizInfo.createDiv({ cls: 'card-type-name', text: '⚡ Quiz' });
        quizInfo.createDiv({ cls: 'card-type-sub', text: 'Ohne Zeitlimit • Direktes Feedback nach jeder Frage' });

        quizBtn.addEventListener('click', () => {
            if (this.selectedType !== 'quiz') {
                this.selectedType = 'quiz';
                this.renderModalContent();
            }
        });

        const examBtn = typeSelector.createDiv({
            cls: `type-select-card ${this.selectedType === 'exam' ? 'is-selected' : ''}`
        });
        const examIcon = examBtn.createSpan({ cls: 'card-type-icon' });
        setIcon(examIcon, 'clock');
        const examInfo = examBtn.createDiv({ cls: 'card-type-info' });
        examInfo.createDiv({ cls: 'card-type-name', text: '⏱️ Klausur' });
        examInfo.createDiv({ cls: 'card-type-sub', text: 'Prüfungsmodus • Zeitlimit & Bestehensgrenze' });

        examBtn.addEventListener('click', () => {
            if (this.selectedType !== 'exam') {
                this.selectedType = 'exam';
                this.renderModalContent();
            }
        });

        // 3. Form Details Card
        const form = contentEl.createDiv({ cls: 'create-modal-form' });

        // Title Input
        const titleRow = form.createDiv({ cls: 'form-field-row' });
        titleRow.createEl('label', { text: 'Titel der Einheit:' });
        const titleInput = titleRow.createEl('input', {
            type: 'text',
            placeholder: this.selectedType === 'quiz' ? 'z. B. Wissens-Check Klassische Konditionierung' : 'z. B. Probeklausur Statistik I',
            value: this.titleVal
        });
        titleInput.addEventListener('input', () => {
            this.titleVal = titleInput.value;
        });

        // Module Input with Datalist for existing modules
        const moduleRow = form.createDiv({ cls: 'form-field-row' });
        moduleRow.createEl('label', { text: 'Modul / Fachgebiet:' });

        const moduleInput = moduleRow.createEl('input', {
            type: 'text',
            placeholder: 'z. B. M1, Biologie, Psychologie',
            value: this.moduleVal,
            attr: { list: 'create-exam-module-suggestions' }
        });
        moduleInput.addEventListener('input', () => {
            this.moduleVal = moduleInput.value;
        });

        // Create datalist of existing modules
        const existingModules = this.plugin.indexer.getAvailableModules();
        if (existingModules.length > 0) {
            const dataList = moduleRow.createEl('datalist', { attr: { id: 'create-exam-module-suggestions' } });
            existingModules.forEach(mod => {
                dataList.createEl('option', { attr: { value: mod } });
            });
        }

        // Exam specific settings (Time limit & Passing score)
        if (this.selectedType === 'exam') {
            const examMetaRow = form.createDiv({ cls: 'form-field-grid-2' });

            const timeCol = examMetaRow.createDiv({ cls: 'form-field-row' });
            timeCol.createEl('label', { text: 'Zeitlimit (Minuten):' });
            const timeInput = timeCol.createEl('input', {
                type: 'number',
                value: String(this.timeLimitVal),
                attr: { min: '5', max: '360', step: '5' }
            });
            timeInput.addEventListener('input', () => {
                this.timeLimitVal = Number(timeInput.value) || 90;
            });

            const passCol = examMetaRow.createDiv({ cls: 'form-field-row' });
            passCol.createEl('label', { text: 'Bestehensgrenze (%):' });
            const passInput = passCol.createEl('input', {
                type: 'number',
                value: String(this.passingScoreVal),
                attr: { min: '30', max: '95', step: '5' }
            });
            passInput.addEventListener('input', () => {
                this.passingScoreVal = Number(passInput.value) || 75;
            });
        }

        // 4. Action Cards (3 easy ways to create)
        contentEl.createEl('h4', {
            cls: 'create-modal-actions-heading',
            text: 'Wie möchtest du starten?'
        });

        const actionsGrid = contentEl.createDiv({ cls: 'create-modal-actions-grid' });

        // Action 1: Create from Template
        const templateCard = actionsGrid.createDiv({ cls: 'action-method-card' });
        const templateTop = templateCard.createDiv({ cls: 'action-card-top' });
        const templIcon = templateTop.createSpan({ cls: 'action-icon' });
        setIcon(templIcon, 'file-plus');
        templateTop.createEl('strong', { text: 'Aus Vorlage erstellen' });
        templateCard.createEl('p', {
            cls: 'action-card-desc',
            text: 'Erstellt eine saubere Datei mit Frontmatter und 2 Beispielfragen direkt im Editor.'
        });
        const createBtn = templateCard.createEl('button', {
            cls: 'mod-cta action-card-btn',
            text: '📄 Notiz erstellen & öffnen'
        });
        createBtn.addEventListener('click', () => {
            void this.handleCreateFromTemplate();
        });

        // Action 2: Import from Clipboard
        const clipCard = actionsGrid.createDiv({ cls: 'action-method-card' });
        const clipTop = clipCard.createDiv({ cls: 'action-card-top' });
        const clipIcon = clipTop.createSpan({ cls: 'action-icon' });
        setIcon(clipIcon, 'clipboard-check');
        clipTop.createEl('strong', { text: 'Aus Zwischenablage importieren' });
        clipCard.createEl('p', {
            cls: 'action-card-desc',
            text: 'Liest KI-generierte Fragen aus der Zwischenablage, vergibt Block-IDs und speichert sofort.'
        });
        const clipBtn = clipCard.createEl('button', {
            cls: 'action-card-btn',
            text: '📋 Aus Zwischenablage einfügen'
        });
        clipBtn.addEventListener('click', () => {
            void this.handleCreateFromClipboard();
        });

        // Action 3: Copy AI Prompt for this Subject
        const aiCard = actionsGrid.createDiv({ cls: 'action-method-card' });
        const aiTop = aiCard.createDiv({ cls: 'action-card-top' });
        const aiIcon = aiTop.createSpan({ cls: 'action-icon' });
        setIcon(aiIcon, 'bot');
        aiTop.createEl('strong', { text: 'Passenden KI-Prompt kopieren' });
        aiCard.createEl('p', {
            cls: 'action-card-desc',
            text: 'Kopiert den fertigen Prompt für ChatGPT/Claude, vorbereitet für dein Fachgebiet.'
        });
        const aiBtn = aiCard.createEl('button', {
            cls: 'action-card-btn',
            text: '🤖 KI-Prompt kopieren'
        });
        aiBtn.addEventListener('click', () => {
            this.handleCopyAIPrompt(aiBtn);
        });

        // 5. Footer Cancel button
        const footer = contentEl.createDiv({ cls: 'create-modal-footer' });
        const cancelBtn = footer.createEl('button', { text: 'Schließen' });
        cancelBtn.addEventListener('click', () => this.close());
    }

    private async handleCreateFromTemplate(): Promise<void> {
        const title = this.titleVal.trim() || (this.selectedType === 'quiz' ? 'Neues Quiz' : 'Neue Klausur');
        const module = this.moduleVal.trim() || 'Allgemein';

        const content = this.selectedType === 'quiz'
            ? generateSampleQuizNote(module, title)
            : generateSampleExamNote(module, title, this.timeLimitVal, this.passingScoreVal);

        const filePath = await this.saveNewExamFile(module, title, content);
        if (filePath) {
            new Notice(`✅ ${this.selectedType === 'quiz' ? 'Quiz' : 'Klausur'} "${title}" erfolgreich erstellt!`);
            this.close();
            if (this.onCreated) this.onCreated(filePath);
        }
    }

    private async handleCreateFromClipboard(): Promise<void> {
        let clipText = '';
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
                clipText = await navigator.clipboard.readText();
            }
        } catch {
            new Notice('⚠️ Zugriff auf die Zwischenablage nicht gestattet oder nicht verfügbar.');
            return;
        }

        if (!clipText || !clipText.trim()) {
            new Notice('ℹ️ Die Zwischenablage ist leer. Kopiere zuerst Fragen hinein!');
            return;
        }

        const title = this.titleVal.trim() || (this.selectedType === 'quiz' ? 'Importiertes Quiz' : 'Importierte Klausur');
        const module = this.moduleVal.trim() || 'Allgemein';

        let finalMarkdown = clipText.trim();

        // If the clipboard content doesn't have YAML frontmatter, prepend it
        if (!finalMarkdown.startsWith('---')) {
            const frontmatter = this.selectedType === 'quiz'
                ? generateQuizFrontmatter(module, title)
                : generateExamFrontmatter(module, title, this.timeLimitVal, this.passingScoreVal);
            finalMarkdown = `${frontmatter}\n${finalMarkdown}`;
        }

        // Auto-assign any missing block IDs
        const { updatedContent, addedCount } = BlockIdAutoAssigner.processMarkdown(finalMarkdown);
        finalMarkdown = updatedContent;

        const filePath = await this.saveNewExamFile(module, title, finalMarkdown);
        if (filePath) {
            new Notice(`✅ ${this.selectedType === 'quiz' ? 'Quiz' : 'Klausur'} aus Zwischenablage importiert (${addedCount} Block-IDs ergänzt)!`);
            this.close();
            if (this.onCreated) this.onCreated(filePath);
        }
    }

    private handleCopyAIPrompt(buttonEl: HTMLButtonElement): void {
        const title = this.titleVal.trim() || (this.selectedType === 'quiz' ? 'Wissens-Check' : 'Prüfung');
        const module = this.moduleVal.trim() || 'Allgemein';

        let prompt = '';
        if (this.selectedType === 'quiz') {
            prompt = [
                'Du bist ein Experte für didaktische Quiz-Erstellung und Markdown-Formatierung.',
                `Erstelle ein interaktives Quiz für das Fach/Modul "${module}" mit dem Titel "${title}".`,
                '',
                'WICHTIGE REGELN & SYNTAX FÜR QUIZZE:',
                '1. Dateikopf (YAML Frontmatter) ganz oben:',
                '---',
                'type: quiz',
                `module: ${module}`,
                `title: ${title}`,
                'shuffleQuestions: true',
                'shuffleOptions: true',
                '---',
                '',
                '2. Frageüberschriften:',
                '- Jede Aufgabe MUSS mit einer H2-Überschrift beginnen: \'## [Fragetext] ^q-[id]\'',
                `- Block-IDs müssen stabil sein, z. B. ^q-${module.toLowerCase().replace(/[^a-z0-9]/g, '')}-01.`,
                '- Trenne Aufgaben jeweils mit drei Bindestrichen \'---\'.',
                '',
                '3. Multiple-Choice Aufgaben (Universitärer 5-Aussagen-Standard oder Single-Choice):',
                'WICHTIG: Die Zeilen \'type:\' und \'points:\' dürfen KEINEN führenden Spiegelstrich (\'-\') haben!',
                'type: multiple-choice',
                'points: 5',
                '(Hinweis: Bei Single-Choice mit genau 1 richtiger Option schreibe \'type: single-choice\' und \'points: 1\')',
                'Aussagen als Checkboxen:',
                '  - [x] für wahre/zutreffende Aussagen',
                '  - [ ] für falsche/unzutreffende Aussagen',
                'Erklärungs-Callout direkt darunter (wird im Quiz sofort nach der Beantwortung eingeblendet):',
                '  > [!explanation]',
                '  > Ausführliche didaktische Erklärung zur Musterlösung.',
                '',
                '4. Freitext-Aufgaben:',
                'type: freetext',
                'points: 3',
                'Musterloesung: [Vollständige Musterantwort]',
                'Kriterien:',
                '  1. [Kriterium 1] (1P)',
                '  2. [Kriterium 2] (1P)',
                'Erklärungs-Callout:',
                '  > [!explanation]',
                '  > Didaktische Hinweise zur Punktevergabe.',
                '',
                '---',
                'HIER SIND DIE ZU KONVERTIERENDEN FRAGEN/INHALTE:',
                '[Füge hier deine Notizen, Vorlesungsfolien oder Fragen ein]'
            ].join('\n');
        } else {
            prompt = [
                'Du bist ein Experte für didaktische Prüfungserstellung und Markdown-Formatierung.',
                `Wandle die folgenden Lerninhalte für das Fach/Modul "${module}" in eine formelle Klausur mit dem Titel "${title}" um.`,
                '',
                'WICHTIGE REGELN & SYNTAX:',
                '1. Dateikopf (YAML Frontmatter) ganz oben:',
                '---',
                'type: exam',
                `module: ${module}`,
                `title: ${title}`,
                `timeLimitMinutes: ${this.timeLimitVal || 90}`,
                `passingScore: ${this.passingScoreVal || 75}%`,
                'shuffleQuestions: true',
                'shuffleOptions: true',
                '---',
                '',
                '2. Frageüberschriften:',
                '- Jede Aufgabe MUSS mit einer H2-Überschrift beginnen: \'## [Fragetext] ^q-[id]\'',
                `- Block-IDs müssen stabil sein, z. B. ^q-${module.toLowerCase().replace(/[^a-z0-9]/g, '')}-01.`,
                '- Trenne Aufgaben jeweils mit drei Bindestrichen \'---\'.',
                '',
                '3. Multiple-Choice Aufgaben (Universitärer 5-Aussagen-Standard):',
                'WICHTIG: Die Zeilen \'type:\' und \'points:\' dürfen KEINEN führenden Spiegelstrich (\'-\') haben!',
                'type: multiple-choice',
                'points: 5',
                'Exakt 5 binäre Aussagen als Checkboxen:',
                '  - [x] für wahre/zutreffende Aussagen',
                '  - [ ] für falsche/unzutreffende Aussagen',
                'Erklärungs-Callout direkt darunter:',
                '  > [!explanation]',
                '  > Ausführliche Erklärung zur Musterlösung und zu den einzelnen Aussagen.',
                '',
                '4. Freitext-Aufgaben:',
                'type: freetext',
                'points: 3',
                'Musterloesung: [Vollständige Musterantwort]',
                'Kriterien:',
                '  1. [Kriterium 1] (1P)',
                '  2. [Kriterium 2] (1P)',
                'Erklärungs-Callout:',
                '  > [!explanation]',
                '  > Didaktische Hinweise zur Punktevergabe.',
                '',
                '---',
                'HIER SIND DIE ZU KONVERTIERENDEN FRAGEN/INHALTE:',
                '[Füge hier deine Fragen, PDF-Texte oder Altfragen ein]'
            ].join('\n');
        }

        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            void navigator.clipboard.writeText(prompt);
            new Notice(`✅ KI-Prompt für "${title}" in die Zwischenablage kopiert!`);
            const prevText = buttonEl.innerText;
            buttonEl.innerText = '✅ Kopiert!';
            window.setTimeout(() => {
                buttonEl.innerText = prevText;
            }, 2500);
        }
    }

    private async saveNewExamFile(module: string, title: string, content: string): Promise<string | null> {
        const folder = this.plugin.settings.examsFolderPath || 'exams';
        await this.ensureFolderExists(folder);

        const cleanMod = this.sanitizeFileName(module);
        const cleanTitle = this.sanitizeFileName(title);
        const baseName = cleanMod ? `${cleanMod} - ${cleanTitle}` : cleanTitle;

        let finalPath = normalizePath(`${folder}/${baseName}.md`);
        let counter = 2;

        // Prevent overwriting existing files by appending counter
        while (this.app.vault.getAbstractFileByPath(finalPath)) {
            finalPath = normalizePath(`${folder}/${baseName} (${counter}).md`);
            counter++;
        }

        try {
            await this.app.vault.create(finalPath, content);

            // Open the new file in active or new workspace tab and ensure index
            const createdFile = this.app.vault.getAbstractFileByPath(finalPath);
            if (createdFile instanceof TFile) {
                await this.plugin.indexer.indexFile(createdFile);
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(createdFile);
            }

            return finalPath;
        } catch (err) {
            console.error('[Exam Quiz Hub] Fehler beim Anlegen der Datei:', err);
            new Notice(`❌ Fehler beim Anlegen der Datei: ${String(err)}`);
            return null;
        }
    }

    private sanitizeFileName(input: string): string {
        return input.replace(/[\\/:*?"<>|]/g, '_').trim().substring(0, 50);
    }

    private async ensureFolderExists(folderPath: string): Promise<void> {
        const parts = folderPath.split('/');
        let current = '';
        for (const part of parts) {
            current = current ? `${current}/${part}` : part;
            const norm = normalizePath(current);
            if (!this.app.vault.getAbstractFileByPath(norm)) {
                try {
                    await this.app.vault.createFolder(norm);
                } catch {
                    // Folder might have been created concurrently
                }
            }
        }
    }

    public onClose(): void {
        this.contentEl.empty();
    }
}
