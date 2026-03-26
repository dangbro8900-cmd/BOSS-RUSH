export class SoundEngine {
  ctx: AudioContext | null = null;
  bgmInterval: any = null;
  currentPhase = 0;
  step = 0;
  nextNoteTime = 0;
  lookahead = 25.0; // ms
  scheduleAheadTime = 0.1; // s
  masterGain: GainNode | null = null;
  delayNode: DelayNode | null = null;
  delayFeedback: GainNode | null = null;
  volume: number = 0.6;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);

      this.delayNode = this.ctx.createDelay();
      this.delayNode.delayTime.value = 0.3214; // Dotted 8th note at 140 BPM
      
      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.value = 0.4; // 40% feedback
      
      const delayFilter = this.ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 2000;

      this.delayNode.connect(delayFilter);
      delayFilter.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);
      delayFilter.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(vol: number) {
    this.volume = vol;
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  // Convert MIDI note to frequency
  mtof(note: number) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  playSynth(freq: number, type: OscillatorType, time: number, attack: number, decay: number, sustain: number, release: number, vol: number, detune: number = 0, useDelay: boolean = false) {
    if (!this.ctx) return;
    
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 6, time);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.5, time + decay);

    const sustainLevel = Math.max(sustain * vol, 0.001);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(vol, time + attack);
    gain.gain.exponentialRampToValueAtTime(sustainLevel, time + attack + decay);
    gain.gain.setValueAtTime(sustainLevel, time + attack + decay + 0.1); // Hold
    gain.gain.exponentialRampToValueAtTime(0.001, time + attack + decay + 0.1 + release);

    const osc1 = this.ctx.createOscillator();
    osc1.type = type;
    osc1.frequency.setValueAtTime(freq, time);
    osc1.connect(filter);
    osc1.start(time);
    osc1.stop(time + attack + decay + 0.1 + release);

    if (detune > 0) {
      const osc2 = this.ctx.createOscillator();
      osc2.type = type;
      osc2.frequency.setValueAtTime(freq, time);
      osc2.detune.value = detune;
      osc2.connect(filter);
      osc2.start(time);
      osc2.stop(time + attack + decay + 0.1 + release);
      
      const osc3 = this.ctx.createOscillator();
      osc3.type = type;
      osc3.frequency.setValueAtTime(freq, time);
      osc3.detune.value = -detune;
      osc3.connect(filter);
      osc3.start(time);
      osc3.stop(time + attack + decay + 0.1 + release);
    }

    filter.connect(gain);
    
    if (useDelay && this.delayNode && this.masterGain) {
      gain.connect(this.masterGain);
      gain.connect(this.delayNode);
    } else if (this.masterGain) {
      gain.connect(this.masterGain);
    }
  }

  playDrum(type: 'kick' | 'snare' | 'hihat' | 'crash', time: number, vol: number) {
    if (!this.ctx) return;
    
    if (type === 'kick') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
      osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
      osc.connect(gain);
      if (this.masterGain) gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + 0.5);
    } else {
      const bufferSize = this.ctx.sampleRate * (type === 'crash' ? 2.0 : 0.5);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      if (type === 'hihat') {
        filter.type = 'highpass';
        filter.frequency.value = 8000;
        gain.gain.setValueAtTime(vol * 0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
      } else if (type === 'snare') {
        filter.type = 'bandpass';
        filter.frequency.value = 2000;
        filter.Q.value = 0.5;
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
        
        const bodyOsc = this.ctx.createOscillator();
        const bodyGain = this.ctx.createGain();
        bodyOsc.frequency.setValueAtTime(200, time);
        bodyOsc.frequency.exponentialRampToValueAtTime(100, time + 0.1);
        bodyGain.gain.setValueAtTime(vol * 0.8, time);
        bodyGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
        bodyOsc.connect(bodyGain);
        if (this.masterGain) bodyGain.connect(this.masterGain);
        bodyOsc.start(time);
        bodyOsc.stop(time + 0.2);
      } else if (type === 'crash') {
        filter.type = 'highpass';
        filter.frequency.value = 4000;
        gain.gain.setValueAtTime(vol * 0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 1.5);
      }

      noise.connect(filter);
      filter.connect(gain);
      if (this.masterGain) gain.connect(this.masterGain);
      noise.start(time);
    }
  }

  scheduler() {
    if (!this.ctx) return;
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.step, this.nextNoteTime);
      this.nextNote();
    }
  }

  nextNote() {
    const secondsPerBeat = 60.0 / 140; // 140 BPM
    this.nextNoteTime += 0.25 * secondsPerBeat; // 16th notes
    this.step = (this.step + 1) % 32;
  }

  scheduleNote(step: number, time: number) {
    const phase = this.currentPhase;
    
    // Cyberpunk / Synthwave progression: Cm - Ab - Fm - G
    // C minor scale
    
    // --- DRUMS ---
    if (phase >= 1) {
      // Four on the floor kick
      if (step % 4 === 0) this.playDrum('kick', time, 0.8);
      
      // Snare on 2 and 4 (steps 4, 12, 20, 28)
      if (phase >= 2 && step % 8 === 4) {
        this.playDrum('snare', time, 0.6);
      }
      
      // Hi-hats
      if (phase >= 2) {
        if (step % 2 === 0) {
          this.playDrum('hihat', time, 0.3); // 8th notes
        } else if (phase >= 3) {
          this.playDrum('hihat', time, 0.15); // 16th notes in phase 3
        }
        // Open hat on the off-beat
        if (step % 4 === 2) {
          this.playDrum('hihat', time, 0.4); 
        }
      }
      
      // Crash on the first beat of the sequence in phase 3
      if (phase >= 3 && step === 0) {
        this.playDrum('crash', time, 0.5);
      }
    }

    // --- BASSLINE ---
    // Driving 16th note bassline
    const rootNotes = [36, 36, 36, 36, 32, 32, 32, 32, 29, 29, 29, 29, 31, 31, 31, 31]; // C2, Ab1, F1, G1
    const rootIndex = Math.floor(step / 8); // Changes every 8 steps (half bar)
    const baseNote = rootNotes[rootIndex * 4]; 
    
    if (phase >= 1) {
      // Phase 1: Sparse, pulsing bass
      if (step % 4 === 0 || step % 4 === 3) {
        this.playSynth(this.mtof(baseNote), 'sawtooth', time, 0.01, 0.1, 0.2, 0.1, 0.4, 10, false);
      }
    }
    
    if (phase >= 2) {
      // Phase 2 & 3: Driving 16th note bass
      // Octave jumps for groove
      const octave = (step % 4 === 2) ? 12 : 0;
      this.playSynth(this.mtof(baseNote + octave), 'square', time, 0.01, 0.1, 0, 0.05, 0.25, 5, false);
    }

    // --- CHORDS / PADS ---
    if (phase >= 2) {
      // Stab chords on the off-beats
      if (step % 8 === 2 || step % 8 === 5) {
        const chordOffsets = [
          [0, 3, 7],    // Cm
          [0, 4, 7],    // Ab (relative to Ab)
          [0, 3, 7],    // Fm (relative to F)
          [0, 4, 7]     // G (relative to G)
        ];
        const chord = chordOffsets[rootIndex];
        const chordRoot = baseNote + 12; // C3 etc
        
        chord.forEach(offset => {
          this.playSynth(this.mtof(chordRoot + offset), 'sawtooth', time, 0.02, 0.15, 0.1, 0.2, 0.15, 8, true);
        });
      }
    }

    // --- ARPEGGIOS & LEADS ---
    if (phase >= 3) {
      // 16th note arpeggio
      const arpPatterns = [
        [48, 51, 55, 60, 55, 51, 48, 51], // Cm: C3, Eb3, G3, C4
        [44, 48, 51, 56, 51, 48, 44, 48], // Ab: Ab2, C3, Eb3, Ab3
        [41, 44, 48, 53, 48, 44, 41, 44], // Fm: F2, Ab2, C3, F3
        [43, 47, 50, 55, 50, 47, 43, 47]  // G: G2, B2, D3, G3
      ];
      const arp = arpPatterns[rootIndex];
      const arpNote = arp[step % 8] + 12; // Up an octave
      
      this.playSynth(this.mtof(arpNote), 'sawtooth', time, 0.01, 0.05, 0, 0.05, 0.1, 0, true);
      
      // High soaring lead melody
      const leadMelody = [
        72, 0, 0, 75, 0, 0, 79, 0,  // C5, Eb5, G5
        80, 0, 0, 79, 0, 0, 75, 0,  // Ab5, G5, Eb5
        72, 0, 0, 68, 0, 0, 67, 0,  // C5, Ab4, G4
        67, 0, 68, 0, 72, 0, 74, 0   // G4, Ab4, C5, D5
      ];
      
      const leadNote = leadMelody[step];
      if (leadNote > 0) {
        this.playSynth(this.mtof(leadNote), 'square', time, 0.05, 0.2, 0.4, 0.4, 0.15, 12, true);
      }
    }
  }

  startBGMPhase(phase: number) {
    this.init();
    if (this.currentPhase === phase) return;
    this.currentPhase = phase;
    
    if (!this.bgmInterval) {
      if (this.ctx) this.nextNoteTime = this.ctx.currentTime + 0.1;
      this.bgmInterval = setInterval(() => this.scheduler(), this.lookahead);
    }
  }

  stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.step = 0;
    this.currentPhase = 0;
  }

  // SFX
  playSFX(freq: number, type: OscillatorType, duration: number, vol: number) {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
    osc.connect(gain);
    if (this.masterGain) gain.connect(this.masterGain);
    else gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  }

  playPlayerShoot() { this.playSFX(800, 'square', 0.1, 0.05); }
  playPlayerMelee() { this.playDrum('snare', this.ctx?.currentTime || 0, 0.3); }
  playPlayerDash() { this.playDrum('hihat', this.ctx?.currentTime || 0, 0.5); }
  playPlayerHit() { this.playSFX(100, 'sawtooth', 0.3, 0.4); }
  
  playPlayerZ() { this.playSFX(600, 'square', 0.2, 0.1); }
  playPlayerX() { this.playSFX(1200, 'sine', 1.0, 0.2); }
  playPlayerUltimateCharge() { this.playSFX(400, 'sine', 1.0, 0.3); }
  playPlayerUltimateBoom() { 
    this.playSFX(50, 'sawtooth', 2.0, 0.8); 
    this.playDrum('kick', this.ctx?.currentTime || 0, 1.0);
  }

  playBossShoot() { this.playSFX(200, 'sawtooth', 0.1, 0.1); }
  playBossDash() { this.playSFX(150, 'square', 0.5, 0.3); }
  playBossHit() { this.playSFX(80, 'square', 0.1, 0.2); }
  playBossDie() { 
    this.playSFX(40, 'sawtooth', 3.0, 0.8);
    this.playDrum('kick', this.ctx?.currentTime || 0, 1.0);
  }
  playBossLaser() { this.playSFX(300, 'sawtooth', 1.0, 0.4); }
  playBossNuke() { this.playSFX(100, 'square', 2.0, 0.5); }
}
