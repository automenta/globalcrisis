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

  // Method to play specific event sounds
  public playEventSound(eventType: EventType, pan: number = 0): void {
    if (this.context.state === 'suspended') {
      this.context.resume().catch(err => console.error("Error resuming audio context for event sound:", err));
    }
    if (this.context.state === 'closed') return;

    const effectivePan = Math.max(-1, Math.min(1, pan));
    const currentTime = this.context.currentTime;

    const panner = this.context.createStereoPanner();
    panner.pan.setValueAtTime(effectivePan, currentTime);
    panner.connect(this.context.destination);

    switch (eventType) {
      case EventType.NUCLEAR_STRIKE:
        // Low rumble, followed by a sharp crack and decaying noise
        const rumbleOsc = this.context.createOscillator();
        const rumbleGain = this.context.createGain();
        rumbleOsc.type = 'sawtooth';
        rumbleOsc.frequency.setValueAtTime(30, currentTime);
        rumbleOsc.frequency.exponentialRampToValueAtTime(20, currentTime + 0.8);
        rumbleGain.gain.setValueAtTime(0.0, currentTime);
        rumbleGain.gain.linearRampToValueAtTime(0.2, currentTime + 0.2); // Fade in
        rumbleGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 1.5);
        rumbleOsc.connect(rumbleGain).connect(panner);
        rumbleOsc.start(currentTime);
        rumbleOsc.stop(currentTime + 1.5);

        // Sharp crack (noise burst)
        const crackSource = this.context.createBufferSource();
        const crackBuffer = this.context.createBuffer(1, this.context.sampleRate * 0.2, this.context.sampleRate);
        const crackData = crackBuffer.getChannelData(0);
        for (let i = 0; i < crackData.length; i++) {
          crackData[i] = Math.random() * 2 - 1; // White noise
        }
        crackSource.buffer = crackBuffer;
        const crackGain = this.context.createGain();
        crackGain.gain.setValueAtTime(0.3, currentTime + 0.3);
        crackGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.5);
        crackSource.connect(crackGain).connect(panner);
        crackSource.start(currentTime + 0.3); // Delayed crack
        break;

      case EventType.PANDEMIC: // Or BIOLOGICAL_WEAPON
        // Eerie, unsettling rising sine wave with slight detuning/vibrato
        const pandemicOsc1 = this.context.createOscillator();
        const pandemicOsc2 = this.context.createOscillator();
        const pandemicGain = this.context.createGain();
        pandemicOsc1.type = 'sine';
        pandemicOsc2.type = 'sine';
        pandemicOsc1.frequency.setValueAtTime(300, currentTime);
        pandemicOsc1.frequency.linearRampToValueAtTime(330, currentTime + 2.5);
        pandemicOsc2.frequency.setValueAtTime(303, currentTime); // Slightly detuned
        pandemicOsc2.frequency.linearRampToValueAtTime(335, currentTime + 2.5);

        pandemicGain.gain.setValueAtTime(0, currentTime);
        pandemicGain.gain.linearRampToValueAtTime(0.07, currentTime + 0.5);
        pandemicGain.gain.linearRampToValueAtTime(0, currentTime + 2.5);

        pandemicOsc1.connect(pandemicGain);
        pandemicOsc2.connect(pandemicGain);
        pandemicGain.connect(panner);
        pandemicOsc1.start(currentTime);
        pandemicOsc2.start(currentTime);
        pandemicOsc1.stop(currentTime + 2.5);
        pandemicOsc2.stop(currentTime + 2.5);
        break;

      case EventType.ECONOMIC_COLLAPSE:
        // Series of falling tones, metallic clang
        const toneFallBaseFreq = 600;
        for (let i = 0; i < 4; i++) {
          const osc = this.context.createOscillator();
          const gain = this.context.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(toneFallBaseFreq - i * 80, currentTime + i * 0.15);
          osc.frequency.exponentialRampToValueAtTime(toneFallBaseFreq - i * 80 - 100, currentTime + i * 0.15 + 0.3);
          gain.gain.setValueAtTime(0.08, currentTime + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, currentTime + i * 0.15 + 0.3);
          osc.connect(gain).connect(panner);
          osc.start(currentTime + i * 0.15);
          osc.stop(currentTime + i * 0.15 + 0.3);
        }
        // Metallic clang (using noise and BPF)
        const clangSource = this.context.createBufferSource();
        const clangBuffer = this.context.createBuffer(1, this.context.sampleRate * 0.8, this.context.sampleRate);
        const clangData = clangBuffer.getChannelData(0);
        for (let i = 0; i < clangData.length; i++) clangData[i] = Math.random() * 2 - 1;
        clangSource.buffer = clangBuffer;

        const clangBpf = this.context.createBiquadFilter();
        clangBpf.type = 'bandpass';
        clangBpf.frequency.setValueAtTime(1200, currentTime + 0.6);
        clangBpf.Q.value = 5;

        const clangGain = this.context.createGain();
        clangGain.gain.setValueAtTime(0.15, currentTime + 0.6);
        clangGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 1.4);
        clangSource.connect(clangBpf).connect(clangGain).connect(panner);
        clangSource.start(currentTime + 0.6);
        break;

      case EventType.ROGUE_AI:
        // Glitchy, distorted digital sounds with a low, menacing pulse
        const glitchPulse = this.context.createOscillator();
        const glitchPulseGain = this.context.createGain();
        glitchPulse.type = 'square';
        glitchPulse.frequency.setValueAtTime(50, currentTime);
        glitchPulseGain.gain.setValueAtTime(0.05, currentTime);
        glitchPulseGain.gain.linearRampToValueAtTime(0.05, currentTime + 2.0); // Pulsate slightly
        glitchPulseGain.gain.setValueAtTime(0.0, currentTime+2.01); // Quick stop
        glitchPulse.connect(glitchPulseGain).connect(panner);
        glitchPulse.start(currentTime);
        glitchPulse.stop(currentTime + 2.01);

        // Glitches (short noise bursts with rapid pitch changes)
        for (let i = 0; i < 5; i++) {
          const glitchOsc = this.context.createOscillator();
          const glitchGain = this.context.createGain();
          glitchOsc.type = Math.random() > 0.5 ? 'sawtooth' : 'square';
          const startFreq = 500 + Math.random() * 1000;
          glitchOsc.frequency.setValueAtTime(startFreq, currentTime + i * 0.15 + Math.random() * 0.1);
          glitchOsc.frequency.exponentialRampToValueAtTime(startFreq / (2 + Math.random()*3) , currentTime + i * 0.15 + Math.random() * 0.1 + 0.05);
          glitchGain.gain.setValueAtTime(0.06, currentTime + i * 0.15 + Math.random() * 0.1);
          glitchGain.gain.exponentialRampToValueAtTime(0.001, currentTime + i * 0.15 + Math.random() * 0.1 + 0.05);
          glitchOsc.connect(glitchGain).connect(panner);
          glitchOsc.start(currentTime + i * 0.15 + Math.random() * 0.1);
          glitchOsc.stop(currentTime + i * 0.15 + Math.random() * 0.1 + 0.05);
        }
        break;

      case EventType.ELECTROMAGNETIC_PULSE:
        // Quick, high-frequency burst with a sub-bass click and decaying static
        const empBurstOsc = this.context.createOscillator();
        const empBurstGain = this.context.createGain();
        empBurstOsc.type = 'triangle';
        empBurstOsc.frequency.setValueAtTime(2000, currentTime);
        empBurstOsc.frequency.exponentialRampToValueAtTime(8000, currentTime + 0.05);
        empBurstGain.gain.setValueAtTime(0.1, currentTime);
        empBurstGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.1);
        empBurstOsc.connect(empBurstGain).connect(panner);
        empBurstOsc.start(currentTime);
        empBurstOsc.stop(currentTime + 0.1);

        const subClickOsc = this.context.createOscillator();
        const subClickGain = this.context.createGain();
        subClickOsc.type = 'sine';
        subClickOsc.frequency.setValueAtTime(40,currentTime);
        subClickGain.gain.setValueAtTime(0.2, currentTime);
        subClickGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.08);
        subClickOsc.connect(subClickGain).connect(panner);
        subClickOsc.start(currentTime);
        subClickOsc.stop(currentTime + 0.08);

        // Decaying static
        const staticSource = this.context.createBufferSource();
        const staticBuffer = this.context.createBuffer(1, this.context.sampleRate * 1.0, this.context.sampleRate);
        const staticData = staticBuffer.getChannelData(0);
        for (let i = 0; i < staticData.length; i++) staticData[i] = Math.random() * 0.4 - 0.2; // Quieter white noise
        staticSource.buffer = staticBuffer;
        const staticGain = this.context.createGain();
        staticGain.gain.setValueAtTime(0.0, currentTime + 0.05); // Start static slightly after burst
        staticGain.gain.linearRampToValueAtTime(0.07, currentTime + 0.1);
        staticGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 1.0);
        staticSource.connect(staticGain).connect(panner);
        staticSource.start(currentTime + 0.05);
        break;

      // Default case for other event types or if specific sound not designed
      default:
        this.playAlert('warning', effectivePan); // Fallback to generic warning
        break;
    }
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
