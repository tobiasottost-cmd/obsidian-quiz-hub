export type QuestionType = 'multiple-choice' | 'single-choice' | 'freetext' | 'cloze';

export interface ChoiceItem {
    id: string;             // Stabile UUID zur Nachverfolgung beim Shufflen
    text: string;
    isCorrect: boolean;     // Im Markdown mit [x] markiert
    userSelected?: boolean; // Eingabe des Nutzers
}

export interface QuestionDefinition {
    id: string;             // Block-ID (z.B. q-kond-01) oder deterministischer Hash
    type: QuestionType;
    prompt: string;
    points: number;         // Standard bei MC: 5
    options?: ChoiceItem[];
    modelAnswer?: string;   // Freitext-Musterlösung
    rubric?: string[];      // Bewertungskriterien
    explanation?: string;   // Inhalt des [!explanation] Callouts
    sourceFilePath: string;
    blockId?: string;       // Obsidian Block-Referenz z.B. ^q-xxx
}

export interface ExamFrontmatter {
    type: 'exam' | 'quiz';
    module: string;
    semester?: string;
    title: string;
    timeLimitMinutes?: number;
    passingScore?: string | number; // z.B. "60%" oder 60
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    tags?: string[];
}

export interface UserAnswerRecord {
    selectedOptionIds?: string[];
    freetextAnswer?: string;
    freetextAssignedPoints?: number;
    clozeAnswers?: Record<string, string>;
}

export interface ActiveSessionState {
    sessionId: string;
    examTitle: string;
    module: string;
    sourceFilePath?: string;
    isErrorPoolSession?: boolean;
    startTime: number;
    timeLimitSeconds: number;
    remainingSeconds: number;
    currentQuestionIndex: number;
    questions: QuestionDefinition[];
    flaggedQuestionIds: string[];
    userAnswers: Record<string, UserAnswerRecord>;
}

export interface QuestionEvaluation {
    questionId: string;
    type: QuestionType;
    possiblePoints: number;
    earnedPoints: number;
    isFullyCorrect: boolean;
    userNotes?: string;
    itemDetails?: {
        text: string;
        userSelected: boolean;
        isCorrect: boolean;
        earnedPoint: boolean;
    }[];
}

export interface SessionResult {
    sessionId: string;
    examTitle: string;
    module: string;
    date: number;
    totalPossiblePoints: number;
    earnedPoints: number;
    percentage: number;
    passed: boolean;
    timeSpentSeconds: number;
    questionEvaluations: QuestionEvaluation[];
    xpEarned: number;
}

export interface FSRSRecord {
    stability: number;      // Gedächtnisstabilität in Tagen
    difficulty: number;     // Schwierigkeitsgrad 1-10
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    lastReview: number;     // Timestamp
}

export interface ErrorPoolItem {
    filePath: string;
    questionId: string;
    failCount: number;
    consecutiveSuccess: number;
    lastFailedAt: number;
}

export interface SyncLearningData {
    version: number;
    lastSyncTimestamp: number;
    errorPool: Record<string, ErrorPoolItem>;
    resolvedPool: Record<string, number>;
    fsrsData: Record<string, FSRSRecord>;
    userXP: number;
    userLevel: number;
    streakDays: number;
    lastActiveDate: string;
}

export interface PluginSettingsData {
    examsFolderPath: string;
    resultsFolderPath: string;
    defaultPassingScore: number;
    enableSoundEffects: boolean;
    enableConfetti: boolean;
    soundVolume: number;
    userXP: number;
    userLevel: number;
    streakDays: number;
    lastActiveDate: string; // YYYY-MM-DD
    activeSession: ActiveSessionState | null;
    errorPool: Record<string, ErrorPoolItem>;
    resolvedPool: Record<string, number>;
    fsrsData: Record<string, FSRSRecord>;
    syncLearningDataInVault: boolean;
    learningDataFileName: string;
}

export const DEFAULT_SETTINGS: PluginSettingsData = {
    examsFolderPath: 'exams',
    resultsFolderPath: 'exams/results',
    defaultPassingScore: 75,
    enableSoundEffects: true,
    enableConfetti: true,
    soundVolume: 0.5,
    userXP: 0,
    userLevel: 1,
    streakDays: 0,
    lastActiveDate: '',
    activeSession: null,
    errorPool: {},
    resolvedPool: {},
    fsrsData: {},
    syncLearningDataInVault: true,
    learningDataFileName: '.quiz-learning-data.json'
};
