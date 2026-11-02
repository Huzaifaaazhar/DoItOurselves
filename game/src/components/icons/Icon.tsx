import { ICONS, IconName } from "./paths";

export type { IconName };

/** React version of the icon set; same paths as the DOM screens. */
export function Icon({ name, size = 22, label, className }: { name: IconName; size?: number; label?: string; className?: string }) {
  return (
    <svg
      className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
