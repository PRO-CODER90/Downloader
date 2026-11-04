import { useState } from 'react';
import { formatBytes, formatDuration } from '../utils.js';

export default function MediaCard({ info, onDownload }) {
  const [tab, setTab] = useState('video');
  const choices = info.choices.filter((c) => c.type === tab);

  return (
    <article className="card media">
      <div className="thumb">
        {info.thumbnail ? <img src={info.thumbnail} alt="" referrerPolicy="no-referrer" /> : <div className="noimg" />}
        {info.duration && <span className="duration">{formatDuration(info.duration)}</span>}
      </div>
      <div className="media-body">
        <span className="site">{info.site}</span>
        <h2 title={info.title}>{info.title}</h2>
        {info.uploader && <p className="muted">{info.uploader}</p>}

        <div className="tabs" role="tablist">
          {['video', 'audio'].map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
              {t === 'video' ? 'Video' : 'Audio only'}
            </button>
          ))}
        </div>

        {!choices.length && <p className="empty">No direct {tab} formats available for this link.</p>}
        <div className="formats">
          {choices.map((c) => (
            <button key={c.id} className="format" onClick={() => onDownload(c)}>
              <strong>{c.label}</strong>
              <span>
                {c.ext?.toUpperCase()}
                {c.size ? ` · ~${formatBytes(c.size)}` : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
