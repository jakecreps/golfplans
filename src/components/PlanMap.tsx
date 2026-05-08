'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's broken default icon paths when bundled with webpack/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const COLORS = [
  '#16a34a', // green-600
  '#2563eb', // blue-600
  '#dc2626', // red-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#db2777', // pink-600
];

interface PlayerPin {
  label: string;
  lat: number;
  lng: number;
  /** miles */
  radiusMiles: number;
}

function FitBounds({ pins }: { pins: PlayerPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 9);
      return;
    }
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [map, pins]);
  return null;
}

export default function PlanMap({ pins }: { pins: PlayerPin[] }) {
  const center: [number, number] =
    pins.length > 0
      ? [
          pins.reduce((s, p) => s + p.lat, 0) / pins.length,
          pins.reduce((s, p) => s + p.lng, 0) / pins.length,
        ]
      : [39.5, -98.35]; // geographic center of US

  return (
    <MapContainer
      center={center}
      zoom={7}
      style={{ height: '360px', width: '100%', borderRadius: '16px' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds pins={pins} />
      {pins.map((pin, i) => {
        const color = COLORS[i % COLORS.length];
        const radiusMeters = pin.radiusMiles * 1609.34;
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background:${color};
            color:white;
            border-radius:50%;
            width:28px;height:28px;
            display:flex;align-items:center;justify-content:center;
            font-size:11px;font-weight:700;
            border:2px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,.35);
          ">${i + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        return (
          <div key={i}>
            <Circle
              center={[pin.lat, pin.lng]}
              radius={radiusMeters}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.12, weight: 2 }}
            />
            <Marker position={[pin.lat, pin.lng]} icon={icon}>
              <Popup>
                <strong>{pin.label}</strong>
                <br />
                {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
                <br />
                Up to {pin.radiusMiles} mi drive
              </Popup>
            </Marker>
          </div>
        );
      })}
    </MapContainer>
  );
}
