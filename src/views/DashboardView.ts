import { App, ItemView, Modal, Notice, setIcon, WorkspaceLeaf } from 'obsidian';
import type ExamQuizHubPlugin from '../main';
import { GamificationEngine } from '../gamification/GamificationEngine';
import { ExamGenerator } from '../session/ExamGenerator';
import { ParsedExamFile } from '../parser/ExamParser';
import { TAMAGOTCHI_STAGES } from '../gamification/TamagotchiAssets';
import { TamagotchiEngine } from '../gamification/TamagotchiEngine';

export const VIEW_TYPE_DASHBOARD = 'exam-quiz-hub-dashboard';

export class DashboardView extends ItemView {
    private plugin: ExamQuizHubPlugin;
    private activeCatalogFilter: 'all' | 'exam' | 'quiz' = 'all';
    private generatorMode: 'exam' | 'quiz' = 'exam';

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
        if (this.plugin.settings.enableXPAndLevels !== false) {
            this.renderGamificationBar(container);
        }
        if (this.plugin.settings.enableTamagotchi !== false) {
            this.renderTamagotchiCard(container);
        }
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
        barFill.setCssStyles({ width: `${levelInfo.progressPercentage}%` });

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

        const isQuiz = active.mode === 'quiz';
        const banner = container.createDiv({ cls: 'exam-hub-resume-banner' });
        const infoRow = banner.createDiv({ cls: 'resume-info-row' });
        const iconSpan = infoRow.createSpan({ cls: 'resume-icon' });
        setIcon(iconSpan, isQuiz ? 'zap' : 'alert-circle');

        const answeredCount = Object.keys(active.userAnswers).filter(id => {
            const ans = active.userAnswers[id];
            return (ans.selectedOptionIds && ans.selectedOptionIds.length > 0) ||
                   (ans.freetextAnswer && ans.freetextAnswer.trim().length > 0);
        }).length;

        const infoText = isQuiz
            ? `Laufendes Quiz: "${active.examTitle}" (${answeredCount}/${active.questions.length} beantwortet • ⚡ Direktes Feedback)`
            : `Laufende Klausur: "${active.examTitle}" (${answeredCount}/${active.questions.length} beantwortet, ca. ${Math.max(0, Math.ceil(active.remainingSeconds / 60))} Min. Restzeit)`;

        infoRow.createDiv({
            cls: 'resume-text',
            text: infoText
        });

        const actionsRow = banner.createDiv({ cls: 'resume-actions' });
        const resumeBtn = actionsRow.createEl('button', {
            cls: 'mod-cta',
            text: isQuiz ? 'Quiz fortsetzen' : 'Klausur fortsetzen'
        });
        resumeBtn.addEventListener('click', () => {
            void this.plugin.startExamWithSession(active);
        });

        const discardBtn = actionsRow.createEl('button', { cls: 'mod-warning', text: 'Verwerfen' });
        discardBtn.addEventListener('click', () => {
            void (async () => {
                this.plugin.settings.activeSession = null;
                await this.plugin.saveSettings();
                this.render();
            })();
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

            const btnRow = errorCard.createDiv({ cls: 'error-pool-actions-row' });

            const trainQuizBtn = btnRow.createEl('button', {
                cls: 'mod-cta start-error-btn',
                text: `⚡ Fehlerspeicher als Quiz trainieren (${count})`
            });
            trainQuizBtn.addEventListener('click', () => {
                const session = ExamGenerator.createErrorPoolSession(
                    this.plugin.indexer.getAllQuestions(),
                    this.plugin.settings.errorPool,
                    'quiz'
                );
                if (session) {
                    void this.plugin.startExamWithSession(session);
                }
            });

            const trainExamBtn = btnRow.createEl('button', {
                cls: 'start-error-btn secondary-btn',
                text: '⏱️ Als Klausur simulieren'
            });
            trainExamBtn.addEventListener('click', () => {
                const session = ExamGenerator.createErrorPoolSession(
                    this.plugin.indexer.getAllQuestions(),
                    this.plugin.settings.errorPool,
                    'exam'
                );
                if (session) {
                    void this.plugin.startExamWithSession(session);
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
        titleRow.createEl('h3', { text: 'Dynamischer Generator (Modul-Mix)' });

        const availableModules = this.plugin.indexer.getAvailableModules();
        if (availableModules.length === 0) {
            card.createEl('p', {
                cls: 'text-muted',
                text: `Keine Klausuren oder Quizze im Ordner "${this.plugin.settings.examsFolderPath}" gefunden. Erstelle Markdown-Dateien im Ordner oder passe den Pfad in den Einstellungen an.`
            });
            return;
        }

        const form = card.createDiv({ cls: 'generator-form' });

        // Mode Selector: Exam vs Quiz
        const modeRow = form.createDiv({ cls: 'generator-mode-row' });
        modeRow.createEl('label', { text: 'Modus wählen:' });
        const modeButtonsGroup = modeRow.createDiv({ cls: 'generator-mode-toggle-group' });

        const examModeBtn = modeButtonsGroup.createEl('button', {
            cls: `mode-toggle-btn ${this.generatorMode === 'exam' ? 'is-active' : ''}`,
            text: '⏱️ Klausur-Modus (Mit Zeitlimit & Endauswertung)'
        });
        const quizModeBtn = modeButtonsGroup.createEl('button', {
            cls: `mode-toggle-btn ${this.generatorMode === 'quiz' ? 'is-active' : ''}`,
            text: '⚡ Quiz-Modus (Sofort-Feedback pro Frage)'
        });

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

        const startMixBtn = form.createEl('button', {
            cls: 'mod-cta start-mix-btn',
            text: this.generatorMode === 'quiz' ? '⚡ Modul-Mix Quiz starten' : '⏱️ Modul-Mix Klausur starten'
        });

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

            if (this.generatorMode === 'quiz') {
                timeEstimate.setText(`Verfügbar: ${availableQuestions.length} Fragen im Pool | Modus: Quiz (Ohne Zeitlimit, direktes Feedback)`);
                startMixBtn.setText('⚡ Modul-Mix Quiz starten');
            } else {
                timeEstimate.setText(`Verfügbar: ${availableQuestions.length} Fragen im Pool | Zeitlimit: ca. ${estMin} Minuten`);
                startMixBtn.setText('⏱️ Modul-Mix Klausur starten');
            }
        };

        examModeBtn.addEventListener('click', () => {
            this.generatorMode = 'exam';
            examModeBtn.addClass('is-active');
            quizModeBtn.removeClass('is-active');
            updateAvailableCount();
        });

        quizModeBtn.addEventListener('click', () => {
            this.generatorMode = 'quiz';
            quizModeBtn.addClass('is-active');
            examModeBtn.removeClass('is-active');
            updateAvailableCount();
        });

        slider.addEventListener('input', () => {
            updateAvailableCount();
        });

        updateAvailableCount();

        startMixBtn.addEventListener('click', () => {
            const availableQuestions = this.plugin.indexer.getQuestionsForModules(Array.from(selectedModules));
            if (availableQuestions.length === 0) {
                return;
            }
            const qCount = parseInt(slider.value);
            const session = ExamGenerator.createDynamicMix(availableQuestions, {
                modules: Array.from(selectedModules),
                questionCount: qCount,
                mode: this.generatorMode
            });
            void this.plugin.startExamWithSession(session);
        });
    }

    private renderExamsCatalog(container: HTMLElement): void {
        const catalog = container.createDiv({ cls: 'exam-hub-card catalog-card' });
        const titleRow = catalog.createDiv({ cls: 'card-title-row' });
        const icon = titleRow.createSpan({ cls: 'card-title-icon' });
        setIcon(icon, 'folder');
        titleRow.createEl('h3', { text: 'Klausuren & Quiz-Pools' });

        const allExams = this.plugin.indexer.getAllExamFiles();
        if (allExams.length === 0) {
            catalog.createEl('p', {
                cls: 'text-muted',
                text: 'Keine Klausur- oder Quiz-Dateien gefunden.'
            });
            return;
        }

        const examCount = allExams.filter(e => e.frontmatter.type !== 'quiz').length;
        const quizCount = allExams.filter(e => e.frontmatter.type === 'quiz').length;

        // Filter Tabs: Alle | Klausuren | Quizze
        const filterBar = catalog.createDiv({ cls: 'exam-hub-filter-tabs' });
        const tabs: { id: 'all' | 'exam' | 'quiz'; label: string; count: number }[] = [
            { id: 'all', label: 'Alle', count: allExams.length },
            { id: 'exam', label: '⏱️ Klausuren', count: examCount },
            { id: 'quiz', label: '⚡ Quizze', count: quizCount }
        ];

        tabs.forEach(tab => {
            const tabBtn = filterBar.createEl('button', {
                cls: `filter-tab-btn ${this.activeCatalogFilter === tab.id ? 'is-active' : ''}`,
                text: `${tab.label} (${tab.count})`
            });
            tabBtn.addEventListener('click', () => {
                this.activeCatalogFilter = tab.id;
                this.render();
            });
        });

        const filteredExams = allExams.filter(e => {
            if (this.activeCatalogFilter === 'exam') return e.frontmatter.type !== 'quiz';
            if (this.activeCatalogFilter === 'quiz') return e.frontmatter.type === 'quiz';
            return true;
        });

        if (filteredExams.length === 0) {
            catalog.createEl('p', {
                cls: 'text-muted',
                text: this.activeCatalogFilter === 'quiz'
                    ? 'Keine Notizen mit "type: quiz" gefunden. Du kannst aber jede Klausur unten als Quiz durchspielen!'
                    : 'Keine Einträge für diesen Filter gefunden.'
            });
            return;
        }

        // Group exams by module
        const grouped = new Map<string, ParsedExamFile[]>();
        for (const exam of filteredExams) {
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
            groupHeader.createEl('h4', { text: `${mod} (${moduleExams.length} Einträge)` });

            const examsGrid = groupDiv.createDiv({ cls: 'module-exams-grid' });

            for (const exam of moduleExams) {
                const isQuizType = exam.frontmatter.type === 'quiz';
                const examCard = examsGrid.createDiv({ cls: `exam-item-card ${isQuizType ? 'is-quiz-card' : 'is-exam-card'}` });
                const cardTop = examCard.createDiv({ cls: 'exam-item-top' });
                cardTop.createEl('h5', { text: exam.frontmatter.title || (isQuizType ? 'Quiz' : 'Klausur') });

                const badgeContainer = cardTop.createDiv({ cls: 'exam-card-badges' });
                if (isQuizType) {
                    badgeContainer.createSpan({ cls: 'exam-badge quiz-type-badge', text: '⚡ Quiz' });
                } else {
                    badgeContainer.createSpan({ cls: 'exam-badge exam-type-badge', text: '⏱️ Klausur' });
                }

                if (exam.frontmatter.semester) {
                    badgeContainer.createSpan({ cls: 'exam-badge semester-badge', text: exam.frontmatter.semester });
                }

                const metaRow = examCard.createDiv({ cls: 'exam-item-meta' });
                metaRow.createSpan({ text: `📝 ${exam.questions.length} Fragen` });
                if (isQuizType) {
                    metaRow.createSpan({ cls: 'quiz-direct-feedback-badge', text: '⚡ Direktes Feedback' });
                } else {
                    const time = exam.frontmatter.timeLimitMinutes ?? 90;
                    metaRow.createSpan({ text: `⏱️ ${time} Min.` });
                }
                const pass = exam.frontmatter.passingScore || `${this.plugin.settings.defaultPassingScore}%`;
                metaRow.createSpan({ text: `🎯 Bestehen: ${pass}` });

                // Action buttons: Dual options (Start as Quiz or Start as Exam)
                const actionsRow = examCard.createDiv({ cls: 'exam-card-actions-row' });

                if (isQuizType) {
                    const startQuizBtn = actionsRow.createEl('button', {
                        cls: 'mod-cta exam-start-btn',
                        text: '⚡ Quiz starten'
                    });
                    startQuizBtn.addEventListener('click', () => {
                        const session = ExamGenerator.fromParsedExam(exam, 'quiz');
                        void this.plugin.startExamWithSession(session);
                    });

                    const startExamBtn = actionsRow.createEl('button', {
                        cls: 'exam-start-btn secondary-btn',
                        text: '⏱️ Als Klausur starten'
                    });
                    startExamBtn.addEventListener('click', () => {
                        const session = ExamGenerator.fromParsedExam(exam, 'exam');
                        void this.plugin.startExamWithSession(session);
                    });
                } else {
                    const startExamBtn = actionsRow.createEl('button', {
                        cls: 'mod-cta exam-start-btn',
                        text: '⏱️ Klausur starten'
                    });
                    startExamBtn.addEventListener('click', () => {
                        const session = ExamGenerator.fromParsedExam(exam, 'exam');
                        void this.plugin.startExamWithSession(session);
                    });

                    // Allows playing any exam as a quiz!
                    const startQuizBtn = actionsRow.createEl('button', {
                        cls: 'exam-start-btn secondary-btn',
                        text: '⚡ Als Quiz spielen'
                    });
                    startQuizBtn.addEventListener('click', () => {
                        const session = ExamGenerator.fromParsedExam(exam, 'quiz');
                        void this.plugin.startExamWithSession(session);
                    });
                }
            }
        }
    }

    private renderTamagotchiCard(container: HTMLElement): void {
        const streak = this.plugin.settings.streakDays || 0;
        const level = this.plugin.settings.userLevel || 1;
        const evolution = TamagotchiEngine.getEvolutionState(streak, level);
        const stage = evolution.currentStage.stage;
        const hunger = this.plugin.settings.tamagotchiHunger ?? 85;
        const happiness = this.plugin.settings.tamagotchiHappiness ?? 90;
        const mood = TamagotchiEngine.getMood(hunger, happiness);
        const companionName = this.plugin.settings.tamagotchiName || 'Lern-Drache';
        const quote = TamagotchiEngine.getSpeechQuote(stage, mood, streak, companionName);
        const stageImage = TAMAGOTCHI_STAGES[stage] || TAMAGOTCHI_STAGES[1];

        const card = container.createDiv({ cls: 'exam-hub-card exam-hub-tamagotchi-card' });

        // Header Row
        const headerRow = card.createDiv({ cls: 'tamagotchi-header-row' });
        const nameGroup = headerRow.createDiv({ cls: 'tamagotchi-name-group' });
        const dragonIcon = nameGroup.createSpan({ cls: 'tamagotchi-header-icon' });
        setIcon(dragonIcon, 'sparkles');
        nameGroup.createEl('h3', { cls: 'tamagotchi-name', text: companionName });

        const renameBtn = nameGroup.createEl('button', {
            cls: 'clickable-icon tamagotchi-rename-btn',
            attr: { 'aria-label': 'Lernbegleiter umbenennen', 'title': 'Lernbegleiter umbenennen' }
        });
        setIcon(renameBtn, 'pencil');
        renameBtn.addEventListener('click', () => {
            new RenameCompanionModal(this.app, this.plugin, () => this.render()).open();
        });

        const stageBadge = headerRow.createDiv({ cls: 'tamagotchi-stage-badge' });
        stageBadge.setText(`Stufe ${stage} / 10 • ${evolution.currentStage.name}`);

        // Main Layout Body
        const body = card.createDiv({ cls: 'tamagotchi-body' });

        // Left Column: Avatar
        const avatarCol = body.createDiv({ cls: 'tamagotchi-avatar-col' });
        const imgWrapper = avatarCol.createDiv({ cls: 'tamagotchi-img-wrapper' });
        imgWrapper.createEl('img', {
            cls: 'tamagotchi-avatar-img',
            attr: {
                src: stageImage,
                alt: `${companionName} - ${evolution.currentStage.name}`
            }
        });
        avatarCol.createDiv({ cls: 'tamagotchi-subtitle', text: evolution.currentStage.title });

        // Right Column: Dialogue & Metrics
        const infoCol = body.createDiv({ cls: 'tamagotchi-info-col' });

        // Speech bubble
        const speechBubble = infoCol.createDiv({ cls: 'tamagotchi-speech-bubble' });
        const quoteIcon = speechBubble.createSpan({ cls: 'speech-bubble-icon' });
        setIcon(quoteIcon, 'message-square');
        speechBubble.createSpan({ cls: 'speech-bubble-text', text: `„${quote}“` });

        // Stats rows
        const metrics = infoCol.createDiv({ cls: 'tamagotchi-metrics' });

        // Satiety
        const satietyRow = metrics.createDiv({ cls: 'tamagotchi-metric-row' });
        const satietyLabels = satietyRow.createDiv({ cls: 'metric-label-row' });
        satietyLabels.createSpan({ cls: 'metric-title', text: 'Wissens-Sättigung' });
        satietyLabels.createSpan({ cls: 'metric-value', text: `${hunger}% • ${mood.emoji} ${mood.label}` });

        const satietyBg = satietyRow.createDiv({ cls: 'exam-hub-progress-bar-bg' });
        const satietyFill = satietyBg.createDiv({ cls: 'exam-hub-progress-bar-fill tamagotchi-satiety-fill' });
        satietyFill.setCssStyles({ width: `${hunger}%` });

        // Evolution progress
        const evoRow = metrics.createDiv({ cls: 'tamagotchi-metric-row' });
        const evoLabels = evoRow.createDiv({ cls: 'metric-label-row' });
        evoLabels.createSpan({
            cls: 'metric-title',
            text: evolution.isMaxStage ? 'Evolutions-Stufe' : `Fortschritt zu Stufe ${evolution.nextStage?.stage}`
        });
        evoLabels.createSpan({
            cls: 'metric-value',
            text: evolution.isMaxStage ? 'Maximal 👑' : `${evolution.progressPercentage}%`
        });

        const evoBg = evoRow.createDiv({ cls: 'exam-hub-progress-bar-bg' });
        const evoFill = evoBg.createDiv({ cls: 'exam-hub-progress-bar-fill tamagotchi-evo-fill' });
        evoFill.setCssStyles({ width: `${evolution.progressPercentage}%` });

        evoRow.createDiv({
            cls: 'metric-hint text-muted',
            text: evolution.requirementText
        });

        // Actions
        const actionsRow = infoCol.createDiv({ cls: 'tamagotchi-actions-row' });

        const petBtn = actionsRow.createEl('button', {
            cls: 'tamagotchi-action-btn pet-btn',
            text: '💖 Streicheln'
        });
        petBtn.addEventListener('click', async () => {
            TamagotchiEngine.pet(this.plugin.settings);
            if (this.plugin.settings.enableSoundEffects) {
                this.plugin.soundManager.playClickSound();
            }
            await this.plugin.saveSettings();
            await this.plugin.learningSyncManager.saveLearningData();

            const heartEl = imgWrapper.createSpan({ cls: 'tamagotchi-floating-heart', text: '💖' });
            window.setTimeout(() => heartEl.remove(), 1200);

            new Notice(`Du hast ${companionName} gestreichelt! +Zuneigung & Energie 🥰`);
            this.render();
        });

        const feedQuizBtn = actionsRow.createEl('button', {
            cls: 'mod-cta tamagotchi-action-btn feed-btn',
            text: '⚡ Jetzt füttern (Schnell-Quiz)'
        });
        feedQuizBtn.addEventListener('click', () => {
            const allQuestions = this.plugin.indexer.getAllQuestions();
            if (allQuestions.length === 0) {
                new Notice('Keine Fragen im Klausuren-Ordner gefunden. Erstelle zuerst ein Quiz oder eine Klausur!');
                return;
            }
            const session = ExamGenerator.createDynamicMix(allQuestions, {
                modules: this.plugin.indexer.getAvailableModules(),
                questionCount: Math.min(5, allQuestions.length),
                mode: 'quiz'
            });
            void this.plugin.startExamWithSession(session);
        });
    }
}

class RenameCompanionModal extends Modal {
    private plugin: ExamQuizHubPlugin;
    private onRenamed: () => void;

    constructor(app: App, plugin: ExamQuizHubPlugin, onRenamed: () => void) {
        super(app);
        this.plugin = plugin;
        this.onRenamed = onRenamed;
    }

    public onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h3', { text: 'Lernbegleiter umbenennen' });

        const input = contentEl.createEl('input', {
            type: 'text',
            value: this.plugin.settings.tamagotchiName || 'Lern-Drache',
            cls: 'exam-hub-rename-input'
        });
        input.setCssStyles({ width: '100%', marginBottom: '16px' });
        input.focus();

        const btnRow = contentEl.createDiv({ cls: 'exam-hub-modal-buttons' });
        btnRow.setCssStyles({ display: 'flex', gap: '8px', justifyContent: 'flex-end' });

        const cancelBtn = btnRow.createEl('button', { text: 'Abbrechen' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = btnRow.createEl('button', { text: 'Speichern', cls: 'mod-cta' });
        saveBtn.addEventListener('click', async () => {
            const newName = input.value.trim();
            if (newName) {
                this.plugin.settings.tamagotchiName = newName;
                await this.plugin.saveSettings();
                await this.plugin.learningSyncManager.saveLearningData();
                this.onRenamed();
                this.close();
            }
        });
    }

    public onClose(): void {
        this.contentEl.empty();
    }
}

