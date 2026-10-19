import { ActiveSessionState, QuestionDefinition, UserAnswerRecord } from '../types';

export class ExamSession {
    private state: ActiveSessionState;
    private timerInterval: number | null = null;
    private autoSaveInterval: number | null = null;
    private onAutoSaveCallback: (state: ActiveSessionState) => Promise<void>;
    
    private tickListeners: ((remainingSeconds: number) => void)[] = [];
    private questionChangedListeners: ((index: number, question: QuestionDefinition) => void)[] = [];
    private stateUpdatedListeners: ((state: ActiveSessionState) => void)[] = [];
    private timeExpiredListeners: (() => void)[] = [];

    private beforeUnloadHandler: () => void;
    private visibilityChangeHandler: () => void;

    constructor(initialState: ActiveSessionState, onAutoSave: (state: ActiveSessionState) => Promise<void>) {
        this.state = initialState;
        this.onAutoSaveCallback = onAutoSave;

        // Auto-save on window unload or when app switches to background (mobile capacitor)
        this.beforeUnloadHandler = () => {
            this.triggerAutoSave();
        };

        this.visibilityChangeHandler = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                this.triggerAutoSave();
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', this.beforeUnloadHandler);
        }
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.visibilityChangeHandler);
        }

        this.startTimer();
        this.startAutoSaveTimer();
    }

    public getState(): ActiveSessionState {
        return this.state;
    }

    public getCurrentQuestion(): QuestionDefinition {
        return this.state.questions[this.state.currentQuestionIndex];
    }

    public getCurrentIndex(): number {
        return this.state.currentQuestionIndex;
    }

    public getTotalQuestions(): number {
        return this.state.questions.length;
    }

    public getRemainingSeconds(): number {
        return this.state.remainingSeconds;
    }

    private startTimer(): void {
        this.stopTimer();
        this.timerInterval = window.setInterval(() => {
            if (this.state.remainingSeconds > 0) {
                this.state.remainingSeconds -= 1;
                for (const listener of this.tickListeners) {
                    listener(this.state.remainingSeconds);
                }
            } else {
                this.stopTimer();
                for (const listener of this.timeExpiredListeners) {
                    listener();
                }
            }
        }, 1000);
    }

    private stopTimer(): void {
        if (this.timerInterval !== null) {
            window.clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    private startAutoSaveTimer(): void {
        this.stopAutoSaveTimer();
        // 15 seconds auto-save requirement from specification v3
        this.autoSaveInterval = window.setInterval(() => {
            this.triggerAutoSave();
        }, 15000);
    }

    private stopAutoSaveTimer(): void {
        if (this.autoSaveInterval !== null) {
            window.clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    public async triggerAutoSave(): Promise<void> {
        try {
            await this.onAutoSaveCallback(this.state);
        } catch (err) {
            console.error('Failed to auto-save exam session:', err);
        }
    }

    // --- State Listeners ---
    public onTick(cb: (remainingSeconds: number) => void): void {
        this.tickListeners.push(cb);
    }

    public onQuestionChanged(cb: (index: number, question: QuestionDefinition) => void): void {
        this.questionChangedListeners.push(cb);
    }

    public onStateUpdated(cb: (state: ActiveSessionState) => void): void {
        this.stateUpdatedListeners.push(cb);
    }

    public onTimeExpired(cb: () => void): void {
        this.timeExpiredListeners.push(cb);
    }

    private notifyStateUpdated(): void {
        for (const listener of this.stateUpdatedListeners) {
            listener(this.state);
        }
    }

    // --- Navigation ---
    public goToQuestion(index: number): void {
        if (index >= 0 && index < this.state.questions.length) {
            this.state.currentQuestionIndex = index;
            const currentQ = this.getCurrentQuestion();
            for (const listener of this.questionChangedListeners) {
                listener(index, currentQ);
            }
            this.notifyStateUpdated();
        }
    }

    public nextQuestion(): void {
        if (this.state.currentQuestionIndex < this.state.questions.length - 1) {
            this.goToQuestion(this.state.currentQuestionIndex + 1);
        }
    }

    public prevQuestion(): void {
        if (this.state.currentQuestionIndex > 0) {
            this.goToQuestion(this.state.currentQuestionIndex - 1);
        }
    }

    // --- Answer Tracking ---
    public getAnswer(questionId: string): UserAnswerRecord {
        if (!this.state.userAnswers[questionId]) {
            this.state.userAnswers[questionId] = {};
        }
        return this.state.userAnswers[questionId];
    }

    public toggleOption(questionId: string, optionId: string): void {
        const record = this.getAnswer(questionId);
        const selected = new Set(record.selectedOptionIds || []);

        if (selected.has(optionId)) {
            selected.delete(optionId);
        } else {
            selected.add(optionId);
        }

        record.selectedOptionIds = Array.from(selected);
        this.notifyStateUpdated();
    }

    public selectSingleOption(questionId: string, optionId: string): void {
        const record = this.getAnswer(questionId);
        record.selectedOptionIds = [optionId];
        this.notifyStateUpdated();
    }

    public setFreetextAnswer(questionId: string, text: string): void {
        const record = this.getAnswer(questionId);
        record.freetextAnswer = text;
        this.notifyStateUpdated();
    }

    public setClozeAnswer(questionId: string, blankKey: string, value: string): void {
        const record = this.getAnswer(questionId);
        if (!record.clozeAnswers) {
            record.clozeAnswers = {};
        }
        record.clozeAnswers[blankKey] = value;
        this.notifyStateUpdated();
    }

    // --- Flagging ---
    public toggleFlag(questionId: string): boolean {
        const idx = this.state.flaggedQuestionIds.indexOf(questionId);
        let flagged: boolean;
        if (idx !== -1) {
            this.state.flaggedQuestionIds.splice(idx, 1);
            flagged = false;
        } else {
            this.state.flaggedQuestionIds.push(questionId);
            flagged = true;
        }
        this.notifyStateUpdated();
        return flagged;
    }

    public isFlagged(questionId: string): boolean {
        return this.state.flaggedQuestionIds.includes(questionId);
    }

    public isAnswered(questionId: string): boolean {
        const record = this.state.userAnswers[questionId];
        if (!record) return false;

        if (record.selectedOptionIds && record.selectedOptionIds.length > 0) {
            return true;
        }
        if (record.freetextAnswer && record.freetextAnswer.trim().length > 0) {
            return true;
        }
        if (record.clozeAnswers && Object.keys(record.clozeAnswers).length > 0) {
            return true;
        }
        return false;
    }

    public getAnsweredCount(): number {
        let count = 0;
        for (const q of this.state.questions) {
            if (this.isAnswered(q.id)) {
                count++;
            }
        }
        return count;
    }

    /**
     * Cleans up all intervals and global event listeners deterministically.
     */
    public destroy(): void {
        this.stopTimer();
        this.stopAutoSaveTimer();

        if (typeof window !== 'undefined') {
            window.removeEventListener('beforeunload', this.beforeUnloadHandler);
        }
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
        }

        this.tickListeners = [];
        this.questionChangedListeners = [];
        this.stateUpdatedListeners = [];
        this.timeExpiredListeners = [];
    }
}
