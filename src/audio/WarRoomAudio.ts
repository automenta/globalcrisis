// src/audio/WarRoomAudio.ts

/**
 * Interface for a generic audio system.
 * This can be implemented by WarRoomAudio or other audio managers.
 */
export interface AudioSystem {
  context: AudioContext;
  playAlert: (type: 'warning' | 'critical' | 'success', pan?: number) => void;
  playAmbient: () => void;
  stopAmbient: () => void;
  dispose: () => void;
}

/**
 * Manages audio playback for the War Room interface, including alerts and ambient sounds.
 */
export class WarRoomAudio implements AudioSystem {
  public context: AudioContext;
  private ambientGain: GainNode;
  private ambientOscillator: OscillatorNode | null = null;

  constructor() {
    this.context = new AudioContext();
    this.ambientGain = this.context.createGain();
    this.ambientGain.connect(this.context.destination);
    this.ambientGain.gain.value = 0.1; // Default ambient volume
  }

  playAlert(type: 'warning' | 'critical' | 'success', pan: number = 0): void {
    if (this.context.state === 'suspended') {
      this.context.resume().catch(err => console.error("Error resuming audio context for alert:", err));
    }
    if (this.context.state === 'closed') return;

    const effectivePan = Math.max(-1, Math.min(1, pan));
    const frequencies: Record<typeof type, number[]> = {
      warning: [800, 1000],
      critical: [400, 600, 800],
      success: [600, 800, 1000],
    };
    const freqs = frequencies[type];
    const baseVolume = type === 'critical' ? 0.12 : 0.08;
    const delayIncrement = type === 'critical' ? 80 : 100;

    freqs.forEach((freq, i) => {
      setTimeout(() => {
        if (this.context.state === 'closed') return;
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        const panner = this.context.createStereoPanner();
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.context.destination);
        panner.pan.setValueAtTime(effectivePan, this.context.currentTime);
        osc.frequency.setValueAtTime(freq, this.context.currentTime);
        osc.type = 'sine';
        gain.gain.setValueAtTime(baseVolume, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.35);
        osc.start(this.context.currentTime);
        osc.stop(this.context.currentTime + 0.35);
      }, i * delayIncrement);
    });
  }

  playAmbient(): void {
    if (this.context.state === 'suspended') {
      this.context.resume().catch(err => console.error("Error resuming audio context for ambient:", err));
    }
    if (this.ambientOscillator || this.context.state === 'closed') return;

    this.ambientOscillator = this.context.createOscillator();
    this.ambientOscillator.type = 'sine';
    this.ambientOscillator.frequency.setValueAtTime(60, this.context.currentTime);
    this.ambientOscillator.connect(this.ambientGain);
    this.ambientOscillator.start();
  }

  stopAmbient(): void {
    if (this.ambientOscillator && this.context.state !== 'closed') {
      try {
        this.ambientOscillator.stop(this.context.currentTime);
        this.ambientOscillator.disconnect();
      } catch (e) {
        // console.warn("Error stopping ambient oscillator:", e);
      } finally {
        this.ambientOscillator = null;
      }
    }
  }

  dispose(): void {
    this.stopAmbient();
    if (this.context.state !== 'closed') {
      this.context.close().catch(err => console.error("Error closing audio context:", err));
    }
  }
}
