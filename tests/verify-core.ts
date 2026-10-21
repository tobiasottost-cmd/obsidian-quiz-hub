import { ExamParser } from '../src/parser/ExamParser';
import { ScoringEngine } from '../src/scoring/ScoringEngine';
import { ExamGenerator } from '../src/session/ExamGenerator';
import { ErrorPoolManager } from '../src/errorpool/ErrorPoolManager';
import { GamificationEngine } from '../src/gamification/GamificationEngine';
import { BlockIdAutoAssigner } from '../src/parser/BlockIdAutoAssigner';
import { ActiveSessionState, DEFAULT_SETTINGS, PluginSettingsData } from '../src/types';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ ASSERTION FAILED: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ ${message}`);
    }
}

console.log('--- Testing ExamParser ---');

const sampleMarkdown = `---
type: exam
module: M1
semester: WiSe26/27
title: Probeklausur Konditionierung
timeLimitMinutes: 45
passingScore: 60%
shuffleQuestions: true
shuffleOptions: true
---

## Welche Aussagen zur klassischen Konditionierung treffen zu? ^q-kond-01
type: multiple-choice
points: 5

- [x] Ein unkonditionierter Reiz (UCS) löst reflexartig eine UCR aus.
- [ ] Extinktion löscht die Gedächtnisspur vollständig.
- [x] Spontanerholung beschreibt das Wiederauftreten der CR nach einer Pause.
- [ ] Generalisierung bedeutet, dass nur der identische Reiz wirkt.
- [x] Konditionierung höherer Ordnung baut auf einem konditionierten Reiz auf.

> [!explanation]
> Extinktion ist Hemmungslernen (Inhibition). Generalisierung reagiert auch auf Reizähnlichkeiten.
> ![[assets/konditionierungs_schema.png]]

---

## Erkläre das Modell der Kognitiven Dissonanz nach Festinger. ^q-diss-02
type: freetext
points: 3

Musterloesung:
Kognitive Dissonanz beschreibt einen aversiven Spannungszustand bei widersprüchlichen Kognitionen.
Kriterien:
1. Definition des aversiven Spannungszustands (1P)
2. Ursache: Widerspruch kognitiver Elemente (1P)
3. Mindestens eine Reduktionsstrategie genannt (1P)

> [!explanation]
> Maximale Punktzahl: 3 Punkte.
`;

const parsed = ExamParser.parse(sampleMarkdown, 'exams/M1/test.md');

assert(parsed.frontmatter.title === 'Probeklausur Konditionierung', 'Frontmatter title correctly parsed');
assert(parsed.frontmatter.module === 'M1', 'Frontmatter module correctly parsed');
assert(parsed.frontmatter.timeLimitMinutes === 45, 'Time limit correctly parsed');
assert(parsed.questions.length === 2, 'Parsed exactly 2 questions');

const q1 = parsed.questions[0];
assert(q1.id === 'q-kond-01', 'Question 1 Block-ID priority matched (^q-kond-01)');
assert(q1.type === 'multiple-choice', 'Question 1 is multiple-choice');
assert(q1.options?.length === 5, 'Question 1 has exactly 5 options');
assert(q1.options?.filter(o => o.isCorrect).length === 3, 'Question 1 has exactly 3 correct options ([x])');
assert(q1.explanation?.includes('Extinktion ist Hemmungslernen'), 'Question 1 explanation callout extracted');

const q2 = parsed.questions[1];
assert(q2.id === 'q-diss-02', 'Question 2 Block-ID priority matched (^q-diss-02)');
assert(q2.type === 'freetext', 'Question 2 is freetext');
assert(q2.modelAnswer?.includes('aversiven Spannungszustand') === true, 'Question 2 model answer extracted');
assert(q2.rubric?.length === 3, 'Question 2 rubric has 3 criteria');

// Test Frontmatter priority over stale cache
const staleCache = { timeLimitMinutes: 45, passingScore: '60%' };
const freshMarkdown = `---
title: Aktualisierte Klausur
zeitlimit: 90
bestehensgrenze: 75%
---
## Testfrage ^q-fresh-01
type: single-choice
- [x] Richtig
- [ ] Falsch
`;
const freshParsed = ExamParser.parse(freshMarkdown, 'exams/test.md', staleCache);
assert(freshParsed.frontmatter.timeLimitMinutes === 90, 'Live file timeLimitMinutes (90) overrides stale cache (45) immediately');
assert(freshParsed.frontmatter.passingScore === '75%', 'Live file passingScore (75%) overrides stale cache');

// Test Default 90 min when timeLimitMinutes is omitted
const noTimeMarkdown = `---
title: Klausur ohne Zeitlimit
---
## Frage 1 ^q-notime-01
type: single-choice
- [x] Ja
`;
const noTimeParsed = ExamParser.parse(noTimeMarkdown, 'exams/notime.md');
const sessionFromNoTime = ExamGenerator.fromParsedExam(noTimeParsed);
assert(sessionFromNoTime.timeLimitSeconds === 90 * 60, 'Default exam time limit is 90 minutes (5400s) when omitted in YAML');

assert(DEFAULT_SETTINGS.defaultPassingScore === 75, 'Default passing score in settings is 75%');

console.log('\n--- Testing ScoringEngine (5-Item MC Logic) ---');

const sessionState: ActiveSessionState = {
    sessionId: 'test-session',
    examTitle: 'Test Exam',
    module: 'M1',
    startTime: Date.now(),
    timeLimitSeconds: 2700,
    remainingSeconds: 1500,
    currentQuestionIndex: 0,
    questions: [q1, q2],
    flaggedQuestionIds: [],
    userAnswers: {}
};

// Case 1: All 5 MC items correctly marked/unmarked -> 5/5 points
const correctOptionIds = q1.options!.filter(o => o.isCorrect).map(o => o.id);
sessionState.userAnswers[q1.id] = { selectedOptionIds: correctOptionIds };
sessionState.userAnswers[q2.id] = { freetextAnswer: 'Meine Ausarbeitung', freetextAssignedPoints: 3 };

let result = ScoringEngine.evaluate(sessionState, 60);
assert(result.questionEvaluations[0].earnedPoints === 5, 'MC question with all correct selections gets 5 points');
assert(result.questionEvaluations[0].isFullyCorrect === true, 'MC question marked isFullyCorrect');
assert(result.questionEvaluations[1].earnedPoints === 3, 'Freetext question gets 3 points');
assert(result.totalPossiblePoints === 8, 'Total possible is 8 points (5 MC + 3 freetext)');
assert(result.earnedPoints === 8, 'Earned 8/8 points (100%)');
assert(result.passed === true, 'Result passed');
// XP calculation: 2 answered (20) + 1 perfect MC (5) + passed (50) + >=85% (100) = 175 XP
assert(result.xpEarned === 175, `XP earned is 175 (got ${result.xpEarned})`);

// Case 2: 1 error in MC (missed 1 true option) -> 4/5 points
sessionState.userAnswers[q1.id] = { selectedOptionIds: [correctOptionIds[0], correctOptionIds[1]] }; // omitted 3rd
result = ScoringEngine.evaluate(sessionState, 60);
assert(result.questionEvaluations[0].earnedPoints === 4, 'MC question with 1 missed item gets 4/5 points');
assert(result.questionEvaluations[0].isFullyCorrect === false, 'MC question with 4 points is not fully correct');

console.log('\n--- Testing ErrorPoolManager (2x Consecutive Success Mastery) ---');

const settings: PluginSettingsData = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

// Process session with error in q1
ErrorPoolManager.processSessionResults(settings, sessionState, result);
assert(settings.errorPool[q1.id] !== undefined, 'Failed question q1 was added to error pool');
assert(settings.errorPool[q1.id].failCount === 1, 'q1 failCount is 1');
assert(settings.errorPool[q1.id].consecutiveSuccess === 0, 'q1 consecutiveSuccess is 0');

// Now simulate an error pool re-training session where user gets q1 fully right (1st time)
const errorSessionState: ActiveSessionState = {
    ...sessionState,
    isErrorPoolSession: true,
    userAnswers: {
        [q1.id]: { selectedOptionIds: correctOptionIds }
    }
};
let errorResult = ScoringEngine.evaluate(errorSessionState, 60);
ErrorPoolManager.processSessionResults(settings, errorSessionState, errorResult);
assert(settings.errorPool[q1.id] !== undefined, 'q1 still in error pool after 1st success');
assert(settings.errorPool[q1.id].consecutiveSuccess === 1, 'q1 consecutiveSuccess incremented to 1');

// Now simulate 2nd consecutive success on q1
ErrorPoolManager.processSessionResults(settings, errorSessionState, errorResult);
assert(settings.errorPool[q1.id] === undefined, 'q1 removed from error pool after 2x consecutive successes!');

console.log('\n--- Testing GamificationEngine ---');

const level1 = GamificationEngine.calculateLevel(0);
assert(level1.level === 1, '0 XP is Level 1');

const level2 = GamificationEngine.calculateLevel(260);
assert(level2.level === 2, '260 XP reaches Level 2');

// Streak tracking
const streakInfo = GamificationEngine.recordActivity(settings);
assert(streakInfo.streakDays === 1, 'Initial streak is 1 day');

console.log('\n--- Testing LearningDataMerger (Cross-Device Sync) ---');
import { LearningDataMerger } from '../src/sync/LearningDataMerger';

const localSettings: PluginSettingsData = {
    ...DEFAULT_SETTINGS,
    userXP: 300,
    userLevel: 2,
    streakDays: 2,
    lastActiveDate: '2026-10-20',
    errorPool: {
        'q-pc-only': {
            filePath: 'exams/pc.md',
            questionId: 'q-pc-only',
            failCount: 1,
            consecutiveSuccess: 0,
            lastFailedAt: 1000
        },
        'q-conflict': {
            filePath: 'exams/conflict.md',
            questionId: 'q-conflict',
            failCount: 1,
            consecutiveSuccess: 0,
            lastFailedAt: 1000
        }
    },
    resolvedPool: {
        'q-resolved-on-pc': 5000 // Mastered on PC at t=5000
    }
};

const remoteData = {
    version: 1,
    lastSyncTimestamp: 6000,
    userXP: 550, // Mobile earned more XP!
    userLevel: 2,
    streakDays: 4,
    lastActiveDate: '2026-10-21', // Mobile was active more recently!
    errorPool: {
        'q-mobile-only': {
            filePath: 'exams/mobile.md',
            questionId: 'q-mobile-only',
            failCount: 2,
            consecutiveSuccess: 0,
            lastFailedAt: 3000
        },
        'q-conflict': {
            filePath: 'exams/conflict.md',
            questionId: 'q-conflict',
            failCount: 3, // Mobile failed it more often
            consecutiveSuccess: 1,
            lastFailedAt: 4000 // newer
        },
        'q-resolved-on-pc': {
            filePath: 'exams/old.md',
            questionId: 'q-resolved-on-pc',
            failCount: 1,
            consecutiveSuccess: 0,
            lastFailedAt: 2000 // older than PC resolution timestamp (5000)
        }
    },
    resolvedPool: {}
};

const { changed, merged } = LearningDataMerger.merge(localSettings, remoteData);

assert(changed === true, 'LearningDataMerger flagged changes');
assert(merged.userXP === 550, 'Merged userXP took highest value (550 XP)');
assert(merged.userLevel === 2, 'Merged userLevel calculated correctly');
assert(merged.streakDays === 4, 'Merged streakDays took mobile newest streak (4)');
assert(merged.lastActiveDate === '2026-10-21', 'Merged lastActiveDate took newest date');

// Error Pool Checks
assert(merged.errorPool['q-pc-only'] !== undefined, 'PC-only error preserved');
assert(merged.errorPool['q-mobile-only'] !== undefined, 'Mobile-only error merged in');
assert(merged.errorPool['q-conflict'] !== undefined, 'Conflict question preserved');
assert(merged.errorPool['q-conflict'].failCount === 3, 'Conflict question took max failCount (3)');
assert(merged.errorPool['q-conflict'].consecutiveSuccess === 1, 'Conflict question took newer consecutiveSuccess');

// Mastery / Resolution check:
assert(merged.errorPool['q-resolved-on-pc'] === undefined, 'Mastered question not resurrected by stale mobile error');
assert(merged.resolvedPool['q-resolved-on-pc'] === 5000, 'ResolvedPool preserved resolution timestamp');

console.log('\n--- Testing BlockIdAutoAssigner and Hash Fallback ---');

// 1. Test ExamParser fallback when user provides NO block-ID
const noBlockIdMd = `---
module: Bio
title: Klausur ohne Block-IDs
---
## Erste Frage ohne Block-ID
type: single-choice
- [x] Antwort A
- [ ] Antwort B

---

## Zweite Frage ohne Block-ID
type: freetext
points: 2
`;
const parsedNoBlock = ExamParser.parse(noBlockIdMd, 'exams/bio/test.md');
assert(parsedNoBlock.questions.length === 2, 'Parsed 2 questions without explicit block IDs');
assert(parsedNoBlock.questions[0].id.startsWith('q-'), 'Question 1 got automatic content hash ID: ' + parsedNoBlock.questions[0].id);
assert(parsedNoBlock.questions[1].id.startsWith('q-'), 'Question 2 got automatic content hash ID: ' + parsedNoBlock.questions[1].id);
assert(parsedNoBlock.questions[0].id !== parsedNoBlock.questions[1].id, 'Questions have distinct hash IDs');

// 2. Test BlockIdAutoAssigner auto-assigning IDs
const unassignedMd = `---
module: "M1 - Grundlagen"
title: Test
---
## Erste Frage
type: single-choice
- [x] Ja

## Zweite Frage ^q-m1-01
type: single-choice
- [x] Ja

## Dritte Frage
type: single-choice
- [x] Ja
`;

const autoResult = BlockIdAutoAssigner.processMarkdown(unassignedMd);
assert(autoResult.addedCount === 2, 'Added exactly 2 missing block IDs');
assert(autoResult.updatedContent.includes('## Erste Frage ^q-m1-02'), 'First question received ^q-m1-02 (avoiding collision with 01)');
assert(autoResult.updatedContent.includes('## Zweite Frage ^q-m1-01'), 'Existing ^q-m1-01 was preserved');
assert(autoResult.updatedContent.includes('## Dritte Frage ^q-m1-03'), 'Third question received ^q-m1-03');

// 3. Test Idempotency: Running again should add 0
const secondRun = BlockIdAutoAssigner.processMarkdown(autoResult.updatedContent);
assert(secondRun.addedCount === 0, 'Second run added 0 block IDs (idempotent)');
assert(secondRun.updatedContent === autoResult.updatedContent, 'Content remained identical');

// 4. Test CRLF preservation
const crlfMd = "---\r\nmodule: Psych\r\n---\r\n## Frage 1\r\n- [x] Ok\r\n";
const crlfResult = BlockIdAutoAssigner.processMarkdown(crlfMd);
assert(crlfResult.updatedContent.includes('\r\n'), 'CRLF line endings preserved');
assert(crlfResult.updatedContent.includes('## Frage 1 ^q-psych-01'), 'Assigned clean prefix ^q-psych-01');

console.log('\n🎉 ALL CORE LOGIC AND SPECIFICATION UNIT TESTS PASSED!');
