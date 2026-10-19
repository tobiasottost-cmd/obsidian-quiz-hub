import { ActiveSessionState, ErrorPoolItem, PluginSettingsData, SessionResult } from '../types';

export class ErrorPoolManager {
    /**
     * Processes evaluation results and updates the intelligent error pool in settings.
     * Implements the 2x consecutive success mastery elimination rule.
     */
    public static processSessionResults(
        settings: PluginSettingsData,
        sessionState: ActiveSessionState,
        result: SessionResult
    ): { addedCount: number; resolvedCount: number } {
        let addedCount = 0;
        let resolvedCount = 0;

        const isErrorSession = Boolean(sessionState.isErrorPoolSession);

        for (const evalRec of result.questionEvaluations) {
            const q = sessionState.questions.find(item => item.id === evalRec.questionId);
            if (!q) continue;

            const qId = q.id;
            const isFullSuccess = evalRec.isFullyCorrect;

            if (isFullSuccess) {
                // If question was already in error pool
                if (settings.errorPool[qId]) {
                    if (isErrorSession) {
                        // Re-training mode: increment consecutive successes
                        settings.errorPool[qId].consecutiveSuccess += 1;
                        if (settings.errorPool[qId].consecutiveSuccess >= 2) {
                            // Mastery achieved: remove from error pool!
                            delete settings.errorPool[qId];
                            resolvedCount++;
                        }
                    }
                }
            } else {
                // Failed question (MC < 5 points or Freetext < 50%)
                const existing = settings.errorPool[qId];
                if (existing) {
                    existing.failCount += 1;
                    existing.consecutiveSuccess = 0; // reset consecutive streak
                    existing.lastFailedAt = Date.now();
                } else {
                    settings.errorPool[qId] = {
                        filePath: q.sourceFilePath,
                        questionId: qId,
                        failCount: 1,
                        consecutiveSuccess: 0,
                        lastFailedAt: Date.now()
                    };
                    addedCount++;
                }
            }
        }

        return { addedCount, resolvedCount };
    }

    /**
     * Returns total count of active questions in the error pool.
     */
    public static getErrorCount(settings: PluginSettingsData): number {
        return Object.keys(settings.errorPool).length;
    }

    /**
     * Clears all items from the error pool.
     */
    public static clearPool(settings: PluginSettingsData): void {
        settings.errorPool = {};
    }
}
