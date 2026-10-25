import { generateUUID } from '../parser/HashUtils';
import { ParsedExamFile } from '../parser/ExamParser';
import { ActiveSessionState, ChoiceItem, ErrorPoolItem, QuestionDefinition } from '../types';

export interface ExamGenerationOptions {
    title?: string;
    modules: string[];
    questionCount: number;
    timePerQuestionMinutes?: number;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    mode?: 'exam' | 'quiz';
}

export class ExamGenerator {
    /**
     * In-place Fisher-Yates shuffle algorithm.
     */
    public static shuffle<T>(array: T[]): T[] {
        const copy = [...array];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = copy[i];
            copy[i] = copy[j];
            copy[j] = temp;
        }
        return copy;
    }

    /**
     * Creates a deep cloned question definition with shuffled options if requested (Level 2 shuffle).
     */
    public static prepareQuestion(q: QuestionDefinition, shouldShuffleOptions: boolean = true): QuestionDefinition {
        let preparedOptions: ChoiceItem[] | undefined = undefined;

        if (q.options && q.options.length > 0) {
            // Clone items ensuring stable UUID
            const clonedOptions = q.options.map(opt => ({
                id: opt.id || generateUUID(),
                text: opt.text,
                isCorrect: opt.isCorrect,
                userSelected: false
            }));

            preparedOptions = shouldShuffleOptions ? this.shuffle(clonedOptions) : clonedOptions;
        }

        return {
            ...q,
            options: preparedOptions
        };
    }

    /**
     * Generates a session from a specific single exam file.
     * Allows overriding mode (e.g. playing any exam as a quiz or vice versa).
     */
    public static fromParsedExam(exam: ParsedExamFile, overrideMode?: 'exam' | 'quiz'): ActiveSessionState {
        const shuffleQuestions = exam.frontmatter.shuffleQuestions !== false;
        const shuffleOptions = exam.frontmatter.shuffleOptions !== false;

        let questions = exam.questions.map(q => this.prepareQuestion(q, shuffleOptions));
        if (shuffleQuestions) {
            questions = this.shuffle(questions);
        }

        const mode: 'exam' | 'quiz' = overrideMode || (exam.frontmatter.type === 'quiz' ? 'quiz' : 'exam');
        const timeLimitMinutes = mode === 'quiz' ? 0 : (exam.frontmatter.timeLimitMinutes ?? 90);
        const timeLimitSeconds = timeLimitMinutes * 60;

        return {
            sessionId: generateUUID(),
            examTitle: exam.frontmatter.title || (mode === 'quiz' ? 'Quiz' : 'Klausur'),
            module: exam.frontmatter.module || 'Allgemein',
            mode,
            sourceFilePath: exam.sourceFilePath,
            startTime: Date.now(),
            timeLimitSeconds,
            remainingSeconds: timeLimitSeconds,
            currentQuestionIndex: 0,
            questions,
            flaggedQuestionIds: [],
            userAnswers: {},
            revealedQuestions: {},
            revealedEvaluations: {}
        };
    }

    /**
     * Generates a dynamic mix session from multiple modules with sampling.
     */
    public static createDynamicMix(
        availableQuestions: QuestionDefinition[],
        options: ExamGenerationOptions
    ): ActiveSessionState {
        const shuffleQuestions = options.shuffleQuestions !== false;
        const shuffleOptions = options.shuffleOptions !== false;

        // Shuffle full candidate pool first (Level 1)
        const pool = shuffleQuestions ? this.shuffle(availableQuestions) : [...availableQuestions];
        const count = Math.min(options.questionCount, pool.length);
        const selectedQuestions = pool.slice(0, count).map(q => this.prepareQuestion(q, shuffleOptions));

        const mode: 'exam' | 'quiz' = options.mode || 'exam';
        const timePerQuestion = options.timePerQuestionMinutes || 1.5;
        const totalMinutes = Math.max(5, Math.round(count * timePerQuestion));
        const timeLimitSeconds = mode === 'quiz' ? 0 : totalMinutes * 60;

        const moduleLabel = options.modules.length > 0 ? options.modules.join(' + ') : 'Alle Module';
        const typeLabel = mode === 'quiz' ? 'Quiz-Mix' : 'Modul-Mix';
        const title = options.title || `${typeLabel} (${moduleLabel})`;

        return {
            sessionId: generateUUID(),
            examTitle: title,
            module: moduleLabel,
            mode,
            startTime: Date.now(),
            timeLimitSeconds,
            remainingSeconds: timeLimitSeconds,
            currentQuestionIndex: 0,
            questions: selectedQuestions,
            flaggedQuestionIds: [],
            userAnswers: {},
            revealedQuestions: {},
            revealedEvaluations: {}
        };
    }

    /**
     * Generates a dedicated session focusing solely on questions from the error pool.
     */
    public static createErrorPoolSession(
        allQuestions: QuestionDefinition[],
        errorPool: Record<string, ErrorPoolItem>,
        mode: 'exam' | 'quiz' = 'exam'
    ): ActiveSessionState | null {
        const errorQuestionIds = new Set(Object.values(errorPool).map(item => item.questionId));

        const matchedQuestions = allQuestions.filter(q => errorQuestionIds.has(q.id));
        if (matchedQuestions.length === 0) {
            return null;
        }

        const preparedQuestions = this.shuffle(matchedQuestions).map(q => this.prepareQuestion(q, true));
        const timeLimitSeconds = mode === 'quiz' ? 0 : Math.max(5, Math.round(preparedQuestions.length * 1.5)) * 60;
        const titlePrefix = mode === 'quiz' ? 'Fehlerspeicher-Quiz' : 'Fehlerspeicher-Training';

        return {
            sessionId: generateUUID(),
            examTitle: `${titlePrefix} (${preparedQuestions.length} Fragen)`,
            module: 'Fehlerspeicher',
            mode,
            isErrorPoolSession: true,
            startTime: Date.now(),
            timeLimitSeconds,
            remainingSeconds: timeLimitSeconds,
            currentQuestionIndex: 0,
            questions: preparedQuestions,
            flaggedQuestionIds: [],
            userAnswers: {},
            revealedQuestions: {},
            revealedEvaluations: {}
        };
    }
}
