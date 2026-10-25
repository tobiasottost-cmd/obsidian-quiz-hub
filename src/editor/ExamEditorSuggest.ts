import { App, Editor, EditorPosition, EditorSuggest, EditorSuggestContext, EditorSuggestTriggerInfo, setIcon, TFile } from 'obsidian';
import {
    generateExamFrontmatter,
    generateFreetextSnippet,
    generateMultipleChoiceSnippet,
    generateQuizFrontmatter,
    generateSingleChoiceSnippet
} from './SnippetTemplates';

export interface ExamSnippetItem {
    id: string;
    label: string;
    detail: string;
    icon: string;
    keywords: string[];
    generateContent: () => string;
}

export class ExamEditorSuggest extends EditorSuggest<ExamSnippetItem> {
    private snippetItems: ExamSnippetItem[];

    constructor(app: App) {
        super(app);
        this.snippetItems = [
            {
                id: 'mc',
                label: 'Multiple-Choice Frage',
                detail: '5 Aussagen mit Checkboxen [x] / [ ] & Erklärung',
                icon: 'check-square',
                keywords: ['mc', 'multiple', 'choice', 'frage', 'question', 'aussagen', 'aufgabe'],
                generateContent: () => generateMultipleChoiceSnippet()
            },
            {
                id: 'sc',
                label: 'Single-Choice Frage',
                detail: '1 richtige aus 4 Optionen & Erklärung',
                icon: 'disc',
                keywords: ['sc', 'single', 'choice', 'frage', 'radio', 'einzelauswahl'],
                generateContent: () => generateSingleChoiceSnippet()
            },
            {
                id: 'freetext',
                label: 'Freitext-Aufgabe',
                detail: 'Offene Frage mit Musterlösung, Kriterien & Hinweisen',
                icon: 'file-text',
                keywords: ['freetext', 'freitext', 'text', 'essay', 'musterloesung', 'kriterien', 'aufgabe'],
                generateContent: () => generateFreetextSnippet()
            },
            {
                id: 'quiz-header',
                label: 'Quiz-Kopfzeile (Frontmatter)',
                detail: 'type: quiz (zeitlimitfrei, direktes Feedback)',
                icon: 'zap',
                keywords: ['quiz', 'header', 'frontmatter', 'yaml', 'kopfzeile', 'wissen'],
                generateContent: () => generateQuizFrontmatter('Modul', 'Neues Quiz')
            },
            {
                id: 'exam-header',
                label: 'Klausur-Kopfzeile (Frontmatter)',
                detail: 'type: exam (mit Zeitlimit & Bestehensgrenze)',
                icon: 'clock',
                keywords: ['exam', 'klausur', 'header', 'frontmatter', 'yaml', 'pruefung', 'test'],
                generateContent: () => generateExamFrontmatter('Modul', 'Neue Klausur', 90, 75)
            }
        ];
    }

    public onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
        const line = editor.getLine(cursor.line);
        const sub = line.substring(0, cursor.ch);

        // Match /keyword at line start or preceded by whitespace
        const match = sub.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);
        if (!match) return null;

        const query = match[1];
        const triggerIndex = sub.lastIndexOf('/' + query);

        return {
            start: { line: cursor.line, ch: triggerIndex },
            end: cursor,
            query: query.toLowerCase()
        };
    }

    public getSuggestions(context: EditorSuggestContext): ExamSnippetItem[] {
        const query = (context.query || '').trim().toLowerCase();
        if (!query) {
            return this.snippetItems;
        }

        return this.snippetItems.filter(item => {
            if (item.id.toLowerCase().includes(query)) return true;
            if (item.label.toLowerCase().includes(query)) return true;
            return item.keywords.some(k => k.includes(query));
        });
    }

    public renderSuggestion(item: ExamSnippetItem, el: HTMLElement): void {
        el.addClass('exam-hub-snippet-suggestion');
        el.empty();

        const row = el.createDiv({ cls: 'snippet-suggestion-row' });
        const iconSpan = row.createSpan({ cls: 'snippet-icon' });
        setIcon(iconSpan, item.icon);

        const textCol = row.createDiv({ cls: 'snippet-text-col' });
        textCol.createDiv({ cls: 'snippet-title', text: item.label });
        textCol.createDiv({ cls: 'snippet-detail', text: item.detail });
    }

    public selectSuggestion(item: ExamSnippetItem, evt: MouseEvent | KeyboardEvent): void {
        if (!this.context) return;
        const editor = this.context.editor;
        const content = item.generateContent();

        editor.replaceRange(content, this.context.start, this.context.end);

        // Position cursor nicely at the inserted snippet prompt if it begins with ## [Fragetext
        const startLine = this.context.start.line;
        const insertedFirstLine = editor.getLine(startLine);
        if (insertedFirstLine.startsWith('## [')) {
            const endBracketIndex = insertedFirstLine.indexOf(']');
            if (endBracketIndex !== -1) {
                editor.setSelection(
                    { line: startLine, ch: 4 },
                    { line: startLine, ch: endBracketIndex }
                );
                return;
            }
        }

        // Default: Move cursor to end of inserted snippet
        const lines = content.split('\n');
        const endLine = startLine + lines.length - 1;
        const endCh = lines[lines.length - 1].length;
        editor.setCursor({ line: endLine, ch: endCh });
    }
}
