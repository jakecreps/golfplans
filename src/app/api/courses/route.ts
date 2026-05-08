import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius'); // miles

  if (!lat || !lng || !radius) {
    return NextResponse.json({ error: 'lat, lng, radius required' }, { status: 400 });
  }

  const radiusMeters = Math.round(parseFloat(radius) * 1609.34);

  const query = `[out:json][timeout:25];(way["leisure"="golf_course"](around:${radiusMeters},${lat},${lng});relation["leisure"="golf_course"](around:${radiusMeters},${lat},${lng}););out tags center 50;`;

  try {
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const res = await fetch(overpassUrl, { method: 'GET' });

    if (!res.ok) throw new Error(`Overpass error ${res.status}`);

    const data = await res.json();

    const courses = (data.elements as any[])
      .filter((e) => e.tags?.name)
      .map((e) => ({
        id: e.id,
        name: e.tags.name as string,
        city: (e.tags['addr:city'] || e.tags['addr:suburb'] || '') as string,
        state: (e.tags['addr:state'] || '') as string,
        website: (e.tags.website || e.tags['contact:website'] || '') as string,
        lat: e.center?.lat ?? e.lat ?? null,
        lng: e.center?.lon ?? e.lon ?? null,
        holes: e.tags.holes ? parseInt(e.tags.holes) : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ courses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Failed to fetch golf courses' }, { status: 500 });
  }
}
