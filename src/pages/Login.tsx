import React, { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, KeyRound } from "lucide-react";
import { C } from "../theme";

// No real authentication is wired up yet — this is a UI gate only.
// Either submitting the form or clicking SSO just calls onLogin().
type LoginField = "email" | "password";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<LoginField | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onLogin();
  }

  const fieldStyle = (name: LoginField): CSSProperties => ({
    background: C.panel2,
    border: `1px solid ${focused === name ? C.accent : C.border}`,
    color: C.ink,
    boxShadow: focused === name ? `0 0 0 3px ${C.accentBg}` : "none",
    transition: "border-color 120ms ease, box-shadow 120ms ease",
  });

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden" style={{ background: C.bg }}>
      <Backdrop />

      <div className="relative z-10 flex flex-col items-center px-6 py-12 w-full">
        <div
          className="w-full rounded-[22px] px-9 pt-9 pb-8"
          style={{
            maxWidth: 392,
            background: C.panel,
            border: `1px solid ${C.border}`,
            boxShadow: "0 1px 2px rgba(15,20,32,0.04), 0 24px 48px -12px rgba(15,20,32,0.18)",
          }}
        >
          {/* Brand mark */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex items-center gap-2 mb-3">
              <ShieldMark size={22} />
              <span
                className="text-[15px] font-bold tracking-[0.14em]"
                style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}
              >
                ACME ASSURE
              </span>
            </div>
            <span
              className="text-[10px] tracking-[0.28em] uppercase"
              style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}
            >
              Enterprise Trust
            </span>
          </div>

          <div className="text-center mb-7">
            <h1
              className="text-[22px] font-bold mb-1"
              style={{ color: C.ink, fontFamily: "'Source Serif 4', serif" }}
            >
              Welcome back
            </h1>
            <p className="text-[13px]" style={{ color: C.muted }}>
              Sign in to continue to your workspace
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label
              className="block text-[10px] font-semibold mb-1.5 tracking-[0.1em] uppercase"
              style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}
            >
              Email
            </label>
            <div className="relative mb-4">
              <Mail size={15} className="absolute top-1/2 -translate-y-1/2 left-3.5 pointer-events-none" color={C.muted} />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                className="w-full rounded-[10px] pl-10 pr-3.5 py-2.5 text-sm outline-none"
                style={fieldStyle("email")}
              />
            </div>

            <div className="flex items-center justify-between mb-1.5">
              <label
                className="block text-[10px] font-semibold tracking-[0.1em] uppercase"
                style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}
              >
                Password
              </label>
              <span className="text-[11.5px] font-medium cursor-pointer" style={{ color: C.accent }}>
                Forgot password?
              </span>
            </div>
            <div className="relative mb-6">
              <Lock size={15} className="absolute top-1/2 -translate-y-1/2 left-3.5 pointer-events-none" color={C.muted} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                className="w-full rounded-[10px] pl-10 pr-10 py-2.5 text-sm outline-none"
                style={fieldStyle("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute top-1/2 -translate-y-1/2 right-3.5"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={15} color={C.muted} /> : <Eye size={15} color={C.muted} />}
              </button>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-sm font-semibold group"
              style={{ background: C.accent, color: "#fff", transition: "opacity 120ms ease" }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.92")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Sign in
              <ArrowRight size={14} />
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: C.border }} />
              <span
                className="text-[10px] tracking-[0.14em] uppercase"
                style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace" }}
              >
                Or continue with
              </span>
              <div className="flex-1 h-px" style={{ background: C.border }} />
            </div>

            <button
              type="button"
              onClick={onLogin}
              className="w-full flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-sm font-semibold"
              style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.ink }}
            >
              <KeyRound size={14} color={C.accent} />
              Single sign-on
            </button>
          </form>
        </div>

        <div
          className="mt-6 text-[10px] tracking-[0.08em] uppercase"
          style={{ color: C.muted, fontFamily: "'IBM Plex Mono', monospace", opacity: 0.75 }}
        >
          Prototype environment · credentials are not verified
        </div>
      </div>
    </div>
  );
}

function ShieldMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.96} viewBox="0 0 48 46" fill="none">
      <defs>
        <linearGradient id="loginShieldGrad" x1="0" y1="0" x2="48" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.accent} />
          <stop offset="1" stopColor={C.accentStrong} />
        </linearGradient>
      </defs>
      <path
        fill="url(#loginShieldGrad)"
        d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"
      />
    </svg>
  );
}

// Quiet backdrop: a soft accent glow over a fine dot-grid, evoking a control
// matrix without illustrating anything literal.
function Backdrop() {
  const dotColor = `color-mix(in srgb, ${C.border} 55%, transparent)`;
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(${dotColor} 1px, transparent 1px)`,
          backgroundSize: "26px 26px",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 720,
          height: 720,
          top: -260,
          left: "50%",
          transform: "translateX(-50%)",
          background: `radial-gradient(circle, ${C.accentBg} 0%, transparent 68%)`,
        }}
      />
    </div>
  );
}
