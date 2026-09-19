import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, Command, Eye, Github, Youtube } from 'lucide-react';
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
const shrimpPieces = Array.from({ length: 20 }, (_, index) => index);
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
const localGuestbookKey = 'zeph-profile-sticky-notes';

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
type ViewRecord = {
  viewedAt: string;
  device: string;
  model?: string;
  osVersion?: string;
  browser: string;
  region: string;
  provider: string;
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
  const [viewCount, setViewCount] = useState(0);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<'history' | 'notes'>('history');
  const [noteTab, setNoteTab] = useState<'pending' | 'approved'>('pending');
  const [historyPage, setHistoryPage] = useState(1);
  const [notesPage, setNotesPage] = useState(1);
  const [viewHistory, setViewHistory] = useState<ViewRecord[]>([]);
  const [guestbook, setGuestbook] = useState<GuestbookEntry[]>([]);
  const [adminGuestbook, setAdminGuestbook] = useState<GuestbookEntry[]>([]);
  const [guestbookName, setGuestbookName] = useState('');
  const [guestbookMessage, setGuestbookMessage] = useState('');
  const [guestbookNotice, setGuestbookNotice] = useState('');
  const stickyClickCounts = useRef(new Map<string, number>());
  const stickyCooldowns = useRef(new Map<string, number>());
  const easterEggTimer = useRef<number | null>(null);
  const shakeTimer = useRef<number | null>(null);
  const [easterEggNote, setEasterEggNote] = useState<string | null>(null);
  const [shakingNote, setShakingNote] = useState<string | null>(null);
  const [stickyClickVersion, setStickyClickVersion] = useState(0);
  const [shrimpPattern, setShrimpPattern] = useState(() => shrimpPieces.map(() => ({ y: 50, delay: 0, duration: 2.5 })));

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
    const loadLocalGuestbook = () => {
      try {
        const stored = localStorage.getItem(localGuestbookKey);
        if (stored) setGuestbook(JSON.parse(stored) as GuestbookEntry[]);
      } catch {
        setGuestbook([]);
      }
    };
    const refreshGuestbook = () => {
      void fetch('/api/guestbook')
        .then((response) => {
          if (!response.ok) throw new Error('Guestbook API unavailable');
          return response.json();
        })
        .then((data: { entries?: GuestbookEntry[] }) => setGuestbook(data.entries ?? []))
        .catch(loadLocalGuestbook);
    };
    void fetch('/api/views', { method: 'POST' })
        .then((response) => response.json())
        .then((data: { views?: number }) => setViewCount(data.views ?? 0))
        .catch(() => undefined);
    refreshGuestbook();
    const guestbookRefresh = window.setInterval(refreshGuestbook, 5000);
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
      window.clearInterval(guestbookRefresh);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if (!(event.shiftKey && event.key.toLowerCase() === 'd')) return;
      event.preventDefault();
      const password = window.prompt('Admin password');
      if (!password) return;
      const login = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!login.ok) {
        window.alert('Admin access denied.');
        return;
      }
      const response = await fetch('/api/admin/views');
      if (!response.ok) return;
      const data = (await response.json()) as { history?: ViewRecord[] };
      setViewHistory(data.history ?? []);
      const guestbookResponse = await fetch('/api/admin/guestbook');
      const guestbookData = (await guestbookResponse.json()) as { entries?: GuestbookEntry[] };
      setAdminGuestbook(guestbookData.entries ?? []);
      setAdminOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const submitGuestbook = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGuestbookNotice('');
    try {
      const response = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: guestbookName, message: guestbookMessage }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Guestbook API unavailable');
      setGuestbookNotice(data.message ?? 'Your note is live.');
      setGuestbookName('');
      setGuestbookMessage('');
    } catch {
      const localEntry: GuestbookEntry = {
        id: crypto.randomUUID(),
        name: guestbookName.trim().slice(0, 40),
        message: guestbookMessage.trim().slice(0, 280),
        createdAt: new Date().toISOString(),
        approved: true,
      };
      const nextEntries = [...guestbook, localEntry];
      localStorage.setItem(localGuestbookKey, JSON.stringify(nextEntries));
      setGuestbook(nextEntries);
      setGuestbookName('');
      setGuestbookMessage('');
      setGuestbookNotice('Saved in this browser. A backend is required to share it with everyone.');
    }
  };

  const moderateGuestbook = async (id: string, approved: boolean) => {
    await fetch('/api/admin/guestbook', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved }),
    });
    setAdminGuestbook((entries) => entries.map((entry) => entry.id === id ? { ...entry, approved } : entry));
    if (approved) {
      const response = await fetch('/api/guestbook');
      const data = (await response.json()) as { entries?: GuestbookEntry[] };
      setGuestbook(data.entries ?? []);
    } else {
      setGuestbook((entries) => entries.filter((entry) => entry.id !== id));
    }
  };

  const deleteGuestbookEntry = async (id: string) => {
    const response = await fetch('/api/admin/guestbook', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (response.ok) {
      setAdminGuestbook((entries) => entries.filter((entry) => entry.id !== id));
      setGuestbook((entries) => entries.filter((entry) => entry.id !== id));
    }
  };

  const triggerStickyEgg = (id: string) => {
    const onlyTriggerableNote = guestbook[0]?.id;
    if (!onlyTriggerableNote || id !== onlyTriggerableNote) return;

    const now = Date.now();
    const cooldownUntil = stickyCooldowns.current.get(id) ?? 0;
    if (cooldownUntil > now) return;

    const clicks = (stickyClickCounts.current.get(id) ?? 0) + 1;
    if (clicks < 5) {
      stickyClickCounts.current.set(id, clicks);
      return;
    }

    stickyClickCounts.current.set(id, 0);
    setStickyClickVersion((version) => version + 1);
    stickyCooldowns.current.set(id, now + 10000);
    setShrimpPattern(shrimpPieces.map(() => ({
      y: 4 + Math.random() * 92,
      delay: Math.random() * .7,
      duration: 2.1 + Math.random() * 1.2,
    })));
    setShakingNote(id);
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => {
      setShakingNote(null);
      shakeTimer.current = null;
    }, 800);
    setEasterEggNote(id);
    if (easterEggTimer.current !== null) window.clearTimeout(easterEggTimer.current);
    easterEggTimer.current = window.setTimeout(() => {
      setEasterEggNote(null);
      easterEggTimer.current = null;
    }, 5000);
  };

  useEffect(() => () => {
    if (easterEggTimer.current !== null) window.clearTimeout(easterEggTimer.current);
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
  }, []);

  const pageSize = 10;
  const pendingNotes = adminGuestbook.filter((entry) => !entry.approved);
  const approvedNotes = adminGuestbook.filter((entry) => entry.approved);
  const noteEntries = noteTab === 'pending' ? pendingNotes : approvedNotes;
  const historyPageCount = Math.max(1, Math.ceil(viewHistory.length / pageSize));
  const notesPageCount = Math.max(1, Math.ceil(noteEntries.length / pageSize));
  const visibleHistory = viewHistory.slice((historyPage - 1) * pageSize, historyPage * pageSize);
  const visibleNotes = noteEntries.slice((notesPage - 1) * pageSize, notesPage * pageSize);

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
          <button type="submit">submit</button>
        </form>
        {guestbookNotice && <p className="guestbook-notice">{guestbookNotice}</p>}
        <div className="guestbook-entries">
          {guestbook.length === 0 && <span className="guestbook-empty">No messages yet.</span>}
          {guestbook.map((entry, index) => (
            <article
              className={`guestbook-note note-${index % 5} ${shakingNote === entry.id ? 'is-shaking' : ''}`}
              key={entry.id}
              data-click-version={shakingNote === entry.id ? stickyClickVersion : undefined}
              draggable="false"
              onClick={() => triggerStickyEgg(entry.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  triggerStickyEgg(entry.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Sticky note from ${entry.name}`}
            >
              <strong>{entry.name}</strong><p>{entry.message}</p>
            </article>
          ))}
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

      {adminOpen && (
        <aside className="admin-panel" aria-label="Private view history">
          <div className="admin-panel-head">
            <strong>admin / private tools</strong>
            <button type="button" onClick={() => setAdminOpen(false)} aria-label="Close view history">close</button>
          </div>
          <div className="admin-tabs" role="tablist" aria-label="Admin sections">
            <button className={adminTab === 'history' ? 'is-active' : ''} type="button" role="tab" aria-selected={adminTab === 'history'} onClick={() => setAdminTab('history')}>01 / history</button>
            <button className={adminTab === 'notes' ? 'is-active' : ''} type="button" role="tab" aria-selected={adminTab === 'notes'} onClick={() => setAdminTab('notes')}>02 / sticky notes</button>
          </div>
          <div className="admin-panel-list">
            {adminTab === 'history' && (
              <>
                <strong className="admin-section-title">view history / page {historyPage}</strong>
                {viewHistory.length === 0 && <span className="admin-empty">No views recorded yet.</span>}
                {visibleHistory.map((view) => (
              <div className="admin-view" key={`${view.viewedAt}-${view.device}`}>
                <strong>{view.device}</strong>
                {view.osVersion && <span>OS: {view.osVersion}</span>}
                <span>{view.region} / {view.provider}</span>
                <time dateTime={view.viewedAt}>{new Date(view.viewedAt).toLocaleString()}</time>
                {view.model && <span>Model: {view.model}</span>}
              </div>
                ))}
                <div className="admin-pagination" aria-label="View history pages">
                  {Array.from({ length: historyPageCount }, (_, index) => index + 1).map((page) => (
                    <button className={historyPage === page ? 'is-active' : ''} type="button" key={page} onClick={() => setHistoryPage(page)} aria-label={`View history page ${page}`}>{page}</button>
                  ))}
                </div>
              </>
            )}
            {adminTab === 'notes' && (
              <>
                <div className="admin-note-tabs" role="tablist" aria-label="Sticky note sections">
                  <button className={noteTab === 'pending' ? 'is-active' : ''} type="button" role="tab" aria-selected={noteTab === 'pending'} onClick={() => { setNoteTab('pending'); setNotesPage(1); }}>approval ({pendingNotes.length})</button>
                  <button className={noteTab === 'approved' ? 'is-active' : ''} type="button" role="tab" aria-selected={noteTab === 'approved'} onClick={() => { setNoteTab('approved'); setNotesPage(1); }}>approved ({approvedNotes.length})</button>
                </div>
                <strong className="admin-section-title">sticky notes / page {notesPage}</strong>
                {visibleNotes.length === 0 && <span className="admin-empty">No notes in this section.</span>}
                {visibleNotes.map((entry) => (
              <div className="admin-view" key={entry.id}>
                <strong>{entry.name}</strong>
                <span>{entry.message}</span>
                <span>{noteTab === 'pending' ? 'flagged for approval' : 'published'}</span>
                <div className="admin-actions">
                  {noteTab === 'pending' && <button type="button" onClick={() => moderateGuestbook(entry.id, true)}>approve</button>}
                  <button type="button" onClick={() => deleteGuestbookEntry(entry.id)}>delete</button>
                </div>
              </div>
                ))}
                <div className="admin-pagination" aria-label="Sticky note pages">
                  {Array.from({ length: notesPageCount }, (_, index) => index + 1).map((page) => (
                    <button className={notesPage === page ? 'is-active' : ''} type="button" key={page} onClick={() => setNotesPage(page)} aria-label={`Sticky notes page ${page}`}>{page}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>
      )}

      {easterEggNote && (
        <div className="shrimp-rain" aria-live="polite" aria-label="Sticky note easter egg">
          {shrimpPieces.map((piece) => (
            <span
              className={`shrimp-piece ${piece < 10 ? 'to-left' : 'to-right'}`}
              key={piece}
              style={{
                '--shrimp-y': `${shrimpPattern[piece].y}%`,
                '--shrimp-delay': `${shrimpPattern[piece].delay}s`,
                '--shrimp-duration': `${shrimpPattern[piece].duration}s`,
              } as CSSProperties}
            >
              <img src={assetUrl('/assets/shrimp.png')} alt="" draggable="false" />
            </span>
          ))}
        </div>
      )}
      </main>
    </>
  );
}

export default App;