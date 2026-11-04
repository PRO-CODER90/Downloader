import { useState } from 'react';

export default function UrlForm({ onSubmit, loading }) {
  const [value, setValue] = useState('');

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setValue(text.trim());
    } catch {
      /* clipboard permission denied */
    }
  }

  return (
    <form
      className="url-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
    >
      <input
        type="url"
        inputMode="url"
        placeholder="https://www.youtube.com/watch?v=…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Video URL"
        required
      />
      <button type="button" className="ghost" onClick={paste} disabled={loading}>
        Paste
      </button>
      <button type="submit" className="primary" disabled={loading}>
        {loading ? <span className="spinner" /> : 'Fetch'}
      </button>
    </form>
  );
}
