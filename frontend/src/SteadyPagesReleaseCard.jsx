import { BellRing, BookOpen, Mic, PhoneOff, Quote, ShieldCheck, SlidersHorizontal, Trophy, UsersRound } from "lucide-react";
import "./SteadyPagesReleaseCard.css";

const HIGHLIGHT_ICONS = [PhoneOff, Mic, ShieldCheck, Trophy, UsersRound, SlidersHorizontal, Quote, BellRing];

export default function SteadyPagesReleaseCard({ release }) {
  return (
    <article className="steady-release-card" aria-label={`Version ${release.version}, ${release.title}`}>
      <span className="steady-release-aurora" aria-hidden="true" />
      <header className="steady-release-topline">
        <span className="steady-release-new">NEW</span>
        <time className="steady-release-date">{release.date}</time>
      </header>
      <div className="steady-release-hero">
        <div className="steady-release-version-block">
          <span className="steady-release-version" data-version={`v${release.version}`} aria-label={`Version ${release.version}`}>v{release.version}</span>
          <span className="steady-release-kicker"><BookOpen size={12} /> READING COMPANION</span>
        </div>
        <div className="steady-release-heading">
          <h3>{release.title || "Steady Pages"}</h3>
          <p>{release.subtitle || "A steadier way to read, ask, save, and stay in the loop."}</p>
        </div>
      </div>
      <div className="steady-release-highlights">
        {(release.items || []).map((item, index) => {
          const Icon = HIGHLIGHT_ICONS[index % HIGHLIGHT_ICONS.length];
          return (
            <div className="steady-release-highlight" key={`${release.version}-${index}`} style={{ "--steady-delay": `${100 + index * 55}ms` }}>
              <span className="steady-release-icon"><Icon size={15} aria-hidden="true" /></span>
              <p>{item.text}</p>
            </div>
          );
        })}
      </div>
    </article>
  );
}