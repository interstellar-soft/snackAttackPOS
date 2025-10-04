let cartBeepAudio: HTMLAudioElement | null = null;

function getCartBeepAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!cartBeepAudio) {
    cartBeepAudio = new Audio('/sounds/barcode-scanner-beep.mp3');
    cartBeepAudio.preload = 'auto';
  }

  return cartBeepAudio;
}

export async function playCartBeep() {
  const audio = getCartBeepAudio();
  if (!audio) {
    return;
  }

  try {
    audio.currentTime = 0;
    await audio.play();
  } catch (error) {
    console.error('Failed to play cart beep audio', error);
  }
}
