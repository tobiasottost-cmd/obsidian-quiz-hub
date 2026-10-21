import { ActiveSessionState, QuestionDefinition, QuestionEvaluation, SessionResult } from '../types';

export class ScoringEngine {
    /**
     * Evaluates a completed or submitted active exam session.
     * Implements strict 5-item MC logic and XP allocation per specification v3.
     */
    public static evaluate(sessionState: ActiveSessionState, defaultPassingPercentage: number = 75): SessionResult {
        const evaluations: QuestionEvaluation[] = [];
        let totalPossible = 0;
        let totalEarned = 0;
        let answeredQuestionsCount = 0;
        let perfectMcBlocksCount = 0;

        for (const question of sessionState.questions) {
            const evaluation = this.evaluateQuestion(question, sessionState);
            evaluations.push(evaluation);

            totalPossible += evaluation.possiblePoints;
            totalEarned += evaluation.earnedPoints;

            const isAnswered = this.isQuestionAnswered(question, sessionState);
            if (isAnswered) {
                answeredQuestionsCount++;
            }

            if (question.type === 'multiple-choice' && evaluation.earnedPoints === 5) {
                perfectMcBlocksCount++;
            }
        }

        const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
        const passed = percentage >= defaultPassingPercentage;
        const timeSpentSeconds = Math.max(0, sessionState.timeLimitSeconds - sessionState.remainingSeconds);

        // Calculate XP according to Modul 4.1:
        // +10 XP per answered question
        // +5 XP for 5/5 in MC
        // +50 XP if passed
        // +100 XP if >= 85%
        let xpEarned = answeredQuestionsCount * 10;
        xpEarned += perfectMcBlocksCount * 5;
        if (passed) {
            xpEarned += 50;
        }
        if (percentage >= 85) {
            xpEarned += 100;
        }

        return {
            sessionId: sessionState.sessionId,
            examTitle: sessionState.examTitle,
            module: sessionState.module,
            date: Date.now(),
            totalPossiblePoints: totalPossible,
            earnedPoints: totalEarned,
            percentage,
            passed,
            timeSpentSeconds,
            questionEvaluations: evaluations,
            xpEarned
        };
    }

    /**
     * Evaluates a single question based on its type.
     */
    public static evaluateQuestion(question: QuestionDefinition, sessionState: ActiveSessionState): QuestionEvaluation {
        const answer = sessionState.userAnswers[question.id] || {};

        switch (question.type) {
            case 'multiple-choice':
                return this.evaluateMultipleChoice(question, answer.selectedOptionIds || []);
            case 'single-choice':
                return this.evaluateSingleChoice(question, answer.selectedOptionIds || []);
            case 'freetext':
                return this.evaluateFreetext(question, answer.freetextAnswer || '', answer.freetextAssignedPoints);
            case 'cloze':
                return this.evaluateCloze(question, answer.clozeAnswers || {});
            default:
                return {
                    questionId: question.id,
                    type: question.type,
                    possiblePoints: question.points || 5,
                    earnedPoints: 0,
                    isFullyCorrect: false
                };
        }
    }

    /**
     * 5-Item MC Scoring:
     * Item point = 1 if (userSelected && isCorrect) || (!userSelected && !isCorrect)
     * Sum = 0 to 5 points.
     */
    private static evaluateMultipleChoice(question: QuestionDefinition, selectedIds: string[]): QuestionEvaluation {
        const options = question.options || [];
        const selectedSet = new Set(selectedIds);
        let earned = 0;
        const itemDetails: { text: string; userSelected: boolean; isCorrect: boolean; earnedPoint: boolean }[] = [];

        for (const opt of options) {
            const userSelected = selectedSet.has(opt.id);
            const isCorrect = opt.isCorrect;
            // 1 point if correctly chosen or correctly rejected
            const gotPoint = (userSelected && isCorrect) || (!userSelected && !isCorrect);
            if (gotPoint) {
                earned += 1;
            }
            itemDetails.push({
                text: opt.text,
                userSelected,
                isCorrect,
                earnedPoint: gotPoint
            });
        }

        const possible = options.length > 0 ? options.length : question.points || 5;

        return {
            questionId: question.id,
            type: 'multiple-choice',
            possiblePoints: possible,
            earnedPoints: earned,
            isFullyCorrect: earned === possible,
            itemDetails
        };
    }

    private static evaluateSingleChoice(question: QuestionDefinition, selectedIds: string[]): QuestionEvaluation {
        const options = question.options || [];
        const correctOpt = options.find(o => o.isCorrect);
        const selectedId = selectedIds[0];
        const isCorrect = correctOpt !== undefined && selectedId === correctOpt.id;

        return {
            questionId: question.id,
            type: 'single-choice',
            possiblePoints: 1,
            earnedPoints: isCorrect ? 1 : 0,
            isFullyCorrect: isCorrect
        };
    }

    private static evaluateFreetext(
        question: QuestionDefinition,
        userText: string,
        assignedPoints?: number
    ): QuestionEvaluation {
        const maxPoints = question.points || (question.rubric ? question.rubric.length : 3);
        const points = assignedPoints !== undefined ? Math.min(maxPoints, Math.max(0, assignedPoints)) : 0;

        return {
            questionId: question.id,
            type: 'freetext',
            possiblePoints: maxPoints,
            earnedPoints: points,
            isFullyCorrect: points >= maxPoints,
            userNotes: userText
        };
    }

    private static evaluateCloze(question: QuestionDefinition, clozeAnswers: Record<string, string>): QuestionEvaluation {
        const matches = Array.from(question.prompt.matchAll(/\{([^}]+)\}/g));
        let earned = 0;
        const total = matches.length || 1;

        matches.forEach((m, idx) => {
            const expectedOptions = m[1].split('|').map(s => s.trim().toLowerCase());
            const userAnswer = (clozeAnswers[`blank_${idx}`] || '').trim().toLowerCase();
            if (expectedOptions.includes(userAnswer)) {
                earned += 1;
            }
        });

        return {
            questionId: question.id,
            type: 'cloze',
            possiblePoints: total,
            earnedPoints: earned,
            isFullyCorrect: earned === total
        };
    }

    private static isQuestionAnswered(question: QuestionDefinition, sessionState: ActiveSessionState): boolean {
        const ans = sessionState.userAnswers[question.id];
        if (!ans) return false;
        if (ans.selectedOptionIds && ans.selectedOptionIds.length > 0) return true;
        if (ans.freetextAnswer && ans.freetextAnswer.trim().length > 0) return true;
        if (ans.clozeAnswers && Object.keys(ans.clozeAnswers).length > 0) return true;
        return false;
    }
}
