import { useEffect, useState } from 'react';
import { api } from './api.js';
import UrlForm from './components/UrlForm.jsx';
import MediaCard from './components/MediaCard.jsx';
import JobList from './components/JobList.jsx';

const PLATFORMS = ['YouTube', 'Instagram', 'TikTok', 'X / Twitter', 'Facebook', 'Vimeo', 'Reddit', 'SoundCloud', '1000+ more'];

export default function App() {
  const [info, setInfo] = useState(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [jobs, setJobs] = useState([]);
  const [server, setServer] = useState(null);

  useEffect(() => {
    api.health().then(setServer).catch((e) => setServer({ ok: false, error: e.message }));
  }, []);

  async function analyze(input) {
    setError('');
    setInfo(null);
    setLoading(true);
    setUrl(input);
    try {
      setInfo(await api.info(input));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function download(choice) {
    setError('');
    if (server?.mode === 'jobs') {
      try {
        const job = await api.createJob({ url, choice: choice.id, title: `${info.title} · ${choice.label}` });
        setJobs((j) => [{ ...job, thumbnail: info.thumbnail }, ...j]);
      } catch (e) {
        setError(e.message);
      }
      return;
    }
    // Direct mode: the browser handles the download natively (with its own progress UI)
    const a = document.createElement('a');
    a.href = api.downloadUrl(url, choice.id);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setToast(`Preparing ${choice.label}… your download will start shortly.`);
    setTimeout(() => setToast(''), 5000);
  }

  const updateJob = (id, patch) => setJobs((list) => list.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  const removeJob = (id) => setJobs((list) => list.filter((j) => j.id !== id));

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            <svg viewBox="0 0 24 24"><path d="M12 3v10.6l3.3-3.3 1.4 1.4L12 17.4l-4.7-4.7 1.4-1.4 3.3 3.3V3zM5 19h14v2H5z" /></svg>
          </span>
          Downloader
        </div>
        <span className={`status ${server?.ok ? 'ok' : server ? 'bad' : ''}`} title={server?.error || ''}>
          <i />
          {server ? (server.ok ? `Online · ${server.mode === 'jobs' ? 'Full' : 'Lite'} · yt-dlp ${server.ytdlp}` : 'Server offline') : 'Connecting…'}
        </span>
      </header>

      <main className="container">
        <section className="hero">
          <h1>Download any video, in any quality.</h1>
          <p>Paste a link from YouTube, Instagram, TikTok, X and 1000+ other sites.</p>
          <UrlForm onSubmit={analyze} loading={loading} />
          <ul className="chips">
            {PLATFORMS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}

        {loading && <div className="card skeleton" aria-busy="true" />}
        {info && <MediaCard info={info} onDownload={download} />}

        <JobList jobs={jobs} onUpdate={updateJob} onRemove={removeJob} />
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>

      <footer className="footer">
        Only download content you own or have permission to download. Respect each platform's terms and copyright law.
      </footer>
    </div>
  );
}
