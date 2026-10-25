import confetti from 'canvas-confetti';

export class ConfettiTrigger {
    /**
     * Fires celebration confetti based on percentage achieved.
     * Complies with Modul 4.3:
     * - Score >= 60%: Standard-Konfetti-Burst (100 Partikel, Spread: 70°)
     * - Score >= 90%: Großes zweistufiges Feuerwerk mit goldenen Akzenten
     */
    public static fire(percentage: number, enabled: boolean = true): void {
        if (!enabled || percentage < 60) return;

        try {
            if (percentage >= 90) {
                this.fireGoldFireworks();
            } else {
                this.fireStandardBurst();
            }
        } catch (e) {
            console.error('Error triggering canvas confetti:', e);
        }
    }

    /**
     * Triggers a manual test burst for settings verification.
     */
    public static testBurst(celebratory: boolean = true): void {
        try {
            if (celebratory) {
                this.fireGoldFireworks();
            } else {
                this.fireStandardBurst();
            }
        } catch (e) {
            console.error('Error triggering test confetti:', e);
        }
    }

    private static fireStandardBurst(): void {
        void confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            zIndex: 99999,
            disableForReducedMotion: true
        });
    }

    private static fireGoldFireworks(): void {
        const count = 200;
        const defaults = {
            origin: { y: 0.7 },
            zIndex: 99999,
            disableForReducedMotion: true
        };

        function fire(particleRatio: number, opts: confetti.Options) {
            void confetti({
                ...defaults,
                ...opts,
                particleCount: Math.floor(count * particleRatio)
            });
        }

        // Two-stage burst with gold & vibrant celebratory colors
        fire(0.25, {
            spread: 26,
            startVelocity: 55,
            colors: ['#FFD700', '#FFA500', '#FFFFFF']
        });
        fire(0.2, {
            spread: 60,
            colors: ['#FFD700', '#60A5FA', '#34D399']
        });
        fire(0.35, {
            spread: 100,
            decay: 0.91,
            scalar: 0.8,
            colors: ['#FFD700', '#F59E0B', '#E11D48']
        });
        fire(0.1, {
            spread: 120,
            startVelocity: 25,
            decay: 0.92,
            colors: ['#FFD700', '#FCD34D']
        });
        fire(0.1, {
            spread: 120,
            startVelocity: 45,
            colors: ['#FFD700', '#10B981', '#6366F1']
        });
    }
}
