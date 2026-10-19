import { App, Modal } from 'obsidian';
import { ActiveSessionState } from '../types';

export class CrashRecoveryModal extends Modal {
    private activeSession: ActiveSessionState;
    private onResume: () => void;
    private onDiscard: () => void;

    constructor(
        app: App,
        activeSession: ActiveSessionState,
        onResume: () => void,
        onDiscard: () => void
    ) {
        super(app);
        this.activeSession = activeSession;
        this.onResume = onResume;
        this.onDiscard = onDiscard;
    }

    public onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('exam-recovery-modal');

        contentEl.createEl('h2', { text: 'Laufende Klausur fortsetzen?' });

        const answeredCount = Object.keys(this.activeSession.userAnswers).filter(id => {
            const ans = this.activeSession.userAnswers[id];
            return (ans.selectedOptionIds && ans.selectedOptionIds.length > 0) ||
                   (ans.freetextAnswer && ans.freetextAnswer.trim().length > 0);
        }).length;

        const totalQuestions = this.activeSession.questions.length;
        const remainingMinutes = Math.max(0, Math.ceil(this.activeSession.remainingSeconds / 60));

        const infoCard = contentEl.createDiv({ cls: 'exam-recovery-info-card' });
        infoCard.createEl('p', {
            text: `Es wurde eine unvollendete Klausursitzung gefunden:`
        });

        const detailsEl = infoCard.createDiv({ cls: 'exam-recovery-details' });
        detailsEl.createEl('div', { text: `Titel: ${this.activeSession.examTitle}` });
        detailsEl.createEl('div', { text: `Modul: ${this.activeSession.module}` });
        detailsEl.createEl('div', { text: `Fortschritt: ${answeredCount}/${totalQuestions} Fragen beantwortet` });
        detailsEl.createEl('div', { text: `Verbleibende Zeit: ca. ${remainingMinutes} Minute(n)` });

        const buttonBar = contentEl.createDiv({ cls: 'exam-recovery-buttons' });

        const resumeBtn = buttonBar.createEl('button', {
            cls: 'mod-cta exam-recovery-resume-btn',
            text: 'Klausur fortsetzen'
        });
        resumeBtn.addEventListener('click', () => {
            this.close();
            this.onResume();
        });

        const discardBtn = buttonBar.createEl('button', {
            cls: 'mod-warning exam-recovery-discard-btn',
            text: 'Verwerfen'
        });
        discardBtn.addEventListener('click', () => {
            this.close();
            this.onDiscard();
        });
    }

    public onClose(): void {
        this.contentEl.empty();
    }
}
