/**
 * System Audio Utility — Web Audio API Chimes
 * Plays crisp, non-intrusive sound effects on task completion.
 */

export function playTaskDoneSound() {
  try {
    const saved = localStorage.getItem('thienphat_app_config');
    const config = saved ? JSON.parse(saved) : { enableSounds: true };
    if (config.enableSounds === false) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    // Harmonious 2-tone chime (F#5 -> B5)
    const playNote = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur);
    };

    playNote(739.99, now, 0.22);        // F#5
    playNote(987.77, now + 0.1, 0.4);   // B5
  } catch (e) {
    console.warn('[Audio] Failed to play completion sound:', e);
  }
}
