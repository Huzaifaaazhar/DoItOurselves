/** Shown when the phone can't run WebGL: a poster of the game instead of a broken screen. */
export default function Fallback() {
  return (
    <main className="fixed inset-0 flex flex-col justify-end bg-ink bg-cover bg-center p-4 pb-[calc(24px+env(safe-area-inset-bottom))]"
      style={{ backgroundImage: "linear-gradient(180deg, rgb(20 17 14 / 0) 30%, rgb(20 17 14 / 0.95) 75%), url(/poster.jpg)" }}>
      <h1 className="font-display text-2xl font-black uppercase leading-[0.95] text-paper">University Road Rider</h1>
      <p className="mt-2 max-w-[34ch] font-ui text-xs text-paper/80">
        This phone can't run the 3D game. Try updating your browser, or open it on a newer phone.
      </p>
    </main>
  );
}
