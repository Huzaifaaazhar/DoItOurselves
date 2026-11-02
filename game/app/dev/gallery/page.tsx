import { notFound } from "next/navigation";
import { Icon } from "@/components/icons/Icon";
import { ICONS, IconName } from "@/components/icons/paths";

// Dev-only: every icon and UI component in every state. Built only with NEXT_PUBLIC_DEV_ROUTES=1.
export default function Gallery() {
  if (process.env.NEXT_PUBLIC_DEV_ROUTES !== "1") notFound();
  const names = Object.keys(ICONS) as IconName[];
  return (
    <div className="fixed inset-0 overflow-y-auto bg-ink p-4 font-ui text-paper" style={{ touchAction: "pan-y" }}>
      <div className="mx-auto flex max-w-[960px] flex-col gap-6">
        <h1 className="font-display text-xl font-black uppercase leading-[0.95]">UI kit · University Road Rider</h1>

        <Section title="Icons (24px grid, 1.75 stroke)">
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
            {names.map(n => (
              <div key={n} className="flex flex-col items-center gap-1 rounded-plate border border-paper/10 p-2 text-[11px] text-paper/70">
                <Icon name={n} size={28} className="text-warn" />{n}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Buttons: default · hover · focus · pressed · disabled · loading">
          <div className="grid gap-3 sm:grid-cols-3">
            <button className="btn primary"><Icon name="bike" size={26} /> Ride</button>
            <button className="btn primary" style={{ background: "rgb(255 222 92)" }}>Hover</button>
            <button className="btn primary" style={{ outline: "3px solid rgb(var(--warn))", outlineOffset: 3 }}>Focus</button>
            <button className="btn primary" style={{ transform: "translateY(2px) scale(.985)", filter: "brightness(.92)" }}>Pressed</button>
            <button className="btn primary" disabled>Disabled</button>
            <button className="btn primary" aria-busy="true"><span className="spinner" /> Loading</button>
            <button className="btn"><Icon name="wrench" /> Secondary</button>
            <button className="btn" disabled><Icon name="wrench" /> Disabled</button>
            <button className="btn" style={{ boxShadow: "inset 0 0 0 1.5px rgb(var(--alert))", color: "rgb(var(--alert))" }}>Error</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="icon-btn" aria-label="Back"><Icon name="back" /></button>
            <button className="icon-btn" aria-label="Settings"><Icon name="settings" /></button>
            <button className="icon-btn" aria-label="Pause"><Icon name="pause" /></button>
            <span className="pill coin-pill"><Icon name="coin" size={18} /> 240</span>
          </div>
        </Section>

        <Section title="Chips & toggles">
          <div className="chips">
            <button className="chip on"><Icon name="sun" size={18} />Day</button>
            <button className="chip"><Icon name="dusk" size={18} />Evening rush</button>
            <button className="chip"><Icon name="moon" size={18} />Night</button>
            <button className="chip" disabled style={{ opacity: 0.4 }}><Icon name="rain" size={18} />Disabled</button>
          </div>
          <div className="mt-3 flex gap-3">
            <button className="toggle on" role="switch" aria-checked="true" aria-label="On" />
            <button className="toggle" role="switch" aria-checked="false" aria-label="Off" />
          </div>
        </Section>

        <Section title="HUD labels, banners, toast">
          <div className="relative flex flex-wrap items-center gap-2 rounded-card p-4" style={{ background: "#c9a877" }}>
            <div className="hud-coin-badge static">C</div>
            <span className="tag-box">Distance: 1.2km</span>
            <span className="tag-box">Coins: 45</span>
            <span className="tag-box status">Road is rugged</span>
            <span className="tag-box status ok">Road is smooth</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            <div id="banner-demo-goal" className="show goal" style={{ position: "static", opacity: 1, transform: "none" }}><span className="banner-demo">GOAL: Reach NED University (6.0km)</span></div>
            <div className="show swerve" style={{ position: "static" }}><span className="banner-demo swerve"><Icon name="arrowLeft" size={26} /> SWERVE!</span></div>
          </div>
        </Section>

        <Section title="List rows, progress, stars">
          <div className="flex flex-col gap-2">
            <div className="item"><div className="ic"><Icon name="engine" size={24} /></div><div className="tx"><b>Engine tuning</b><small>Higher top speed</small><div className="pips">{[1, 1, 0, 0, 0].map((on, i) => <i key={i} className={on ? "on" : ""} />)}</div></div><button className="buy"><Icon name="coin" size={16} /> 173</button></div>
            <div className="item"><div className="ic"><Icon name="helmet" size={24} /></div><div className="tx"><b>Helmet & guards</b><small>Not enough coins</small></div><button className="buy" disabled><Icon name="coin" size={16} /> 70</button></div>
            <div className="item"><div className="ic"><Icon name="magnet" size={24} /></div><div className="tx"><b>Coin magnet</b><small>Maxed out</small></div><span className="done">MAX</span></div>
          </div>
          <div className="meter mt-4"><i style={{ width: "42%" }} /></div>
          <div className="stars mt-3">{[1, 1, 0].map((on, i) => <span key={i} className={on ? "on" : ""}><Icon name="star" size={24} /></span>)}</div>
        </Section>

        <Section title="Road upgrade">
          <div className="upgrade-card">
            <div className="conds">{(["pothole", "manhole", "gutter", "breaker", "barrier"] as IconName[]).map((n, i) => <div key={n} className={`cond ${i === 0 ? "hot" : ""}`}><span><Icon name={n} size={24} /></span><small>{n}</small></div>)}</div>
            <div className="fix-grid"><button className="fix-btn">Fix Potholes<small>(40 C)</small></button><button className="fix-btn" disabled>Finish BRT<small>(90 C)</small></button></div>
            <button className="pave-btn">Paving Hassan Segment <small>(610 C)</small></button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="label mb-3">{title}</h2>
      {children}
    </section>
  );
}
