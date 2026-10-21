import { Component, ItemView, Notice, setIcon, WorkspaceLeaf } from 'obsidian';
import type ExamQuizHubPlugin from '../main';
import { ActiveSessionState, QuestionDefinition, QuestionEvaluation, SessionResult } from '../types';
import { ScoringEngine } from '../scoring/ScoringEngine';
import { ResultExporter } from '../scoring/ResultExporter';
import { ConfettiTrigger } from '../gamification/ConfettiTrigger';
import { MarkdownUtils } from '../parser/MarkdownUtils';
import { ExamGenerator } from '../session/ExamGenerator';

export const VIEW_TYPE_RESULT = 'exam-quiz-hub-result';

export class ResultView extends ItemView {
    private plugin: ExamQuizHubPlugin;
    private result: SessionResult | null = null;
    private sessionState: ActiveSessionState | null = null;
    private renderComponent: Component = new Component();

    constructor(leaf: WorkspaceLeaf, plugin: ExamQuizHubPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    public getViewType(): string {
        return VIEW_TYPE_RESULT;
    }

    public getDisplayText(): string {
        return 'Klausur-Ergebnis & Auswertung';
    }

    public getIcon(): string {
        return 'check-circle';
    }

    public setResult(result: SessionResult, sessionState: ActiveSessionState): void {
        this.result = result;
        this.sessionState = sessionState;
        this.renderComponent.load();

        // Trigger Audio & Confetti
        if (result.passed) {
            this.plugin.soundManager.playSuccessChord();
            ConfettiTrigger.fire(result.percentage, this.plugin.settings.enableConfetti);
        } else {
            this.plugin.soundManager.playFailSound();
        }

        this.render();
    }

    public async onClose(): Promise<void> {
        this.renderComponent.unload();
    }

    private render(): void {
        const container = this.contentEl;
        container.empty();
        container.addClass('exam-result-container');

        const nativeHeader = this.containerEl.querySelector('.view-header');
        if (nativeHeader) {
            nativeHeader.addClass('exam-runner-hide-header');
        }

        if (!this.result || !this.sessionState) {
            container.createEl('p', { text: 'Keine Auswertungsdaten vorhanden.' });
            return;
        }

        const inner = container.createDiv({ cls: 'exam-result-inner' });
        this.renderScoreBanner(inner);
        this.renderActionButtons(inner);
        this.renderReviewQuickNav(inner);
        void this.renderQuestionsReview(inner);
    }

    private renderReviewQuickNav(container: HTMLElement): void {
        if (!this.result || !this.sessionState) return;

        const navCard = container.createDiv({ cls: 'result-quick-nav-card' });
        navCard.createEl('h4', { text: 'Fragen-Übersicht & Schnellnavigation:' });
        const strip = navCard.createDiv({ cls: 'result-tiles-strip' });

        this.sessionState.questions.forEach((q, idx) => {
            const evalRec = this.result!.questionEvaluations.find(e => e.questionId === q.id);
            const isFull = evalRec?.isFullyCorrect || false;
            const earned = evalRec?.earnedPoints || 0;
            const statusClass = isFull ? 'tile-correct' : earned > 0 ? 'tile-partial' : 'tile-wrong';

            const tile = strip.createEl('button', {
                cls: `result-tile-btn ${statusClass}`,
                text: `${idx + 1}`
            });

            tile.addEventListener('click', () => {
                const targetCard = this.containerEl.querySelector(`#review-q-${idx}`);
                if (targetCard) {
                    targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    private renderScoreBanner(container: HTMLElement): void {
        if (!this.result) return;

        const banner = container.createDiv({
            cls: `exam-result-score-banner ${this.result.passed ? 'is-passed' : 'is-failed'}`
        });

        const topRow = banner.createDiv({ cls: 'score-banner-top' });

        const scoreCircle = topRow.createDiv({ cls: 'score-circle' });
        scoreCircle.createDiv({ cls: 'score-percentage', text: `${this.result.percentage}%` });
        scoreCircle.createDiv({ cls: 'score-points-text', text: `${this.result.earnedPoints} / ${this.result.totalPossiblePoints} Pkt.` });

        const infoCol = topRow.createDiv({ cls: 'score-info-col' });
        infoCol.createEl('h2', { text: this.result.examTitle });

        infoCol.createDiv({
            cls: `result-status-badge ${this.result.passed ? 'badge-passed' : 'badge-failed'}`,
            text: this.result.passed ? '🎉 Bestanden' : '❌ Nicht bestanden'
        });

        const durationMin = Math.round(this.result.timeSpentSeconds / 60);
        infoCol.createEl('p', {
            cls: 'result-meta-text',
            text: `Modul: ${this.result.module} • Dauer: ca. ${durationMin} Min. • Datum: ${new Date(this.result.date).toLocaleDateString()}`
        });

        // XP Gained Card
        const xpCard = banner.createDiv({ cls: 'result-xp-card' });
        const xpIcon = xpCard.createSpan({ cls: 'xp-icon' });
        setIcon(xpIcon, 'zap');
        xpCard.createSpan({ cls: 'xp-text', text: `+${this.result.xpEarned} Erfahrungspunkte (XP) erhalten!` });
    }

    private renderActionButtons(container: HTMLElement): void {
        const row = container.createDiv({ cls: 'result-actions-row' });

        const exportBtn = row.createEl('button', {
            cls: 'mod-cta result-action-btn',
            text: '📄 Ergebnis als Vault-Notiz speichern'
        });
        exportBtn.addEventListener('click', () => {
            void (async () => {
                if (!this.result || !this.sessionState) return;
                try {
                    const path = await ResultExporter.exportToVault(
                        this.app,
                        this.result,
                        this.sessionState,
                        this.plugin.settings.resultsFolderPath
                    );
                    new Notice(`Klausurbericht erfolgreich gespeichert:\n${path}`);
                } catch (err) {
                    console.error('Fehler beim Exportieren des Ergebnisses:', err);
                    new Notice('Fehler beim Speichern der Notiz.');
                }
            })();
        });

        const failedCount = this.result?.questionEvaluations.filter(e => !e.isFullyCorrect).length || 0;
        if (failedCount > 0) {
            const trainErrorsBtn = row.createEl('button', {
                cls: 'result-action-btn train-errors-btn',
                text: `🎯 Fehlerspeicher trainieren (${failedCount} Fehler)`
            });
            trainErrorsBtn.addEventListener('click', () => {
                const session = ExamGenerator.createErrorPoolSession(
                    this.plugin.indexer.getAllQuestions(),
                    this.plugin.settings.errorPool
                );
                if (session) {
                    void this.plugin.startExamWithSession(session);
                }
            });
        }

        const dashboardBtn = row.createEl('button', {
            cls: 'result-action-btn back-dashboard-btn',
            text: '← Zurück zum Dashboard'
        });
        dashboardBtn.addEventListener('click', () => {
            void this.plugin.openDashboard(this.leaf);
        });
    }

    private async renderQuestionsReview(container: HTMLElement): Promise<void> {
        if (!this.result || !this.sessionState) return;

        const section = container.createDiv({ cls: 'result-review-section' });
        section.createEl('h3', { text: 'Detaillierte Aufgaben-Nachbereitung' });

        const list = section.createDiv({ cls: 'review-questions-list' });

        for (let i = 0; i < this.sessionState.questions.length; i++) {
            const q = this.sessionState.questions[i];
            const evalRec = this.result.questionEvaluations.find(e => e.questionId === q.id);
            const isFull = evalRec?.isFullyCorrect || false;
            const earned = evalRec?.earnedPoints || 0;
            const possible = evalRec?.possiblePoints || q.points;

            const card = list.createDiv({
                cls: `review-question-card ${isFull ? 'card-success' : earned > 0 ? 'card-partial' : 'card-failed'}`,
                attr: { id: `review-q-${i}` }
            });

            // Card Header
            const header = card.createDiv({ cls: 'review-card-header' });
            const titleSpan = header.createSpan({ cls: 'review-card-title' });
            titleSpan.createSpan({ cls: 'q-index', text: `Aufgabe ${i + 1}: ` });
            titleSpan.createSpan({ text: q.prompt.split('\n')[0] });

            header.createSpan({
                cls: `review-points-badge ${isFull ? 'is-full' : 'is-not-full'}`,
                text: `${earned} / ${possible} Pkt.`
            });

            // Card Body
            const body = card.createDiv({ cls: 'review-card-body' });

            // Render full prompt markdown
            const promptDiv = body.createDiv({ cls: 'review-prompt-md' });
            await MarkdownUtils.render(this.app, q.prompt, promptDiv, q.sourceFilePath, this.renderComponent);

            // Review for Multiple Choice
            if (q.type === 'multiple-choice' && evalRec?.itemDetails) {
                const mcReview = body.createDiv({ cls: 'review-mc-list' });
                for (const item of evalRec.itemDetails) {
                    const itemRow = mcReview.createDiv({
                        cls: `review-mc-item ${item.earnedPoint ? 'is-item-correct' : 'is-item-wrong'}`
                    });

                    const iconSpan = itemRow.createSpan({ cls: 'mc-check-icon' });
                    setIcon(iconSpan, item.userSelected ? 'check-square' : 'square');

                    itemRow.createSpan({ cls: 'mc-item-text', text: item.text });

                    itemRow.createSpan({
                        cls: `mc-item-status-tag ${item.earnedPoint ? 'tag-correct' : 'tag-wrong'}`,
                        text: item.earnedPoint ? '+1 Pkt.' : '0 Pkt.'
                    });

                    itemRow.createSpan({
                        cls: `mc-truth-badge ${item.isCorrect ? 'is-true' : 'is-false'}`,
                        text: item.isCorrect ? 'Wahr' : 'Falsch'
                    });
                }
            } else if (q.type === 'freetext') {
                // Interactive Freetext Evaluation
                this.renderFreetextSelfAssessment(body, q, evalRec);
            }

            // Explanation Callout
            if (q.explanation) {
                const explDiv = body.createDiv({ cls: 'review-explanation-callout' });
                explDiv.createEl('strong', { text: '💡 Erklärung & Musterhinweis:' });
                const explContent = explDiv.createDiv({ cls: 'explanation-content' });
                await MarkdownUtils.render(this.app, q.explanation, explContent, q.sourceFilePath, this.renderComponent);
            }
        }
    }

    private renderFreetextSelfAssessment(container: HTMLElement, q: QuestionDefinition, evalRec?: QuestionEvaluation): void {
        const selfAssess = container.createDiv({ cls: 'freetext-self-assessment' });

        const userAns = this.sessionState?.userAnswers[q.id]?.freetextAnswer || '*(Keine Eingabe)*';
        const userDiv = selfAssess.createDiv({ cls: 'freetext-user-box' });
        userDiv.createEl('h5', { text: 'Deine Antwort:' });
        userDiv.createEl('p', { text: userAns });

        if (q.modelAnswer) {
            const modelDiv = selfAssess.createDiv({ cls: 'freetext-model-box' });
            modelDiv.createEl('h5', { text: 'Erwartungshorizont / Musterlösung:' });
            modelDiv.createEl('p', { text: q.modelAnswer });
        }

        if (q.rubric && q.rubric.length > 0) {
            const rubricDiv = selfAssess.createDiv({ cls: 'freetext-rubric-box' });
            rubricDiv.createEl('h5', { text: 'Bewertungskriterien:' });
            const ul = rubricDiv.createEl('ul');
            q.rubric.forEach((r: string) => ul.createEl('li', { text: r }));
        }

        // Stepped button selector for manual scoring
        const scoringBar = selfAssess.createDiv({ cls: 'freetext-scoring-bar' });
        scoringBar.createSpan({ text: 'Punkte selbst vergeben: ' });

        const maxPoints = evalRec?.possiblePoints || q.points || 3;
        const currentAssigned = this.sessionState?.userAnswers[q.id]?.freetextAssignedPoints ?? evalRec?.earnedPoints ?? 0;

        const buttonGroup = scoringBar.createDiv({ cls: 'score-button-group' });

        for (let p = 0; p <= maxPoints; p += 0.5) {
            const btn = buttonGroup.createEl('button', {
                cls: `score-step-btn ${currentAssigned === p ? 'is-active' : ''}`,
                text: `${p} P`
            });

            btn.addEventListener('click', () => {
                if (!this.sessionState) return;
                if (!this.sessionState.userAnswers[q.id]) {
                    this.sessionState.userAnswers[q.id] = {};
                }
                this.sessionState.userAnswers[q.id].freetextAssignedPoints = p;

                // Recalculate score live
                this.result = ScoringEngine.evaluate(this.sessionState, this.plugin.settings.defaultPassingScore);
                this.render();
            });
        }
    }
}
