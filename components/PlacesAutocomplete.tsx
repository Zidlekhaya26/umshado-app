'use client';
import { useEffect, useRef, useState } from 'react';
import { CR, BOR, DK, MUT } from '@/lib/tokens';

declare global {
  interface Window {
    google: any;
    __googleMapsReady?: () => void;
    __googleMapsPromise?: Promise<void>;
  }
}

// Module-level singleton — loads only once, shared across all instances
function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__googleMapsPromise) return window.__googleMapsPromise;

  window.__googleMapsPromise = new Promise<void>((resolve, reject) => {
    window.__googleMapsReady = resolve;
    const script = document.createElement('script');
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__googleMapsReady`;
    script.async = true;
    script.onerror = () => {
      window.__googleMapsPromise = undefined;
      reject(new Error('Google Maps failed to load'));
    };
    document.head.appendChild(script);
  });

  return window.__googleMapsPromise;
}

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: { main_text: string; secondary_text: string };
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  id?: string;
  required?: boolean;
  hint?: string;
  inputStyle?: React.CSSProperties;
  inputClassName?: string;
  labelStyle?: React.CSSProperties;
}

export default function PlacesAutocomplete({
  value, onChange, placeholder, label, id, required, hint,
  inputStyle, inputClassName, labelStyle,
}: Props) {
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [ready, setReady] = useState(false);
  const serviceRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        serviceRef.current = new window.google.maps.places.AutocompleteService();
        setReady(true);
      })
      .catch(() => {/* silently degrade to plain text input */});
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchSuggestions = (input: string) => {
    if (!input || input.length < 2 || !ready || !serviceRef.current) {
      setSuggestions([]); setOpen(false); return;
    }

    serviceRef.current.getPlacePredictions(
      { input, types: ['geocode'] },
      (results: Prediction[] | null, status: string) => {
        if (status === 'OK' && results) {
          setSuggestions(results.slice(0, 5));
          setOpen(true);
        } else {
          setSuggestions([]);
          setOpen(false);
        }
      }
    );
  };

  const handleSelect = (p: Prediction) => {
    onChange(p.description);
    setSuggestions([]);
    setOpen(false);
  };

  const inputBaseStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 36px 11px 14px',
    border: `1.5px solid ${focused ? CR : BOR}`,
    borderRadius: 10,
    fontSize: 14,
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    color: DK,
    fontFamily: 'inherit',
    boxShadow: focused ? `0 0 0 3px rgba(154,33,67,0.08)` : 'none',
    transition: 'border-color .14s, box-shadow .14s',
    ...inputStyle,
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {label && (
        <label htmlFor={id} style={{
          display: 'block', fontSize: 10.5, fontWeight: 800,
          letterSpacing: 1.1, textTransform: 'uppercase',
          color: MUT, marginBottom: 7, ...labelStyle,
        }}>
          {label}{required && <span style={{ color: CR, marginLeft: 3 }}>*</span>}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type="text"
          value={value}
          onChange={e => { onChange(e.target.value); fetchSuggestions(e.target.value); }}
          onFocus={() => { setFocused(true); if (suggestions.length) setOpen(true); }}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoComplete="off"
          required={required}
          className={inputClassName}
          style={inputBaseStyle}
        />
        <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.4 }}
          width="16" height="16" fill="none" stroke={CR} strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>

      {open && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', border: `1.5px solid ${BOR}`, borderRadius: 12,
          padding: 0, margin: 0, listStyle: 'none', zIndex: 9999,
          boxShadow: '0 8px 24px rgba(26,13,18,0.12)', overflow: 'hidden',
        }}>
          {suggestions.map((s, i) => (
            <li key={s.place_id}
              onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
              style={{
                padding: '10px 14px', cursor: 'pointer', display: 'flex',
                alignItems: 'flex-start', gap: 10, background: '#fff',
                borderBottom: i < suggestions.length - 1 ? `1px solid ${BOR}` : 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#faf8f5')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <svg style={{ marginTop: 2, flexShrink: 0 }} width="14" height="14" fill="none" stroke={CR} strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: DK }}>{s.structured_formatting.main_text}</div>
                <div style={{ fontSize: 11, color: MUT, marginTop: 1 }}>{s.structured_formatting.secondary_text}</div>
              </div>
            </li>
          ))}
          <li style={{ padding: '5px 14px', background: '#faf8f5', display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 9, color: '#9ca3af' }}>powered by Google</span>
          </li>
        </ul>
      )}

      {hint && <p style={{ fontSize: 11, color: '#9ca3af', margin: '5px 0 0' }}>{hint}</p>}
    </div>
  );
}
