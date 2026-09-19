import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Command, Eye, Github, Youtube } from 'lucide-react';
import { SiCplusplus, SiCss, SiHtml5, SiJavascript, SiKofi, SiPython } from 'react-icons/si';

const socials = [
  { label: 'X', href: 'https://x.com/Zeph_Knight_', icon: Command },
  { label: 'GitHub', href: 'https://github.com/ZephKrnl', icon: Github },
  { label: 'YouTube', href: 'https://www.youtube.com/@ZephKnightLOL', icon: Youtube },
];
const projects = [
  { number: '01', title: 'Discord Presence', description: 'A desktop companion that brings Rich Presence and live status to the profile.', href: 'https://github.com/ZephKrnl' },
];
const skills = [
  { label: 'JavaScript', Icon: SiJavascript },
  { label: 'C++', Icon: SiCplusplus },
  { label: 'HTML', Icon: SiHtml5 },
  { label: 'CSS', Icon: SiCss },
  { label: 'Python', Icon: SiPython },
];

type DiscordProfile = {
  username: string;
  avatarUrl: string;
  bannerUrl?: string;
};
type DiscordActivity = {
  name: string;
  details?: string;
  state?: string;
  imageUrl?: string;
  trackUrl?: string;
  startedAt?: number;
  endsAt?: number;
};
type GuestbookEntry = {
  id: string;
  name: string;
  message: string;
  createdAt: string;
  approved: boolean;
};

function ZephLogo() {
  return (
    <svg className="zeph-logo" viewBox="0 0 64 64" role="img" aria-label="Zeph logo">
      <path d="M12 16h40L19 48h33" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
      <path d="M12 16v32M52 16v32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" opacity=".58" />
      <circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 5" opacity=".38" />
    </svg>
  );
}

function App() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [entryText, setEntryText] = useState('');
  const [entryLeaving, setEntryLeaving] = useState(false);
  const [entered, setEntered] = useState(false);
  const [cursor, setCursor] = useState({ x: -100, y: -100 });
  const [cursorHover, setCursorHover] = useState(false);
  const [discordStatus, setDiscordStatus] = useState<'online' | 'idle' | 'dnd' | 'offline'>('offline');
  const [discordProfile, setDiscordProfile] = useState<DiscordProfile | null>(null);
  const [oauthProfile, setOauthProfile] = useState<DiscordProfile | null>(null);
  const [discordActivity, setDiscordActivity] = useState<DiscordActivity | null>(null);
  const [viewCount, setViewCount] = useState(0);
  const [guestbook, setGuestbook] = useState<GuestbookEntry[]>([]);
  const [guestbookName, setGuestbookName] = useState('');
  const [guestbookMessage, setGuestbookMessage] = useState('');
  const [guestbookNotice, setGuestbookNotice] = useState('');

  useEffect(() => {
    const word = 'ENTER';
    let index = 0;
    const interval = window.setInterval(() => {
      index += 1;
      setEntryText(word.slice(0, index));
      if (index >= word.length) window.clearInterval(interval);
    }, 180);
    return () => window.clearInterval(interval);
  }, []);

  const playTone = (frequency: number, duration: number, volume: number) => {
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;
    if (context.state === 'suspended') void context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = 'square';
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  };

  const enterSite = () => {
    if (entryLeaving || entered) return;
    playTone(180, .16, .045);
    setEntryLeaving(true);
    window.setTimeout(() => setEntered(true), 760);
  };

  useEffect(() => {
    const onEntryKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        enterSite();
      }
    };
    window.addEventListener('keydown', onEntryKeyDown);
    return () => window.removeEventListener('keydown', onEntryKeyDown);
  });

  useEffect(() => {
    document.title = 'Zeph — Digital freedom is an illusion.';
    void fetch('/api/views', { method: 'POST' })
        .then((response) => response.json())
        .then((data: { views?: number }) => setViewCount(data.views ?? 0))
        .catch(() => undefined);
    void fetch('/api/guestbook')
      .then((response) => response.json())
      .then((data: { entries?: GuestbookEntry[] }) => setGuestbook(data.entries ?? []))
      .catch(() => undefined);
    const onMove = (event: MouseEvent) => setCursor({ x: event.clientX, y: event.clientY });
    const onOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      setCursorHover(Boolean(target.closest('a, button')));
    };
    const onTiltMove = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('.social-button, .project-card, .guestbook-note');
      if (!target || window.matchMedia('(pointer: coarse), (prefers-reduced-motion: reduce)').matches) return;
      const bounds = target.getBoundingClientRect();
      const rotateX = ((event.clientY - bounds.top) / bounds.height - 0.5) * -5;
      const rotateY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 5;
      target.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
      target.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
    };
    const onTiltLeave = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('.social-button, .project-card, .guestbook-note');
      target?.style.setProperty('--tilt-x', '0deg');
      target?.style.setProperty('--tilt-y', '0deg');
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseover', onOver);
    window.addEventListener('mousemove', onTiltMove);
    window.addEventListener('mouseout', onTiltLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onOver);
      window.removeEventListener('mousemove', onTiltMove);
      window.removeEventListener('mouseout', onTiltLeave);
    };
  }, []);

  const submitGuestbook = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGuestbookNotice('');
    const response = await fetch('/api/guestbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: guestbookName, message: guestbookMessage }),
    });
    const data = (await response.json()) as { message?: string; error?: string };
    setGuestbookNotice(data.message ?? data.error ?? 'Unable to send message.');
    if (response.ok) {
      setGuestbookName('');
      setGuestbookMessage('');
    }
  };

  useEffect(() => {
    let active = true;

    const applyStatus = (status: { status?: 'online' | 'idle' | 'dnd' | 'offline'; profile?: DiscordProfile | null; activity?: DiscordActivity | null }) => {
      if (!active) return;
      setDiscordStatus(status.status ?? 'offline');
      setDiscordProfile(status.profile ?? null);
      setDiscordActivity(status.activity ?? null);
    };

    const checkDiscordPresence = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8765/status');
        if (!response.ok) throw new Error('Presence bridge unavailable');
        applyStatus((await response.json()) as {
          status?: 'online' | 'idle' | 'dnd' | 'offline';
          profile?: DiscordProfile | null;
          activity?: DiscordActivity | null;
        });
      } catch {
        if (active) {
          setDiscordStatus('offline');
          setDiscordProfile(null);
          setDiscordActivity(null);
        }
      }
    };

    void checkDiscordPresence();
    const events = new EventSource('http://127.0.0.1:8765/events');
    events.onmessage = (event) => applyStatus(JSON.parse(event.data));
    events.onerror = () => events.close();
    const refresh = window.setInterval(() => {
      void checkDiscordPresence();
    }, 5000);
    return () => {
      active = false;
      events.close();
      window.clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    void fetch('/api/discord/profile')
      .then((response) => response.json())
      .then((data: { profile?: DiscordProfile | null }) => setOauthProfile(data.profile ?? null))
      .catch(() => setOauthProfile(null));
  }, []);

  const spotifyEmbedUrl = discordActivity?.trackUrl?.replace(
    'https://open.spotify.com/track/',
    'https://open.spotify.com/embed/track/',
  );

  return (
    <>
      {!entered && (
        <section className={`entry-screen ${entryLeaving ? 'is-leaving' : ''}`} aria-label="Enter site">
          <div className="entry-grid" aria-hidden="true" />
          <div className="entry-content">
            <button className="enter-button" type="button" onClick={enterSite} autoFocus aria-label="Enter site">
              {entryText || 'ENTER'}<span className="entry-caret" aria-hidden="true">_</span>
            </button>
          </div>
        </section>
      )}
      <main className={`zeph-app ${entered ? 'site-entered' : ''}`} id="top">
      <video
        className="background-video"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      >
        <source src="/assets/background.mp4" type="video/mp4" />
      </video>
      <div className="background-shade" aria-hidden="true" />
      <div className="background-vignette" aria-hidden="true" />

      <div className="cursor-dot" style={{ left: cursor.x, top: cursor.y }} aria-hidden="true" />
      <div className={`cursor-ring ${cursorHover ? 'cursor-hover' : ''}`} style={{ left: cursor.x, top: cursor.y }} aria-hidden="true" />

      <a
        className="kofi-button"
        href="https://ko-fi.com/zephknight"
        target="_blank"
        rel="noreferrer"
        aria-label="Donate on Ko-fi"
        data-testid="link-kofi"
      >
        <SiKofi aria-hidden="true" />
        <span className="kofi-tooltip" role="tooltip">Donate</span>
      </a>

      <section className="profile-surface" id="profile" aria-label="Zeph profile">
        <h1>Zeph</h1>
        <p className="profile-tagline">Digital freedom is an illusion.</p>

        {(oauthProfile || (discordStatus !== 'offline' && discordProfile)) && (
          <div className="profile-card" data-testid="card-profile">
            <img src={(oauthProfile ?? discordProfile)!.avatarUrl} alt={`${(oauthProfile ?? discordProfile)!.username} avatar`} className="profile-avatar" />
            <div className="profile-card-copy">
              <strong>{(oauthProfile ?? discordProfile)!.username}</strong>
              {discordActivity && (
                <>
                  <span className="profile-activity-status">listening now</span>
                  <span className="profile-activity">
                    {discordActivity.details ?? discordActivity.name}
                    {discordActivity.state ? ` - ${discordActivity.state}` : ''}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        <nav className="socials" aria-label="Social links">
          {socials.map(({ label, href, icon: Icon }) => (
            <a href={href} target="_blank" rel="noreferrer" className="social-button" key={label} aria-label={label} data-testid={`link-social-${label.toLowerCase()}`}>
              {label === 'X' ? <span className="social-letter">X</span> : <Icon aria-hidden="true" />}
            </a>
          ))}
        </nav>

        <div className="profile-meta">
          <span>
            <i className={`online-dot status-${discordStatus}`} aria-hidden="true" />
            {discordStatus === 'dnd'
              ? 'do not disturb'
              : discordStatus === 'offline'
                ? 'offline'
                : discordStatus}
          </span>
          <span>3 socials</span>
        </div>
        <div className="view-count"><Eye aria-hidden="true" /> <span>{viewCount} views</span></div>

      </section>

      <nav className="section-index" aria-label="Page sections">
        <a href="#profile">profile</a>
        <a href="#about">about me</a>
        <a href="#projects">projects</a>
        <a href="#sticky-notes">sticky notes</a>
      </nav>

      <section className="about-section" id="about" aria-label="About me">
        <div className="about-heading">
          <span className="eyebrow">in my own words</span>
          <h2>about me</h2>
        </div>
        <div className="about-layout">
          <div className="about-copy">
            <p>I'm just a guy who likes to live on his own terms.</p>
            <p>Freedom and independence are important values to me. Being able to do whatever I want, create my own future, and live however I want to is what drives me.</p>
            <p>My main hobbies are coding and working with technology. I mostly use Python and C++ languages, and learning HTML, CSS, and JavaScript. Quite frankly, I can code all day and never get tired of it.</p>
            <p>Right now, I'm studying economics and finance, and my ultimate goal is to obtain an IT degree. One of my aims is to work at Google, or even NVIDIA company.</p>
            <p>I'm not really interested in politics. Too stressful for me, so I prefer to invest my efforts into learning, building something and being useful for somebody.</p>
            <p>In the long run, I would like to accumulate considerable financial assets - both for me and for my country of choice. I want to be completely transparent about my activities and finances, though the exact country will be kept secret for now.</p>
            <p>In general, I would like to establish a business and be a CEO with my partner, living life freely.</p>
            <p>At some point of time, when I'm happy with everything, I'll say 'enough'.</p>
          </div>
          <div className="about-facts" aria-label="Skill set">
            <span className="skills-label">skill set</span>
            <div className="skills-grid">
              {skills.map(({ label, Icon }) => (
                <div className="skill-item" key={label}>
                  <Icon aria-hidden="true" />
                  <strong>{label}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="projects-section" id="projects" aria-label="Projects">
        <div className="projects-heading">
          <span className="eyebrow">selected work</span>
          <h2>projects</h2>
        </div>
        <div className={`projects-grid ${projects.length === 1 ? 'projects-grid-single' : ''}`}>
          {projects.map((project) => (
            <a className="project-card" href={project.href} target="_blank" rel="noreferrer" key={project.number}>
              <span className="project-number">{project.number}</span>
              <strong>{project.title}</strong>
              <p>{project.description}</p>
              <span className="project-link">view project ↗</span>
            </a>
          ))}
        </div>
      </section>

      <a className="guestbook-cue" href="#sticky-notes" aria-label="Scroll to sticky notes">
        <span>sticky notes</span>
        <ArrowDown aria-hidden="true" />
      </a>

      <section className="guestbook" id="sticky-notes" aria-label="Sticky notes">
        <div className="guestbook-heading">
          <span className="eyebrow">a little space below</span>
          <h2>sticky notes</h2>
        </div>
        <form className="guestbook-form" onSubmit={submitGuestbook}>
          <input value={guestbookName} onChange={(event) => setGuestbookName(event.target.value)} placeholder="name" maxLength={40} required />
          <textarea value={guestbookMessage} onChange={(event) => setGuestbookMessage(event.target.value)} placeholder="message" maxLength={280} required />
          <button type="submit">sign it</button>
        </form>
        {guestbookNotice && <p className="guestbook-notice">{guestbookNotice}</p>}
        <div className="guestbook-entries">
          {guestbook.length === 0 && <span className="guestbook-empty">No messages yet.</span>}
          {guestbook.map((entry, index) => <article className={`guestbook-note note-${index % 5}`} key={entry.id}><strong>{entry.name}</strong><p>{entry.message}</p></article>)}
        </div>
        <a className="guestbook-back" href="#top" aria-label="Back to profile">
          <ArrowDown aria-hidden="true" />
          <span>back up</span>
        </a>
      </section>

      {discordActivity && (
        <aside
          className="music-banner"
          aria-label="Play current song"
        >
          {spotifyEmbedUrl && (
            <iframe
              className="spotify-player"
              src={`${spotifyEmbedUrl}?utm_source=generator&theme=0`}
              title={`Play ${discordActivity.details ?? discordActivity.name} on Spotify`}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          )}
        </aside>
      )}

      </main>
    </>
  );
}

export default App;