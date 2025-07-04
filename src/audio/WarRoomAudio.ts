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
import { GameState, EventType } from '../engine/GameEngine'; // Import GameState and EventType

export class WarRoomAudio implements AudioSystem {
  public context: AudioContext;
  private masterAmbientGain: GainNode; // Overall gain for all ambient layers

  // Base Hum Layer
  private baseHumOsc: OscillatorNode | null = null;
  private baseHumGain: GainNode | null = null;

  // Tension Layer (based on stability)
  private tensionOsc: OscillatorNode | null = null;
  private tensionGain: GainNode | null = null;

  // Crisis Layer (based on critical events)
  private crisisNoiseOsc: OscillatorNode | null = null; // For generating noise
  private crisisBiquadFilter: BiquadFilterNode | null = null; // To make noise less harsh
  private crisisPulseLFO: OscillatorNode | null = null; // LFO to create pulsing effect
  private crisisPulseGain: GainNode | null = null; // Modulated by LFO
  private crisisMasterGain: GainNode | null = null; // Overall gain for this layer, controlled by event count

  private isAmbientPlaying: boolean = false;

  constructor() {
    this.context = new AudioContext();
    this.masterAmbientGain = this.context.createGain();
    this.masterAmbientGain.connect(this.context.destination);
    this.masterAmbientGain.gain.value = 0.15; // Overall ambient volume

    // Initialize gain nodes for each layer
    this.baseHumGain = this.context.createGain();
    this.baseHumGain.connect(this.masterAmbientGain);

    this.tensionGain = this.context.createGain();
    this.tensionGain.connect(this.masterAmbientGain);

    this.crisisMasterGain = this.context.createGain();
    this.crisisMasterGain.connect(this.masterAmbientGain);

    // Setup for crisis layer's pulsed noise
    this.crisisPulseGain = this.context.createGain();
    this.crisisBiquadFilter = this.context.createBiquadFilter();
    this.crisisBiquadFilter.type = 'lowpass';
    this.crisisBiquadFilter.frequency.value = 800; // Cut off high frequencies from noise
    this.crisisPulseGain.connect(this.crisisBiquadFilter);
    this.crisisBiquadFilter.connect(this.crisisMasterGain);

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
      // It might take a moment for the context to resume, so subsequent calls might be needed
      // or ideally, user interaction should trigger resume.
    }
    if (this.isAmbientPlaying || this.context.state !== 'running') return;

    // --- Base Hum Layer ---
    if (this.baseHumGain) {
        this.baseHumOsc = this.context.createOscillator();
        this.baseHumOsc.type = 'sawtooth';
        this.baseHumOsc.frequency.setValueAtTime(40, this.context.currentTime); // Deep hum
        this.baseHumGain.gain.setValueAtTime(0.3, this.context.currentTime); // Adjust volume as needed
        this.baseHumOsc.connect(this.baseHumGain);
        this.baseHumOsc.start();
    }

    // --- Tension Layer ---
    if (this.tensionGain) {
        this.tensionOsc = this.context.createOscillator();
        this.tensionOsc.type = 'triangle';
        this.tensionOsc.frequency.setValueAtTime(120, this.context.currentTime); // Mid-frequency
        // Initial gain will be set by updateAmbient, start low
        this.tensionGain.gain.setValueAtTime(0, this.context.currentTime);
        this.tensionOsc.connect(this.tensionGain);
        this.tensionOsc.start();
    }

    // --- Crisis Layer (Pulsing Noise) ---
    if (this.crisisMasterGain && this.crisisPulseGain && this.crisisBiquadFilter) {
        // Noise Source (approximated with a square wave for broad spectrum)
        this.crisisNoiseOsc = this.context.createOscillator();
        this.crisisNoiseOsc.type = 'square';
        this.crisisNoiseOsc.frequency.setValueAtTime(20, this.context.currentTime); // Low freq square wave has rich harmonics
        this.crisisNoiseOsc.connect(this.crisisPulseGain);
        this.crisisNoiseOsc.start();

        // LFO for pulsing effect
        this.crisisPulseLFO = this.context.createOscillator();
        this.crisisPulseLFO.type = 'sine';
        this.crisisPulseLFO.frequency.setValueAtTime(0.5, this.context.currentTime); // Slow pulse (0.5 Hz = 2 seconds per pulse)

        // LFO modulates the gain of crisisPulseGain
        // The LFO output is typically -1 to 1. We need 0 to 1 for gain.
        // So, we can use another GainNode to scale/offset LFO output or connect LFO directly if gain allows negative.
        // For simplicity, LFO output will be scaled by crisisPulseGain itself.
        // crisisPulseGain's gain will be controlled by LFO.
        // This requires crisisPulseGain to be an AudioParam.
        this.crisisPulseLFO.connect(this.crisisPulseGain.gain); // LFO output directly controls gain value
        this.crisisPulseLFO.start();

        // Initial gain for the overall crisis layer (controlled by events)
        this.crisisMasterGain.gain.setValueAtTime(0, this.context.currentTime);
    }

    this.isAmbientPlaying = true;
  }

  public updateAmbient(gameState: GameState): void {
    if (!this.isAmbientPlaying || this.context.state !== 'running') return;

    const currentTime = this.context.currentTime;

    // Update Tension Layer Gain (inversely proportional to stability)
    if (this.tensionGain) {
      const stabilityFactor = Math.max(0, Math.min(1, gameState.globalStability / 100));
      // Lower stability = higher gain. Max gain 0.25 for tension.
      const tensionVolume = (1 - stabilityFactor) * 0.25;
      this.tensionGain.gain.setTargetAtTime(tensionVolume, currentTime, 0.1); // Smooth transition
    }

    // Update Crisis Layer Gain (proportional to number of critical events)
    if (this.crisisMasterGain) {
      const criticalEventTypes: EventType[] = [
        EventType.NUCLEAR_STRIKE, EventType.PANDEMIC, EventType.ECONOMIC_COLLAPSE,
        EventType.ROGUE_AI, EventType.CLIMATE_DISASTER, EventType.NUCLEAR_MELTDOWN,
        EventType.INTERDIMENSIONAL
      ];
      const criticalEventCount = gameState.activeEvents.filter(event =>
        criticalEventTypes.includes(event.type) && event.active
      ).length;

      // Map critical event count to gain. Max gain 0.4 for crisis.
      let crisisVolume = Math.min(criticalEventCount * 0.08, 0.4);
      this.crisisMasterGain.gain.setTargetAtTime(crisisVolume, currentTime, 0.1);

      // Adjust LFO frequency for crisis pulse based on critical events
      if (this.crisisPulseLFO) {
        const pulseRate = 0.5 + Math.min(criticalEventCount * 0.2, 2.5); // Faster pulse with more events
        this.crisisPulseLFO.frequency.setTargetAtTime(pulseRate, currentTime, 0.2);
      }
    }
  }

  stopAmbient(): void {
    if (!this.isAmbientPlaying || this.context.state === 'closed') return;

    const currentTime = this.context.currentTime;
    const fadeOutTime = currentTime + 0.2;

    if (this.baseHumOsc) {
      this.baseHumGain?.gain.setTargetAtTime(0, currentTime, 0.05);
      this.baseHumOsc.stop(fadeOutTime);
      this.baseHumOsc.disconnect();
      this.baseHumOsc = null;
    }
    if (this.tensionOsc) {
      this.tensionGain?.gain.setTargetAtTime(0, currentTime, 0.05);
      this.tensionOsc.stop(fadeOutTime);
      this.tensionOsc.disconnect();
      this.tensionOsc = null;
    }
    if (this.crisisNoiseOsc) {
      this.crisisMasterGain?.gain.setTargetAtTime(0, currentTime, 0.05);
      this.crisisNoiseOsc.stop(fadeOutTime);
      this.crisisNoiseOsc.disconnect();
      this.crisisNoiseOsc = null;
    }
    if (this.crisisPulseLFO) {
      this.crisisPulseLFO.stop(fadeOutTime);
      this.crisisPulseLFO.disconnect();
      this.crisisPulseLFO = null;
    }
    // Note: GainNodes (baseHumGain, tensionGain, crisisMasterGain, crisisPulseGain) are persistent and reused.
    // BiquadFilter (crisisBiquadFilter) is also persistent.

    this.isAmbientPlaying = false;
  }

  dispose(): void {
    this.stopAmbient();
    if (this.context.state !== 'closed') {
      this.context.close().catch(err => console.error("Error closing audio context:", err));
    }
  }
}
