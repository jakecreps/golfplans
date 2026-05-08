'use client';

import { useState, useRef } from 'react';
import { Location } from '@/lib/types';

// zippopotam.us — free, no API key, complete US zip code coverage
interface ZipResult {
  'post code': string;
  places: { 'place name': string; 'state abbreviation': string; latitude: string; longitude: string }[];
}

interface Props {
  value: Location | null;
  onChange: (loc: Location) => void;
}

export default function AddressSearch({ value, onChange }: Props) {
  const [zip, setZip] = useState(value ? extractZip(value.address) : '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'notfound'>(value ? 'found' : 'idle');
  const [cityLabel, setCityLabel] = useState(value?.address ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function extractZip(addr: string) {
    const m = addr.match(/\d{5}/);
    return m ? m[0] : '';
  }

  function handleChange(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 5);
    setZip(digits);
    if (digits.length < 5) {
      setStatus('idle');
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => lookup(digits), 300);
  }

  async function lookup(digits: string) {
    setStatus('loading');
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${digits}`);
      if (!res.ok) { setStatus('notfound'); return; }
      const data: ZipResult = await res.json();
      const place = data.places[0];
      const label = `${place['place name']}, ${place['state abbreviation']} ${digits}`;
      setCityLabel(label);
      setStatus('found');
      onChange({
        address: label,
        lat: parseFloat(place.latitude),
        lng: parseFloat(place.longitude),
      });
    } catch {
      setStatus('notfound');
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={zip}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Enter zip code (e.g. 75068)"
          maxLength={5}
          className={`w-full border rounded-xl px-4 py-3 text-lg tracking-widest font-mono focus:outline-none focus:ring-2 pr-10 ${
            status === 'found'
              ? 'border-green-400 bg-green-50 focus:ring-green-500'
              : status === 'notfound'
              ? 'border-red-300 bg-red-50 focus:ring-red-400'
              : 'border-gray-300 focus:ring-green-500'
          }`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">
          {status === 'loading' && (
            <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          )}
          {status === 'found' && <span className="text-green-500">✓</span>}
          {status === 'notfound' && <span className="text-red-400">✕</span>}
        </div>
      </div>
      {status === 'found' && (
        <p className="text-sm text-green-700 font-medium px-1">📍 {cityLabel}</p>
      )}
      {status === 'notfound' && (
        <p className="text-sm text-red-500 px-1">Zip code not found — double-check and try again</p>
      )}
    </div>
  );
}


// Photon is a free, open-source geocoder powered by OpenStreetMap data (by Komoot).
// No API key required. https://photon.komoot.io

interface PhotonFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] }; // [lng, lat]
  properties: {
    osm_id?: number;
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countrycode?: string;
  };
}

