import { ChoiceItem, ExamFrontmatter, QuestionDefinition, QuestionType } from '../types';
import { computeContentHash, generateUUID } from './HashUtils';

export interface ParsedExamFile {
    frontmatter: ExamFrontmatter;
    questions: QuestionDefinition[];
    rawMarkdown: string;
    sourceFilePath: string;
}

export class ExamParser {
    /**
     * Parses a raw markdown string representing an exam or quiz into a structured ParsedExamFile.
     * Complies with mobile_desktop_compatibility_requirements:
     * - NO regex lookbehinds.
     * - Pure string/regex processing.
     */
    public static parse(content: string, sourceFilePath: string, cachedFrontmatter?: Record<string, unknown>): ParsedExamFile {
        const normalized = content.replace(/\r\n/g, '\n');
        const { frontmatter, body } = this.extractFrontmatter(normalized, cachedFrontmatter);
        const questions = this.parseQuestions(body, sourceFilePath);

        return {
            frontmatter,
            questions,
            rawMarkdown: normalized,
            sourceFilePath
        };
    }

    /**
     * Extracts YAML frontmatter without lookbehind regexes.
     */
    private static extractFrontmatter(content: string, cached?: Record<string, unknown>): { frontmatter: ExamFrontmatter; body: string } {
        let frontmatter: ExamFrontmatter = {
            type: 'exam',
            module: 'Allgemein',
            title: 'Klausur'
        };

        let body = content;

        let parsedYaml: Partial<ExamFrontmatter> = {};
        if (content.startsWith('---')) {
            const secondDashesIndex = content.indexOf('\n---', 3);
            if (secondDashesIndex !== -1) {
                const yamlBlock = content.substring(3, secondDashesIndex).trim();
                body = content.substring(secondDashesIndex + 4).trim();
                parsedYaml = this.parseSimpleYaml(yamlBlock);
            }
        }

        // Merge Obsidian cached frontmatter as baseline if available
        if (cached && typeof cached === 'object') {
            frontmatter = {
                ...frontmatter,
                type: cached.type === 'quiz' ? 'quiz' : 'exam',
                module: typeof cached.module === 'string' ? cached.module : frontmatter.module,
                semester: typeof cached.semester === 'string' ? cached.semester : frontmatter.semester,
                title: typeof cached.title === 'string' ? cached.title : frontmatter.title,
                timeLimitMinutes: cached.timeLimitMinutes !== undefined ? Number(cached.timeLimitMinutes) : frontmatter.timeLimitMinutes,
                passingScore: typeof cached.passingScore === 'string' || typeof cached.passingScore === 'number' ? cached.passingScore : frontmatter.passingScore,
                shuffleQuestions: cached.shuffleQuestions !== undefined ? Boolean(cached.shuffleQuestions) : frontmatter.shuffleQuestions,
                shuffleOptions: cached.shuffleOptions !== undefined ? Boolean(cached.shuffleOptions) : frontmatter.shuffleOptions,
                tags: Array.isArray(cached.tags) ? (cached.tags as string[]) : frontmatter.tags
            };
        }

        // Live file content takes highest precedence so edits take effect immediately
        frontmatter = {
            ...frontmatter,
            ...parsedYaml
        };

        return { frontmatter, body };
    }

    /**
     * Lightweight key-value YAML parser for basic frontmatter with alias support.
     */
    private static parseSimpleYaml(yamlStr: string): Partial<ExamFrontmatter> {
        const result: Partial<ExamFrontmatter> = {};
        const lines = yamlStr.split('\n');

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const colonIndex = trimmed.indexOf(':');
            if (colonIndex === -1) continue;

            const key = trimmed.substring(0, colonIndex).trim();
            let value = trimmed.substring(colonIndex + 1).trim();

            // Strip inline comments, e.g. "45 # Zeitlimit"
            const commentIndex = value.indexOf('#');
            if (commentIndex !== -1) {
                value = value.substring(0, commentIndex).trim();
            }

            // Strip surrounding quotes
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }

            const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
            switch (lowerKey) {
                case 'type':
                    result.type = value === 'quiz' ? 'quiz' : 'exam';
                    break;
                case 'module':
                case 'modul':
                case 'fach':
                    result.module = value;
                    break;
                case 'semester':
                    result.semester = value;
                    break;
                case 'title':
                case 'titel':
                case 'name':
                    result.title = value;
                    break;
                case 'timelimitminutes':
                case 'timelimit':
                case 'time':
                case 'zeitlimit':
                case 'dauer':
                case 'zeit':
                    result.timeLimitMinutes = Number(value) || undefined;
                    break;
                case 'passingscore':
                case 'bestehensgrenze':
                case 'bestehen':
                case 'passing':
                case 'score':
                    result.passingScore = value;
                    break;
                case 'shufflequestions':
                case 'mischen':
                case 'fragenmischen':
                    result.shuffleQuestions = value === 'true';
                    break;
                case 'shuffleoptions':
                case 'optionenmischen':
                case 'antwortenmischen':
                    result.shuffleOptions = value === 'true';
                    break;
            }
        }
        return result;
    }

    /**
     * Chunks body by '## ' headings and parses individual questions.
     */
    private static parseQuestions(body: string, sourceFilePath: string): QuestionDefinition[] {
        const questions: QuestionDefinition[] = [];
        const lines = body.split('\n');

        let currentHeading = '';
        let currentBlockId: string | undefined = undefined;
        let currentChunkLines: string[] = [];

        const flushQuestion = () => {
            if (currentHeading.trim() || currentChunkLines.length > 0) {
                const q = this.parseSingleQuestion(currentHeading, currentBlockId, currentChunkLines, sourceFilePath);
                if (q) {
                    questions.push(q);
                }
            }
            currentHeading = '';
            currentBlockId = undefined;
            currentChunkLines = [];
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const headingMatch = line.match(/^##\s+(.*)$/);

            if (headingMatch) {
                flushQuestion();
                let headingText = headingMatch[1].trim();

                // Check for Obsidian block reference at the end of the heading, e.g. ^q-kond-01
                const blockRefMatch = headingText.match(/\^([a-zA-Z0-9_-]+)$/);
                if (blockRefMatch) {
                    currentBlockId = blockRefMatch[1];
                    // Strip the block reference from the visible heading prompt
                    headingText = headingText.replace(/\s*\^[a-zA-Z0-9_-]+$/, '').trim();
                }
                currentHeading = headingText;
            } else {
                currentChunkLines.push(line);
            }
        }

        flushQuestion();
        return questions;
    }

    /**
     * Parses a single question block from its heading, blockId, and content lines.
     */
    private static parseSingleQuestion(
        heading: string,
        blockId: string | undefined,
        chunkLines: string[],
        sourceFilePath: string
    ): QuestionDefinition | null {
        let explicitType: QuestionType | undefined = undefined;
        let explicitPoints: number | undefined = undefined;
        let explicitId: string | undefined = undefined;

        const options: ChoiceItem[] = [];
        const rubric: string[] = [];
        let modelAnswer: string | undefined = undefined;
        const explanationLines: string[] = [];
        const promptLines: string[] = [];

        let inExplanationCallout = false;
        let inModelAnswer = false;
        let inRubric = false;

        for (let i = 0; i < chunkLines.length; i++) {
            const rawLine = chunkLines[i];
            const trimmed = rawLine.trim();

            // Callout start or continuation
            if (trimmed.startsWith('>')) {
                const calloutContent = trimmed.replace(/^>\s?/, '');
                if (calloutContent.toLowerCase().includes('[!explanation]') || calloutContent.toLowerCase().includes('[!erklärung]')) {
                    inExplanationCallout = true;
                    continue;
                }
                if (inExplanationCallout) {
                    explanationLines.push(calloutContent);
                    continue;
                }
            } else {
                inExplanationCallout = false;
            }

            // Check metadata lines: type, points, id
            const typeMatch = trimmed.match(/^type:\s*([a-zA-Z0-9_-]+)$/i);
            if (typeMatch) {
                const t = typeMatch[1].toLowerCase();
                if (t === 'multiple-choice' || t === 'single-choice' || t === 'freetext' || t === 'cloze') {
                    explicitType = t;
                    continue;
                }
            }

            const pointsMatch = trimmed.match(/^points:\s*([0-9]+(?:\.[0-9]+)?)$/i);
            if (pointsMatch) {
                explicitPoints = parseFloat(pointsMatch[1]);
                continue;
            }

            const idMatch = trimmed.match(/^id:\s*([a-zA-Z0-9_-]+)$/i);
            if (idMatch) {
                explicitId = idMatch[1];
                continue;
            }

            // Check for Block ID in a separate line (e.g. ^q-123)
            const lineBlockIdMatch = trimmed.match(/^\^([a-zA-Z0-9_-]+)$/);
            if (lineBlockIdMatch && !blockId) {
                blockId = lineBlockIdMatch[1];
                continue;
            }

            // Check for MC option: - [x] or - [ ] or * [x]
            const mcMatch = rawLine.match(/^\s*[-*]\s*\[([ xX])\]\s+(.*)$/);
            if (mcMatch) {
                const isCorrect = mcMatch[1].toLowerCase() === 'x';
                const text = mcMatch[2].trim();
                options.push({
                    id: generateUUID(),
                    text,
                    isCorrect,
                    userSelected: false
                });
                continue;
            }

            // Check for Model Answer / Musterloesung
            const modelAnswerMatch = trimmed.match(/^(?:Musterloesung|Musterlösung|Answer):\s*(.*)$/i);
            if (modelAnswerMatch) {
                inModelAnswer = true;
                inRubric = false;
                const restOfLine = modelAnswerMatch[1].trim();
                modelAnswer = restOfLine;
                continue;
            }

            // Check for Rubric / Kriterien
            const rubricMatch = trimmed.match(/^(?:Kriterien|Rubric):\s*$/i);
            if (rubricMatch) {
                inRubric = true;
                inModelAnswer = false;
                continue;
            }

            if (inRubric) {
                const rubricItemMatch = trimmed.match(/^\d+\.\s*(.*)$/);
                if (rubricItemMatch) {
                    rubric.push(rubricItemMatch[1].trim());
                    continue;
                } else if (!trimmed) {
                    inRubric = false;
                }
            }

            if (inModelAnswer) {
                if (trimmed.startsWith('---') || trimmed.startsWith('##') || trimmed.startsWith('>')) {
                    inModelAnswer = false;
                } else {
                    modelAnswer = (modelAnswer ? modelAnswer + '\n' : '') + trimmed;
                    continue;
                }
            }

            // Separator between questions
            if (trimmed === '---') {
                continue;
            }

            // Otherwise, part of the prompt
            if (trimmed) {
                promptLines.push(rawLine);
            }
        }

        // Combine prompt
        let prompt = heading;
        if (promptLines.length > 0) {
            prompt = prompt ? `${prompt}\n\n${promptLines.join('\n')}` : promptLines.join('\n');
        }

        if (!prompt.trim() && options.length === 0 && !modelAnswer) {
            return null;
        }

        // Determine question type if not explicitly specified
        let type: QuestionType = 'multiple-choice';
        if (explicitType) {
            type = explicitType;
        } else if (options.length > 0) {
            // Count correct options
            const correctCount = options.filter(o => o.isCorrect).length;
            type = correctCount === 1 && options.length > 2 ? 'single-choice' : 'multiple-choice';
        } else if (modelAnswer !== undefined || rubric.length > 0) {
            type = 'freetext';
        } else if (/\{[^}]+\}/.test(prompt)) {
            type = 'cloze';
        }

        // Determine points
        let points = 5;
        if (explicitPoints !== undefined) {
            points = explicitPoints;
        } else if (type === 'multiple-choice') {
            points = 5;
        } else if (type === 'single-choice') {
            points = 1;
        } else if (type === 'freetext') {
            points = rubric.length > 0 ? rubric.length : 3;
        } else if (type === 'cloze') {
            const clozeMatches = prompt.match(/\{[^}]+\}/g);
            points = clozeMatches ? clozeMatches.length : 1;
        }

        // Determine stable question ID based on specification priority:
        // 1. Obsidian Block-ID (^q-xxx)
        // 2. Explicit ID (id: xxx)
        // 3. Deterministic Content Hash (MurmurHash3 / FNV-1a)
        let id: string;
        if (blockId) {
            id = blockId;
        } else if (explicitId) {
            id = explicitId;
        } else {
            id = computeContentHash(heading || prompt);
        }

        return {
            id,
            type,
            prompt: prompt.trim(),
            points,
            options: options.length > 0 ? options : undefined,
            modelAnswer: modelAnswer ? modelAnswer.trim() : undefined,
            rubric: rubric.length > 0 ? rubric : undefined,
            explanation: explanationLines.length > 0 ? explanationLines.join('\n').trim() : undefined,
            sourceFilePath,
            blockId
        };
    }
}
