import { App, normalizePath, TFile } from 'obsidian';
import { ActiveSessionState, SessionResult } from '../types';

export class ResultExporter {
    /**
     * Exports a completed exam result to an auditable Markdown file in the vault.
     */
    public static async exportToVault(
        app: App,
        result: SessionResult,
        sessionState: ActiveSessionState,
        resultsFolderPath: string = 'exams/results'
    ): Promise<string> {
        const normalizedFolder = normalizePath(resultsFolderPath);
        await this.ensureFolderExists(app, normalizedFolder);

        const now = new Date(result.date);
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');

        const safeModule = this.sanitizeFileName(result.module || 'Allgemein');
        const safeTitle = this.sanitizeFileName(result.examTitle || 'Klausur');
        const fileName = `${year}-${month}-${day}_${hours}-${minutes}_${safeModule}_${safeTitle}.md`;
        const filePath = normalizePath(`${normalizedFolder}/${fileName}`);

        const markdownContent = this.generateMarkdown(result, sessionState, now);

        const existingFile = app.vault.getAbstractFileByPath(filePath);
        if (existingFile instanceof TFile) {
            await app.vault.modify(existingFile, markdownContent);
        } else {
            await app.vault.create(filePath, markdownContent);
        }

        return filePath;
    }

    private static sanitizeFileName(name: string): string {
        return name.replace(/[\\/:*?"<>|]/g, '_').trim().substring(0, 40);
    }

    private static async ensureFolderExists(app: App, folderPath: string): Promise<void> {
        const parts = folderPath.split('/');
        let currentPath = '';

        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const normalized = normalizePath(currentPath);
            const folder = app.vault.getAbstractFileByPath(normalized);
            if (!folder) {
                try {
                    await app.vault.createFolder(normalized);
                } catch {
                    // Ignore if folder was created concurrently
                }
            }
        }
    }

    private static generateMarkdown(result: SessionResult, sessionState: ActiveSessionState, date: Date): string {
        const failedCount = result.questionEvaluations.filter(e => !e.isFullyCorrect).length;
        const durationMin = Math.round(result.timeSpentSeconds / 60);
        const isQuiz = sessionState.mode === 'quiz';

        const frontmatter = [
            '---',
            `type: ${isQuiz ? 'quiz-result' : 'exam-result'}`,
            `mode: "${isQuiz ? 'quiz' : 'exam'}"`,
            `date: ${date.toISOString()}`,
            `module: "${result.module}"`,
            `title: "${result.examTitle}"`,
            `score: "${result.percentage}%"`,
            `earnedPoints: ${result.earnedPoints}`,
            `totalPossiblePoints: ${result.totalPossiblePoints}`,
            `passed: ${result.passed}`,
            `durationMinutes: ${durationMin}`,
            `failedQuestionsCount: ${failedCount}`,
            `xpEarned: ${result.xpEarned}`,
            '---',
            ''
        ].join('\n');

        const summaryCallout = [
            `# ${isQuiz ? 'Quiz-Protokoll' : 'Klausur-Protokoll'}: ${result.examTitle}`,
            '',
            `> [!info] Zusammenfassung (${result.module})`,
            `> * **Modus:** ${isQuiz ? '⚡ Quiz (Direktes Feedback)' : '⏱️ Klausur-Simulation'}`,
            `> * **Ergebnis:** ${result.percentage}% (${result.earnedPoints} / ${result.totalPossiblePoints} Punkte)`,
            `> * **Status:** ${result.passed ? '✅ Bestanden' : '❌ Nicht bestanden'}`,
            `> * **Dauer:** ${durationMin} Minute(n)`,
            `> * **Erfahrungspunkte (XP):** +${result.xpEarned} XP`,
            `> * **Fehlerhafte Aufgaben:** ${failedCount} von ${result.questionEvaluations.length}`,
            ''
        ].join('\n');

        const questionsSection: string[] = ['## Aufgabenübersicht & Detailauswertung', ''];

        sessionState.questions.forEach((q, idx) => {
            const evalRecord = result.questionEvaluations.find(e => e.questionId === q.id);
            const earned = evalRecord ? evalRecord.earnedPoints : 0;
            const possible = evalRecord ? evalRecord.possiblePoints : q.points;
            const isFull = evalRecord ? evalRecord.isFullyCorrect : false;
            const statusIcon = isFull ? '✅' : earned > 0 ? '⚠️' : '❌';

            questionsSection.push(`### ${idx + 1}. ${q.prompt.split('\n')[0]} ${statusIcon}`);
            questionsSection.push(`*Punkte: ${earned} / ${possible} Pkt.* | *Typ: ${q.type}*`);
            if (q.blockId) {
                questionsSection.push(`*Block-ID: ^${q.blockId}*`);
            }
            questionsSection.push('');

            if (q.type === 'multiple-choice' && evalRecord?.itemDetails) {
                questionsSection.push('**Aussagen-Prüfung:**');
                for (const item of evalRecord.itemDetails) {
                    const check = item.userSelected ? '[x]' : '[ ]';
                    const verdict = item.earnedPoint ? '*(Korrekt bewertet (+1P))*' : '*(Fehlentscheidung (0P))*';
                    const correctChoice = item.isCorrect ? '*(Musterlösung: Wahr)*' : '*(Musterlösung: Falsch)*';
                    questionsSection.push(`- ${check} ${item.text} — ${verdict} ${correctChoice}`);
                }
                questionsSection.push('');
            } else if (q.type === 'freetext') {
                const userAns = sessionState.userAnswers[q.id]?.freetextAnswer || '*(Keine Antwort gegeben)*';
                questionsSection.push('**Eigene Antwort:**');
                questionsSection.push(`> ${userAns.replace(/\n/g, '\n> ')}`);
                questionsSection.push('');

                if (q.modelAnswer) {
                    questionsSection.push('**Musterlösung:**');
                    questionsSection.push(`> ${q.modelAnswer.replace(/\n/g, '\n> ')}`);
                    questionsSection.push('');
                }

                if (q.rubric && q.rubric.length > 0) {
                    questionsSection.push('**Kriterien:**');
                    q.rubric.forEach(r => questionsSection.push(`- ${r}`));
                    questionsSection.push('');
                }
            }

            if (q.explanation) {
                questionsSection.push('> [!explanation]');
                questionsSection.push(`> ${q.explanation.replace(/\n/g, '\n> ')}`);
                questionsSection.push('');
            }

            questionsSection.push('---');
            questionsSection.push('');
        });

        return frontmatter + summaryCallout + questionsSection.join('\n');
    }
}
