export class SoundManager {
    private audioCtx: AudioContext | null = null;
    private enabled: boolean = true;
    private volume: number = 0.5;

    constructor(enabled: boolean = true, volume: number = 0.5) {
        this.enabled = enabled;
        this.volume = volume;
    }

    public updateSettings(enabled: boolean, volume: number): void {
        this.enabled = enabled;
        this.volume = Math.max(0, Math.min(1, volume));
    }

    private getContext(): AudioContext | null {
        if (!this.enabled || this.volume <= 0) return null;

        if (!this.audioCtx && typeof window !== 'undefined') {
            const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (AudioContextClass) {
                this.audioCtx = new AudioContextClass();
            }
        }

        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }

        return this.audioCtx;
    }

    /**
     * Plays a rich C-major chord (C5, E5, G5, C6) with linear attack and exponential decay on pass.
     */
    public playSuccessChord(): void {
        const ctx = this.getContext();
        if (!ctx) return;

        const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        const now = ctx.currentTime;
        const duration = 1.2;

        frequencies.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);

            // Stagger notes slightly for arpeggio effect
            const startTime = now + idx * 0.06;
            const noteDuration = duration - idx * 0.06;

            gain.gain.setValueAtTime(0.0001, startTime);
            gain.gain.linearRampToValueAtTime(0.2 * this.volume, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDuration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + noteDuration);
        });
    }

    /**
     * Plays a subtle descending sawtooth fail tone.
     */
    public playFailSound(): void {
        const ctx = this.getContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.4);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.18 * this.volume, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.45);
    }

    /**
     * Plays a crisp micro-click sound when checking an item.
     */
    public playClickSound(): void {
        const ctx = this.getContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);

        gain.gain.setValueAtTime(0.08 * this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.03);
    }

    public destroy(): void {
        if (this.audioCtx) {
            this.audioCtx.close().catch(() => {});
            this.audioCtx = null;
        }
    }
}
