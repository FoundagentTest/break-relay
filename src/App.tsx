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
import { getRelayCapabilities, speakCue } from "./capabilities";
import {
  completeSession,
  createSession,
  markCueAnnounced,
  pauseSession,
  reconcileSession,
  remainingMs,
  replaceWithExtension,
  resumeSession,
  shouldAnnounceCue,
  skipStep,
} from "./session";
import {
  clearPreferences,
  clearSession,
  loadPreferences,
  loadSession,
  savePreferences,
  saveSession,
} from "./storage";
import type {
  ActiveSession,
  Feeling,
  Preferences,
  SpaceMode,
  Station,
} from "./types";

type Screen =
  | "stations"
  | "tune"
  | "home"
  | "readiness"
  | "recover"
  | "session"
  | "complete";

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
  return getRelayCapabilities().speech;
}

function speak(text: string, onError?: () => void) {
  speakCue(text, onError);
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

function Readiness({
  preferences,
  onBack,
  onStart,
}: {
  preferences: Preferences;
  onBack: () => void;
  onStart: (options: { audioEnabled: boolean; keepAwake: boolean }) => void;
}) {
  const capabilities = useMemo(getRelayCapabilities, []);
  const [visualOnly, setVisualOnly] = useState(
    preferences.audioEnabled && !capabilities.speech,
  );
  const [audioReady, setAudioReady] = useState(
    !preferences.audioEnabled || !capabilities.speech,
  );
  const [keepAwake, setKeepAwake] = useState(false);
  const audioEnabled =
    preferences.audioEnabled && capabilities.speech && !visualOnly;

  function checkAudio() {
    speak(
      "Break Relay is ready. The next cue will name one place and one action.",
      () => setVisualOnly(true),
    );
    setAudioReady(true);
  }

  return (
    <main className="readiness-page">
      <header className="setup-header">
        <Brand />
        <button className="text-button" onClick={onBack} type="button">
          Back
        </button>
      </header>
      <section className="readiness-shell">
        <div className="readiness-copy">
          <p className="eyebrow">BEFORE YOU STEP AWAY</p>
          <h1>Set a boundary this browser can keep.</h1>
          <p className="lede">
            Your exact route and deadline stay on this device. If the tab sleeps
            or reloads, Relay catches up to the one cue that matters now.
          </p>
        </div>

        <div className="readiness-grid">
          <section className="readiness-checks" aria-label="Screen-away readiness">
            <article className="capability-card">
              <span className="capability-icon">
                <Icon name="sound" />
              </span>
              <div>
                <p className="capability-label">
                  {capabilities.speech ? "SPOKEN CUES AVAILABLE" : "VISUAL CUES ONLY"}
                </p>
                <h2>
                  {capabilities.speech
                    ? "Let your browser speak once."
                    : "This browser cannot speak the route."}
                </h2>
                <p>
                  {capabilities.speech
                    ? "A cue can play while this page remains active. Background and locked-screen delivery still depends on your browser and operating system."
                    : "Keep the dim cue page visible when possible. Relay will still recover the correct step and deadline when you return."}
                </p>
                {preferences.audioEnabled && capabilities.speech && !visualOnly && (
                  <button
                    className={`secondary-button audio-check ${
                      audioReady ? "is-checked" : ""
                    }`}
                    onClick={checkAudio}
                    type="button"
                  >
                    <Icon name={audioReady ? "check" : "play"} size={17} />
                    {audioReady ? "Cue check played" : "Play cue check"}
                  </button>
                )}
                {preferences.audioEnabled && capabilities.speech && (
                  <button
                    className="inline-button visual-only-button"
                    onClick={() => {
                      window.speechSynthesis.cancel();
                      setVisualOnly((current) => !current);
                      setAudioReady(true);
                    }}
                    type="button"
                  >
                    {visualOnly ? "Use spoken cues" : "Use visual cues instead"}
                  </button>
                )}
              </div>
            </article>

            <article className="capability-card">
              <span className="capability-icon">
                <Icon name="spark" />
              </span>
              <div>
                <p className="capability-label">
                  {capabilities.wakeLock ? "SCREEN WAKE AVAILABLE" : "SYSTEM FALLBACK"}
                </p>
                <h2>
                  {capabilities.wakeLock
                    ? "Keep the dim relay surface awake."
                    : "Your screen may sleep normally."}
                </h2>
                <p>
                  {capabilities.wakeLock
                    ? "Optional. This asks the device to keep the display awake only while Relay is visible and running. It releases on pause or finish."
                    : "Relay cannot prevent sleep here. If you need a cue through a locked screen, use your device’s timer as a backup."}
                </p>
                <label className="wake-choice">
                  <input
                    checked={keepAwake && capabilities.wakeLock}
                    disabled={!capabilities.wakeLock}
                    onChange={(event) => setKeepAwake(event.target.checked)}
                    type="checkbox"
                  />
                  <span aria-hidden="true" />
                  <span>Keep this session awake</span>
                </label>
              </div>
            </article>
          </section>

          <aside className="boundary-card">
            <p className="eyebrow">HONEST BOUNDARY</p>
            <strong>{preferences.duration}</strong>
            <span>minutes, measured by the clock</span>
            <p>
              No notifications are required. Locking the device or moving the
              browser fully into the background can silence web audio; your
              route itself will not restart or gain time.
            </p>
            <button
              className="primary-button primary-button--coral primary-button--wide"
              disabled={audioEnabled && !audioReady}
              onClick={() => onStart({ audioEnabled, keepAwake })}
              type="button"
            >
              Start and step away
              <Icon name="arrow" />
            </button>
            {audioEnabled && !audioReady && (
              <small>Play the cue check once, or choose visual cues.</small>
            )}
          </aside>
        </div>
        <PrivacyNote />
      </section>
    </main>
  );
}

function Recovery({
  session,
  onResume,
  onDiscard,
}: {
  session: ActiveSession;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const minutes = Math.max(1, Math.ceil(remainingMs(session) / 60_000));
  const step = session.route[session.currentStepIndex];
  return (
    <main className="recovery-page">
      <header className="setup-header">
        <Brand />
      </header>
      <section className="recovery-shell">
        <p className="eyebrow">RELAY FOUND ON THIS DEVICE</p>
        <h1>Your break is still in progress.</h1>
        <p className="recovery-lede">
          Relay kept the original route and clock. It will not start another
          break or replay the cues you missed.
        </p>
        <div className="recovery-card">
          <div>
            <span>{session.paused ? "PAUSED" : "CURRENT CUE"}</span>
            <strong>{step.station.name}</strong>
            <p>{step.action}</p>
          </div>
          <dl>
            <div>
              <dt>Boundary</dt>
              <dd>
                {session.paused
                  ? `${minutes} min held while paused`
                  : `About ${minutes} min remain`}
              </dd>
            </div>
            <div>
              <dt>Route</dt>
              <dd>
                Step {session.currentStepIndex + 1} of {session.route.length}
              </dd>
            </div>
          </dl>
          <div className="recovery-actions">
            <button
              className="primary-button primary-button--coral"
              onClick={onResume}
              type="button"
            >
              <Icon name="play" size={17} />
              {session.paused ? "Open paused relay" : "Resume this relay"}
            </button>
            <button className="discard-button" onClick={onDiscard} type="button">
              Discard this relay
            </button>
          </div>
        </div>
        <p className="recovery-note">
          Discarding removes only this active relay. Your saved stations stay in
          this browser.
        </p>
      </section>
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

type WakeLockStatus = "idle" | "requesting" | "held" | "released" | "failed";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

function useWakeLock(enabled: boolean) {
  const [status, setStatus] = useState<WakeLockStatus>("idle");

  useEffect(() => {
    const wakeNavigator = navigator as Navigator & {
      wakeLock?: {
        request: (type: "screen") => Promise<WakeLockSentinelLike>;
      };
    };
    let sentinel: WakeLockSentinelLike | null = null;
    let disposed = false;

    async function release() {
      const held = sentinel;
      sentinel = null;
      if (held) {
        try {
          await held.release();
        } catch {
          // A browser may already have released it on visibility change.
        }
      }
    }

    async function request() {
      if (
        !enabled ||
        !wakeNavigator.wakeLock ||
        document.visibilityState !== "visible" ||
        sentinel
      ) {
        return;
      }
      setStatus("requesting");
      try {
        const next = await wakeNavigator.wakeLock.request("screen");
        if (disposed || !enabled) {
          await next.release();
          return;
        }
        sentinel = next;
        setStatus("held");
        next.addEventListener("release", () => {
          sentinel = null;
          if (!disposed) setStatus("released");
        });
      } catch {
        if (!disposed) setStatus("failed");
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") void request();
    }

    if (!enabled) {
      setStatus("idle");
    } else if (!wakeNavigator.wakeLock) {
      setStatus("failed");
    } else {
      void request();
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      void release();
    };
  }, [enabled]);

  return status;
}

function RelaySession({
  session,
  onChange,
  onFinish,
}: {
  session: ActiveSession;
  onChange: (session: ActiveSession) => void;
  onFinish: (session: ActiveSession) => void;
}) {
  const [clock, setClock] = useState(Date.now());
  const [speechFailed, setSpeechFailed] = useState(
    session.audioEnabled && !canUseSpeech(),
  );
  const sessionRef = useRef(session);
  const finishing = useRef(false);
  sessionRef.current = session;
  const step = session.route[session.currentStepIndex];
  const wakeStatus = useWakeLock(
    session.keepAwake && !session.paused && session.status === "active",
  );

  const commit = useCallback(
    (next: ActiveSession) => {
      sessionRef.current = next;
      onChange(next);
    },
    [onChange],
  );

  const announce = useCallback(
    (next: ActiveSession, force = false) => {
      if (!force && !shouldAnnounceCue(next)) {
        commit(next);
        return;
      }
      const cue = next.route[next.currentStepIndex]?.spokenCue;
      if (!cue) return;
      if (next.audioEnabled) {
        speak(cue, () => setSpeechFailed(true));
      } else {
        navigator.vibrate?.([120, 80, 120]);
      }
      const marked = markCueAnnounced(
        force ? { ...next, lastAnnouncedStepId: null } : next,
      );
      commit(marked);
    },
    [commit],
  );

  const finish = useCallback(
    (next: ActiveSession) => {
      if (finishing.current) return;
      finishing.current = true;
      let finished = next;
      if (next.lastAnnouncedStepId !== "__complete__") {
        if (next.audioEnabled) {
          speak(
            next.endedEarly
              ? "Your relay has ended. Return when you are ready."
              : "You are back at the boundary. Return when you are ready.",
            () => setSpeechFailed(true),
          );
        } else {
          navigator.vibrate?.([140, 90, 140]);
        }
        finished = {
          ...next,
          lastAnnouncedStepId: "__complete__",
          updatedAt: Date.now(),
        };
      }
      sessionRef.current = finished;
      onFinish(finished);
    },
    [onFinish],
  );

  useEffect(() => {
    document.title = `${step.station.name} · Break Relay`;
  }, [step.station.name]);

  useEffect(() => {
    function tick() {
      const now = Date.now();
      const current = sessionRef.current;
      const next = reconcileSession(current, now);
      setClock(now);
      if (next.status === "complete") {
        finish(next);
      } else if (next.currentStepIndex !== current.currentStepIndex) {
        announce(next);
      }
    }

    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    window.addEventListener("pageshow", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
      window.removeEventListener("pageshow", tick);
      window.speechSynthesis?.cancel?.();
    };
  }, [announce, finish]);

  const totalRemaining = Math.ceil(remainingMs(session, clock) / 1000);

  function togglePause() {
    const current = sessionRef.current;
    if (current.paused) {
      const resumed = resumeSession(current);
      announce(resumed, true);
    } else {
      window.speechSynthesis?.cancel?.();
      commit(pauseSession(current));
    }
  }

  function skip() {
    window.speechSynthesis?.cancel?.();
    const next = skipStep(sessionRef.current);
    if (next.status === "complete") finish(next);
    else announce(next);
  }

  function endEarly() {
    window.speechSynthesis?.cancel?.();
    finish(completeSession(sessionRef.current, true));
  }

  return (
    <main
      className={`session-page ${session.paused ? "is-paused" : ""} ${
        session.keepAwake ? "is-dim-awake" : ""
      }`}
    >
      <header className="session-header">
        <Brand quiet />
        <div className="session-boundary" aria-live="polite">
          <span>
            {step.kind === "extension"
              ? "QUIET EXTENSION"
              : `STOP ${session.currentStepIndex + 1} OF ${session.route.length}`}
          </span>
          <strong>
            {session.paused ? "Relay paused" : formatBoundary(totalRemaining)}
          </strong>
        </div>
        <button className="end-button" onClick={endEarly} type="button">
          End early
        </button>
      </header>

      <section className="session-shell">
        <div className="session-track" aria-hidden="true">
          {session.route.map((item, index) => (
            <span
              className={`${index < session.currentStepIndex ? "is-done" : ""} ${
                index === session.currentStepIndex ? "is-current" : ""
              }`}
              key={item.id}
            >
              {index < session.currentStepIndex && <Icon name="check" size={13} />}
            </span>
          ))}
        </div>

        <article className="cue-card" aria-live="assertive">
          <div className="cue-kicker">
            <span className="cue-pulse" aria-hidden="true" />
            {session.paused
              ? "PAUSED HERE"
              : step.kind === "return"
                ? "RETURN CUE"
                : "GO TO"}
          </div>
          <h1>{step.station.name}</h1>
          <div className="cue-divider" />
          <p>{step.action}</p>
          {session.paused && (
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
              <Icon name={session.paused ? "play" : "pause"} size={21} />
            </span>
            {session.paused ? "Resume" : "Pause"}
          </button>
          <button
            className="control-button"
            onClick={() => announce(sessionRef.current, true)}
            type="button"
          >
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
        {session.keepAwake && (
          <p className={`wake-status wake-status--${wakeStatus}`} role="status">
            {wakeStatus === "held"
              ? "Dim screen is being kept awake while this page is visible."
              : wakeStatus === "failed"
                ? "This device declined the wake request; the route clock still continues."
                : "Preparing the dim wake surface…"}
          </p>
        )}
        <p className="session-footnote">
          Nothing to tap at the station. If the browser sleeps, Relay catches up
          when it returns.
        </p>
      </section>
    </main>
  );
}

function Completion({
  session,
  interrupted,
  onReady,
  onExtend,
  onFinish,
}: {
  session: ActiveSession;
  interrupted: boolean;
  onReady: () => void;
  onExtend: () => void;
  onFinish: () => void;
}) {
  useEffect(() => {
    document.title = "Return when ready · Break Relay";
  }, []);

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
        <p className="eyebrow">
          {session.endedEarly
            ? "RELAY ENDED"
            : interrupted
              ? "BOUNDARY RECONCILED"
              : "RETURN CUE"}
        </p>
        <h1>
          {session.endedEarly
            ? "Meet the day from here."
            : "You’re back at the boundary."}
        </h1>
        <p className="completion-copy">
          {session.endedEarly
            ? "Stopping early is a complete choice. Come back to the desk when it suits you."
            : interrupted
              ? `The original ${session.durationMinutes}-minute deadline passed while Relay was away. It is complete—no time was added.`
              : `Your ${session.durationMinutes}-minute route is complete. No score, streak, or verdict—just choose what comes next.`}
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
          {!session.extensionUsed && !session.endedEarly && (
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
  const recovered = useMemo(loadSession, []);
  const [preferences, setPreferences] = useState<Preferences>(initial);
  const [draft, setDraft] = useState<Preferences>(initial);
  const [screen, setScreen] = useState<Screen>(
    recovered
      ? recovered.status === "complete"
        ? "complete"
        : "recover"
      : initial.hasOnboarded && initial.stations.length >= 3
        ? "home"
        : "stations",
  );
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [session, setSession] = useState<ActiveSession | null>(recovered);
  const [interruptedCompletion, setInterruptedCompletion] = useState(
    recovered?.status === "complete",
  );
  const [readinessReturn, setReadinessReturn] = useState<"home" | "tune">(
    "home",
  );

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

  const commitSession = useCallback((next: ActiveSession) => {
    setSession(next);
    saveSession(next);
  }, []);

  function openReadiness(source: Preferences, returnTo: "home" | "tune") {
    setDraft(source);
    setReadinessReturn(returnTo);
    setScreen("readiness");
  }

  function startRelay(options: {
    audioEnabled: boolean;
    keepAwake: boolean;
  }) {
    const nextPreferences = {
      ...draft,
      audioEnabled: options.audioEnabled,
      hasOnboarded: true,
    };
    updatePreferences(nextPreferences);
    setDraft(nextPreferences);
    const route = buildRoute(
      nextPreferences.stations,
      nextPreferences.feeling,
      nextPreferences.duration,
    );
    let nextSession = createSession({
      route,
      durationMinutes: nextPreferences.duration,
      audioEnabled: options.audioEnabled,
      keepAwake: options.keepAwake,
    });
    if (options.audioEnabled) {
      speak(route[0].spokenCue);
    } else {
      navigator.vibrate?.([120, 80, 120]);
    }
    nextSession = markCueAnnounced(nextSession);
    commitSession(nextSession);
    setInterruptedCompletion(false);
    setScreen("session");
  }

  const finishSession = useCallback((finished: ActiveSession) => {
    commitSession(finished);
    setInterruptedCompletion(false);
    setScreen("complete");
  }, [commitSession]);

  function returnHome() {
    clearSession();
    setSession(null);
    setScreen("home");
    setInterruptedCompletion(false);
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
          openReadiness(draft, "tune");
        }}
      />
    );
  }

  if (screen === "readiness") {
    return (
      <Readiness
        onBack={() => setScreen(readinessReturn)}
        onStart={startRelay}
        preferences={draft}
      />
    );
  }

  if (screen === "recover" && session?.status === "active") {
    return (
      <Recovery
        onDiscard={() => {
          window.speechSynthesis?.cancel?.();
          clearSession();
          setSession(null);
          setScreen("home");
        }}
        onResume={() => {
          let current = reconcileSession(session);
          if (current.status === "complete") {
            commitSession(current);
            setInterruptedCompletion(true);
            setScreen("complete");
            return;
          }
          if (!current.paused) {
            const cue = current.route[current.currentStepIndex].spokenCue;
            if (current.audioEnabled) speak(cue);
            else navigator.vibrate?.([120, 80, 120]);
            current = markCueAnnounced({
              ...current,
              lastAnnouncedStepId: null,
            });
          }
          commitSession(current);
          setScreen("session");
        }}
        session={session}
      />
    );
  }

  if (screen === "session" && session?.status === "active") {
    return (
      <RelaySession
        key={session.id}
        onChange={commitSession}
        onFinish={finishSession}
        session={session}
      />
    );
  }

  if (screen === "complete" && session) {
    return (
      <Completion
        interrupted={interruptedCompletion}
        onExtend={() => {
          let extension = replaceWithExtension(
            session,
            [buildExtension(preferences.feeling)],
          );
          const cue = extension.route[0].spokenCue;
          if (extension.audioEnabled) speak(cue);
          else navigator.vibrate?.([120, 80, 120]);
          extension = markCueAnnounced(extension);
          commitSession(extension);
          setInterruptedCompletion(false);
          setScreen("session");
        }}
        onFinish={returnHome}
        onReady={returnHome}
        session={session}
      />
    );
  }

  return (
    <>
      <Home
        onChange={updatePreferences}
        onSettings={() => setSettingsOpen(true)}
        onStart={() => openReadiness(preferences, "home")}
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
            clearSession();
            setPreferences(DEFAULT_PREFERENCES);
            setDraft(DEFAULT_PREFERENCES);
            setSession(null);
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
