import { FSRSRecord, PluginSettingsData, SessionResult } from '../types';

export interface LevelInfo {
    level: number;
    totalXP: number;
    currentLevelBaseXp: number;
    nextLevelBaseXp: number;
    progressInLevel: number;
    neededInLevel: number;
    progressPercentage: number;
}

export class GamificationEngine {
    /**
     * Calculates required XP to advance from level L to L+1.
     * Curve formula: 250 * L^1.5
     */
    public static getXpRequiredForNextLevel(currentLevel: number): number {
        return Math.floor(250 * Math.pow(currentLevel, 1.5));
    }

    /**
     * Calculates comprehensive level information from total accumulated XP.
     */
    public static calculateLevel(totalXP: number): LevelInfo {
        let level = 1;
        let cumulativeXp = 0;

        while (true) {
            const nextLevelCost = this.getXpRequiredForNextLevel(level);
            if (totalXP < cumulativeXp + nextLevelCost) {
                const progressInLevel = totalXP - cumulativeXp;
                const progressPercentage = Math.min(100, Math.max(0, Math.round((progressInLevel / nextLevelCost) * 100)));
                return {
                    level,
                    totalXP,
                    currentLevelBaseXp: cumulativeXp,
                    nextLevelBaseXp: cumulativeXp + nextLevelCost,
                    progressInLevel,
                    neededInLevel: nextLevelCost,
                    progressPercentage
                };
            }
            cumulativeXp += nextLevelCost;
            level++;
        }
    }

    /**
     * Updates user XP and recalculates level.
     */
    public static addXP(settings: PluginSettingsData, xp: number): { gainedXp: number; leveledUp: boolean; oldLevel: number; newLevel: number } {
        const oldLevel = settings.userLevel;
        settings.userXP += xp;
        const info = this.calculateLevel(settings.userXP);
        const leveledUp = info.level > oldLevel;
        settings.userLevel = info.level;

        return {
            gainedXp: xp,
            leveledUp,
            oldLevel,
            newLevel: info.level
        };
    }

    /**
     * Updates daily streak tracking based on the 48-hour inactivity reset rule.
     */
    public static recordActivity(settings: PluginSettingsData): { streakDays: number; streakIncreased: boolean } {
        const today = this.getTodayDateString();
        const lastDate = settings.lastActiveDate;

        if (lastDate === today) {
            return { streakDays: settings.streakDays, streakIncreased: false };
        }

        const yesterday = this.getYesterdayDateString();
        let streakIncreased = false;

        if (!lastDate) {
            settings.streakDays = 1;
            streakIncreased = true;
        } else if (lastDate === yesterday) {
            settings.streakDays += 1;
            streakIncreased = true;
        } else {
            // Gap greater than 48 hours -> reset streak
            settings.streakDays = 1;
            streakIncreased = true;
        }

        settings.lastActiveDate = today;
        return { streakDays: settings.streakDays, streakIncreased };
    }

    /**
     * Updates FSRS spaced repetition records for all evaluated questions.
     */
    public static updateFSRS(settings: PluginSettingsData, result: SessionResult): void {
        const now = Date.now();

        for (const evaluation of result.questionEvaluations) {
            const qId = evaluation.questionId;
            let record: FSRSRecord = settings.fsrsData[qId] || {
                stability: 1.0,
                difficulty: 5.0,
                elapsedDays: 0,
                scheduledDays: 1,
                reps: 0,
                lapses: 0,
                lastReview: 0
            };

            const isSuccess = evaluation.isFullyCorrect;
            const elapsedDays = record.lastReview > 0 ? Math.max(0, (now - record.lastReview) / (1000 * 60 * 60 * 24)) : 0;

            record.reps += 1;
            record.elapsedDays = Math.round(elapsedDays * 10) / 10;
            record.lastReview = now;

            if (isSuccess) {
                record.stability = Math.round((record.stability * 1.5 + 1.0) * 10) / 10;
                record.difficulty = Math.max(1, Math.round((record.difficulty - 0.2) * 10) / 10);
                record.scheduledDays = Math.round(record.stability);
            } else {
                record.lapses += 1;
                record.stability = Math.max(0.5, Math.round((record.stability * 0.5) * 10) / 10);
                record.difficulty = Math.min(10, Math.round((record.difficulty + 0.5) * 10) / 10);
                record.scheduledDays = 1;
            }

            settings.fsrsData[qId] = record;
        }
    }

    public static getTodayDateString(): string {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    public static getYesterdayDateString(): string {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
}
