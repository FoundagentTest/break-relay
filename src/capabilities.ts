export interface RelayCapabilities {
  speech: boolean;
  wakeLock: boolean;
  vibration: boolean;
  standalone: boolean;
}

export function getRelayCapabilities(
  browserWindow: Window = window,
  browserNavigator: Navigator = navigator,
): RelayCapabilities {
  const speechWindow = browserWindow as Window & {
    SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
  };
  const wakeNavigator = browserNavigator as Navigator & {
    wakeLock?: unknown;
  };
  return {
    speech:
      !!speechWindow.speechSynthesis &&
      typeof speechWindow.SpeechSynthesisUtterance === "function",
    wakeLock: !!wakeNavigator.wakeLock,
    vibration: typeof browserNavigator.vibrate === "function",
    standalone:
      browserWindow.matchMedia?.("(display-mode: standalone)").matches ??
      false,
  };
}

export function speakCue(text: string, onError?: () => void) {
  const capabilities = getRelayCapabilities();
  let failed = false;
  const fallback = () => {
    if (failed) return;
    failed = true;
    navigator.vibrate?.([120, 80, 120]);
    onError?.();
  };
  if (!capabilities.speech) {
    fallback();
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88;
    utterance.pitch = 0.92;
    utterance.volume = 0.78;
    utterance.onerror = (event) => {
      if (event.error === "canceled" || event.error === "interrupted") return;
      fallback();
    };
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    fallback();
    return false;
  }
}
