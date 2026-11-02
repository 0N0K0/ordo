// Browsers only allow audio after a user gesture: the context is created on the first click or key press.
let audio: AudioContext | null = null;

/**
 * Prepares the audio on the first user gesture of the page, so alarms can ring later.
 * @returns {() => void} Cleanup removing the listeners.
 */
export function unlockAudioOnGesture(): () => void {
  const unlock = () => {
    try {
      audio ??= new AudioContext();
      void audio.resume();
    } catch {
      // No audio support.
    }
    cleanup();
  };
  const cleanup = () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  return cleanup;
}

/**
 * Plays a short three-note chime (Web Audio, no file). Silent until the page had a user gesture.
 * @returns {void}
 */
export function playChime(): void {
  if (!audio || audio.state !== 'running') return;
  [880, 1175, 1568].forEach((frequency, index) => {
    const start = audio!.currentTime + index * 0.18;
    const oscillator = audio!.createOscillator();
    const gain = audio!.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    oscillator.connect(gain).connect(audio!.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.5);
  });
}
