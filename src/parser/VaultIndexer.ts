import { App, EventRef, normalizePath, TAbstractFile, TFile, TFolder } from 'obsidian';
import { QuestionDefinition } from '../types';
import { ExamParser, ParsedExamFile } from './ExamParser';

export class VaultIndexer {
    private app: App;
    private examsFolderPath: string;
    private cache: Map<string, ParsedExamFile> = new Map();
    private eventRefs: EventRef[] = [];
    private metadataEventRefs: EventRef[] = [];
    private onIndexUpdatedCallbacks: (() => void)[] = [];

    constructor(app: App, examsFolderPath: string) {
        this.app = app;
        this.examsFolderPath = normalizePath(examsFolderPath);
    }

    /**
     * Initializes event listeners and performs initial scan of the exams folder.
     */
    public async initialize(): Promise<void> {
        this.registerVaultEvents();
        await this.indexAllFiles();
    }

    /**
     * Updates folder path if settings change.
     */
    public async updateFolderPath(newPath: string): Promise<void> {
        this.examsFolderPath = normalizePath(newPath);
        this.cache.clear();
        await this.indexAllFiles();
    }

    public onIndexUpdated(cb: () => void): void {
        this.onIndexUpdatedCallbacks.push(cb);
    }

    private notifyIndexUpdated(): void {
        for (const cb of this.onIndexUpdatedCallbacks) {
            try {
                cb();
            } catch (err) {
                console.error('Error in onIndexUpdated callback:', err);
            }
        }
    }

    /**
     * Subscribes to Obsidian vault lifecycle events.
     */
    private registerVaultEvents(): void {
        this.eventRefs.push(
            this.app.vault.on('create', async (file: TAbstractFile) => {
                if (file instanceof TFile && this.isExamFile(file)) {
                    await this.indexFile(file);
                    this.notifyIndexUpdated();
                }
            })
        );

        this.eventRefs.push(
            this.app.vault.on('modify', async (file: TAbstractFile) => {
                if (file instanceof TFile && this.isExamFile(file)) {
                    await this.indexFile(file);
                    this.notifyIndexUpdated();
                }
            })
        );

        this.eventRefs.push(
            this.app.vault.on('delete', (file: TAbstractFile) => {
                if (file instanceof TFile && this.cache.has(file.path)) {
                    this.cache.delete(file.path);
                    this.notifyIndexUpdated();
                }
            })
        );

        this.eventRefs.push(
            this.app.vault.on('rename', async (file: TAbstractFile, oldPath: string) => {
                this.cache.delete(oldPath);
                if (file instanceof TFile && this.isExamFile(file)) {
                    await this.indexFile(file);
                }
                this.notifyIndexUpdated();
            })
        );

        this.metadataEventRefs.push(
            this.app.metadataCache.on('changed', async (file: TFile) => {
                if (this.isExamFile(file)) {
                    await this.indexFile(file);
                    this.notifyIndexUpdated();
                }
            })
        );
    }

    /**
     * Checks if a file is a markdown file situated in the configured exams folder or its subfolders.
     * Excludes results subfolder.
     */
    public isExamFile(file: TAbstractFile): boolean {
        if (!(file instanceof TFile) || file.extension !== 'md') {
            return false;
        }

        const normalizedFilePath = normalizePath(file.path);
        const folderPrefix = this.examsFolderPath + '/';

        // Must start with examsFolderPath, but not be in results folder
        if (!normalizedFilePath.startsWith(folderPrefix) && normalizedFilePath !== this.examsFolderPath) {
            return false;
        }

        // Avoid indexing generated result files
        if (normalizedFilePath.includes('/results/')) {
            return false;
        }

        return true;
    }

    /**
     * Scans and indexes all markdown files inside the exams directory.
     */
    public async indexAllFiles(): Promise<void> {
        const folder = this.app.vault.getAbstractFileByPath(this.examsFolderPath);
        if (!folder || !(folder instanceof TFolder)) {
            // Folder does not exist yet; nothing to index
            return;
        }

        const filesToIndex: TFile[] = [];
        const collectFiles = (parent: TFolder) => {
            for (const child of parent.children) {
                if (child instanceof TFile && child.extension === 'md') {
                    if (this.isExamFile(child)) {
                        filesToIndex.push(child);
                    }
                } else if (child instanceof TFolder && !child.name.startsWith('.') && child.name !== 'results') {
                    collectFiles(child);
                }
            }
        };

        collectFiles(folder);

        // Process files in non-blocking batches for mobile friendliness
        for (let i = 0; i < filesToIndex.length; i++) {
            await this.indexFile(filesToIndex[i]);
            // Yield every 10 files to keep main thread responsive on mobile
            if ((i + 1) % 10 === 0) {
                await new Promise((resolve) => window.setTimeout(resolve, 0));
            }
        }

        this.notifyIndexUpdated();
    }

    /**
     * Indexes a single markdown file into the memory cache.
     */
    public async indexFile(file: TFile): Promise<ParsedExamFile | null> {
        try {
            const content = await this.app.vault.read(file);
            const metadata = this.app.metadataCache.getFileCache(file);
            const frontmatterCache = metadata?.frontmatter;

            const parsed = ExamParser.parse(content, file.path, frontmatterCache);

            // Infer module from subfolder if not defined in frontmatter
            if (!parsed.frontmatter.module || parsed.frontmatter.module === 'Allgemein') {
                const parts = file.path.split('/');
                if (parts.length > 2) {
                    // e.g. exams/M1 - Grundlagen/test.md -> 'M1'
                    const folderName = parts[parts.length - 2];
                    const folderMatch = folderName.match(/^([a-zA-Z0-9]+)/);
                    if (folderMatch) {
                        parsed.frontmatter.module = folderMatch[1];
                    }
                }
            }

            this.cache.set(file.path, parsed);
            return parsed;
        } catch (error) {
            console.error(`Error indexing exam file ${file.path}:`, error);
            return null;
        }
    }

    /**
     * Retrieves an exam file from cache by its vault path.
     */
    public getExamFile(path: string): ParsedExamFile | undefined {
        return this.cache.get(normalizePath(path));
    }

    /**
     * Returns all indexed exam files.
     */
    public getAllExamFiles(): ParsedExamFile[] {
        return Array.from(this.cache.values());
    }

    /**
     * Returns a sorted list of unique module identifiers found across all exams.
     */
    public getAvailableModules(): string[] {
        const modules = new Set<string>();
        for (const exam of this.cache.values()) {
            if (exam.frontmatter.module) {
                modules.add(exam.frontmatter.module);
            }
        }
        return Array.from(modules).sort();
    }

    /**
     * Returns questions matching selected modules.
     */
    public getQuestionsForModules(modules: string[]): QuestionDefinition[] {
        const selectedModules = new Set(modules);
        const questions: QuestionDefinition[] = [];

        for (const exam of this.cache.values()) {
            if (selectedModules.size === 0 || selectedModules.has(exam.frontmatter.module)) {
                questions.push(...exam.questions);
            }
        }
        return questions;
    }

    /**
     * Returns all indexed questions across all files.
     */
    public getAllQuestions(): QuestionDefinition[] {
        const questions: QuestionDefinition[] = [];
        for (const exam of this.cache.values()) {
            questions.push(...exam.questions);
        }
        return questions;
    }

    /**
     * Cleans up all vault listeners when plugin unloads.
     */
    public destroy(): void {
        for (const ref of this.eventRefs) {
            this.app.vault.offref(ref);
        }
        this.eventRefs = [];
        for (const ref of this.metadataEventRefs) {
            this.app.metadataCache.offref(ref);
        }
        this.metadataEventRefs = [];
        this.cache.clear();
        this.onIndexUpdatedCallbacks = [];
    }
}
