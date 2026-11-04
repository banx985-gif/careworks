// CAREWORKS sound (Milestone 38, bible §41) — plain data for core/AudioManager.js and core/SoundSynth.js. No audio files
// exist, so every sound is a code-made recipe: soft, warm and never alarming (a care home, not a hospital). A real file
// wins with no code change: assets/audio/<id>.mp3 with the same id (publish.ps1 writes the audio manifest).
// Sound starts only after the first tap (the browser rule). Every moment that has a sound also has its words and colour
// on screen, so nothing is lost with the sound off (tests/careworks/m38.test.mjs).
// PLACEHOLDERS (DECISIONS.md, M38): every recipe, and which moment plays which sound.
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const tone = (m, t, d, wave = 'triangle', v = 1, extra = {}) => ({ wave, f: hz(m), t, d, v, ...extra });
const sweep = (f, f2, t, d, wave = 'sine', v = 1, extra = {}) => ({ wave, f, f2, t, d, v, ...extra });
const arp = (notes, step, len, wave = 'triangle', v = 1, from = 0) => notes.map((m, i) => tone(m, from + i * step, len, wave, v));
const S = (group, layers, extra = {}) => ({ group, recipe: { layers, gain: extra.gain ?? 0.4, echo: extra.echo }, volume: extra.volume ?? 1 });
const ROOM = { delay: 0.12, feedback: 0.3, mix: 0.25 };

export const AUDIO_BASE = 'assets/audio/';
export const AUDIO_MANIFEST = 'assets/audio/manifest.json';

export const SOUNDS = {
  sfx_ui: S('ui', [sweep(820, 1100, 0, 0.04, 'sine')], { gain: 0.18 }),
  sfx_ui_back: S('ui', [sweep(1000, 700, 0, 0.06, 'sine', 0.9)], { gain: 0.16 }),
  sfx_bell: S('workshop', [tone(84, 0, 0.5, 'sine', 0.8), tone(79, 0.18, 0.6, 'sine', 0.6)], { gain: 0.3, echo: ROOM }), // a soft call-bell chime
  sfx_welcome: S('progression', arp([67, 71, 74], 0.1, 0.3, 'triangle', 0.7), { gain: 0.34, echo: ROOM }), // someone moves in
  sfx_alert: S('progression', [tone(72, 0, 0.22, 'sine', 0.8), tone(67, 0.22, 0.32, 'sine', 0.7)], { gain: 0.3 }), // a resident needs a look: gentle, two notes down
  sfx_incident: S('progression', [tone(64, 0, 0.3, 'triangle', 0.8), tone(64, 0.34, 0.3, 'triangle', 0.8), tone(60, 0.68, 0.45, 'triangle', 0.7)], { gain: 0.32 }),
  sfx_birthday: S('progression', arp([72, 72, 74, 72, 77, 76], 0.12, 0.2, 'triangle', 0.7), { gain: 0.34, echo: ROOM }),
  sfx_award: S('competition', [...arp([67, 72, 76, 79], 0.1, 0.25, 'triangle', 0.7), tone(84, 0.4, 0.8, 'sine', 0.6)], { gain: 0.42, echo: ROOM }),
  sfx_rank: S('progression', arp([65, 69, 72, 77], 0.08, 0.25, 'triangle', 0.7), { gain: 0.36, echo: ROOM }),
  sfx_passed: S('progression', [tone(60, 0, 1.4, 'sine', 0.6, { a: 0.2 }), tone(67, 0.3, 1.4, 'sine', 0.45, { a: 0.2 })], { gain: 0.26, echo: ROOM }), // quiet and slow
  sfx_trained: S('progression', [sweep(500, 900, 0, 0.15, 'sine', 0.7), tone(83, 0.14, 0.3, 'triangle', 0.6)], { gain: 0.3 }),
  sfx_hired: S('progression', arp([64, 67, 72], 0.08, 0.2, 'triangle', 0.7), { gain: 0.3 }),
  sfx_build: S('workshop', [{ wave: 'noise', t: 0, d: 0.05, lp: 2400, v: 0.6, a: 0.002 }, tone(57, 0.04, 0.12, 'triangle', 0.6), tone(64, 0.14, 0.14, 'triangle', 0.6)], { gain: 0.3 }),
  sfx_secret: S('competition', [...arp([72, 76, 79, 83, 88], 0.07, 0.3, 'sine', 0.6), tone(91, 0.4, 0.9, 'sine', 0.4)], { gain: 0.36, echo: ROOM }),
  sfx_purchase: S('economy', [tone(81, 0, 0.08, 'triangle', 0.8), tone(88, 0.08, 0.25, 'triangle', 0.8)], { gain: 0.3 }),
};

// Three calm loops: the home by day, the home in the evening and at night, and the title / ceremony.
export const MUSIC = {
  music_day: { bpm: 84, bars: 4, root: 60, chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], gain: 0.22, pad: { wave: 'triangle', v: 0.35, octave: 0 }, bass: { wave: 'sine', v: 0.4, steps: [0, 8] }, arp: { wave: 'sine', v: 0.18, every: 4, octave: 1 } },
  music_evening: { bpm: 66, bars: 4, root: 57, chords: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [-2, 2, 5]], gain: 0.18, pad: { wave: 'sine', v: 0.4, octave: 0 }, bass: { wave: 'sine', v: 0.3, steps: [0] } },
  music_title: { bpm: 92, bars: 4, root: 62, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], gain: 0.22, pad: { wave: 'triangle', v: 0.3, octave: 0 }, bass: { wave: 'sine', v: 0.35, steps: [0, 6, 8] }, arp: { wave: 'triangle', v: 0.16, every: 2, octave: 1 } },
};

// Which home event plays which sound (main.js). The call bell only with Settings → Call-bell alert sound on.
export const EVENT_SOUNDS = {
  'care:bell': 'sfx_bell',
  'care:joined': 'sfx_welcome',
  'care:alert': 'sfx_alert',
  'care:incident': 'sfx_incident',
  'care:birthday': 'sfx_birthday',
  'quality:award': 'sfx_award',
  'quality:rankUp': 'sfx_rank',
  'care:passed': 'sfx_passed',
  'staff:trained': 'sfx_trained',
  'staff:hired': 'sfx_hired',
  'home:layout': 'sfx_build',
  'secret:found': 'sfx_secret',
  'commerce:purchased': 'sfx_purchase',
};
// The evening loop from 17:00 to 06:00 (the Evening / settling and Night bands).
export const MUSIC_BANDS = { evening: ['evening', 'night'] };
