import { App, EventRef, normalizePath, Notice, TFile } from 'obsidian';
import type ExamQuizHubPlugin from '../main';
import { PluginSettingsData, SyncLearningData } from '../types';
import { LearningDataMerger } from './LearningDataMerger';

export class LearningSyncManager {
    private app: App;
    private plugin: ExamQuizHubPlugin;
    private modifyEventRef: EventRef | null = null;
    private deleteEventRef: EventRef | null = null;
    private lastLocalWriteTime = 0;
    private isMerging = false;

    private windowFocusHandler: (() => void) | null = null;

    constructor(app: App, plugin: ExamQuizHubPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    public getSyncFilePath(): string {
        const folder = this.plugin.settings.examsFolderPath || 'exams';
        const fileName = this.plugin.settings.learningDataFileName || '.quiz-learning-data.json';
        return normalizePath(`${folder}/${fileName}`);
    }

    public async initialize(): Promise<void> {
        if (!this.plugin.settings.syncLearningDataInVault) {
            return;
        }

        try {
            await this.loadAndMerge(false);
            this.registerVaultWatcher();
        } catch (err) {
            console.error('[Exam Quiz Hub] Fehler bei Initialisierung des LearningSyncManagers:', err);
        }
    }

    public destroy(): void {
        if (this.modifyEventRef) {
            this.app.vault.offref(this.modifyEventRef);
            this.modifyEventRef = null;
        }
        if (this.deleteEventRef) {
            this.app.vault.offref(this.deleteEventRef);
            this.deleteEventRef = null;
        }
        if (this.windowFocusHandler && typeof window !== 'undefined') {
            window.removeEventListener('focus', this.windowFocusHandler);
            this.windowFocusHandler = null;
        }
    }

    /**
     * Pure merge algorithm: merges local and remote learning progress without loss.
     */
    public static mergeLearningData(
        local: PluginSettingsData,
        remote: Partial<SyncLearningData>
    ): { changed: boolean; merged: PluginSettingsData } {
        return LearningDataMerger.merge(local, remote);
    }

    /**
     * Loads the vault learning data file, merges it with local settings, and updates both if needed.
     */
    public async loadAndMerge(notifyUser = false): Promise<boolean> {
        if (!this.plugin.settings.syncLearningDataInVault) {
            return false;
        }

        const syncPath = this.getSyncFilePath();
        const adapter = this.app.vault.adapter;

        try {
            this.isMerging = true;
            const exists = await adapter.exists(syncPath);

            if (!exists) {
                // First time or file not yet created in vault: seed file with current local settings
                await this.writeToVault(this.plugin.settings);
                return false;
            }

            const content = await adapter.read(syncPath);
            if (!content || !content.trim()) {
                await this.writeToVault(this.plugin.settings);
                return false;
            }

            const parsed = JSON.parse(content) as Partial<SyncLearningData>;
            const { changed, merged } = LearningSyncManager.mergeLearningData(this.plugin.settings, parsed);

            if (changed) {
                this.plugin.settings.errorPool = merged.errorPool;
                this.plugin.settings.resolvedPool = merged.resolvedPool;
                this.plugin.settings.fsrsData = merged.fsrsData;
                this.plugin.settings.userXP = merged.userXP;
                this.plugin.settings.userLevel = merged.userLevel;
                this.plugin.settings.streakDays = merged.streakDays;
                this.plugin.settings.lastActiveDate = merged.lastActiveDate;

                await this.plugin.saveSettings();
                await this.writeToVault(this.plugin.settings);

                if (notifyUser) {
                    new Notice('🔄 Klausur-Lerndaten synchronisiert');
                }
                this.notifyOpenViews();
            }

            return changed;
        } catch (err) {
            console.warn('[Exam Quiz Hub] Fehler beim Parsen der Lerndaten-Sync-Datei:', err);
            return false;
        } finally {
            this.isMerging = false;
        }
    }

    /**
     * Saves learning data to the vault sync file.
     * If forceReset is false, reads remote file first to perform conflict-free merge before writing.
     */
    public async saveLearningData(forceReset = false): Promise<void> {
        if (!this.plugin.settings.syncLearningDataInVault) {
            return;
        }

        const syncPath = this.getSyncFilePath();
        const adapter = this.app.vault.adapter;

        if (!forceReset) {
            try {
                const exists = await adapter.exists(syncPath);
                if (exists) {
                    const content = await adapter.read(syncPath);
                    if (content && content.trim()) {
                        const parsed = JSON.parse(content) as Partial<SyncLearningData>;
                        const { changed, merged } = LearningSyncManager.mergeLearningData(this.plugin.settings, parsed);
                        if (changed) {
                            this.plugin.settings.errorPool = merged.errorPool;
                            this.plugin.settings.resolvedPool = merged.resolvedPool;
                            this.plugin.settings.fsrsData = merged.fsrsData;
                            this.plugin.settings.userXP = merged.userXP;
                            this.plugin.settings.userLevel = merged.userLevel;
                            this.plugin.settings.streakDays = merged.streakDays;
                            this.plugin.settings.lastActiveDate = merged.lastActiveDate;
                            await this.plugin.saveSettings();
                        }
                    }
                }
            } catch (err) {
                console.warn('[Exam Quiz Hub] Merge vor Speichern fehlgeschlagen:', err);
            }
        }

        try {
            await this.writeToVault(this.plugin.settings);
        } catch (err) {
            console.error('[Exam Quiz Hub] Fehler beim Speichern der Lerndaten in den Vault:', err);
        }
    }

    private async writeToVault(settings: PluginSettingsData): Promise<void> {
        const syncPath = this.getSyncFilePath();
        const folderPath = syncPath.substring(0, syncPath.lastIndexOf('/'));
        if (folderPath) {
            await this.ensureFolderExists(folderPath);
        }

        const payload: SyncLearningData = {
            version: 1,
            lastSyncTimestamp: Date.now(),
            errorPool: settings.errorPool || {},
            resolvedPool: settings.resolvedPool || {},
            fsrsData: settings.fsrsData || {},
            userXP: settings.userXP || 0,
            userLevel: settings.userLevel || 1,
            streakDays: settings.streakDays || 0,
            lastActiveDate: settings.lastActiveDate || ''
        };

        const fileContent = JSON.stringify(payload, null, 2);
        this.lastLocalWriteTime = Date.now();

        await this.app.vault.adapter.write(syncPath, fileContent);
    }

    private async ensureFolderExists(folderPath: string): Promise<void> {
        const parts = folderPath.split('/');
        let currentPath = '';

        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const normalized = normalizePath(currentPath);
            const exists = await this.app.vault.adapter.exists(normalized);
            if (!exists) {
                try {
                    await this.app.vault.adapter.mkdir(normalized);
                } catch {
                    // Ignore concurrent folder creation
                }
            }
        }
    }

    private registerVaultWatcher(): void {
        this.modifyEventRef = this.app.vault.on('modify', (file) => {
            if (!(file instanceof TFile)) return;
            if (file.path !== this.getSyncFilePath()) return;

            // Ignore our own recent writes (within 2 seconds)
            if (Date.now() - this.lastLocalWriteTime < 2000) return;
            if (this.isMerging) return;

            // Incoming change from external sync (e.g. Obsidian Sync or iCloud from mobile)
            window.setTimeout(() => {
                void this.loadAndMerge(true);
            }, 300);
        });

        this.deleteEventRef = this.app.vault.on('delete', (file) => {
            if (!(file instanceof TFile)) return;
            if (file.path !== this.getSyncFilePath()) return;

            // Re-seed if file was deleted
            if (Date.now() - this.lastLocalWriteTime > 2000) {
                window.setTimeout(() => {
                    void this.saveLearningData(true);
                }, 1000);
            }
        });

        // Window focus check: catches external sync modifications on desktop & mobile when switching apps
        if (typeof window !== 'undefined') {
            this.windowFocusHandler = () => {
                if (Date.now() - this.lastLocalWriteTime > 2000 && !this.isMerging) {
                    void this.loadAndMerge(false);
                }
            };
            window.addEventListener('focus', this.windowFocusHandler);
        }
    }

    private notifyOpenViews(): void {
        // Trigger dashboard re-render if visible
        for (const leaf of this.app.workspace.getLeavesOfType('exam-hub-dashboard')) {
            const view = leaf.view as { render?: () => void };
            if (typeof view.render === 'function') {
                view.render();
            }
        }
    }
}
