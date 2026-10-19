import { Plugin, WorkspaceLeaf } from 'obsidian';
import { ActiveSessionState, DEFAULT_SETTINGS, PluginSettingsData } from './types';
import { VaultIndexer } from './parser/VaultIndexer';
import { SoundManager } from './gamification/SoundManager';
import { SettingsTab } from './settings/SettingsTab';
import { CrashRecoveryModal } from './session/CrashRecoveryModal';
import { ExamSession } from './session/ExamSession';
import { DashboardView, VIEW_TYPE_DASHBOARD } from './views/DashboardView';
import { ExamRunnerView, VIEW_TYPE_EXAM_RUNNER } from './views/ExamRunnerView';
import { ResultView, VIEW_TYPE_RESULT } from './views/ResultView';
import { ScoringEngine } from './scoring/ScoringEngine';
import { GamificationEngine } from './gamification/GamificationEngine';
import { ErrorPoolManager } from './errorpool/ErrorPoolManager';
import { ExamGenerator } from './session/ExamGenerator';

export default class ExamQuizHubPlugin extends Plugin {
    public settings: PluginSettingsData = DEFAULT_SETTINGS;
    public indexer!: VaultIndexer;
    public soundManager!: SoundManager;

    public async onload(): Promise<void> {
        await this.loadSettings();

        // Initialize mobile-safe audio
        this.soundManager = new SoundManager(
            this.settings.enableSoundEffects,
            this.settings.soundVolume
        );

        // Initialize vault indexer
        this.indexer = new VaultIndexer(this.app, this.settings.examsFolderPath);
        await this.indexer.initialize();

        // Register custom view types
        this.registerView(
            VIEW_TYPE_DASHBOARD,
            (leaf: WorkspaceLeaf) => new DashboardView(leaf, this)
        );

        this.registerView(
            VIEW_TYPE_EXAM_RUNNER,
            (leaf: WorkspaceLeaf) => new ExamRunnerView(leaf, this)
        );

        this.registerView(
            VIEW_TYPE_RESULT,
            (leaf: WorkspaceLeaf) => new ResultView(leaf, this)
        );

        // Ribbon icon in left sidebar
        this.addRibbonIcon('graduation-cap', 'Exam and Quiz Hub', () => {
            this.openDashboard();
        });

        // Commands
        this.addCommand({
            id: 'open-exam-hub-dashboard',
            name: 'Klausur-Dashboard öffnen',
            callback: () => {
                this.openDashboard();
            }
        });

        this.addCommand({
            id: 'start-quick-mix-exam',
            name: 'Zufallsklausur (Modul-Mix) starten',
            callback: () => {
                const modules = this.indexer.getAvailableModules();
                const questions = this.indexer.getAllQuestions();
                if (questions.length > 0) {
                    const session = ExamGenerator.createDynamicMix(questions, {
                        modules,
                        questionCount: 15
                    });
                    this.startExamWithSession(session);
                } else {
                    this.openDashboard();
                }
            }
        });

        this.addCommand({
            id: 'train-error-pool',
            name: 'Fehlerspeicher trainieren',
            callback: () => {
                const session = ExamGenerator.createErrorPoolSession(
                    this.indexer.getAllQuestions(),
                    this.settings.errorPool
                );
                if (session) {
                    this.startExamWithSession(session);
                } else {
                    this.openDashboard();
                }
            }
        });

        // Settings tab
        this.addSettingTab(new SettingsTab(this.app, this));

        // Crash-Recovery check upon startup
        this.app.workspace.onLayoutReady(() => {
            if (this.settings.activeSession) {
                new CrashRecoveryModal(
                    this.app,
                    this.settings.activeSession,
                    () => {
                        this.startExamWithSession(this.settings.activeSession!);
                    },
                    async () => {
                        this.settings.activeSession = null;
                        await this.saveSettings();
                    }
                ).open();
            }
        });
    }

    public onunload(): void {
        if (this.indexer) {
            this.indexer.destroy();
        }
        if (this.soundManager) {
            this.soundManager.destroy();
        }
    }

    public async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    public async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    /**
     * Opens or reveals the Dashboard view in the active leaf or an existing tab.
     */
    public async openDashboard(reuseLeaf?: WorkspaceLeaf): Promise<void> {
        const { workspace } = this.app;
        let leaf: WorkspaceLeaf | null = reuseLeaf || workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)[0];

        if (!leaf) {
            leaf = workspace.getLeaf(false);
        }

        await leaf.setViewState({
            type: VIEW_TYPE_DASHBOARD,
            active: true
        });

        workspace.revealLeaf(leaf);
    }

    /**
     * Starts an exam simulation with the given session state.
     */
    public async startExamWithSession(sessionState: ActiveSessionState): Promise<void> {
        this.settings.activeSession = sessionState;
        await this.saveSettings();

        const { workspace } = this.app;
        let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_EXAM_RUNNER)[0];

        if (!leaf) {
            leaf = workspace.getLeaf(true);
            await leaf.setViewState({
                type: VIEW_TYPE_EXAM_RUNNER,
                active: true
            });
        }

        workspace.revealLeaf(leaf);

        const runnerView = leaf.view as ExamRunnerView;
        const examSession = new ExamSession(sessionState, async (updatedState) => {
            this.settings.activeSession = updatedState;
            await this.saveSettings();
        });

        runnerView.setSession(examSession);
    }

    /**
     * Evaluates exam, updates gamification, streaks, error pool and transforms the active runner leaf into ResultView.
     */
    public async completeExam(sessionState: ActiveSessionState): Promise<void> {
        const result = ScoringEngine.evaluate(sessionState, this.settings.defaultPassingScore);

        // Update gamification & streak
        GamificationEngine.addXP(this.settings, result.xpEarned);
        GamificationEngine.recordActivity(this.settings);
        GamificationEngine.updateFSRS(this.settings, result);

        // Update error pool
        ErrorPoolManager.processSessionResults(this.settings, sessionState, result);

        // Clear active session from crash-recovery
        this.settings.activeSession = null;
        await this.saveSettings();

        // Reuse the leaf that was running the exam instead of opening a new tab
        const { workspace } = this.app;
        let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_EXAM_RUNNER)[0];
        if (!leaf) {
            leaf = workspace.getLeavesOfType(VIEW_TYPE_RESULT)[0];
        }
        if (!leaf) {
            leaf = workspace.getLeaf(false);
        }

        await leaf.setViewState({
            type: VIEW_TYPE_RESULT,
            active: true
        });

        workspace.revealLeaf(leaf);
        const resultView = leaf.view as ResultView;
        resultView.setResult(result, sessionState);
    }
}
