import { useEffect, useRef } from 'react';
import { api } from '../api.js';

function JobItem({ job, onUpdate, onRemove }) {
  const triggered = useRef(false);

  useEffect(() => {
    if (['done', 'error', 'cancelled'].includes(job.status)) return;
    const es = api.events(job.id);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      onUpdate(job.id, data);
      if (['done', 'error', 'cancelled'].includes(data.status)) es.close();
    };
    es.onerror = () => es.close();
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  // Auto-save once finished
  useEffect(() => {
    if (job.status === 'done' && !triggered.current) {
      triggered.current = true;
      const a = document.createElement('a');
      a.href = api.fileUrl(job.id);
      a.download = job.filename || '';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, [job.status, job.id, job.filename]);

  const active = ['queued', 'downloading', 'processing'].includes(job.status);
  const label = {
    queued: 'Queued',
    downloading: `${job.progress.toFixed(1)}%${job.speed ? ` · ${job.speed}` : ''}${job.eta ? ` · ETA ${job.eta}` : ''}`,
    processing: 'Processing…',
    done: 'Completed',
    error: job.error || 'Failed',
    cancelled: 'Cancelled',
  }[job.status];

  return (
    <li className={`job ${job.status}`}>
      {job.thumbnail && <img src={job.thumbnail} alt="" referrerPolicy="no-referrer" />}
      <div className="job-body">
        <p className="job-title" title={job.title}>{job.title}</p>
        <div className="bar">
          <span style={{ width: `${job.status === 'done' ? 100 : job.progress}%` }} className={job.status === 'processing' ? 'pulse' : ''} />
        </div>
        <p className="job-meta">{label}{job.size && active ? ` · ${job.size}` : ''}</p>
      </div>
      <div className="job-actions">
        {job.status === 'done' && (
          <a className="primary small" href={api.fileUrl(job.id)} download={job.filename}>
            Save
          </a>
        )}
        {active ? (
          <button className="ghost small" onClick={() => api.cancelJob(job.id).catch(() => {})}>
            Cancel
          </button>
        ) : (
          <button className="ghost small" onClick={() => onRemove(job.id)} aria-label="Remove">
            ✕
          </button>
        )}
      </div>
    </li>
  );
}

export default function JobList({ jobs, onUpdate, onRemove }) {
  if (!jobs.length) return null;
  return (
    <section className="jobs">
      <h3>Downloads</h3>
      <ul>
        {jobs.map((j) => (
          <JobItem key={j.id} job={j} onUpdate={onUpdate} onRemove={onRemove} />
        ))}
      </ul>
    </section>
  );
}
