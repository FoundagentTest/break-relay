export interface RelayCapabilities {
  audio: boolean;
  speech: boolean;
  wakeLock: boolean;
  vibration: boolean;
  standalone: boolean;
}

export type CueSignal = "phase" | "return";

export interface CuePlaybackResult {
  ok: boolean;
  reason?: "unsupported" | "blocked" | "error" | "timeout";
}

export interface SpeechCueCallbacks {
  onError?: () => void;
  onStart?: () => void;
}

const PHASE_CHIME =
  "data:audio/wav;base64,UklGRiQFAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAFAACAgICAgICAgICAgH9/f3+AgIGCgoKBgIB/fn19fX5/gIKEhISDgYB/fXx7ent+gIOFh4aFg4F/fXt5eHl8gIOHiYmHhYKAfXp3dnd5foKHiouKh4OAfXl2dHR3fIGHjI2MiYWBfnl1cnJ0eYCHjI+PjIiDf3p1cW9xdn6FjZGRj4qFgHt1cG1uc3uDjJKUko2HgXx1cGxrb3eBi5OWlZCKg312cGtpbHN+iZKXmJSNhn93cGpnaG96hpKZmpeRiYB5cWplZWt2g5CZnJqUjIN7c2tlZGhygI2XnJuWjoZ+dW1nZGZvfImUm5yYkIiAeG9oZGVseIWRmpyZk4uCenJqZWRpdIGOmJyblY2EfXRsZmRncH6Llpucl4+Hf3ZuZ2RmbXqHk5qcmZKJgXlwaWRlanaDkJmcmpSMg3tza2VkaHKAjJecm5aOhn51bWdkZm97iJSbnJiRiIB4b2hkZWx3hJGanJmTi4J6cmplZGl0gI6YnJuVjYV9dGxmZGdwfYqVm5yXkId/d25nZGZteYaTmpyZkoqBeXFpZWRqdYKPmZyalIyDfHNrZWRocn+Ml5yblo6GfnZtZ2RmbnuIlJucmJGIgHhwaGRla3eEkZmcmZOLgntyamVkaXOAjpicm5WNhX10bGZkZ3B9ipWbnJeQh4B3b2hkZW15hpKanJmSioF5cWllZGp1go+ZnJqUjIR8c2tmZGhxf4yWnJuWj4Z+dm5nZGZue4iUm5yYkYmAeHBpZGVrd4SRmZyak4uCe3JqZWRpc4CNl5yblY6FfXVsZmRncH2KlZucl5CHgHdvaGRlbXmGkpqcmZKKgXpxamVkanWCj5icmpSMhHxzbGZkaHF/i5acm5aPhn92bmdkZm56iJSbnJiRiYB4cGlkZWt3g5CZnJqTi4N7cmtlZGlzgI2XnJuWjoV9dW1mZGdvfImVm5yXkIiAd29oZGVseIWSmpyZkoqCenFqZWRqdIGPmJyalY2EfHRsZmRocX6Llpybl4+Hf3ZuZ2RmbnqHk5ucmJGJgHlwaWRla3aDkJmcmpSMg3tza2VkaHKAjZecm5aOhX51bWZkZ398iZWbnJiQiIB3b2hkZWx4hZKanJmTioJ6cWplZGl0gY6YnJqVjYR9dGxmZGdxfouWnJuXj4d/dm5nZGZteoeTmpyYkomBeXBpZGVrdoOQmZyalIyDe3NrZWRocoCMl5yblo6GfnVtZ2Rmb3yJlJucl5CIgHhwaWZnbXiEkJial5GJgntzbWhobHaAjJSXlpGLhH12cGtqbXR+iJGVlZGLhYB5c25sbXN8hI2Sk5GMhoB8dnFub3J6gYqPkZCMh4J+eXRxcHN4gIaMj46Lh4N/e3d0cnR4foSJjIyKh4OAfXl2dXV4fYGGioqJh4SAfnt5d3d5fICEh4iIhoOBf317eXl6fICChYaGhYOBgH99fHt8fX+Bg4SEg4KBgIB/fn1+fn+AgYKCgYGAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

// Two soft ascending notes make the return boundary recognizable without
// turning each ordinary phase into an alarm.
const RETURN_CHIME =
  "data:audio/wav;base64,UklGRswMAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YagMAACAgICAgICAgICAf39/f3+AgIGCgoKBgIB/fn18fX1/gIOEhYSDgoB/fXx6ent+gIOGh4eFg4F/fXp5eHl8gIOHiYmHhYKAfXp3dnZ5foOIi4uKh4SAfXl2dHR2fIGIjI6NioaBfnl1cnFzeYCHjZCPjIiDf3l0cG9wdn6GjZKSj4uFgHp0b21tcnqEjZOVk46IgXt1b2tqbneBjJOXlpGLg312b2poa3N+ipOZmZSOhn93b2lmZ256h5Kam5iRiYB5cGlkZGp2g5GanZuVjIN7cmpkY2dygI2YnZyXj4Z+dWxlY2VufImVnJ2ZkYiAd25nY2Rrd4WSm52alIuCenFpZGNoc4GPmZ2clo6FfHNrZWNmcH2Ll52dmJCHf3ZtZmNkbHmHlJydmpOKgXlwaGNjaXWDkJqdm5WMg3tyamRjZ3F/jZidnJePhn51bGVjZW57iZWcnZmRiYB3b2djZGt3hZKbnZuUi4J6cWlkY2hzgI+ZnZyWjoV9dGtlY2ZvfYuWnZ2YkId/dm5mY2RseYeUnJ2ak4qBeXBoY2NpdYKQmp2blY2Ee3JqZGNncX+NmJ2cl4+GfnVsZmNlbnuJlZydmZKJgHhvZ2Nka3eEkpudm5SLgnpxaWRjaHOAjpmdnJaOhX10a2VjZm99ipadnZiRiIB2bmZjZGx5hpObnZqTioF5cGhjY2l1gpCanZuVjYR8c2pkY2dxf4yXnZ2Xj4Z+dW1mY2VteoiVnJ2ZkomAeG9nY2RqdoSSm52blIyDenJpZGNocoCOmZ2clo6FfXRsZWNmb3yKlp2dmJGIgHduZ2NkbHiGk5udmpOKgXlwaGNjaXSCkJqdnJWNhHxza2RjZ3B+jJednZeQh391bWZjZW16iJScnZmSiYB4b2hjY2p2hJGanZuUjIN7cmpkY2hygI6YnZyXjoV9dGxlY2ZvfIqWnJ2YkYiAd25nY2RreIaTm52ak4uCeXFpY2NpdIGPmZ2clo2EfHNrZWNmcH6Ml52dmJCHf3ZtZmNlbXqIlJydmZKJgHhvaGNjanaDkZqdm5WMg3tyamRjZ3KAjZidnJePhn50bGVjZW58iZacnZmRiIB3bmdjZGt4hZKbnZqTi4J6cWlkY2h0gY+ZnZuVjYR9dGxmZWhxfoqVmpqVjoZ/d3BqZ2lwe4aQl5iVj4iAenNtampveIKMk5aUj4mCfXZwbGxvdoCJkJOTj4qEf3l0b25wdX2FjZGRjoqFgHt2cnBxdXyCiY6PjYqFgX15dXNzdXqAhouNjImGgn97eHV1dnp/hIiKioiFgoB9enh3eHp+goWIiIeFgoB+fHp5eXt+gIOFhoWEgoCAfn18fHx+gIGDg4OCgYCAf35+fn5/gICBgYGBgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgH9/f4CBgoKCgYCAfn19foCBg4SDgoB/fXx7fH+ChYaFg4F/fHp5en6ChoiHhYJ/fHl3eH2Ch4qJhoN/e3d1dnuBiIuLiISAe3ZzdHmAiI2NioWAe3VycneAiI6QjIeAe3Vwb3R+iJCSj4mCe3RvbXJ8h5GUkYuDfHRua296hpGWk42EfXRtaW14hZKXlo+GfnRsZ2p1g5KZmJGIf3RrZmdygZGam5SKgHVrZGVvgJGcnZeMgXZrY2JsfY+cn5mPgndrYmBpe42coJuQhHlsY2BneIuaoJyShnpuZGBmdYiZoJ2Th3xwZWBkc4aXoJ6ViX5xZmBjcIOVn5+Wi39zaGFiboCTnp+YjIB1aWFhbH6RnaCZjoJ2amJhanyOnKCakIN4bGNgaHmMm6CckYV6bWRgZnaJmaCdk4d7b2VgZXSHmKCelIh9cWZgZHGElp+elop/cmdgYm+BlJ+fl4yAdGhhYm1/kp6gmY2BdmphYWt9j52gmo+Dd2tiYGl6jZygm5GEeW1jYGd3ipqgnJKGe25kYGV1iJignZSIfHBlYGRyhZegnpWJfnJmYGNwgpWfn5eLgHNoYWJugJOen5iNgHVpYWFrfpCdoJmOgnZrYmFpe46coJuQhHhsY2BoeIuboJyShXpuZGBmdomZoJ2Th3xvZWBlc4aXoJ6ViX1xZmBjcYOWn5+Win9zZ2BiboGTn5+YjIB0aWFhbH+RnqCZjoF2amJhanyPnaCaj4N3bGJgaHqMm6CbkYV5bWNgZ3eKmqCckoZ7b2RgZXSHmKCdlIh9cGVgZHKFlp+elop+cmdgY2+ClJ+fl4uAc2hhYm2Akp6fmI2BdWlhYWt9kJ2gmo+Cd2tiYGl7jZygm5CEeGxjYGd4i5qgnJKGem5kYGZ1iJmgnZOHfHBlYGRzhpegnpWJfnFmYGNwg5Wfn5aLf3NoYGJugJOen5iMgHRpYWFsfpGdoJmOgnZqYmFqfI6coJqQg3hsY2BoeYyboJyRhXltY2BmdomaoJ2Th3tvZWBldIeYoJ6UiH1xZmBkcYSWn56Win9yZ2Bib4GUn5+XjIB0aGFibYCSnqCZjYF1amFha32PnaCaj4N3a2JgaXqNnKCbkYR5bWNgZ3eKmqCckoZ6bmRgZXWImaCdlIh8cGVgZHKFl6CelYl+cWZgY3CClZ+fl4uAc2hhYm6Ak56fmI2AdWlhYWx+kJ2gmY6CdmtiYWp7jpygm5CEeGxjYGh5jJugnJKFem5kYGZ2iZmgnZOHe29lYGVzhpegnpWJfXFmYGNxhJafnpaKf3JnYGJvgZSfn5eMgHRpYWFsf5GeoJmOgXZqYmFqfI+doJqPg3drYmBoeo2boJuRhXltY2Bnd4qaoJyShntvZGBldIeYoJ2UiHxwZWBkcoWWn56Vin5yZ2BjcIKUn5+Xi4BzaGFibYCSnp+YjYF1aWFha32QnaCaj4J3a2JgaXuOnKCbkIR4bGNgZ3iLmqCckoZ6bmRgZnWImaCdk4d8b2VgZHOGl6CelYl9cWZgY3CDlZ+flot/c2dgYm6Ak56fmIyAdGlhYWx/kZ2gmY6CdmpiYWp8j5ygmpCDeGxiYGh5jJugnJGFeW1jYGZ2ipqgnZOHe29kYGV0h5ignpSIfXBmYGRxhJafnpaKfnJnYGNvgZSfn5eMgHRoYWJtgJKeoJmNgXVqYWFrfZCdoJqPg3drYmBpeo2coJuRhHltY2BneIuaoJyShnpuZGBmdYiZoJ2UiHxwZWBkcoWXoJ6ViX5xZmBjcIOVn5+Xi39zaGFiboCTnp+YjYB1aWFhbH6QnaCZjoJ2a2JhanuOnKCbkIR4bGNgaHmMm6CckYV6bmRgZnaJmaCdk4d7b2VgZXOGmKCelYl9cWZgY3GElp+elop/cmdgYm+BlJ+fl4yAdGlhYWx/kZ6gmY6BdmpiYWp8j52gmo+Dd2tiYGl6jZugm5GFeW1jYGd3ipqgnJKGe25kYGV0h5ignZSIfHBlYGRyhZafnpWKfnJnYGNwgpSfn5eLgHNoYWJtgJKen5iNgHVpYWFrfpCdoJqPgndrYmBpe46coJuQhHhtY2FoeIuZn5qRhXpvZmNod4iWnZqRhnxyaWRodYWTmpmRh350a2dpdIKQmJeRiH92bmlqc4COlpaRiIB4cGtrc3+Lk5SQiYF6c21tc36JkZOPiYJ7dXBvc32GjpGOiYJ9d3JwdHyEjI+NiIN+eXRydXuDio2MiIN/enZ0dnuBiIuKh4OAfHh2d3uAhomIhoOAfXp4eXyAhIaHhYKAfnx6enyAgoSFhIKAf358fH6AgYODgoGAgH9+fn+AgIGBgYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=";

const playingAudio = new Set<HTMLAudioElement>();

export function getRelayCapabilities(
  browserWindow: Window = window,
  browserNavigator: Navigator = navigator,
): RelayCapabilities {
  const speechWindow = browserWindow as Window & {
    Audio?: typeof Audio;
    SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
  };
  const wakeNavigator = browserNavigator as Navigator & {
    wakeLock?: unknown;
  };
  return {
    audio: typeof speechWindow.Audio === "function",
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

export function playCueSignal(
  signal: CueSignal,
  timeoutMs = 2_500,
): Promise<CuePlaybackResult> {
  if (!getRelayCapabilities().audio) {
    return Promise.resolve({ ok: false, reason: "unsupported" });
  }

  return new Promise((resolve) => {
    let settled = false;
    let audio: HTMLAudioElement;
    try {
      audio = new Audio(signal === "return" ? RETURN_CHIME : PHASE_CHIME);
    } catch {
      resolve({ ok: false, reason: "error" });
      return;
    }
    audio.preload = "auto";
    audio.volume = signal === "return" ? 0.72 : 0.62;
    playingAudio.add(audio);

    const finish = (result: CuePlaybackResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("error", onError);
      resolve(result);
    };
    const onPlaying = () => finish({ ok: true });
    const onError = () => {
      playingAudio.delete(audio);
      finish({ ok: false, reason: "error" });
    };
    const timeout = window.setTimeout(
      () => {
        playingAudio.delete(audio);
        finish({ ok: false, reason: "timeout" });
      },
      timeoutMs,
    );
    audio.addEventListener("playing", onPlaying, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.addEventListener(
      "ended",
      () => {
        playingAudio.delete(audio);
      },
      { once: true },
    );

    try {
      const started = audio.play();
      void started?.catch(() => {
        playingAudio.delete(audio);
        finish({ ok: false, reason: "blocked" });
      });
    } catch {
      playingAudio.delete(audio);
      finish({ ok: false, reason: "blocked" });
    }
  });
}

export function speakCue(
  text: string,
  callbacks: SpeechCueCallbacks | (() => void) = {},
) {
  const handlers =
    typeof callbacks === "function" ? { onError: callbacks } : callbacks;
  const capabilities = getRelayCapabilities();
  let failed = false;
  const fallback = () => {
    if (failed) return;
    failed = true;
    handlers.onError?.();
  };
  if (!capabilities.speech) {
    fallback();
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    let started = false;
    const timeout = window.setTimeout(() => {
      if (!started) fallback();
    }, 4_000);
    utterance.rate = 0.88;
    utterance.pitch = 0.92;
    utterance.volume = 0.78;
    utterance.onstart = () => {
      started = true;
      window.clearTimeout(timeout);
      handlers.onStart?.();
    };
    utterance.onerror = (event) => {
      window.clearTimeout(timeout);
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
