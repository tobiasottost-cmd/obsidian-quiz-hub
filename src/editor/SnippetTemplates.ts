/**
 * Templates and snippet generators for creating and editing exams and quizzes.
 */

export function generateQuestionBlockId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let rand = '';
    for (let i = 0; i < 6; i++) {
        rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `q-${rand}`;
}

export function generateMultipleChoiceSnippet(prefixId?: string): string {
    const blockId = prefixId || generateQuestionBlockId();
    return [
        `## [Fragetext der Multiple-Choice-Aufgabe eingeben] ^${blockId}`,
        'type: multiple-choice',
        'points: 5',
        '',
        '- [x] Aussage 1 (Zutreffend / Richtig)',
        '- [ ] Aussage 2 (Unzutreffend / Falsch)',
        '- [x] Aussage 3 (Zutreffend / Richtig)',
        '- [ ] Aussage 4 (Unzutreffend / Falsch)',
        '- [ ] Aussage 5 (Unzutreffend / Falsch)',
        '',
        '> [!explanation]',
        '> Ausführliche Erklärung zur Musterlösung und den Aussagen.',
        '',
        '---',
        ''
    ].join('\n');
}

export function generateSingleChoiceSnippet(prefixId?: string): string {
    const blockId = prefixId || generateQuestionBlockId();
    return [
        `## [Fragetext der Single-Choice-Aufgabe eingeben] ^${blockId}`,
        'type: single-choice',
        'points: 1',
        '',
        '- [ ] Option A',
        '- [x] Option B (Einzig richtige Antwort)',
        '- [ ] Option C',
        '- [ ] Option D',
        '',
        '> [!explanation]',
        '> Erklärung, warum Option B zutrifft und die anderen Optionen falsch sind.',
        '',
        '---',
        ''
    ].join('\n');
}

export function generateFreetextSnippet(prefixId?: string): string {
    const blockId = prefixId || generateQuestionBlockId();
    return [
        `## [Fragetext der Freitext-Aufgabe eingeben] ^${blockId}`,
        'type: freetext',
        'points: 3',
        '',
        'Musterloesung:',
        'Vollständige Musterantwort und Erwartungshorizont hier formulieren.',
        '',
        'Kriterien:',
        '1. Definition des Kernkonzepts genannt (1P)',
        '2. Fachbegriffe präzise angewendet (1P)',
        '3. Mindestens ein Anwendungsbeispiel oder Zusammenhang erläutert (1P)',
        '',
        '> [!explanation]',
        '> Didaktische Hinweise zur Punktevergabe und typischen Fehlern.',
        '',
        '---',
        ''
    ].join('\n');
}

export function generateQuizFrontmatter(module: string = 'Allgemein', title: string = 'Neues Quiz'): string {
    return [
        '---',
        'type: quiz',
        `module: ${module || 'Allgemein'}`,
        `title: ${title || 'Neues Quiz'}`,
        'shuffleQuestions: true',
        'shuffleOptions: true',
        '---',
        ''
    ].join('\n');
}

export function generateExamFrontmatter(
    module: string = 'Allgemein',
    title: string = 'Neue Klausur',
    timeLimitMinutes: number = 90,
    passingScore: number = 75
): string {
    return [
        '---',
        'type: exam',
        `module: ${module || 'Allgemein'}`,
        `title: ${title || 'Neue Klausur'}`,
        `timeLimitMinutes: ${timeLimitMinutes || 90}`,
        `passingScore: ${passingScore || 75}%`,
        'shuffleQuestions: true',
        'shuffleOptions: true',
        '---',
        ''
    ].join('\n');
}

export function generateSampleQuizNote(module: string, title: string): string {
    const cleanMod = (module || 'Allgemein').toLowerCase().replace(/[^a-z0-9]/g, '');
    const prefix = cleanMod ? `q-${cleanMod}` : 'q';
    return [
        generateQuizFrontmatter(module, title),
        `## Erste Beispielfrage zu ${title || 'diesem Thema'} ^${prefix}-01`,
        'type: multiple-choice',
        'points: 5',
        '',
        '- [x] Dies ist eine zutreffende Aussage.',
        '- [ ] Dies ist eine falsche Aussage.',
        '- [x] Noch eine richtige Aussage zum Thema.',
        '- [ ] Eine weitere unzutreffende Option.',
        '- [ ] Falsche Distraktor-Aussage.',
        '',
        '> [!explanation]',
        '> Hier steht die didaktische Erklärung zur Musterlösung, die im Quizmodus direkt nach der Beantwortung angezeigt wird.',
        '',
        '---',
        '',
        `## Welche der folgenden Aussagen ist primär zutreffend? ^${prefix}-02`,
        'type: single-choice',
        'points: 1',
        '',
        '- [ ] Falsche Option A',
        '- [x] Richtige Antwort B',
        '- [ ] Falsche Option C',
        '- [ ] Falsche Option D',
        '',
        '> [!explanation]',
        '> Didaktische Erklärung zur richtigen Option B.',
        '',
        '---',
        ''
    ].join('\n');
}

export function generateSampleExamNote(
    module: string,
    title: string,
    timeLimitMinutes: number = 90,
    passingScore: number = 75
): string {
    const cleanMod = (module || 'Allgemein').toLowerCase().replace(/[^a-z0-9]/g, '');
    const prefix = cleanMod ? `q-${cleanMod}` : 'q';
    return [
        generateExamFrontmatter(module, title, timeLimitMinutes, passingScore),
        `## Multiple-Choice Aufgabe zu ${title || 'diesem Thema'} ^${prefix}-01`,
        'type: multiple-choice',
        'points: 5',
        '',
        '- [x] Dies ist eine wahre Aussage.',
        '- [ ] Dies ist eine falsche Aussage.',
        '- [x] Eine weitere zutreffende Aussage.',
        '- [ ] Ein unzutreffender Distraktor.',
        '- [ ] Noch eine falsche Aussage.',
        '',
        '> [!explanation]',
        '> Didaktische Erklärung zur Klausuraufgabe.',
        '',
        '---',
        '',
        `## Erläutere das zentrale Konzept von ${title || 'diesem Thema'} ^${prefix}-02`,
        'type: freetext',
        'points: 3',
        '',
        'Musterloesung:',
        'Musterantwort und Erwartungshorizont zur Klausuraufgabe.',
        '',
        'Kriterien:',
        '1. Definition des Kernkonzepts genannt (1P)',
        '2. Ursachen oder Zusammenhänge präzise erläutert (1P)',
        '3. Mindestens ein konkretes Beispiel genannt (1P)',
        '',
        '> [!explanation]',
        '> Bewertungsmaßstab und didaktische Hinweise.',
        '',
        '---',
        ''
    ].join('\n');
}
