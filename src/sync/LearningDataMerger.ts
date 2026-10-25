import { FSRSRecord, ErrorPoolItem, PluginSettingsData, SyncLearningData } from '../types';
import { GamificationEngine } from '../gamification/GamificationEngine';

export class LearningDataMerger {
    /**
     * Pure, conflict-free merge algorithm: merges local and remote learning progress without data loss.
     */
    public static merge(
        local: PluginSettingsData,
        remote: Partial<SyncLearningData>
    ): { changed: boolean; merged: PluginSettingsData } {
        const updated: PluginSettingsData = Object.assign({}, local);
        let changed = false;

        // 1. ResolvedPool Merge
        const localResolved = Object.assign({}, local.resolvedPool || {});
        const remoteResolved = Object.assign({}, remote.resolvedPool || {});
        const mergedResolved: Record<string, number> = {};

        const allResolvedKeys = new Set([...Object.keys(localResolved), ...Object.keys(remoteResolved)]);
        for (const key of allResolvedKeys) {
            mergedResolved[key] = Math.max(localResolved[key] || 0, remoteResolved[key] || 0);
        }

        // 2. ErrorPool Merge
        const localErrors = local.errorPool || {};
        const remoteErrors = remote.errorPool || {};
        const allQuestionIds = new Set([...Object.keys(localErrors), ...Object.keys(remoteErrors)]);
        const mergedErrors: Record<string, ErrorPoolItem> = {};

        for (const qId of allQuestionIds) {
            const lItem = localErrors[qId];
            const rItem = remoteErrors[qId];
            const resolvedTimestamp = mergedResolved[qId] || 0;
            const maxFailedAt = Math.max(lItem?.lastFailedAt || 0, rItem?.lastFailedAt || 0);

            // If question was resolved/mastered after its latest failure, it stays resolved
            if (resolvedTimestamp > 0 && resolvedTimestamp >= maxFailedAt) {
                continue;
            }

            if (lItem && rItem) {
                const failCount = Math.max(lItem.failCount, rItem.failCount);
                let consecutiveSuccess = Math.max(lItem.consecutiveSuccess, rItem.consecutiveSuccess);
                if (lItem.lastFailedAt > rItem.lastFailedAt) {
                    consecutiveSuccess = lItem.consecutiveSuccess;
                } else if (rItem.lastFailedAt > lItem.lastFailedAt) {
                    consecutiveSuccess = rItem.consecutiveSuccess;
                }

                mergedErrors[qId] = {
                    filePath: lItem.filePath || rItem.filePath,
                    questionId: qId,
                    failCount,
                    consecutiveSuccess,
                    lastFailedAt: maxFailedAt
                };
            } else if (lItem) {
                mergedErrors[qId] = Object.assign({}, lItem);
            } else if (rItem) {
                mergedErrors[qId] = Object.assign({}, rItem);
            }
        }

        if (JSON.stringify(local.errorPool || {}) !== JSON.stringify(mergedErrors)) {
            updated.errorPool = mergedErrors;
            changed = true;
        }
        if (JSON.stringify(local.resolvedPool || {}) !== JSON.stringify(mergedResolved)) {
            updated.resolvedPool = mergedResolved;
            changed = true;
        }

        // 3. FSRS Data Merge
        const localFsrs = local.fsrsData || {};
        const remoteFsrs = remote.fsrsData || {};
        const allFsrsKeys = new Set([...Object.keys(localFsrs), ...Object.keys(remoteFsrs)]);
        const mergedFsrs: Record<string, FSRSRecord> = {};

        for (const qId of allFsrsKeys) {
            const lFsrs = localFsrs[qId];
            const rFsrs = remoteFsrs[qId];
            if (lFsrs && rFsrs) {
                mergedFsrs[qId] = (lFsrs.lastReview >= rFsrs.lastReview) ? lFsrs : rFsrs;
            } else if (lFsrs) {
                mergedFsrs[qId] = lFsrs;
            } else if (rFsrs) {
                mergedFsrs[qId] = rFsrs;
            }
        }

        if (JSON.stringify(local.fsrsData || {}) !== JSON.stringify(mergedFsrs)) {
            updated.fsrsData = mergedFsrs;
            changed = true;
        }

        // 4. XP & Level Merge
        const remoteXp = remote.userXP || 0;
        if (remoteXp > (local.userXP || 0)) {
            updated.userXP = remoteXp;
            updated.userLevel = GamificationEngine.calculateLevel(remoteXp).level;
            changed = true;
        }

        // 5. Streak & Activity Date Merge
        const remoteDate = remote.lastActiveDate || '';
        const localDate = local.lastActiveDate || '';
        if (remoteDate > localDate) {
            updated.lastActiveDate = remoteDate;
            updated.streakDays = remote.streakDays || 1;
            changed = true;
        } else if (remoteDate === localDate && remoteDate !== '') {
            const higherStreak = Math.max(local.streakDays || 0, remote.streakDays || 0);
            if (higherStreak !== local.streakDays) {
                updated.streakDays = higherStreak;
                changed = true;
            }
        }

        // 6. Tamagotchi State Merge
        const remoteFedDate = remote.tamagotchiLastFedDate || '';
        const localFedDate = local.tamagotchiLastFedDate || '';
        if (remoteFedDate > localFedDate) {
            updated.tamagotchiLastFedDate = remoteFedDate;
            if (remote.tamagotchiHunger !== undefined) updated.tamagotchiHunger = remote.tamagotchiHunger;
            if (remote.tamagotchiHappiness !== undefined) updated.tamagotchiHappiness = remote.tamagotchiHappiness;
            changed = true;
        } else if (remoteFedDate === localFedDate && remoteFedDate !== '') {
            const maxHunger = Math.max(local.tamagotchiHunger ?? 80, remote.tamagotchiHunger ?? 80);
            const maxHappiness = Math.max(local.tamagotchiHappiness ?? 85, remote.tamagotchiHappiness ?? 85);
            if (maxHunger !== local.tamagotchiHunger || maxHappiness !== local.tamagotchiHappiness) {
                updated.tamagotchiHunger = maxHunger;
                updated.tamagotchiHappiness = maxHappiness;
                changed = true;
            }
        }
        if (remote.tamagotchiName && remote.tamagotchiName !== 'Lern-Drache' && local.tamagotchiName === 'Lern-Drache') {
            updated.tamagotchiName = remote.tamagotchiName;
            changed = true;
        }

        return { changed, merged: updated };
    }
}

