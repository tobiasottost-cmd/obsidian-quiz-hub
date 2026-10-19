import { ItemView, setIcon, WorkspaceLeaf } from 'obsidian';
import type ExamQuizHubPlugin from '../main';
import { GamificationEngine } from '../gamification/GamificationEngine';
import { ExamGenerator } from '../session/ExamGenerator';
import { ParsedExamFile } from '../parser/ExamParser';

export const VIEW_TYPE_DASHBOARD = 'exam-quiz-hub-dashboard';

export class DashboardView extends ItemView {
    private plugin: ExamQuizHubPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: ExamQuizHubPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    public getViewType(): string {
        return VIEW_TYPE_DASHBOARD;
    }

    public getDisplayText(): string {
        return 'Exam Hub — Dashboard';
    }

    public getIcon(): string {
        return 'graduation-cap';
    }

    public async onOpen(): Promise<void> {
        this.render();
        this.plugin.indexer.onIndexUpdated(() => {
            this.render();
        });
    }

    public render(): void {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass('exam-hub-dashboard-container');

        this.renderHeader(container);
        this.renderGamificationBar(container);
        this.renderResumeBanner(container);
        this.renderErrorPoolCard(container);
        this.renderGeneratorCard(container);
        this.renderExamsCatalog(container);
    }

    private renderHeader(container: HTMLElement): void {
        const header = container.createDiv({ cls: 'exam-hub-dashboard-header' });
        const titleRow = header.createDiv({ cls: 'exam-hub-title-row' });
        const iconSpan = titleRow.createSpan({ cls: 'exam-hub-title-icon' });
        setIcon(iconSpan, 'graduation-cap');
        titleRow.createEl('h1', { text: 'Exam and Quiz Hub' });
    }

    private renderGamificationBar(container: HTMLElement): void {
        const stats = container.createDiv({ cls: 'exam-hub-stats-bar' });
        const levelInfo = GamificationEngine.calculateLevel(this.plugin.settings.userXP);

        // Level Badge
        const levelBadge = stats.createDiv({ cls: 'exam-hub-stat-card level-card' });
        const levelIcon = levelBadge.createSpan({ cls: 'stat-icon' });
        setIcon(levelIcon, 'award');
        levelBadge.createDiv({ cls: 'stat-value', text: `Level ${levelInfo.level}` });
        levelBadge.createDiv({ cls: 'stat-label', text: `${this.plugin.settings.userXP} Gesamt-XP` });

        // XP Progress
        const xpProgressCard = stats.createDiv({ cls: 'exam-hub-stat-card xp-card' });
        const xpLabelRow = xpProgressCard.createDiv({ cls: 'xp-label-row' });
        xpLabelRow.createSpan({ text: `Fortschritt Level ${levelInfo.level + 1}` });
        xpLabelRow.createSpan({ text: `${levelInfo.progressInLevel} / ${levelInfo.neededInLevel} XP (${levelInfo.progressPercentage}%)` });

        const barBg = xpProgressCard.createDiv({ cls: 'exam-hub-progress-bar-bg' });
        const barFill = barBg.createDiv({ cls: 'exam-hub-progress-bar-fill' });
        barFill.style.width = `${levelInfo.progressPercentage}%`;

        // Streak
        const streakCard = stats.createDiv({ cls: 'exam-hub-stat-card streak-card' });
        const streakIcon = streakCard.createSpan({ cls: 'stat-icon' });
        setIcon(streakIcon, 'flame');
        streakCard.createDiv({ cls: 'stat-value', text: `${this.plugin.settings.streakDays} Tage` });
        streakCard.createDiv({ cls: 'stat-label', text: 'Lern-Streak' });
    }

    private renderResumeBanner(container: HTMLElement): void {
        const active = this.plugin.settings.activeSession;
        if (!active) return;

        const banner = container.createDiv({ cls: 'exam-hub-resume-banner' });
        const infoRow = banner.createDiv({ cls: 'resume-info-row' });
        const iconSpan = infoRow.createSpan({ cls: 'resume-icon' });
        setIcon(iconSpan, 'alert-circle');

        const answeredCount = Object.keys(active.userAnswers).filter(id => {
            const ans = active.userAnswers[id];
            return (ans.selectedOptionIds && ans.selectedOptionIds.length > 0) ||
                   (ans.freetextAnswer && ans.freetextAnswer.trim().length > 0);
        }).length;

        const remainingMin = Math.max(0, Math.ceil(active.remainingSeconds / 60));
        infoRow.createDiv({
            cls: 'resume-text',
            text: `Laufende Sitzung: "${active.examTitle}" (${answeredCount}/${active.questions.length} beantwortet, ca. ${remainingMin} Min. Restzeit)`
        });

        const actionsRow = banner.createDiv({ cls: 'resume-actions' });
        const resumeBtn = actionsRow.createEl('button', { cls: 'mod-cta', text: 'Fortsetzen' });
        resumeBtn.addEventListener('click', () => {
            this.plugin.startExamWithSession(active);
        });

        const discardBtn = actionsRow.createEl('button', { cls: 'mod-warning', text: 'Verwerfen' });
        discardBtn.addEventListener('click', async () => {
            this.plugin.settings.activeSession = null;
            await this.plugin.saveSettings();
            this.render();
        });
    }

    private renderErrorPoolCard(container: HTMLElement): void {
        const errorCard = container.createDiv({ cls: 'exam-hub-card error-pool-card' });
        const titleRow = errorCard.createDiv({ cls: 'card-title-row' });
        const icon = titleRow.createSpan({ cls: 'card-title-icon' });
        setIcon(icon, 'crosshair');
        titleRow.createEl('h3', { text: 'Intelligenter Fehlerspeicher' });

        const count = Object.keys(this.plugin.settings.errorPool).length;

        if (count > 0) {
            errorCard.createEl('p', {
                text: `${count} Frage(n) im Fehlerspeicher. Eine Frage wird entlastet, sobald du sie im Fehlertraining 2x hintereinander fehlerfrei beantwortest.`
            });

            const trainBtn = errorCard.createEl('button', {
                cls: 'mod-cta start-error-btn',
                text: `Fehlerspeicher trainieren (${count} Fragen)`
            });
            trainBtn.addEventListener('click', () => {
                const session = ExamGenerator.createErrorPoolSession(
                    this.plugin.indexer.getAllQuestions(),
                    this.plugin.settings.errorPool
                );
                if (session) {
                    this.plugin.startExamWithSession(session);
                }
            });
        } else {
            errorCard.createEl('p', {
                cls: 'text-muted',
                text: 'Aktuell sind keine ungelösten Fragen im Fehlerspeicher. Großartige Arbeit!'
            });
        }
    }

    private renderGeneratorCard(container: HTMLElement): void {
        const card = container.createDiv({ cls: 'exam-hub-card generator-card' });
        const titleRow = card.createDiv({ cls: 'card-title-row' });
        const icon = titleRow.createSpan({ cls: 'card-title-icon' });
        setIcon(icon, 'sliders');
        titleRow.createEl('h3', { text: 'Dynamischer Klausur-Generator (Modul-Mix)' });

        const availableModules = this.plugin.indexer.getAvailableModules();
        if (availableModules.length === 0) {
            card.createEl('p', {
                cls: 'text-muted',
                text: `Keine Klausuren im Ordner "${this.plugin.settings.examsFolderPath}" gefunden. Erstelle Markdown-Dateien im Ordner oder passe den Pfad in den Einstellungen an.`
            });
            return;
        }

        const form = card.createDiv({ cls: 'generator-form' });

        // Module selection
        form.createEl('label', { text: 'Module auswählen:' });
        const moduleCheckboxesDiv = form.createDiv({ cls: 'module-checkboxes-grid' });
        const selectedModules = new Set<string>(availableModules);

        availableModules.forEach(mod => {
            const label = moduleCheckboxesDiv.createEl('label', { cls: 'checkbox-label' });
            const cb = label.createEl('input', { type: 'checkbox' });
            cb.checked = true;
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    selectedModules.add(mod);
                } else {
                    selectedModules.delete(mod);
                }
                updateAvailableCount();
            });
            label.createSpan({ text: ` ${mod}` });
        });

        // Question count slider
        const countRow = form.createDiv({ cls: 'slider-row' });
        const countLabel = countRow.createEl('label', { text: 'Anzahl der Fragen: ' });
        const countDisplay = countLabel.createSpan({ cls: 'slider-val', text: '15' });

        const slider = countRow.createEl('input', {
            type: 'range',
            cls: 'generator-slider'
        });
        slider.min = '5';
        slider.max = '60';
        slider.step = '5';
        slider.value = '15';

        const timeEstimate = form.createEl('p', { cls: 'time-estimate text-muted' });

        const updateAvailableCount = () => {
            const availableQuestions = this.plugin.indexer.getQuestionsForModules(Array.from(selectedModules));
            const maxQ = Math.max(5, availableQuestions.length);
            slider.max = String(maxQ);
            if (parseInt(slider.value) > maxQ) {
                slider.value = String(maxQ);
            }
            const qCount = parseInt(slider.value);
            countDisplay.setText(String(qCount));
            const estMin = Math.round(qCount * 1.5);
            timeEstimate.setText(`Verfügbar: ${availableQuestions.length} Fragen im Pool | Zeitlimit: ca. ${estMin} Minuten`);
        };

        slider.addEventListener('input', () => {
            updateAvailableCount();
        });

        updateAvailableCount();

        const startMixBtn = form.createEl('button', {
            cls: 'mod-cta start-mix-btn',
            text: 'Modul-Mix Klausur starten'
        });

        startMixBtn.addEventListener('click', () => {
            const availableQuestions = this.plugin.indexer.getQuestionsForModules(Array.from(selectedModules));
            if (availableQuestions.length === 0) {
                return;
            }
            const qCount = parseInt(slider.value);
            const session = ExamGenerator.createDynamicMix(availableQuestions, {
                modules: Array.from(selectedModules),
                questionCount: qCount
            });
            this.plugin.startExamWithSession(session);
        });
    }

    private renderExamsCatalog(container: HTMLElement): void {
        const catalog = container.createDiv({ cls: 'exam-hub-card catalog-card' });
        const titleRow = catalog.createDiv({ cls: 'card-title-row' });
        const icon = titleRow.createSpan({ cls: 'card-title-icon' });
        setIcon(icon, 'folder');
        titleRow.createEl('h3', { text: 'Klausuren & Quiz-Pools' });

        const exams = this.plugin.indexer.getAllExamFiles();
        if (exams.length === 0) {
            catalog.createEl('p', {
                cls: 'text-muted',
                text: 'Keine Klausur-Dateien gefunden.'
            });
            return;
        }

        // Group exams by module
        const grouped = new Map<string, ParsedExamFile[]>();
        for (const exam of exams) {
            const mod = exam.frontmatter.module || 'Allgemein';
            if (!grouped.has(mod)) {
                grouped.set(mod, []);
            }
            grouped.get(mod)!.push(exam);
        }

        const accordion = catalog.createDiv({ cls: 'exam-catalog-accordion' });

        for (const [mod, moduleExams] of grouped.entries()) {
            const groupDiv = accordion.createDiv({ cls: 'module-group' });
            const groupHeader = groupDiv.createDiv({ cls: 'module-group-header' });
            const groupIcon = groupHeader.createSpan({ cls: 'module-icon' });
            setIcon(groupIcon, 'book-open');
            groupHeader.createEl('h4', { text: `${mod} (${moduleExams.length} Klausuren)` });

            const examsGrid = groupDiv.createDiv({ cls: 'module-exams-grid' });

            for (const exam of moduleExams) {
                const examCard = examsGrid.createDiv({ cls: 'exam-item-card' });
                const cardTop = examCard.createDiv({ cls: 'exam-item-top' });
                cardTop.createEl('h5', { text: exam.frontmatter.title || 'Klausur' });

                if (exam.frontmatter.semester) {
                    cardTop.createSpan({ cls: 'exam-badge semester-badge', text: exam.frontmatter.semester });
                }

                const metaRow = examCard.createDiv({ cls: 'exam-item-meta' });
                metaRow.createSpan({ text: `📝 ${exam.questions.length} Fragen` });
                const time = exam.frontmatter.timeLimitMinutes || Math.round(exam.questions.length * 1.5);
                metaRow.createSpan({ text: `⏱️ ${time} Min.` });
                metaRow.createSpan({ text: `🎯 Bestehen: ${exam.frontmatter.passingScore || '60%'}` });

                const startBtn = examCard.createEl('button', {
                    cls: 'mod-cta exam-start-btn',
                    text: 'Klausur starten'
                });

                startBtn.addEventListener('click', () => {
                    const session = ExamGenerator.fromParsedExam(exam);
                    this.plugin.startExamWithSession(session);
                });
            }
        }
    }
}
