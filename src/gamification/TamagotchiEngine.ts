import { PluginSettingsData } from '../types';
import { GamificationEngine } from './GamificationEngine';

export interface TamagotchiStageInfo {
    stage: number;               // 1 bis 10
    name: string;                // z.B. "Drachen-Ei"
    title: string;               // z.B. "Geheimnisvoller Ursprung"
    description: string;         // Didaktische Beschreibung
    minStreak: number;           // Benötigte Lern-Streak Tage
    minLevel: number;            // Alternativ benötigtes Level
}

export interface TamagotchiEvolutionState {
    currentStage: TamagotchiStageInfo;
    nextStage: TamagotchiStageInfo | null;
    isMaxStage: boolean;
    progressPercentage: number;
    requirementText: string;
}

export interface TamagotchiMoodInfo {
    mood: 'ecstatic' | 'happy' | 'content' | 'hungry' | 'sleepy';
    label: string;
    emoji: string;
    colorVar: string;
}

export const TAMAGOTCHI_STAGE_DEFINITIONS: TamagotchiStageInfo[] = [
    {
        stage: 1,
        name: 'Drachen-Ei',
        title: 'Geheimnisvoller Ursprung',
        description: 'Ein gesprenkeltes Drachen-Ei ruht geborgen auf einem Samtkissen. Noch schläft der kleine Gelehrte darin!',
        minStreak: 0,
        minLevel: 1
    },
    {
        stage: 2,
        name: 'Frisch geschlüpft',
        title: 'Der erste Funke',
        description: 'Knack! Mit deinem ersten Lernerfolg ist das Drachenbaby aus der Schale geschlüpft und blickt neugierig in deine Unterlagen.',
        minStreak: 1,
        minLevel: 2
    },
    {
        stage: 3,
        name: 'Kleiner Wicht',
        title: 'Neugieriger Entdecker',
        description: 'Auf tapsigen Pfoten erkundet der kleine Drache die Welt des Wissens und freut sich über jedes gelöste Quiz.',
        minStreak: 3,
        minLevel: 3
    },
    {
        stage: 4,
        name: 'Aufgeweckter Lehrling',
        title: 'Eifriger Studiosus',
        description: 'Mit wachen Augen und ersten kleinen Schwingen sitzt dein Begleiter bei jeder Lerneinheit aufmerksam neben dir.',
        minStreak: 5,
        minLevel: 4
    },
    {
        stage: 5,
        name: 'Schuldrache',
        title: 'Gelehrter mit Ranzen',
        description: 'Ausgestattet mit Schultasche und Schreibfeder meistert dein Drache zusammen mit dir eine ganze Woche Lern-Streak!',
        minStreak: 7,
        minLevel: 6
    },
    {
        stage: 6,
        name: 'Wissbegieriger Adept',
        title: 'Hüter der Folianten',
        description: 'Inmitten dicker Bücher wachsen die magischen Schwingen. Komplexe Klausuren meistert ihr jetzt im Team.',
        minStreak: 10,
        minLevel: 8
    },
    {
        stage: 7,
        name: 'Flügellehrling',
        title: 'Erhabener Flugschüler',
        description: 'Zwei Wochen konsequentes Lernen! Dein Drache erhebt sich majestätisch in die Lüfte und brennt für neue Wissensgebiete.',
        minStreak: 14,
        minLevel: 10
    },
    {
        stage: 8,
        name: 'Meister der Prüfungen',
        title: 'Weiser Prüfungsmeister',
        description: 'Gekleidet in edle akademische Roben strahlt dein Begleiter pure Ruhe und Souveränität vor jeder Klausur aus.',
        minStreak: 21,
        minLevel: 13
    },
    {
        stage: 9,
        name: 'Akademie-Wächter',
        title: 'Großmeister der Fakultät',
        description: 'Ein voller Monat tägliches Lernen! Der mächtige Drache bewahrt dein Vault-Wissen vor dem Vergessen.',
        minStreak: 30,
        minLevel: 16
    },
    {
        stage: 10,
        name: 'Ehrwürdiger Wissensdrache',
        title: 'Legendärer Ältester',
        description: 'Die höchste Evolutionsstufe! Ein unsterblicher, majestätischer Wissensdrache von unendlicher Weisheit und Konzentration.',
        minStreak: 50,
        minLevel: 20
    }
];

export class TamagotchiEngine {
    /**
     * Ermittelt die aktuelle Evolutionsstufe basierend auf Lern-Streak und Level/XP.
     */
    public static getEvolutionState(streakDays: number, userLevel: number): TamagotchiEvolutionState {
        let currentStage = TAMAGOTCHI_STAGE_DEFINITIONS[0];

        for (const def of TAMAGOTCHI_STAGE_DEFINITIONS) {
            if (streakDays >= def.minStreak || userLevel >= def.minLevel) {
                currentStage = def;
            }
        }

        const isMaxStage = currentStage.stage >= 10;
        const nextStage = isMaxStage ? null : TAMAGOTCHI_STAGE_DEFINITIONS[currentStage.stage]; // index = currentStage.stage (0-based)

        if (!nextStage) {
            return {
                currentStage,
                nextStage: null,
                isMaxStage: true,
                progressPercentage: 100,
                requirementText: 'Höchste Evolutionsstufe erreicht! 👑'
            };
        }

        const streakDelta = Math.max(1, nextStage.minStreak - currentStage.minStreak);
        const levelDelta = Math.max(1, nextStage.minLevel - currentStage.minLevel);

        const streakProgress = Math.min(100, Math.max(0, Math.round(((streakDays - currentStage.minStreak) / streakDelta) * 100)));
        const levelProgress = Math.min(100, Math.max(0, Math.round(((userLevel - currentStage.minLevel) / levelDelta) * 100)));
        const progressPercentage = Math.max(streakProgress, levelProgress);

        const streakRemaining = Math.max(0, nextStage.minStreak - streakDays);
        const levelRemaining = Math.max(0, nextStage.minLevel - userLevel);

        let requirementText = '';
        if (streakRemaining > 0 && levelRemaining > 0) {
            requirementText = `Noch ${streakRemaining} Tag(e) Streak oder ${levelRemaining} Level`;
        } else if (streakRemaining > 0) {
            requirementText = `Noch ${streakRemaining} Tag(e) Streak`;
        } else {
            requirementText = `Noch ${levelRemaining} Level`;
        }

        return {
            currentStage,
            nextStage,
            isMaxStage: false,
            progressPercentage,
            requirementText
        };
    }

    /**
     * Zieht bei täglicher Inaktivität schrittweise Sättigung ab (Drache kann NIE sterben, Min = 15%).
     */
    public static applyDailyDecay(settings: PluginSettingsData): { decayed: boolean; hungerLost: number } {
        const today = GamificationEngine.getTodayDateString();
        const lastDecay = settings.tamagotchiLastDecayDate;

        if (!lastDecay) {
            settings.tamagotchiLastDecayDate = today;
            return { decayed: false, hungerLost: 0 };
        }

        if (lastDecay === today) {
            return { decayed: false, hungerLost: 0 };
        }

        // Berechne vergangene Tage
        const diffMs = Math.max(0, new Date(today).getTime() - new Date(lastDecay).getTime());
        const diffDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        const hungerLost = Math.min(60, diffDays * 15);
        const happinessLost = Math.min(45, diffDays * 10);

        const currentHunger = settings.tamagotchiHunger ?? 85;
        const currentHappiness = settings.tamagotchiHappiness ?? 90;

        settings.tamagotchiHunger = Math.max(15, currentHunger - hungerLost);
        settings.tamagotchiHappiness = Math.max(20, currentHappiness - happinessLost);
        settings.tamagotchiLastDecayDate = today;

        return { decayed: true, hungerLost };
    }

    /**
     * Füttert den Begleiter mit Lernpunkten (z.B. nach Quiz oder Klausur).
     */
    public static feed(settings: PluginSettingsData, amount: number): { oldHunger: number; newHunger: number; added: number } {
        const oldHunger = settings.tamagotchiHunger ?? 85;
        const newHunger = Math.min(100, oldHunger + amount);
        const added = newHunger - oldHunger;

        settings.tamagotchiHunger = newHunger;
        settings.tamagotchiHappiness = Math.min(100, (settings.tamagotchiHappiness ?? 90) + Math.round(amount * 0.75));
        settings.tamagotchiLastFedDate = GamificationEngine.getTodayDateString();

        return { oldHunger, newHunger, added };
    }

    /**
     * Streichelt den Begleiter auf dem Dashboard für ein wenig Liebe und Zuneigung.
     */
    public static pet(settings: PluginSettingsData): { happinessGained: number; hungerGained: number } {
        const oldHappiness = settings.tamagotchiHappiness ?? 90;
        const oldHunger = settings.tamagotchiHunger ?? 85;

        const newHappiness = Math.min(100, oldHappiness + 6);
        const newHunger = Math.min(100, oldHunger + 2);

        settings.tamagotchiHappiness = newHappiness;
        settings.tamagotchiHunger = newHunger;
        settings.tamagotchiLastFedDate = GamificationEngine.getTodayDateString();

        return {
            happinessGained: newHappiness - oldHappiness,
            hungerGained: newHunger - oldHunger
        };
    }

    /**
     * Ermittelt die Stimmung des Begleiters.
     */
    public static getMood(hunger: number, happiness: number): TamagotchiMoodInfo {
        if (hunger >= 85 && happiness >= 80) {
            return { mood: 'ecstatic', label: 'Begeistert & voller Energie', emoji: '🔥', colorVar: 'var(--text-accent)' };
        }
        if (hunger >= 60) {
            return { mood: 'happy', label: 'Glücklich & lernbereit', emoji: '✨', colorVar: 'var(--text-success)' };
        }
        if (hunger >= 40) {
            return { mood: 'content', label: 'Zufrieden & entspannt', emoji: '😊', colorVar: 'var(--text-normal)' };
        }
        if (hunger >= 20) {
            return { mood: 'hungry', label: 'Hungrig nach neuem Wissen', emoji: '🍎', colorVar: 'var(--text-warning)' };
        }
        return { mood: 'sleepy', label: 'Schläfrig (Braucht Wissens-Snack!)', emoji: '💤', colorVar: 'var(--text-muted)' };
    }

    /**
     * Erzeugt ein charmantes, didaktisches Zitat passend zu Stufe, Stimmung und Streak.
     */
    public static getSpeechQuote(stage: number, mood: TamagotchiMoodInfo, streakDays: number, companionName: string): string {
        const name = companionName || 'Lern-Drache';

        if (stage === 1) {
            return `*knister... knister* Etwas regt sich im Ei von ${name}! Mit deinem ersten gelösten Quiz schlüpfe ich! 🥚`;
        }

        if (mood.mood === 'sleepy' || mood.mood === 'hungry') {
            const hungryQuotes = [
                `Gääähn... Mein Wissensmagen knurrt! Hast du Zeit für ein kurzes 5-Fragen-Quiz?`,
                `Ein kleiner Wissens-Snack würde mich sofort aufwecken! Zeig mir eine Frage!`,
                `Ohne frische Fragen werden meine Schwingen ganz schwer. Füttere mich mit Wissen!`
            ];
            return hungryQuotes[Math.floor(Math.random() * hungryQuotes.length)];
        }

        if (streakDays >= 7) {
            return `Wahnsinn! ${streakDays} Tage Lern-Streak in Folge! Wir zwei sind ein unschlagbares Team!`;
        }

        if (stage >= 8) {
            return `Als Meister der Prüfungen bin ich stolz auf dich. Lass uns dein Wissen weiter vertiefen!`;
        }

        if (mood.mood === 'ecstatic') {
            const ecstaticQuotes = [
                `Ich strotze vor Wissensdrang! Welches Thema knöpfen wir uns als Nächstes vor?`,
                `Mmmh, Wissensfutter ist das Beste! Lass uns noch ein Quiz rocken!`,
                `Gemeinsam machen wir jede Klausur zum Kinderspiel! Auf geht's!`
            ];
            return ecstaticQuotes[Math.floor(Math.random() * ecstaticQuotes.length)];
        }

        const standardQuotes = [
            `Ein prima Tag zum Lernen! Jedes richtige Häkchen lässt mich wachsen!`,
            `Ich sitze bereit mit meiner Schreibfeder. Welche Fragen lösen wir heute?`,
            `Kontinuität ist der Schlüssel zum Prüfungserfolg! Schön, dass du da bist!`
        ];
        return standardQuotes[Math.floor(Math.random() * standardQuotes.length)];
    }
}
