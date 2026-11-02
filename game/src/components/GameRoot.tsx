"use client";

import { useEffect, useRef, useState } from "react";
import Fallback from "./Fallback";

/** True when the device can run the 3D game: WebGL present and not explicitly low-end. */
function canRun3D() {
  try {
    const c = document.createElement("canvas");
    if (!(c.getContext("webgl2") || c.getContext("webgl"))) return false;
  } catch { return false; }
  const q = new URLSearchParams(location.search);
  if (q.get("fallback") === "1") return false;
  return true;
}

/**
 * Hosts the game. The DOM shell (canvas + UI layers) is rendered by React; the engine and
 * screens attach to it after first paint, so a poster shows instantly while 3D loads.
 */
export default function GameRoot() {
  const [mode, setMode] = useState<"poster" | "game" | "fallback">("poster");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!canRun3D()) { setMode("fallback"); return; }
    setMode("game");
    (async () => {
      const [{ Game }, { UI }] = await Promise.all([import("@/game/Game"), import("@/ui/ui")]);
      const game = new Game(document.getElementById("scene") as HTMLCanvasElement);
      const ui = new UI(game);
      document.addEventListener("backbutton", () => (game.running ? ui.pause() : ui.home()));
      (window as unknown as { __game: unknown }).__game = game;
      document.documentElement.dataset.ready = "1";
    })();
  }, []);

  if (mode === "fallback") return <Fallback />;
  return (
    <>
      <canvas id="scene" />
      {mode === "poster" && <div className="poster" aria-hidden />}
      <div id="flash" />
      <div id="hud" />
      <div id="toast" role="status" aria-live="polite" />
      <div id="banner" role="status" aria-live="assertive" />
      <section id="home" className="layer scrim" />
      <section id="plan" className="layer solid" />
      <section id="garage" className="layer scrim" />
      <section id="fix" className="layer solid" />
      <section id="settings" className="layer solid" />
      <section id="pause" className="layer scrim" />
      <section id="result" className="layer scrim-low" />
      <section id="tutorial" className="layer scrim" />
    </>
  );
}
