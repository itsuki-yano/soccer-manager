import { NextResponse } from "next/server";

// 出発地点：かりがね小学校（愛知県刈谷市築地町2-15-1）
const ORIGIN_LAT = 34.9747;
const ORIGIN_LON = 137.0028;

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=jp`;
  const res = await fetch(url, {
    headers: { "User-Agent": "soccer-manager-app/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function getDrivingDistance(
  originLat: number, originLon: number,
  destLat: number, destLon: number
): Promise<number | null> {
  const url = `http://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": "soccer-manager-app/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) return null;
  return data.routes[0].distance / 1000; // km
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });

  try {
    const dest = await geocode(address);
    if (!dest) {
      return NextResponse.json({ error: "住所が見つかりませんでした" }, { status: 404 });
    }

    const oneWayKm = await getDrivingDistance(ORIGIN_LAT, ORIGIN_LON, dest.lat, dest.lon);
    if (oneWayKm === null) {
      return NextResponse.json({ error: "距離計算に失敗しました" }, { status: 500 });
    }

    const roundTripKm = Math.round(oneWayKm * 2 * 100) / 100;
    return NextResponse.json({ roundTripKm, oneWayKm: Math.round(oneWayKm * 100) / 100 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
