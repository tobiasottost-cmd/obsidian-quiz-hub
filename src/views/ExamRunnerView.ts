import { Component, ItemView, Modal, Platform, setIcon, WorkspaceLeaf } from 'obsidian';
import type ExamQuizHubPlugin from '../main';
import { ExamSession } from '../session/ExamSession';
import { MarkdownUtils } from '../parser/MarkdownUtils';
import { QuestionDefinition } from '../types';
import { ScoringEngine } from '../scoring/ScoringEngine';

export const VIEW_TYPE_EXAM_RUNNER = 'exam-quiz-hub-runner';

export class ExamRunnerView extends ItemView {
    private plugin: ExamQuizHubPlugin;
    private session: ExamSession | null = null;
    private isFocusMode: boolean = false;
    private isDrawerOpen: boolean = false;
    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
    private renderComponent: Component = new Component();

    constructor(leaf: WorkspaceLeaf, plugin: ExamQuizHubPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    public getViewType(): string {
        return VIEW_TYPE_EXAM_RUNNER;
    }

    public getDisplayText(): string {
        if (!this.session) return 'Klausur-Simulation';
        const isQuiz = this.session.isQuizMode();
        return `${isQuiz ? 'Quiz' : 'Klausur'}: ${this.session.getState().examTitle}`;
    }

    public getIcon(): string {
        return 'pencil';
    }

    public setSession(session: ExamSession): void {
        if (this.session && this.session !== session) {
            this.session.destroy();
        }
        this.session = session;
        this.renderComponent.load();

        // Subscribe to session ticks and updates
        this.session.onTick(() => {
            this.updateTimerDisplay();
        });

        this.session.onQuestionChanged(() => {
            void this.renderQuestionContent();
            this.updateHeaderProgress();
            this.updateMatrix();
            this.updateTilesStrip();
            this.updateFooterNavButtons();
            this.scrollToTop();
        });

        this.session.onTimeExpired(() => {
            this.handleTimeExpired();
        });

        this.setupKeyboardShortcuts();
        this.render();
    }

    public async onOpen(): Promise<void> {
        // Active session is injected and managed by plugin.startExamWithSession
    }

    public async onClose(): Promise<void> {
        this.removeKeyboardShortcuts();
        this.renderComponent.unload();
        if (this.session) {
            await this.session.triggerAutoSave();
            this.session.destroy();
            this.session = null;
        }
    }

    private setupKeyboardShortcuts(): void {
        this.removeKeyboardShortcuts();

        this.keydownHandler = (e: KeyboardEvent) => {
            if (!this.session) return;

            // Don't trigger shortcuts if focus is inside an input or textarea
            const target = e.target as HTMLElement;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                return;
            }

            const key = e.key.toLowerCase();
            const currentQ = this.session.getCurrentQuestion();
            const currentIdx = this.session.getCurrentIndex();
            const totalQuestions = this.session.getTotalQuestions();

            // 1-5 for options A-E in MC
            if (['1', '2', '3', '4', '5'].includes(key)) {
                // In quiz mode, options are locked once checked/revealed
                if (this.session.isQuizMode() && this.session.isRevealed(currentQ.id)) {
                    e.preventDefault();
                    return;
                }

                const optIndex = parseInt(key) - 1;
                if (currentQ && currentQ.options && optIndex < currentQ.options.length) {
                    const opt = currentQ.options[optIndex];
                    if (currentQ.type === 'single-choice') {
                        this.session.selectSingleOption(currentQ.id, opt.id);
                    } else {
                        this.session.toggleOption(currentQ.id, opt.id);
                    }
                    this.plugin.soundManager.playClickSound();
                    void this.renderQuestionOptions(currentQ);
                    this.updateMatrix();
                    this.updateTilesStrip();
                    e.preventDefault();
                }
            } else if (e.key === ' ' || (e.key === 'Enter' && !e.ctrlKey)) {
                // Space or Enter in Quiz mode: Check answer or advance
                if (this.session.isQuizMode()) {
                    if (!this.session.isRevealed(currentQ.id)) {
                        this.checkCurrentQuestion();
                    } else {
                        if (currentIdx === totalQuestions - 1) {
                            this.confirmAndSubmit();
                        } else {
                            this.session.nextQuestion();
                        }
                    }
                    e.preventDefault();
                }
            } else if (key === 'j' || e.key === 'ArrowRight') {
                if (currentIdx === totalQuestions - 1) {
                    this.confirmAndSubmit();
                } else {
                    this.session.nextQuestion();
                }
                e.preventDefault();
            } else if (key === 'k' || e.key === 'ArrowLeft') {
                this.session.prevQuestion();
                e.preventDefault();
            } else if (key === 'm') {
                if (currentQ) {
                    this.session.toggleFlag(currentQ.id);
                    this.updateFlagButton();
                    this.updateTilesStrip();
                    this.updateMatrix();
                    this.updateFooterNavButtons();
                    e.preventDefault();
                }
            } else if (e.key === 'Enter' && e.ctrlKey) {
                this.confirmAndSubmit();
                e.preventDefault();
            }
        };

        this.registerDomEvent(window, 'keydown', this.keydownHandler);
    }

    private removeKeyboardShortcuts(): void {
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }
    }

    private render(): void {
        const container = this.contentEl;
        container.empty();
        container.addClass('exam-runner-container');
        if (this.isFocusMode) {
            container.addClass('is-focus-mode');
        }

        const nativeHeader = this.containerEl.querySelector('.view-header');
        if (nativeHeader) {
            nativeHeader.addClass('exam-runner-hide-header');
        }

        if (!this.session) {
            container.createEl('p', { text: 'Keine aktive Sitzung.' });
            return;
        }

        this.renderStickyHeader(container);

        const bodyWrapper = container.createDiv({ cls: 'exam-runner-body-wrapper' });
        this.renderMatrixDrawer(bodyWrapper);
        this.renderQuestionArea(bodyWrapper);
        this.renderFooterNavigation(container);
    }

    private renderStickyHeader(container: HTMLElement): void {
        const header = container.createDiv({ cls: 'exam-runner-sticky-header' });

        const topRow = header.createDiv({ cls: 'runner-header-top-row' });

        // Left: Back button & Title
        const leftGroup = topRow.createDiv({ cls: 'header-left-group' });
        const backBtn = leftGroup.createEl('button', { cls: 'icon-btn runner-back-btn', title: 'Zurück zum Dashboard' });
        setIcon(backBtn, 'arrow-left');
        backBtn.addEventListener('click', () => {
            this.confirmExit();
        });

        const titleDiv = leftGroup.createDiv({ cls: 'header-exam-titles' });
        titleDiv.createSpan({ cls: 'exam-title-text', text: this.session?.getState().examTitle || 'Klausur' });
        titleDiv.createSpan({ cls: 'exam-module-badge', text: this.session?.getState().module || 'Allgemein' });

        // Center: Timer / Mode Indicator
        const isQuiz = this.session?.isQuizMode() || false;
        const timerDiv = topRow.createDiv({
            cls: `runner-timer-container ${isQuiz ? 'is-quiz-timer' : ''}`,
            attr: { id: 'exam-runner-timer' }
        });
        const timerIcon = timerDiv.createSpan({ cls: 'timer-icon' });
        setIcon(timerIcon, isQuiz ? 'zap' : 'clock');
        timerDiv.createSpan({
            cls: 'timer-text',
            text: isQuiz ? '⚡ Quiz (Kein Zeitlimit)' : this.formatTime(this.session?.getRemainingSeconds() || 0)
        });

        // Right: Tools & Submit
        const rightGroup = topRow.createDiv({ cls: 'header-right-group' });

        const flagBtn = rightGroup.createEl('button', {
            cls: 'icon-btn flag-toggle-btn',
            attr: { id: 'runner-flag-btn', title: 'Frage markieren (M)' }
        });
        setIcon(flagBtn, 'flag');
        flagBtn.addEventListener('click', () => {
            if (this.session) {
                const q = this.session.getCurrentQuestion();
                this.session.toggleFlag(q.id);
                this.updateFlagButton();
                this.updateTilesStrip();
                this.updateMatrix();
                this.updateFooterNavButtons();
            }
        });

        const matrixBtn = rightGroup.createEl('button', {
            cls: 'icon-btn matrix-toggle-btn',
            attr: { title: 'Fragen-Matrix öffnen' }
        });
        setIcon(matrixBtn, 'grid');
        matrixBtn.addEventListener('click', () => {
            this.isDrawerOpen = !this.isDrawerOpen;
            const drawer = this.containerEl.querySelector('.exam-matrix-drawer');
            if (drawer) {
                drawer.classList.toggle('is-open', this.isDrawerOpen);
            }
        });

        const focusBtn = rightGroup.createEl('button', {
            cls: 'icon-btn focus-toggle-btn',
            attr: { title: 'Fokusmodus umschalten' }
        });
        setIcon(focusBtn, 'maximize-2');
        focusBtn.addEventListener('click', () => {
            this.isFocusMode = !this.isFocusMode;
            this.containerEl.children[1].classList.toggle('is-focus-mode', this.isFocusMode);
        });

        const submitBtn = rightGroup.createEl('button', {
            cls: 'mod-cta runner-submit-btn',
            text: isQuiz ? 'Quiz beenden' : 'Abgeben'
        });
        submitBtn.addEventListener('click', () => {
            this.confirmAndSubmit();
        });

        // Progress bar row
        const progressRow = header.createDiv({ cls: 'runner-progress-row' });
        const progressInfoRow = progressRow.createDiv({ cls: 'runner-progress-info-row' });
        const progressInfo = progressInfoRow.createDiv({ cls: 'progress-info-text', attr: { id: 'runner-progress-info' } });
        this.updateHeaderProgressText(progressInfo);

        const tilesToggleBtn = progressInfoRow.createEl('button', {
            cls: 'runner-tiles-toggle-btn',
            attr: { title: 'Kachelleiste umschalten' }
        });
        setIcon(tilesToggleBtn, 'layers');
        tilesToggleBtn.addEventListener('click', () => {
            const strip = header.querySelector('#runner-tiles-strip');
            if (strip) {
                strip.classList.toggle('is-visible');
            }
        });

        const barBg = progressRow.createDiv({ cls: 'runner-progress-bar-bg' });
        barBg.createDiv({ cls: 'runner-progress-bar-fill', attr: { id: 'runner-progress-fill' } });
        this.updateProgressBar();

        // Question tiles strip (Schnellnavigation Kacheln)
        const tilesStrip = header.createDiv({ cls: 'runner-question-tiles-strip', attr: { id: 'runner-tiles-strip' } });
        this.populateTilesStrip(tilesStrip);
    }

    private populateTilesStrip(stripEl: HTMLElement): void {
        stripEl.empty();
        if (!this.session) return;

        const questions = this.session.getState().questions;
        const currentIdx = this.session.getCurrentIndex();

        questions.forEach((q, idx) => {
            const isAnswered = this.session!.isAnswered(q.id);
            const isFlagged = this.session!.isFlagged(q.id);
            const isCurrent = idx === currentIdx;
            const isRevealed = this.session!.isRevealed(q.id);
            const evalRec = isRevealed ? this.session!.getRevealedEvaluation(q.id) : undefined;

            let scoreCls = '';
            if (isRevealed && evalRec) {
                if (evalRec.isFullyCorrect) {
                    scoreCls = 'quiz-score-full';
                } else if (evalRec.earnedPoints > 0) {
                    scoreCls = 'quiz-score-partial';
                } else {
                    scoreCls = 'quiz-score-zero';
                }
            }

            const titleScore = evalRec ? ` (${evalRec.earnedPoints}/${evalRec.possiblePoints} Pkt.)` : '';
            const tile = stripEl.createEl('button', {
                cls: `runner-tile-item ${isCurrent ? 'is-current' : ''} ${isAnswered ? 'is-answered' : ''} ${isFlagged ? 'is-flagged' : ''} ${scoreCls}`,
                attr: {
                    id: `runner-tile-${idx}`,
                    title: `Frage ${idx + 1}${isFlagged ? ' (Markiert)' : ''}${isAnswered ? ' (Beantwortet)' : ''}${titleScore}`
                }
            });

            tile.createSpan({ cls: 'tile-num', text: `${idx + 1}` });

            if (isFlagged) {
                const flagBadge = tile.createSpan({ cls: 'tile-flag-icon' });
                setIcon(flagBadge, 'flag');
            } else if (isRevealed && evalRec) {
                const badge = tile.createSpan({ cls: 'tile-check-icon' });
                if (evalRec.isFullyCorrect) {
                    setIcon(badge, 'check');
                } else if (evalRec.earnedPoints > 0) {
                    badge.setText('~');
                } else {
                    setIcon(badge, 'x');
                }
            } else if (isAnswered) {
                const checkBadge = tile.createSpan({ cls: 'tile-check-icon' });
                setIcon(checkBadge, 'check');
            }

            tile.addEventListener('click', () => {
                this.session!.goToQuestion(idx);
            });
        });

        // Scroll active tile into view smoothly
        const activeTile = stripEl.querySelector(`#runner-tile-${currentIdx}`);
        if (activeTile) {
            (activeTile as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    private updateTilesStrip(): void {
        const strip = this.containerEl.querySelector('#runner-tiles-strip') as HTMLElement;
        if (strip) {
            this.populateTilesStrip(strip);
        }
    }

    private renderMatrixDrawer(container: HTMLElement): void {
        const drawer = container.createDiv({
            cls: `exam-matrix-drawer ${this.isDrawerOpen ? 'is-open' : ''}`
        });

        const drawerHeader = drawer.createDiv({ cls: 'matrix-drawer-header' });
        drawerHeader.createEl('h4', { text: 'Fragen-Übersicht' });

        const closeBtn = drawerHeader.createEl('button', { cls: 'icon-btn close-drawer-btn' });
        setIcon(closeBtn, 'x');
        closeBtn.addEventListener('click', () => {
            this.isDrawerOpen = false;
            drawer.removeClass('is-open');
        });

        const grid = drawer.createDiv({ cls: 'matrix-grid', attr: { id: 'matrix-grid-container' } });
        this.populateMatrixGrid(grid);
    }

    private populateMatrixGrid(grid: HTMLElement): void {
        grid.empty();
        if (!this.session) return;

        const questions = this.session.getState().questions;
        const currentIndex = this.session.getCurrentIndex();

        questions.forEach((q, idx) => {
            const isAnswered = this.session!.isAnswered(q.id);
            const isFlagged = this.session!.isFlagged(q.id);
            const isCurrent = idx === currentIndex;
            const isRevealed = this.session!.isRevealed(q.id);
            const evalRec = isRevealed ? this.session!.getRevealedEvaluation(q.id) : undefined;

            let scoreCls = '';
            if (isRevealed && evalRec) {
                if (evalRec.isFullyCorrect) {
                    scoreCls = 'quiz-score-full';
                } else if (evalRec.earnedPoints > 0) {
                    scoreCls = 'quiz-score-partial';
                } else {
                    scoreCls = 'quiz-score-zero';
                }
            }

            const btn = grid.createEl('button', {
                cls: `matrix-item-btn ${isCurrent ? 'is-current' : ''} ${isAnswered ? 'is-answered' : ''} ${isFlagged ? 'is-flagged' : ''} ${scoreCls}`,
                text: `${idx + 1}`
            });

            if (isFlagged) {
                const flagBadge = btn.createSpan({ cls: 'matrix-flag-indicator' });
                setIcon(flagBadge, 'flag');
            } else if (isRevealed && evalRec) {
                const indicator = btn.createSpan({ cls: 'matrix-score-indicator' });
                if (evalRec.isFullyCorrect) {
                    setIcon(indicator, 'check');
                } else if (evalRec.earnedPoints > 0) {
                    indicator.setText('~');
                } else {
                    setIcon(indicator, 'x');
                }
            }

            btn.addEventListener('click', () => {
                this.session!.goToQuestion(idx);
                if (window.innerWidth < 768) {
                    this.isDrawerOpen = false;
                    const drawer = this.containerEl.querySelector('.exam-matrix-drawer');
                    if (drawer) drawer.removeClass('is-open');
                }
            });
        });
    }

    private renderQuestionArea(container: HTMLElement): void {
        container.createDiv({ cls: 'exam-runner-question-area', attr: { id: 'question-area-container' } });
        void this.renderQuestionContent();
    }

    private async renderQuestionContent(): Promise<void> {
        const area = this.containerEl.querySelector('#question-area-container') as HTMLElement;
        if (!area || !this.session) return;
        area.empty();

        const currentQ = this.session.getCurrentQuestion();
        const currentIdx = this.session.getCurrentIndex();
        const total = this.session.getTotalQuestions();
        const isFlagged = this.session.isFlagged(currentQ.id);

        const qCard = area.createDiv({ cls: 'question-content-card' });

        // Meta header row with prominent Flag Button
        const metaRow = qCard.createDiv({ cls: 'question-meta-row' });
        const metaLeft = metaRow.createDiv({ cls: 'question-meta-left' });
        metaLeft.createSpan({ cls: 'q-index-badge', text: `Aufgabe ${currentIdx + 1} von ${total}` });

        const badgesGroup = metaLeft.createDiv({ cls: 'badges-group' });
        badgesGroup.createSpan({ cls: 'q-points-badge', text: `${currentQ.points} Punkte` });
        if (currentQ.blockId) {
            badgesGroup.createSpan({ cls: 'q-block-id-badge', text: `^${currentQ.blockId}` });
        }
        badgesGroup.createSpan({
            cls: `q-flag-badge ${isFlagged ? 'is-visible' : ''}`,
            text: '⚑ Markiert'
        });

        // Prominent Flag button directly on question card
        const cardFlagText = Platform.isMobile
            ? (isFlagged ? '⚑ Markiert' : '⚐ Markieren')
            : (isFlagged ? '⚑ Für Überprüfung markiert' : '⚐ Frage markieren (M)');
        const cardFlagBtn = metaRow.createEl('button', {
            cls: `question-card-flag-btn ${isFlagged ? 'is-flagged' : ''}`,
            text: cardFlagText,
            attr: { title: 'Markierung für Review umschalten (M)' }
        });
        cardFlagBtn.addEventListener('click', () => {
            this.session!.toggleFlag(currentQ.id);
            this.updateFlagButton();
            this.updateTilesStrip();
            this.updateMatrix();
            this.updateFooterNavButtons();
            const nowFlagged = this.session!.isFlagged(currentQ.id);
            cardFlagBtn.classList.toggle('is-flagged', nowFlagged);
            const nowText = Platform.isMobile
                ? (nowFlagged ? '⚑ Markiert' : '⚐ Markieren')
                : (nowFlagged ? '⚑ Für Überprüfung markiert' : '⚐ Frage markieren (M)');
            cardFlagBtn.setText(nowText);
        });

        // Markdown rendered prompt
        const promptContainer = qCard.createDiv({ cls: 'question-prompt-container' });
        await MarkdownUtils.render(
            this.app,
            currentQ.prompt,
            promptContainer,
            currentQ.sourceFilePath || '',
            this.renderComponent
        );

        // Options or Input Container
        qCard.createDiv({ cls: 'question-input-area', attr: { id: 'question-input-container' } });
        await this.renderQuestionOptions(currentQ);

        this.updateFlagButton();
    }

    private async renderQuestionOptions(q: QuestionDefinition): Promise<void> {
        const container = this.containerEl.querySelector('#question-input-container') as HTMLElement;
        if (!container || !this.session) return;
        container.empty();

        const isQuiz = this.session.isQuizMode();
        const isRevealed = isQuiz && this.session.isRevealed(q.id);
        const answerRecord = this.session.getAnswer(q.id);
        const evalRec = isRevealed ? (this.session.getRevealedEvaluation(q.id) || ScoringEngine.evaluateQuestion(q, this.session.getState())) : undefined;

        if (q.type === 'multiple-choice' || q.type === 'single-choice') {
            const options = q.options || [];
            const isSingle = q.type === 'single-choice';
            const selectedSet = new Set(answerRecord.selectedOptionIds || []);

            const list = container.createDiv({ cls: 'options-list' });

            options.forEach((opt, idx) => {
                const isSelected = selectedSet.has(opt.id);
                const letter = String.fromCharCode(65 + idx); // A, B, C, D, E

                let cardExtraCls = '';
                let statusBadgeText = '';
                let itemDetail: { userSelected: boolean; isCorrect: boolean; earnedPoint: boolean } | undefined;

                if (isRevealed && evalRec && evalRec.itemDetails && evalRec.itemDetails[idx]) {
                    itemDetail = evalRec.itemDetails[idx];
                    cardExtraCls = 'is-locked ';

                    if (itemDetail.userSelected && itemDetail.isCorrect) {
                        cardExtraCls += 'is-revealed-correct';
                        statusBadgeText = '+1 Pkt. • Zutreffend';
                    } else if (itemDetail.userSelected && !itemDetail.isCorrect) {
                        cardExtraCls += 'is-revealed-wrong';
                        statusBadgeText = '0 Pkt. • Falsch gewählt';
                    } else if (!itemDetail.userSelected && itemDetail.isCorrect) {
                        cardExtraCls += 'is-revealed-missed';
                        statusBadgeText = '0 Pkt. • Gefehlt (Wäre zutreffend)';
                    } else {
                        cardExtraCls += 'is-revealed-neutral';
                        statusBadgeText = '+1 Pkt. • Richtig nicht gewählt';
                    }
                } else if (isSelected) {
                    cardExtraCls = 'is-selected';
                }

                const card = list.createDiv({
                    cls: `option-choice-card ${cardExtraCls}`
                });

                const checkIndicator = card.createDiv({
                    cls: `choice-indicator ${isSingle ? 'is-radio' : 'is-checkbox'} ${isSelected ? 'checked' : ''}`
                });

                if (isRevealed && itemDetail) {
                    if (itemDetail.userSelected && itemDetail.isCorrect) {
                        setIcon(checkIndicator, 'check');
                    } else if (itemDetail.userSelected && !itemDetail.isCorrect) {
                        setIcon(checkIndicator, 'x');
                    } else if (!itemDetail.userSelected && itemDetail.isCorrect) {
                        setIcon(checkIndicator, 'alert-circle');
                    } else {
                        checkIndicator.addClass('is-neutral-unselected');
                    }
                } else if (isSelected && !isSingle) {
                    setIcon(checkIndicator, 'check');
                }

                card.createSpan({ cls: 'choice-letter-label', text: `${letter}.` });
                card.createDiv({ cls: 'choice-text', text: opt.text });

                if (statusBadgeText) {
                    card.createSpan({ cls: 'quiz-item-status-tag', text: statusBadgeText });
                }

                // Only allow clicking if NOT revealed in quiz mode
                if (!isRevealed) {
                    card.addEventListener('click', () => {
                        if (isSingle) {
                            this.session!.selectSingleOption(q.id, opt.id);
                        } else {
                            this.session!.toggleOption(q.id, opt.id);
                        }
                        this.plugin.soundManager.playClickSound();
                        void this.renderQuestionOptions(q);
                        this.updateMatrix();
                        this.updateTilesStrip();
                        this.updateProgressBar();
                    });
                }
            });

            // Quiz mode actions: "Antwort prüfen" button when unrevealed
            if (isQuiz && !isRevealed) {
                const checkBar = container.createDiv({ cls: 'quiz-check-action-bar' });
                const checkBtn = checkBar.createEl('button', {
                    cls: 'mod-cta quiz-check-btn',
                    text: '⚡ Antwort prüfen (Enter)'
                });
                checkBtn.addEventListener('click', () => {
                    this.checkCurrentQuestion();
                });
            }

            // Quiz mode feedback when revealed
            if (isQuiz && isRevealed && evalRec) {
                const scoreBanner = container.createDiv({
                    cls: `quiz-question-score-banner ${evalRec.isFullyCorrect ? 'is-full-score' : evalRec.earnedPoints > 0 ? 'is-partial-score' : 'is-zero-score'}`
                });
                const iconSpan = scoreBanner.createSpan({ cls: 'quiz-score-icon' });
                setIcon(iconSpan, evalRec.isFullyCorrect ? 'check-circle' : evalRec.earnedPoints > 0 ? 'alert-triangle' : 'x-circle');
                scoreBanner.createSpan({
                    cls: 'quiz-score-text',
                    text: `${evalRec.earnedPoints} von ${evalRec.possiblePoints} Punkten (${evalRec.isFullyCorrect ? '100% Richtig' : evalRec.earnedPoints > 0 ? 'Teilpunkte' : 'Fehler'})`
                });

                const currentIdx = this.session.getCurrentIndex();
                if (currentIdx < this.session.getTotalQuestions() - 1) {
                    const nextBtn = scoreBanner.createEl('button', {
                        cls: 'mod-cta quiz-advance-btn',
                        text: 'Nächste Frage (J) →'
                    });
                    nextBtn.addEventListener('click', () => {
                        this.session?.nextQuestion();
                    });
                }

                // Render Explanation Callout immediately
                if (q.explanation) {
                    const explBox = container.createDiv({ cls: 'quiz-explanation-box' });
                    explBox.createEl('h5', { text: '💡 Erklärung & Lösungshinweis:' });
                    const explBody = explBox.createDiv({ cls: 'quiz-explanation-body' });
                    await MarkdownUtils.render(this.app, q.explanation, explBody, q.sourceFilePath || '', this.renderComponent);
                }
            }
        } else if (q.type === 'freetext') {
            const freetextDiv = container.createDiv({ cls: 'freetext-input-container' });
            freetextDiv.createEl('label', { text: 'Deine Ausarbeitung / Antwort:' });

            const textarea = freetextDiv.createEl('textarea', {
                cls: `freetext-textarea ${isRevealed ? 'is-locked' : ''}`,
                attr: { placeholder: 'Antwort hier formulieren...', rows: '6' }
            });
            textarea.value = answerRecord.freetextAnswer || '';
            if (isRevealed) {
                textarea.readOnly = true;
            } else {
                textarea.addEventListener('input', () => {
                    this.session!.setFreetextAnswer(q.id, textarea.value);
                    this.updateMatrix();
                    this.updateTilesStrip();
                    this.updateProgressBar();
                });
            }

            if (isQuiz && !isRevealed) {
                const checkBar = container.createDiv({ cls: 'quiz-check-action-bar' });
                const checkBtn = checkBar.createEl('button', {
                    cls: 'mod-cta quiz-check-btn',
                    text: '⚡ Lösung anzeigen & Bewerten'
                });
                checkBtn.addEventListener('click', () => {
                    this.checkCurrentQuestion();
                });
            }

            if (isQuiz && isRevealed) {
                if (q.modelAnswer) {
                    const modelBox = container.createDiv({ cls: 'quiz-freetext-box quiz-model-box' });
                    modelBox.createEl('h5', { text: 'Erwartungshorizont / Musterlösung:' });
                    modelBox.createEl('p', { text: q.modelAnswer });
                }

                if (q.rubric && q.rubric.length > 0) {
                    const rubricBox = container.createDiv({ cls: 'quiz-freetext-box quiz-rubric-box' });
                    rubricBox.createEl('h5', { text: 'Bewertungskriterien:' });
                    const ul = rubricBox.createEl('ul');
                    q.rubric.forEach(r => ul.createEl('li', { text: r }));
                }

                if (q.explanation) {
                    const explBox = container.createDiv({ cls: 'quiz-explanation-box' });
                    explBox.createEl('h5', { text: '💡 Didaktische Hinweise:' });
                    const explBody = explBox.createDiv({ cls: 'quiz-explanation-body' });
                    await MarkdownUtils.render(this.app, q.explanation, explBody, q.sourceFilePath || '', this.renderComponent);
                }

                // Interactive Self-Assessment buttons
                const assessBox = container.createDiv({ cls: 'quiz-freetext-self-assessment' });
                assessBox.createEl('h5', { text: '🎯 Punkte selbst vergeben:' });
                const maxPoints = q.points || 3;
                const currentAssigned = answerRecord.freetextAssignedPoints ?? 0;
                const scoreGroup = assessBox.createDiv({ cls: 'score-button-group' });

                for (let p = 0; p <= maxPoints; p += 0.5) {
                    const btn = scoreGroup.createEl('button', {
                        cls: `score-step-btn ${currentAssigned === p ? 'is-active' : ''}`,
                        text: `${p} P`
                    });
                    btn.addEventListener('click', () => {
                        answerRecord.freetextAssignedPoints = p;
                        const updatedEval = ScoringEngine.evaluateQuestion(q, this.session!.getState());
                        this.session!.revealQuestion(q.id, updatedEval);
                        void this.renderQuestionOptions(q);
                        this.updateMatrix();
                        this.updateTilesStrip();
                        this.updateHeaderProgress();
                        this.updateFooterNavButtons();
                    });
                }
            }
        }
    }

    private checkCurrentQuestion(): void {
        if (!this.session) return;
        const currentQ = this.session.getCurrentQuestion();
        if (this.session.isRevealed(currentQ.id)) return;

        const evaluation = ScoringEngine.evaluateQuestion(currentQ, this.session.getState());
        this.session.revealQuestion(currentQ.id, evaluation);

        if (this.plugin.soundManager) {
            if (evaluation.isFullyCorrect) {
                this.plugin.soundManager.playSuccessChord();
            } else if (evaluation.earnedPoints > 0) {
                this.plugin.soundManager.playClickSound();
            } else {
                this.plugin.soundManager.playFailSound();
            }
        }

        void this.renderQuestionOptions(currentQ);
        this.updateMatrix();
        this.updateTilesStrip();
        this.updateHeaderProgress();
        this.updateFooterNavButtons();
    }

    private renderFooterNavigation(container: HTMLElement): void {
        const footer = container.createDiv({ cls: 'exam-runner-footer-nav' });
        this.updateFooterNavButtons(footer);
    }

    private updateFooterNavButtons(footerEl?: HTMLElement): void {
        const footer = footerEl || (this.containerEl.querySelector('.exam-runner-footer-nav') as HTMLElement);
        if (!footer || !this.session) return;
        footer.empty();

        const currentIdx = this.session.getCurrentIndex();
        const total = this.session.getTotalQuestions();
        const isLastQuestion = currentIdx === total - 1;
        const isQuiz = this.session.isQuizMode();

        const prevText = Platform.isMobile ? '← Zurück' : '← Vorherige (K)';
        const prevBtn = footer.createEl('button', {
            cls: `nav-btn prev-btn ${currentIdx === 0 ? 'is-disabled' : ''}`,
            text: prevText
        });
        prevBtn.addEventListener('click', () => {
            this.session?.prevQuestion();
        });

        const isFlagged = this.session.isFlagged(this.session.getCurrentQuestion().id);
        const markText = Platform.isMobile
            ? (isFlagged ? '⚑ Markiert' : '⚐ Markieren')
            : (isFlagged ? '⚑ Markiert (M)' : '⚐ Zur Überprüfung (M)');
        const markBtn = footer.createEl('button', {
            cls: `nav-btn mark-btn ${isFlagged ? 'is-flagged' : ''}`,
            text: markText
        });
        markBtn.addEventListener('click', () => {
            if (this.session) {
                const q = this.session.getCurrentQuestion();
                this.session.toggleFlag(q.id);
                this.updateFlagButton();
                this.updateTilesStrip();
                this.updateMatrix();
                this.updateFooterNavButtons(footer);
            }
        });

        if (isLastQuestion) {
            const submitText = isQuiz
                ? (Platform.isMobile ? 'Quiz abschließen ✓' : 'Quiz abschließen & auswerten ✓')
                : (Platform.isMobile ? 'Abgeben ✓' : 'Klausur abgeben ✓');
            const submitBtn = footer.createEl('button', {
                cls: 'mod-cta nav-btn submit-btn is-final-submit',
                text: submitText
            });
            submitBtn.addEventListener('click', () => {
                this.confirmAndSubmit();
            });
        } else {
            const nextText = Platform.isMobile ? 'Weiter →' : 'Nächste (J) →';
            const nextBtn = footer.createEl('button', {
                cls: 'mod-cta nav-btn next-btn',
                text: nextText
            });
            nextBtn.addEventListener('click', () => {
                this.session?.nextQuestion();
            });
        }
    }

    private updateTimerDisplay(): void {
        const timerEl = this.containerEl.querySelector('#exam-runner-timer .timer-text');
        if (timerEl && this.session) {
            if (this.session.isQuizMode()) {
                timerEl.setText('⚡ Quiz (Kein Zeitlimit)');
                return;
            }
            const remaining = this.session.getRemainingSeconds();
            timerEl.setText(this.formatTime(remaining));
            const timerContainer = this.containerEl.querySelector('#exam-runner-timer');
            if (timerContainer) {
                // Warning state if less than 5 minutes (300 seconds)
                timerContainer.classList.toggle('is-danger', remaining <= 300);
            }
        }
    }

    private updateHeaderProgress(): void {
        const textEl = this.containerEl.querySelector('#runner-progress-info') as HTMLElement;
        if (textEl) {
            this.updateHeaderProgressText(textEl);
        }
        this.updateProgressBar();
    }

    private updateHeaderProgressText(el: HTMLElement): void {
        if (!this.session) return;
        const current = this.session.getCurrentIndex() + 1;
        const total = this.session.getTotalQuestions();
        const answered = this.session.getAnsweredCount();
        el.setText(`Frage ${current} von ${total} • ${answered} beantwortet`);
    }

    private updateProgressBar(): void {
        const fill = this.containerEl.querySelector('#runner-progress-fill') as HTMLElement;
        if (fill && this.session) {
            const answered = this.session.getAnsweredCount();
            const total = this.session.getTotalQuestions();
            const pct = total > 0 ? (answered / total) * 100 : 0;
            fill.setCssStyles({ width: `${pct}%` });
        }
    }

    private updateFlagButton(): void {
        if (!this.session) return;
        const currentQ = this.session.getCurrentQuestion();
        const isFlagged = this.session.isFlagged(currentQ.id);

        const btn = this.containerEl.querySelector('#runner-flag-btn') as HTMLElement;
        if (btn) {
            btn.classList.toggle('is-flagged', isFlagged);
        }

        const badge = this.containerEl.querySelector('.q-flag-badge') as HTMLElement;
        if (badge) {
            badge.classList.toggle('is-visible', isFlagged);
        }
    }

    private updateMatrix(): void {
        const grid = this.containerEl.querySelector('#matrix-grid-container') as HTMLElement;
        if (grid) {
            this.populateMatrixGrid(grid);
        }
    }

    private scrollToTop(): void {
        const body = this.containerEl.querySelector('.exam-runner-question-area');
        if (body) {
            body.scrollTop = 0;
        }
    }

    private formatTime(totalSeconds: number): string {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    private handleTimeExpired(): void {
        new Modal(this.app)
            .setTitle('Zeit abgelaufen!')
            .setContent('Die Bearbeitungszeit für diese Klausur ist abgelaufen. Die Klausur wird nun ausgewertet.')
            .open();
        void this.submitExam();
    }

    private confirmAndSubmit(): void {
        if (!this.session) return;

        const isQuiz = this.session.isQuizMode();
        const unanswered = this.session.getTotalQuestions() - this.session.getAnsweredCount();
        const flagged = this.session.getState().flaggedQuestionIds.length;

        const modal = new Modal(this.app);
        modal.titleEl.setText(isQuiz ? 'Quiz abschließen?' : 'Klausur abgeben?');

        let msg = isQuiz
            ? 'Möchtest du das Quiz jetzt abschließen und deine Gesamtauswertung ansehen?'
            : 'Möchtest du die Klausur jetzt abschließen und auswerten?';
        if (unanswered > 0 || flagged > 0) {
            msg += `\n\nHinweis: Es sind noch ${unanswered} unbeantwortete Frage(n) und ${flagged} markierte Frage(n) vorhanden.`;
        }
        modal.contentEl.createEl('p', { text: msg });

        const btnRow = modal.contentEl.createDiv({ cls: 'modal-button-row' });
        const cancelBtn = btnRow.createEl('button', { text: 'Weiterbearbeiten' });
        cancelBtn.addEventListener('click', () => modal.close());

        const confirmBtn = btnRow.createEl('button', { cls: 'mod-cta', text: isQuiz ? 'Ja, Quiz beenden' : 'Ja, abgeben' });
        confirmBtn.addEventListener('click', () => {
            modal.close();
            void this.submitExam();
        });

        modal.open();
    }

    private confirmExit(): void {
        const isQuiz = this.session?.isQuizMode() || false;
        const modal = new Modal(this.app);
        modal.titleEl.setText(isQuiz ? 'Quiz verlassen?' : 'Klausur verlassen?');
        modal.contentEl.createEl('p', {
            text: isQuiz
                ? 'Möchtest du das Quiz pausieren (um es später im Dashboard fortzusetzen) oder verwerfen?'
                : 'Deine bisherigen Antworten und die verbleibende Zeit sind zwischengespeichert. Du kannst die Klausur später über das Dashboard oder den Wiederherstellungsdialog fortsetzen.'
        });

        const btnRow = modal.contentEl.createDiv({ cls: 'modal-button-row' });
        const cancelBtn = btnRow.createEl('button', { text: 'Weiterbearbeiten' });
        cancelBtn.addEventListener('click', () => modal.close());

        const discardBtn = btnRow.createEl('button', { cls: 'mod-warning', text: isQuiz ? 'Quiz verwerfen' : 'Abbrechen & verwerfen' });
        discardBtn.addEventListener('click', () => {
            void (async () => {
                modal.close();
                if (this.session) {
                    this.session.destroy();
                    this.session = null;
                }
                this.plugin.settings.activeSession = null;
                await this.plugin.saveSettings();
                await this.plugin.openDashboard(this.leaf);
            })();
        });

        const exitBtn = btnRow.createEl('button', { cls: 'mod-cta', text: isQuiz ? 'Pausieren (Zum Dashboard)' : 'Zum Dashboard' });
        exitBtn.addEventListener('click', () => {
            void (async () => {
                modal.close();
                if (this.session) {
                    await this.session.triggerAutoSave();
                    this.session.destroy();
                    this.session = null;
                }
                await this.plugin.openDashboard(this.leaf);
            })();
        });

        modal.open();
    }

    private async submitExam(): Promise<void> {
        if (!this.session) return;
        const state = this.session.getState();
        this.session.destroy();
        this.session = null;
        await this.plugin.completeExam(state);
    }
}
