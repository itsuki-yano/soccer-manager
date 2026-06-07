import { NextResponse } from "next/server";

// 出発地点：かりがね小学校（愛知県刈谷市築地町2-15-1）
const ORIGIN_LAT = 35.013439;
const ORIGIN_LON = 137.018478;

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  // 国土地理院ジオコーダー（日本国内専用、無料・制限なし）
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("gsi failed");
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const [lon, lat] = data[0].geometry.coordinates;
    return { lat, lon };
  } catch {
    // フォールバック: Nominatim
    const url2 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=jp`;
    const res2 = await fetch(url2, { headers: { "User-Agent": "soccer-manager-app/1.0" } });
    if (!res2.ok) return null;
    const data2 = await res2.json();
    if (!data2 || data2.length === 0) return null;
    return { lat: parseFloat(data2[0].lat), lon: parseFloat(data2[0].lon) };
  }
}

async function getDrivingDistance(
  originLat: number, originLon: number,
  destLat: number, destLon: number
): Promise<number | null> {
  // OSRM デモサーバー (HTTPS)
  const url = `https://router.project-osrm.org/route/v1/driving/${originLon},${originLat};${destLon},${destLat}?overview=false`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "soccer-manager-app/1.0" } });
    if (!res.ok) throw new Error("osrm failed");
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) throw new Error("no route");
    return data.routes[0].distance / 1000;
  } catch {
    // フォールバック: 直線距離 × 1.4 係数で概算
    const R = 6371;
    const dLat = (destLat - originLat) * Math.PI / 180;
    const dLon = (destLon - originLon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(originLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const straight = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return straight * 1.4; // 道路距離の概算係数
  }
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
