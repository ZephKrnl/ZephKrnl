import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, Command, Github, Youtube } from 'lucide-react';
import { SiCplusplus, SiCss, SiHtml5, SiJavascript, SiKofi, SiPython } from 'react-icons/si';

const socials = [
  { label: 'X', href: 'https://x.com/Zeph_Knight_', icon: Command },
  { label: 'GitHub', href: 'https://github.com/ZephKrnl', icon: Github },
  { label: 'YouTube', href: 'https://www.youtube.com/@ZephKnightLOL', icon: Youtube },
];
const projects = [
  { number: '01', title: 'Discord Presence', description: 'A desktop companion that brings Rich Presence and live status to the profile.', href: 'https://github.com/ZephKrnl/Discord-Presence-Site' },
];
const skills = [
  { label: 'JavaScript', Icon: SiJavascript },
  { label: 'C++', Icon: SiCplusplus },
  { label: 'HTML', Icon: SiHtml5 },
  { label: 'CSS', Icon: SiCss },
  { label: 'Python', Icon: SiPython },
];
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

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
function ZephLogo() {
  return (
    <svg className="zeph-logo" viewBox="0 0 64 64" role="img" aria-label="Zeph logo">
      <path d="M12 16h40L19 48h33" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
      <path d="M12 16v32M52 16v32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" opacity=".58" />
      <circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 5" opacity=".38" />
    </svg>
  );
}

function ProfileActivity({ text }: { text: string }) {
  const activityRef = useRef<HTMLSpanElement | null>(null);
  const trackRef = useRef<HTMLSpanElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const measure = () => {
      const element = activityRef.current;
      const track = trackRef.current;
      if (!element) return;
      setIsOverflowing(Boolean(track && track.firstElementChild && track.firstElementChild.scrollWidth > element.clientWidth + 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (activityRef.current) observer.observe(activityRef.current);
    return () => observer.disconnect();
  }, [text]);

  return (
    <span
      ref={activityRef}
      className={`profile-activity ${isOverflowing ? 'is-scrolling' : ''}`}
      title={text}
    >
      <span ref={trackRef} className="profile-activity-track">
        <span>{text}</span>
        <span aria-hidden="true">{text}</span>
      </span>
    </span>
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

  const liveDiscordProfile = oauthProfile ?? discordProfile;
  const profileName = liveDiscordProfile?.username ?? 'Zeph';
  const profileAvatar = liveDiscordProfile?.avatarUrl ?? assetUrl('/assets/profile.jpg');

  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

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
    if (entered) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const preventEntryScroll = (event: Event) => event.preventDefault();
    const preventScrollKeys = (event: KeyboardEvent) => {
      if ([' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) event.preventDefault();
    };

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    window.addEventListener('wheel', preventEntryScroll, { passive: false });
    window.addEventListener('touchmove', preventEntryScroll, { passive: false });
    window.addEventListener('keydown', preventScrollKeys);
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('wheel', preventEntryScroll);
      window.removeEventListener('touchmove', preventEntryScroll);
      window.removeEventListener('keydown', preventScrollKeys);
    };
  }, [entered]);

  useEffect(() => {
    document.title = 'Zeph — Digital freedom is an illusion.';
    const onMove = (event: MouseEvent) => setCursor({ x: event.clientX, y: event.clientY });
    const onOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      setCursorHover(Boolean(target.closest('a, button')));
    };
    const onTiltMove = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('.social-button, .project-card');
      if (!target || window.matchMedia('(pointer: coarse), (prefers-reduced-motion: reduce)').matches) return;
      const bounds = target.getBoundingClientRect();
      const rotateX = ((event.clientY - bounds.top) / bounds.height - 0.5) * -5;
      const rotateY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 5;
      target.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
      target.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
    };
    const onTiltLeave = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('.social-button, .project-card');
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
      <main className={`zeph-app ${entered ? 'site-entered' : ''}`} id="top" style={{ '--cursor-image': `url(${assetUrl('/assets/cursor.webp')})` } as CSSProperties}>
      <video
        className="background-video"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
      >
        <source src={assetUrl('/assets/background.mp4')} type="video/mp4" />
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

        <div className={`profile-card ${liveDiscordProfile ? 'is-discord-live' : 'is-offline'}`} data-testid="card-profile">
          <img src={profileAvatar} alt={`${profileName} avatar`} className="profile-avatar" />
          <div className="profile-card-copy">
            <strong>{profileName}</strong>
            {liveDiscordProfile && discordActivity && (
              <>
                <span className="profile-activity-status">listening now</span>
                <ProfileActivity text={`${discordActivity.details ?? discordActivity.name}${discordActivity.state ? ` - ${discordActivity.state}` : ''}`} />
              </>
            )}
          </div>
        </div>

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
      </section>

      <nav className="section-index" aria-label="Page sections">
        <a href="#profile">profile</a>
        <a href="#about">about me</a>
        <a href="#projects">projects</a>
      </nav>

      <section className="about-section" id="about" aria-label="About me">
        <div className="about-heading">
          <span className="eyebrow">in my own words</span>
          <h2>about me</h2>
        </div>
        <div className="about-layout">
          <div className="about-copy">
            <p>I am essentially just a person living his own life.</p>
            <p>I have always been a lover of all things related to technology and coding. I spend my days playing around with computers and learning as much as possible about programming. The languages that I know best are Python and C++ although I'm also studying HTML, CSS, and JavaScript.</p>
            <p>At the moment, I have recently started studying the economy and finance since I wanted to have at least some knowledge regarding such issues as investments, business and economy in general. The field which I am going to study is IT, and I will work for either Google or NVIDIA.</p>
            <p>Politically, I am quite indifferent as it is mostly stressful.</p>
            <p>What I really want is to earn enough money to build wealth and not only buy myself expensive things, but to also support my family and other people as well as to contribute to the development of a country of which I won't disclose its name. I will be open about the matter.</p>
            <p>In the end, I would like to start my own company and become its CEO together with my partner while making sure that my family gets the chance to enjoy our lives as well.</p>
            <p>Most importantly though, I would like to achieve financial freedom and have my digital freedom of choice in terms of my privacy.</p>
            <p>Maybe one day, when I will be satisfied with everything, I will just stop.</p>
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