import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildExtension,
  buildRoute,
  DEFAULT_PREFERENCES,
  FEELINGS,
  SPACE_MODES,
  STATION_PRESETS,
} from "./data";
import { clearPreferences, loadPreferences, savePreferences } from "./storage";
import type {
  Feeling,
  Preferences,
  RouteStep,
  SpaceMode,
  Station,
} from "./types";

type Screen = "stations" | "tune" | "home" | "session" | "complete";

function Icon({
  name,
  size = 20,
}: {
  name:
    | "arrow"
    | "check"
    | "close"
    | "edit"
    | "pause"
    | "play"
    | "repeat"
    | "settings"
    | "skip"
    | "sound"
    | "spark"
    | "trash";
  size?: number;
}) {
  const paths = {
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    pause: (
      <>
        <path d="M8 5v14" />
        <path d="M16 5v14" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7Z" />,
    repeat: (
      <>
        <path d="m17 2 4 4-4 4" />
        <path d="M3 11V9a3 3 0 0 1 3-3h15" />
        <path d="m7 22-4-4 4-4" />
        <path d="M21 13v2a3 3 0 0 1-3 3H3" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21H10v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-1.55V3h4v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.55 1H21v4h-.08a1.7 1.7 0 0 0-1.52 1Z" />
      </>
    ),
    skip: (
      <>
        <path d="m5 5 10 7L5 19Z" />
        <path d="M19 5v14" />
      </>
    ),
    sound: (
      <>
        <path d="M11 5 6 9H2v6h4l5 4Z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
        <path d="m5.6 5.6 2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name]}
    </svg>
  );
}

function RelayMark() {
  return (
    <span aria-hidden="true" className="relay-mark">
      <span />
      <span />
      <span />
    </span>
  );
}

function Brand({ quiet = false }: { quiet?: boolean }) {
  return (
    <a className={`brand ${quiet ? "brand--quiet" : ""}`} href="/" aria-label="Break Relay home">
      <RelayMark />
      <span>Break Relay</span>
    </a>
  );
}

function PrivacyNote() {
  return (
    <div className="privacy-note">
      <span className="privacy-dot" aria-hidden="true" />
      <span>
        No account. Your stations stay in this browser and are never sent anywhere.
      </span>
    </div>
  );
}

function StepRail({ current }: { current: 1 | 2 }) {
  return (
    <div
      aria-label="Setup progress"
      aria-valuemax={2}
      aria-valuemin={1}
      aria-valuenow={current}
      className="step-rail"
      role="progressbar"
    >
      <span className={current >= 1 ? "is-active" : ""} />
      <span className={current >= 2 ? "is-active" : ""} />
    </div>
  );
}

function SpaceModePicker({
  value,
  onChange,
}: {
  value: SpaceMode;
  onChange: (mode: SpaceMode) => void;
}) {
  return (
    <fieldset className="choice-fieldset">
      <legend>Your space today</legend>
      <div className="space-mode-grid">
        {SPACE_MODES.map((mode) => (
          <label className={`space-mode ${value === mode.id ? "is-selected" : ""}`} key={mode.id}>
            <input
              checked={value === mode.id}
              name="space-mode"
              onChange={() => onChange(mode.id)}
              type="radio"
              value={mode.id}
            />
            <span className="choice-indicator" aria-hidden="true">
              {value === mode.id && <span />}
            </span>
            <span>
              <strong>{mode.label}</strong>
              <small>{mode.description}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function StationSetup({
  draft,
  onDraftChange,
  onContinue,
  editing,
  onCancel,
}: {
  draft: Preferences;
  onDraftChange: (draft: Preferences) => void;
  onContinue: () => void;
  editing: boolean;
  onCancel: () => void;
}) {
  const [customName, setCustomName] = useState("");
  const [customError, setCustomError] = useState("");
  const customInput = useRef<HTMLInputElement>(null);

  const visiblePresets = useMemo(
    () => STATION_PRESETS.filter((station) => station.modes.includes(draft.spaceMode)),
    [draft.spaceMode],
  );

  const selectedIds = new Set(draft.stations.map((station) => station.id));

  function toggleStation(station: Station) {
    if (selectedIds.has(station.id)) {
      onDraftChange({
        ...draft,
        stations: draft.stations.filter((item) => item.id !== station.id),
      });
      return;
    }
    if (draft.stations.length >= 6) return;
    onDraftChange({ ...draft, stations: [...draft.stations, station] });
  }

  function addCustom(event: React.FormEvent) {
    event.preventDefault();
    const cleanName = customName.trim();
    if (cleanName.length < 2) {
      setCustomError("Give this stop a short name.");
      customInput.current?.focus();
      return;
    }
    if (draft.stations.length >= 6) {
      setCustomError("Six stops is plenty for a useful relay.");
      return;
    }
    const station: Station = {
      id: `custom-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      name: cleanName,
      kind: "custom",
      detail: "Your own reachable stop",
      modes: ["any", "small", "seated"],
      custom: true,
    };
    onDraftChange({ ...draft, stations: [...draft.stations, station] });
    setCustomName("");
    setCustomError("");
  }

  return (
    <main className="setup-page">
      <header className="setup-header">
        <Brand />
        {editing && (
          <button className="text-button" onClick={onCancel} type="button">
            Cancel
          </button>
        )}
      </header>

      <div className="setup-shell">
        <section className="setup-intro">
          <div>
            <p className="eyebrow">{editing ? "EDIT YOUR ROUTE" : "SETUP · ABOUT ONE MINUTE"}</p>
            <h1>Mark three places that can carry a break.</h1>
            <p className="lede">
              Choose spots you can safely reach right now. A turn away from the
              desk counts; a long walk is not required.
            </p>
          </div>
          <StepRail current={1} />
        </section>

        <section className="setup-workspace">
          <div className="station-library">
            <SpaceModePicker
              onChange={(spaceMode) => onDraftChange({ ...draft, spaceMode })}
              value={draft.spaceMode}
            />

            <div className="field-heading">
              <div>
                <h2>Choose your relay points</h2>
                <p>Pick 3–6. You can change these any time.</p>
              </div>
              <span className="count-pill" aria-live="polite">
                {draft.stations.length} / 3 minimum
              </span>
            </div>

            <div className="station-grid">
              {visiblePresets.map((station) => {
                const selected = selectedIds.has(station.id);
                return (
                  <button
                    aria-pressed={selected}
                    className={`station-option ${selected ? "is-selected" : ""}`}
                    disabled={!selected && draft.stations.length >= 6}
                    key={station.id}
                    onClick={() => toggleStation(station)}
                    type="button"
                  >
                    <span className="station-number" aria-hidden="true">
                      {selected
                        ? draft.stations.findIndex((item) => item.id === station.id) + 1
                        : "＋"}
                    </span>
                    <span>
                      <strong>{station.name}</strong>
                      <small>{station.detail}</small>
                    </span>
                    {selected && (
                      <span className="station-check" aria-hidden="true">
                        <Icon name="check" size={15} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <form className="custom-station" onSubmit={addCustom}>
              <label htmlFor="custom-station">Or name your own safe stop</label>
              <div className="custom-input-row">
                <input
                  aria-describedby={customError ? "custom-error" : undefined}
                  id="custom-station"
                  maxLength={32}
                  onChange={(event) => {
                    setCustomName(event.target.value);
                    setCustomError("");
                  }}
                  placeholder="e.g. back step, reading chair"
                  ref={customInput}
                  type="text"
                  value={customName}
                />
                <button className="secondary-button" type="submit">
                  Add stop
                </button>
              </div>
              {customError && (
                <p className="field-error" id="custom-error" role="alert">
                  {customError}
                </p>
              )}
            </form>
          </div>

          <aside className="route-slip" aria-label="Your selected route">
            <div className="route-slip__top">
              <span>YOUR RELAY</span>
              <span>{draft.stations.length ? "READYING" : "EMPTY"}</span>
            </div>
            <ol className="route-list">
              {draft.stations.length === 0 ? (
                <li className="route-empty">
                  <span />
                  Your chosen stops will line up here.
                </li>
              ) : (
                draft.stations.map((station, index) => (
                  <li key={station.id}>
                    <span className="route-node">{index + 1}</span>
                    <span>
                      <strong>{station.name}</strong>
                      <small>{station.detail}</small>
                    </span>
                    <button
                      aria-label={`Remove ${station.name}`}
                      className="icon-button icon-button--small"
                      onClick={() => toggleStation(station)}
                      type="button"
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </li>
                ))
              )}
            </ol>
            <div className="safety-note">
              <Icon name="spark" size={18} />
              <p>
                Skip anything unsafe, uncomfortable, or unavailable. Relay never
                asks you to push through pain.
              </p>
            </div>
            <button
              className="primary-button primary-button--wide"
              disabled={draft.stations.length < 3}
              onClick={onContinue}
              type="button"
            >
              {editing ? "Save relay points" : "Shape my relay"}
              <Icon name="arrow" />
            </button>
            {draft.stations.length < 3 && (
              <p className="button-hint">
                Choose {3 - draft.stations.length} more{" "}
                {3 - draft.stations.length === 1 ? "stop" : "stops"} to continue.
              </p>
            )}
          </aside>
        </section>
        <PrivacyNote />
      </div>
    </main>
  );
}

function FeelingPicker({
  value,
  onChange,
}: {
  value: Feeling;
  onChange: (feeling: Feeling) => void;
}) {
  return (
    <fieldset className="choice-fieldset">
      <legend>What needs a change?</legend>
      <div className="feeling-grid">
        {FEELINGS.map((feeling) => (
          <label
            className={`feeling-option ${value === feeling.id ? "is-selected" : ""}`}
            key={feeling.id}
          >
            <input
              checked={value === feeling.id}
              name="feeling"
              onChange={() => onChange(feeling.id)}
              type="radio"
              value={feeling.id}
            />
            <span className="feeling-symbol" aria-hidden="true">
              {feeling.symbol}
            </span>
            <span>
              <strong>{feeling.label}</strong>
              <small>{feeling.short}</small>
            </span>
            <span className="choice-tick" aria-hidden="true">
              {value === feeling.id && <Icon name="check" size={16} />}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function DurationPicker({
  value,
  onChange,
}: {
  value: 5 | 7 | 10;
  onChange: (duration: 5 | 7 | 10) => void;
}) {
  return (
    <fieldset className="choice-fieldset duration-fieldset">
      <legend>How much room do you have?</legend>
      <div className="duration-picker">
        {([5, 7, 10] as const).map((duration) => (
          <label className={value === duration ? "is-selected" : ""} key={duration}>
            <input
              checked={value === duration}
              name="duration"
              onChange={() => onChange(duration)}
              type="radio"
              value={duration}
            />
            <strong>{duration}</strong>
            <small>min</small>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function canUseSpeech() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

function speak(text: string, onError?: () => void) {
  if (!canUseSpeech()) {
    onError?.();
    if ("vibrate" in navigator) navigator.vibrate?.([120, 80, 120]);
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.88;
  utterance.pitch = 0.92;
  utterance.volume = 0.78;
  utterance.onerror = onError ?? null;
  window.speechSynthesis.speak(utterance);
}

function AudioChoice({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const speechAvailable = canUseSpeech();
  return (
    <div className="audio-choice">
      <div className="audio-choice__icon">
        <Icon name="sound" />
      </div>
      <div className="audio-choice__copy">
        <strong>Spoken cues</strong>
        <p>
          {speechAvailable
            ? "Your browser will calmly announce each new stop. No headphones required."
            : "Speech is unavailable in this browser. Large visual cues stay on screen, and vibration is used where supported."}
        </p>
        {enabled && speechAvailable && (
          <button
            className="inline-button"
            onClick={() =>
              speak("Break Relay is ready. The next cue will name one place and one action.")
            }
            type="button"
          >
            Test this voice
          </button>
        )}
      </div>
      <label className="switch">
        <span className="sr-only">Spoken cues</span>
        <input
          checked={enabled && speechAvailable}
          disabled={!speechAvailable}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span aria-hidden="true" />
      </label>
    </div>
  );
}

function TuneSetup({
  draft,
  onDraftChange,
  onBack,
  onStart,
}: {
  draft: Preferences;
  onDraftChange: (draft: Preferences) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <main className="setup-page tune-page">
      <header className="setup-header">
        <Brand />
        <button className="text-button" onClick={onBack} type="button">
          Back to stations
        </button>
      </header>
      <div className="setup-shell setup-shell--narrow">
        <section className="setup-intro">
          <div>
            <p className="eyebrow">ONE LAST CHOICE</p>
            <h1>Shape this break around right now.</h1>
            <p className="lede">
              Relay will choose an order and one light action for each stop. It
              won’t ask you to keep checking the screen.
            </p>
          </div>
          <StepRail current={2} />
        </section>

        <section className="tune-layout">
          <div className="tune-controls">
            <FeelingPicker
              onChange={(feeling) => onDraftChange({ ...draft, feeling })}
              value={draft.feeling}
            />
            <DurationPicker
              onChange={(duration) => onDraftChange({ ...draft, duration })}
              value={draft.duration}
            />
            <AudioChoice
              enabled={draft.audioEnabled}
              onChange={(audioEnabled) => onDraftChange({ ...draft, audioEnabled })}
            />
          </div>
          <aside className="launch-card">
            <p className="eyebrow">YOUR FIRST RELAY</p>
            <div className="launch-number">
              <strong>{draft.duration}</strong>
              <span>minutes</span>
            </div>
            <p>
              {draft.stations.length} real stops ·{" "}
              {FEELINGS.find((item) => item.id === draft.feeling)?.label.toLowerCase()}
            </p>
            <div className="mini-route" aria-label="Your relay stations">
              {draft.stations.map((station, index) => (
                <div key={station.id}>
                  <span>{index + 1}</span>
                  <small>{station.name}</small>
                </div>
              ))}
            </div>
            <div className="launch-note">
              Start with your device’s volume at a comfortable level. The first
              cue plays immediately.
            </div>
            <button
              className="primary-button primary-button--coral primary-button--wide"
              onClick={onStart}
              type="button"
            >
              Start this relay
              <Icon name="arrow" />
            </button>
          </aside>
        </section>
        <PrivacyNote />
      </div>
    </main>
  );
}

function AppHeader({ onSettings }: { onSettings: () => void }) {
  return (
    <header className="app-header">
      <Brand />
      <button className="settings-button" onClick={onSettings} type="button">
        <Icon name="settings" size={18} />
        <span>My relay</span>
      </button>
    </header>
  );
}

function Home({
  preferences,
  onChange,
  onStart,
  onSettings,
}: {
  preferences: Preferences;
  onChange: (preferences: Preferences) => void;
  onStart: () => void;
  onSettings: () => void;
}) {
  const feeling = FEELINGS.find((item) => item.id === preferences.feeling);
  return (
    <main className="home-page">
      <AppHeader onSettings={onSettings} />
      <section className="home-shell">
        <div className="home-copy">
          <p className="eyebrow">A ROUTE AWAY, THEN BACK</p>
          <h1>What would feel different for a few minutes?</h1>
          <p className="lede">
            Choose the need. Relay handles the route and the return.
          </p>
        </div>

        <div className="home-grid">
          <section className="home-controls">
            <FeelingPicker
              onChange={(nextFeeling) =>
                onChange({ ...preferences, feeling: nextFeeling })
              }
              value={preferences.feeling}
            />
            <DurationPicker
              onChange={(duration) => onChange({ ...preferences, duration })}
              value={preferences.duration}
            />
          </section>

          <aside className="ready-card">
            <div className="ready-card__wash" aria-hidden="true">
              {feeling?.symbol}
            </div>
            <p className="eyebrow">READY WHEN YOU ARE</p>
            <div className="ready-time">
              <strong>{preferences.duration}</strong>
              <span>minute relay</span>
            </div>
            <p className="ready-description">
              One cue at a time through {preferences.stations.length} places.
              Then a clear invitation back.
            </p>
            <ol className="ready-route" aria-label="Saved relay points">
              {preferences.stations.slice(0, 4).map((station, index) => (
                <li key={station.id}>
                  <span>{index + 1}</span>
                  {station.name}
                </li>
              ))}
              {preferences.stations.length > 4 && (
                <li className="ready-route__more">
                  +{preferences.stations.length - 4} in rotation
                </li>
              )}
            </ol>
            <button
              className="primary-button primary-button--coral primary-button--wide start-button"
              onClick={onStart}
              type="button"
            >
              <span className="start-button__play">
                <Icon name="play" size={17} />
              </span>
              Begin my break
            </button>
            <div className="cue-mode">
              <Icon name={preferences.audioEnabled ? "sound" : "spark"} size={17} />
              {preferences.audioEnabled && canUseSpeech()
                ? "Spoken cues are on"
                : "Visual cues stay on screen"}
            </div>
          </aside>
        </div>
      </section>
      <footer className="app-footer">
        <PrivacyNote />
        <p>A voluntary reset, not a measure of health or productivity.</p>
      </footer>
    </main>
  );
}

function SettingsPanel({
  preferences,
  onClose,
  onEdit,
  onAudioChange,
  onReset,
}: {
  preferences: Preferences;
  onClose: () => void;
  onEdit: () => void;
  onAudioChange: (enabled: boolean) => void;
  onReset: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const home = document.querySelector<HTMLElement>(".home-page");
    home?.setAttribute("inert", "");
    home?.setAttribute("aria-hidden", "true");
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      home?.removeAttribute("inert");
      home?.removeAttribute("aria-hidden");
    };
  }, [onClose]);

  return (
    <div className="panel-backdrop" onMouseDown={onClose}>
      <div
        aria-label="My relay settings"
        aria-modal="true"
        className="settings-panel"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="panel-header">
          <div>
            <p className="eyebrow">LOCAL PREFERENCES</p>
            <h2>My relay</h2>
          </div>
          <button
            aria-label="Close settings"
            className="icon-button"
            onClick={onClose}
            ref={closeRef}
            type="button"
          >
            <Icon name="close" />
          </button>
        </div>

        <section className="panel-section">
          <div className="panel-section__heading">
            <h3>Relay points</h3>
            <button className="inline-button" onClick={onEdit} type="button">
              <Icon name="edit" size={15} /> Edit
            </button>
          </div>
          <ol className="panel-stations">
            {preferences.stations.map((station, index) => (
              <li key={station.id}>
                <span>{index + 1}</span>
                <div>
                  <strong>{station.name}</strong>
                  <small>{station.detail}</small>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel-section panel-setting-row">
          <div>
            <h3>Spoken cues</h3>
            <p>
              {canUseSpeech()
                ? "Announce each station and action."
                : "Unavailable here; visual cues remain."}
            </p>
          </div>
          <label className="switch">
            <span className="sr-only">Spoken cues</span>
            <input
              checked={preferences.audioEnabled && canUseSpeech()}
              disabled={!canUseSpeech()}
              onChange={(event) => onAudioChange(event.target.checked)}
              type="checkbox"
            />
            <span aria-hidden="true" />
          </label>
        </section>

        <section className="local-card">
          <span className="privacy-dot" aria-hidden="true" />
          <div>
            <h3>Stored only on this device</h3>
            <p>
              Break Relay has no account or server profile. Your station names and
              last choices live in this browser’s local storage.
            </p>
          </div>
        </section>

        <section className="reset-section">
          {!confirmReset ? (
            <button className="danger-link" onClick={() => setConfirmReset(true)} type="button">
              <Icon name="trash" size={17} />
              Reset local data
            </button>
          ) : (
            <div className="reset-confirm" role="alert">
              <p>
                <strong>Start completely over?</strong>
                This removes every saved station from this browser.
              </p>
              <div>
                <button className="danger-button" onClick={onReset} type="button">
                  Yes, reset
                </button>
                <button
                  className="text-button"
                  onClick={() => setConfirmReset(false)}
                  type="button"
                >
                  Keep my relay
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function formatBoundary(seconds: number) {
  if (seconds <= 60) return "Under a minute remains";
  return `About ${Math.ceil(seconds / 60)} min remain`;
}

function RelaySession({
  route,
  audioEnabled,
  onFinish,
}: {
  route: RouteStep[];
  audioEnabled: boolean;
  onFinish: (endedEarly: boolean) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsInStep, setSecondsInStep] = useState(route[0].durationSeconds);
  const [paused, setPaused] = useState(false);
  const [speechFailed, setSpeechFailed] = useState(audioEnabled && !canUseSpeech());
  const finishing = useRef(false);
  const step = route[currentIndex];

  const announceStep = useCallback(() => {
    if (audioEnabled) {
      speak(step.spokenCue, () => setSpeechFailed(true));
    } else if ("vibrate" in navigator) {
      navigator.vibrate?.([120, 80, 120]);
    }
  }, [audioEnabled, step.spokenCue]);

  useEffect(() => {
    document.title = `${step.station.name} · Break Relay`;
    announceStep();
    return () => window.speechSynthesis?.cancel?.();
  }, [announceStep, step.station.name]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setSecondsInStep((seconds) => {
        if (seconds > 1) return seconds - 1;
        if (currentIndex < route.length - 1) {
          const nextIndex = currentIndex + 1;
          setCurrentIndex(nextIndex);
          return route[nextIndex].durationSeconds;
        }
        if (!finishing.current) {
          finishing.current = true;
          onFinish(false);
        }
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [currentIndex, onFinish, paused, route]);

  const totalRemaining =
    secondsInStep +
    route
      .slice(currentIndex + 1)
      .reduce((total, item) => total + item.durationSeconds, 0);

  function togglePause() {
    setPaused((current) => {
      if (canUseSpeech()) {
        if (current) window.speechSynthesis.resume();
        else window.speechSynthesis.pause();
      }
      return !current;
    });
  }

  function skip() {
    window.speechSynthesis?.cancel?.();
    if (currentIndex >= route.length - 1) {
      if (!finishing.current) {
        finishing.current = true;
        onFinish(false);
      }
      return;
    }
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setSecondsInStep(route[nextIndex].durationSeconds);
  }

  function endEarly() {
    window.speechSynthesis?.cancel?.();
    if (!finishing.current) {
      finishing.current = true;
      onFinish(true);
    }
  }

  return (
    <main className={`session-page ${paused ? "is-paused" : ""}`}>
      <header className="session-header">
        <Brand quiet />
        <div className="session-boundary" aria-live="polite">
          <span>
            {step.kind === "extension"
              ? "QUIET EXTENSION"
              : `STOP ${currentIndex + 1} OF ${route.length}`}
          </span>
          <strong>{paused ? "Relay paused" : formatBoundary(totalRemaining)}</strong>
        </div>
        <button className="end-button" onClick={endEarly} type="button">
          End early
        </button>
      </header>

      <section className="session-shell">
        <div className="session-track" aria-hidden="true">
          {route.map((item, index) => (
            <span
              className={`${index < currentIndex ? "is-done" : ""} ${
                index === currentIndex ? "is-current" : ""
              }`}
              key={item.id}
            >
              {index < currentIndex && <Icon name="check" size={13} />}
            </span>
          ))}
        </div>

        <article className="cue-card" aria-live="assertive">
          <div className="cue-kicker">
            <span className="cue-pulse" aria-hidden="true" />
            {paused ? "PAUSED HERE" : step.kind === "return" ? "RETURN CUE" : "GO TO"}
          </div>
          <h1>{step.station.name}</h1>
          <div className="cue-divider" />
          <p>{step.action}</p>
          {paused && (
            <div className="paused-note">Take your time. The relay will wait.</div>
          )}
        </article>

        {speechFailed && (
          <div className="fallback-banner" role="status">
            <Icon name="spark" size={18} />
            <p>
              <strong>Audio isn’t available here.</strong> Keep this large cue
              visible. The page title also changes at every stop, and vibration is
              used where supported.
            </p>
          </div>
        )}

        <div className="session-controls" aria-label="Relay controls">
          <button className="control-button control-button--primary" onClick={togglePause} type="button">
            <span>
              <Icon name={paused ? "play" : "pause"} size={21} />
            </span>
            {paused ? "Resume" : "Pause"}
          </button>
          <button className="control-button" onClick={announceStep} type="button">
            <span>
              <Icon name="repeat" size={20} />
            </span>
            Repeat cue
          </button>
          <button className="control-button" onClick={skip} type="button">
            <span>
              <Icon name="skip" size={20} />
            </span>
            Skip stop
          </button>
        </div>
        <p className="session-footnote">
          Nothing to tap at the station. The next cue will come on its own.
        </p>
      </section>
    </main>
  );
}

function Completion({
  duration,
  endedEarly,
  extensionUsed,
  audioEnabled,
  onReady,
  onExtend,
  onFinish,
}: {
  duration: number;
  endedEarly: boolean;
  extensionUsed: boolean;
  audioEnabled: boolean;
  onReady: () => void;
  onExtend: () => void;
  onFinish: () => void;
}) {
  useEffect(() => {
    document.title = "Return when ready · Break Relay";
    const cue = endedEarly
      ? "Your relay has ended. Return when you are ready."
      : "You are back at the boundary. Return when you are ready.";
    if (audioEnabled) speak(cue);
    else if ("vibrate" in navigator) navigator.vibrate?.([140, 90, 140]);
    return () => window.speechSynthesis?.cancel?.();
  }, [audioEnabled, endedEarly]);

  return (
    <main className="completion-page">
      <header className="completion-header">
        <Brand quiet />
      </header>
      <section className="completion-shell">
        <div className="completion-orbit" aria-hidden="true">
          <div className="orbit-dot orbit-dot--one" />
          <div className="orbit-dot orbit-dot--two" />
          <div className="orbit-center">
            <Icon name="check" size={38} />
          </div>
        </div>
        <p className="eyebrow">{endedEarly ? "RELAY ENDED" : "RETURN CUE"}</p>
        <h1>{endedEarly ? "Meet the day from here." : "You’re back at the boundary."}</h1>
        <p className="completion-copy">
          {endedEarly
            ? "Stopping early is a complete choice. Come back to the desk when it suits you."
            : `Your ${duration}-minute route is complete. No score, streak, or verdict—just choose what comes next.`}
        </p>

        <div className="return-choices">
          <button className="primary-button primary-button--coral return-primary" onClick={onReady} type="button">
            <span>
              <Icon name="arrow" />
            </span>
            <span>
              <strong>Ready to return</strong>
              <small>Close the relay and continue</small>
            </span>
          </button>
          {!extensionUsed && !endedEarly && (
            <button className="return-secondary" onClick={onExtend} type="button">
              <span className="plus-two">+2</span>
              <span>
                <strong>Add two quiet minutes</strong>
                <small>One last cue, no new destination</small>
              </span>
            </button>
          )}
          <button className="finish-link" onClick={onFinish} type="button">
            Finish here
          </button>
        </div>
        <p className="completion-note">
          Break Relay doesn’t assess how rested you are. You decide what was useful.
        </p>
      </section>
    </main>
  );
}

export default function App() {
  const initial = useMemo(loadPreferences, []);
  const [preferences, setPreferences] = useState<Preferences>(initial);
  const [draft, setDraft] = useState<Preferences>(initial);
  const [screen, setScreen] = useState<Screen>(
    initial.hasOnboarded && initial.stations.length >= 3 ? "home" : "stations",
  );
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [route, setRoute] = useState<RouteStep[]>([]);
  const [endedEarly, setEndedEarly] = useState(false);
  const [extensionUsed, setExtensionUsed] = useState(false);

  useEffect(() => {
    if (preferences.hasOnboarded) savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (screen !== "session" && screen !== "complete") {
      document.title = "Break Relay · A route away, then back";
    }
  }, [screen]);

  const updatePreferences = useCallback((next: Preferences) => {
    setPreferences(next);
    savePreferences(next);
  }, []);

  function startRelay(source: Preferences = preferences) {
    const next = { ...source, hasOnboarded: true };
    updatePreferences(next);
    setDraft(next);
    setRoute(buildRoute(next.stations, next.feeling, next.duration));
    setEndedEarly(false);
    setExtensionUsed(false);
    setScreen("session");
  }

  function finishSession(wasEarly: boolean) {
    setEndedEarly(wasEarly);
    setScreen("complete");
  }

  function returnHome() {
    setScreen("home");
    setEndedEarly(false);
    setExtensionUsed(false);
  }

  if (screen === "stations") {
    return (
      <StationSetup
        draft={draft}
        editing={editing}
        onCancel={() => {
          setDraft(preferences);
          setEditing(false);
          setScreen("home");
        }}
        onContinue={() => {
          if (editing) {
            const next = { ...draft, hasOnboarded: true };
            updatePreferences(next);
            setDraft(next);
            setEditing(false);
            setScreen("home");
          } else {
            setScreen("tune");
          }
        }}
        onDraftChange={setDraft}
      />
    );
  }

  if (screen === "tune") {
    return (
      <TuneSetup
        draft={draft}
        onBack={() => setScreen("stations")}
        onDraftChange={setDraft}
        onStart={() => {
          setEditing(false);
          startRelay(draft);
        }}
      />
    );
  }

  if (screen === "session" && route.length > 0) {
    return (
      <RelaySession
        audioEnabled={preferences.audioEnabled}
        key={route.map((step) => step.id).join("-")}
        onFinish={finishSession}
        route={route}
      />
    );
  }

  if (screen === "complete") {
    return (
      <Completion
        audioEnabled={preferences.audioEnabled}
        duration={preferences.duration}
        endedEarly={endedEarly}
        extensionUsed={extensionUsed}
        onExtend={() => {
          setExtensionUsed(true);
          setRoute([buildExtension(preferences.feeling)]);
          setScreen("session");
        }}
        onFinish={returnHome}
        onReady={returnHome}
      />
    );
  }

  return (
    <>
      <Home
        onChange={updatePreferences}
        onSettings={() => setSettingsOpen(true)}
        onStart={() => startRelay()}
        preferences={preferences}
      />
      {settingsOpen && (
        <SettingsPanel
          onAudioChange={(audioEnabled) =>
            updatePreferences({ ...preferences, audioEnabled })
          }
          onClose={() => setSettingsOpen(false)}
          onEdit={() => {
            setDraft(preferences);
            setEditing(true);
            setSettingsOpen(false);
            setScreen("stations");
          }}
          onReset={() => {
            clearPreferences();
            setPreferences(DEFAULT_PREFERENCES);
            setDraft(DEFAULT_PREFERENCES);
            setSettingsOpen(false);
            setEditing(false);
            setScreen("stations");
          }}
          preferences={preferences}
        />
      )}
    </>
  );
}
