// The boot sequence: load the dataset, then mount the app.
//
// This component exists because engine/index.ts stopped building itself at
// import time. Nothing that imports the engine barrel may be evaluated until
// initEngine() has resolved, and App.tsx statically imports every page — so App
// itself is loaded lazily, and that import is only reached once the engine is
// ready. Getting this wrong is not subtle: a page module evaluating early
// throws out of getLiveEngine() or baseFacts() with a message naming this file.
//
// The shape here is deliberately the shape a real deployment needs. Today the
// awaited work is a dynamic import of the parsed YAML; when the facts come from
// an API it becomes a fetch, and only the body of initEngine() changes. The
// loading and failed states are already rendered, so no page has to grow a
// spinner or an error branch later.
//
// One behaviour worth knowing about: createEngine() runs validateDerivations(),
// which throws when the dataset's derived integrity checks fail. That used to
// happen during module evaluation and showed up as a blank page with a console
// trace. It now lands in the failed state below, which says what broke.
//
// The order is sign in -> load facts -> app. Authentication comes first because
// a real API cannot answer for a tenant it has not authenticated, and that is
// the shape this needs to keep once the facts come from one. It is also why
// Login is imported statically while App is not: the login screen has to render
// without pulling the page bundle, and App still drags in every page.
//
// The cost is that the dataset does not start loading until someone signs in,
// so the splash below is what they see for a beat afterwards rather than before.
// That is the right trade — nothing should be fetched on behalf of a visitor who
// has not said who they are.
import { lazy, Suspense, useEffect, useState } from "react";
import { initEngine } from "./engine";
import { applyTheme, storedThemeMode, C, FONT_IMPORT } from "./theme";
import { useUser } from "./auth/useUser";
import Login from "./pages/Login";

const App = lazy(() => import("./App"));

type BootState =
  | { phase: "loading" }
  | { phase: "ready" }
  | { phase: "failed"; message: string };

// The dataset parses fast enough locally that showing a spinner immediately
// reads as a flash of unrelated content. Hold it back briefly; a load that
// finishes inside the delay never paints a splash at all.
const SPINNER_DELAY_MS = 200;

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ background: C.bg, minHeight: "100dvh", padding: 24 }}
    >
      <style>{FONT_IMPORT}</style>
      {children}
    </div>
  );
}

function Loading() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), SPINNER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return <Splash>{null}</Splash>;

  return (
    <Splash>
      <div className="flex flex-col items-center gap-3">
        <div
          className="rounded-full"
          style={{
            width: 26, height: 26,
            border: `2px solid ${C.panel2}`,
            borderTopColor: C.accent,
            animation: "grc-boot-spin 700ms linear infinite",
          }}
        />
        <div style={{ color: C.muted, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Loading assurance model
        </div>
        <style>{"@keyframes grc-boot-spin { to { transform: rotate(360deg); } }"}</style>
      </div>
    </Splash>
  );
}

function Failed({ message }: { message: string }) {
  return (
    <Splash>
      <div
        className="rounded-xl"
        style={{ background: C.panel, border: `1px solid ${C.border}`, padding: 20, maxWidth: 620 }}
      >
        <div style={{ color: C.red, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          The assurance model failed to load
        </div>
        <div style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>
          The dataset did not pass its integrity checks, so no page can render a number from it.
          Nothing has been changed or saved.
        </div>
        <pre
          className="rounded-lg"
          style={{
            background: C.bg, border: `1px solid ${C.border}`, color: C.ink,
            fontSize: 11, padding: 12, margin: 0, whiteSpace: "pre-wrap", overflowX: "auto",
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          {message}
        </pre>
      </div>
    </Splash>
  );
}

export default function Boot() {
  const [state, setState] = useState<BootState>({ phase: "loading" });
  const user = useUser();

  // Painted before the engine resolves, so the splash matches the theme the
  // user last chose instead of the module default. App re-applies it on mount.
  applyTheme(storedThemeMode());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    initEngine().then(
      () => {
        if (!cancelled) setState({ phase: "ready" });
      },
      (error: unknown) => {
        if (cancelled) return;
        console.error("initEngine failed", error);
        setState({ phase: "failed", message: error instanceof Error ? error.message : String(error) });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <>
        <style>{FONT_IMPORT}</style>
        <Login />
      </>
    );
  }

  if (state.phase === "failed") return <Failed message={state.message} />;
  if (state.phase === "loading") return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      <App />
    </Suspense>
  );
}
