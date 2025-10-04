let audioContext: AudioContext | null = null;

function resolveAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return ctor ?? null;
}

function getAudioContext(): AudioContext | null {
  const AudioContextConstructor = resolveAudioContextConstructor();
  if (!AudioContextConstructor) {
    return null;
  }

  if (!audioContext) {
    try {
      audioContext = new AudioContextConstructor();
    } catch (error) {
      console.error('Failed to create AudioContext', error);
      return null;
    }
  }

  return audioContext;
}

export async function playCartBeep() {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch (error) {
      console.error('Failed to resume AudioContext', error);
      return;
    }
  }

  const duration = 0.18;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = 'square';
  oscillator.frequency.value = 880;

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.1, context.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();
  oscillator.stop(context.currentTime + duration);

  oscillator.addEventListener('ended', () => {
    oscillator.disconnect();
    gain.disconnect();
  });
}
