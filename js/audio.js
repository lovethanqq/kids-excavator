// Audio Manager using Web Audio API & Web Speech API
// Designed specifically for toddler interactions: zero external dependencies, 100% reliable offline!

class SoundManager {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.engineOsc = null;
        this.engineGain = null;
        this.isEngineRunning = false;
        this.synth = window.speechSynthesis || null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.engineGain) {
            this.engineGain.gain.setValueAtTime(this.isMuted ? 0 : 0.05, this.ctx ? this.ctx.currentTime : 0);
        }
        if (this.isMuted && this.synth) {
            this.synth.cancel();
        }
        return this.isMuted;
    }

    // --- 1. 柴油机怠速/加速突突突声 ---
    startEngine() {
        if (this.isEngineRunning || !this.ctx || this.isMuted) return;
        try {
            const t = this.ctx.currentTime;
            
            // Oscillator for low diesel rumble
            this.engineOsc = this.ctx.createOscillator();
            this.engineOsc.type = 'sawtooth';
            this.engineOsc.frequency.setValueAtTime(22, t);

            // Filter to muffle into a deep engine sound
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(140, t);

            // Tremolo / chug modulation (the "putt-putt-putt" pulse)
            const tremolo = this.ctx.createOscillator();
            tremolo.type = 'square';
            tremolo.frequency.setValueAtTime(8, t); // 8 chugs per second

            const tremoloGain = this.ctx.createGain();
            tremoloGain.gain.setValueAtTime(0.4, t);
            tremolo.connect(tremoloGain.gain);

            this.engineGain = this.ctx.createGain();
            this.engineGain.gain.setValueAtTime(this.isMuted ? 0 : 0.06, t);

            this.engineOsc.connect(filter);
            filter.connect(tremoloGain);
            tremoloGain.connect(this.engineGain);
            this.engineGain.connect(this.ctx.destination);

            this.engineOsc.start();
            tremolo.start();
            this.isEngineRunning = true;
            this.engineTremolo = tremolo;
        } catch (e) {
            console.log("Audio not allowed yet:", e);
        }
    }

    setEngineRev(isReving) {
        if (!this.engineOsc || !this.ctx || this.isMuted) return;
        const t = this.ctx.currentTime;
        if (isReving) {
            // Speed up engine
            this.engineOsc.frequency.linearRampToValueAtTime(45, t + 0.3);
            if (this.engineTremolo) this.engineTremolo.frequency.linearRampToValueAtTime(16, t + 0.3);
            this.engineGain.gain.linearRampToValueAtTime(0.12, t + 0.2);
        } else {
            // Return to idle
            this.engineOsc.frequency.linearRampToValueAtTime(22, t + 0.5);
            if (this.engineTremolo) this.engineTremolo.frequency.linearRampToValueAtTime(8, t + 0.5);
            this.engineGain.gain.linearRampToValueAtTime(0.06, t + 0.5);
        }
    }

    // --- 2. 挖掘机喇叭声 (哔哔！) ---
    playHorn() {
        if (this.isMuted) return;
        this.init();
        const t = this.ctx.currentTime;
        [440, 554].forEach(freq => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);

            gain.gain.setValueAtTime(0.25, t);
            gain.gain.setValueAtTime(0.25, t + 0.18);
            gain.gain.linearRampToValueAtTime(0.001, t + 0.22);
            gain.gain.setValueAtTime(0.25, t + 0.26);
            gain.gain.setValueAtTime(0.25, t + 0.44);
            gain.gain.linearRampToValueAtTime(0.001, t + 0.5);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.55);
        });
    }

    // --- 3. 液压臂运动声 (哧--吱吱) ---
    playHydraulic() {
        if (this.isMuted) return;
        this.init();
        const t = this.ctx.currentTime;
        
        // Noise generation for hiss
        const bufferSize = this.ctx.sampleRate * 0.6;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.linearRampToValueAtTime(1400, t + 0.4);
        filter.Q.setValueAtTime(3, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(t);
    }

    // --- 4. 挖斗铲入泥土声 (嘭-沙沙沙) ---
    playDirtDig() {
        if (this.isMuted) return;
        this.init();
        const t = this.ctx.currentTime;

        // Thud component
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);
        oscGain.gain.setValueAtTime(0.3, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.35);

        // Gravel crunch noise
        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, t);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.18, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(t);
    }

    // --- 5. 挖对数字清脆欢呼声 (金币/钢琴和弦) ---
    playSuccess() {
        if (this.isMuted) return;
        this.init();
        const t = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + idx * 0.08);

            const startT = t + idx * 0.08;
            gain.gain.setValueAtTime(0.25, startT);
            gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.5);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(startT);
            osc.stop(startT + 0.6);
        });
    }

    // --- 6. 点错提示音 (友好的轻柔摇动音符，不刺耳不吓小孩) ---
    playOops() {
        if (this.isMuted) return;
        this.init();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(260, t + 0.25);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    // --- 7. 通关大烟花连响声 ---
    playCelebrationFanfare() {
        if (this.isMuted) return;
        this.init();
        const melody = [
            { f: 523.25, d: 0.15 },
            { f: 523.25, d: 0.15 },
            { f: 523.25, d: 0.15 },
            { f: 659.25, d: 0.35 },
            { f: 783.99, d: 0.2 },
            { f: 1046.5, d: 0.6 }
        ];
        let offset = 0;
        melody.forEach(note => {
            const t = this.ctx.currentTime + offset;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.f, t);
            gain.gain.setValueAtTime(0.28, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + note.d);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + note.d + 0.05);
            offset += note.d * 0.9;
        });
    }

    // --- 8. 中文自然语音朗读 (Web Speech API) ---
    speak(text) {
        if (this.isMuted || !this.synth) return;
        try {
            this.synth.cancel(); // 取消上一句
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = 'zh-CN';
            utter.rate = 0.92; // 稍慢一点，3岁容易听懂
            utter.pitch = 1.25; // 稍微偏高、活泼亲和的语气

            // 优先匹配中文普通话声音
            const voices = this.synth.getVoices();
            const zhVoice = voices.find(v => v.lang.includes('zh') || v.lang.includes('cmn'));
            if (zhVoice) {
                utter.voice = zhVoice;
            }
            this.synth.speak(utter);
        } catch (e) {
            console.log("Speech synthesis error:", e);
        }
    }
}

window.soundManager = new SoundManager();
