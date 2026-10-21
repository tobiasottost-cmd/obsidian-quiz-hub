import type { App, TFile } from 'obsidian';

export interface AutoAssignResult {
    updatedContent: string;
    addedCount: number;
}

export class BlockIdAutoAssigner {
    /**
     * Scans markdown content and appends unique block-IDs (e.g. ^q-m1-01)
     * to all question headings (## ...) that do not yet have one.
     */
    public static processMarkdown(content: string, customPrefix?: string): AutoAssignResult {
        const isCrlf = content.includes('\r\n');
        const normalized = content.replace(/\r\n/g, '\n');
        const lines = normalized.split('\n');
        let addedCount = 0;
        let questionIndex = 1;

        // Infer module prefix from frontmatter (e.g. 'module: M1' -> 'q-m1')
        let prefix = customPrefix || 'q';
        if (!customPrefix) {
            const modMatch = content.match(/module:\s*([^\r\n#]+)/i);
            if (modMatch && modMatch[1].trim()) {
                const rawModule = modMatch[1].trim().replace(/^['"]|['"]$/g, '');
                const firstToken = rawModule.split(/[\s-_]+/)[0];
                const cleanMod = firstToken.toLowerCase()
                    .replace(/ä/g, 'ae')
                    .replace(/ö/g, 'oe')
                    .replace(/ü/g, 'ue')
                    .replace(/ß/g, 'ss')
                    .replace(/[^a-z0-9]/g, '');
                if (cleanMod) {
                    prefix = `q-${cleanMod}`;
                }
            }
        }

        // Collect existing IDs in this content to avoid collisions
        const existingIds = new Set<string>();
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
                const m = trimmed.match(/^##\s+.*?\^([a-zA-Z0-9_-]+)$/);
                if (m) {
                    existingIds.add(m[1].toLowerCase());
                }
            }
        }

        const updatedLines = lines.map((line) => {
            const trimmed = line.trim();
            // Match any H2 heading
            if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
                const headingMatch = trimmed.match(/^(##\s+.*?)(?:\s+\^([a-zA-Z0-9_-]+))?$/);
                if (headingMatch) {
                    const headingText = headingMatch[1].trim();
                    const existingBlockId = headingMatch[2];

                    if (!existingBlockId) {
                        // Find next free question index
                        let candidate = '';
                        while (true) {
                            const numStr = String(questionIndex).padStart(2, '0');
                            candidate = `${prefix}-${numStr}`;
                            questionIndex++;
                            if (!existingIds.has(candidate.toLowerCase())) {
                                existingIds.add(candidate.toLowerCase());
                                break;
                            }
                        }
                        addedCount++;
                        return `${headingText} ^${candidate}`;
                    }
                }
            }
            return line;
        });

        return {
            updatedContent: updatedLines.join(isCrlf ? '\r\n' : '\n'),
            addedCount,
        };
    }

    /**
     * Processes a single markdown TFile in the Obsidian vault.
     */
    public static async processFile(app: App, file: TFile): Promise<number> {
        try {
            const content = await app.vault.read(file);
            const { updatedContent, addedCount } = this.processMarkdown(content);
            if (addedCount > 0) {
                await app.vault.modify(file, updatedContent);
            }
            return addedCount;
        } catch (err) {
            console.error(`Error auto-assigning block IDs in ${file.path}:`, err);
            return 0;
        }
    }
}
