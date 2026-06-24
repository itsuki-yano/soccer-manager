// かりがね小学校 → 目的地住所 のルート線入り静止地図(PNG)を生成する。
// Geoapify Static Maps API を使用（環境変数 GEOAPIFY_API_KEY）。
// キー未設定や取得失敗時は null を返す（呼び出し側でスキップ）。

const ORIGIN_LAT = 35.013439;
const ORIGIN_LON = 137.018478;

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("gsi failed");
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const [lon, lat] = data[0].geometry.coordinates;
    return { lat, lon };
  } catch {
    const url2 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=jp`;
    const res2 = await fetch(url2, { headers: { "User-Agent": "soccer-manager-app/1.0" } });
    if (!res2.ok) return null;
    const data2 = await res2.json();
    if (!data2 || data2.length === 0) return null;
    return { lat: parseFloat(data2[0].lat), lon: parseFloat(data2[0].lon) };
  }
}

// OSRM からルートの座標列([lon,lat]...)を取得。失敗時は始点・終点の直線。
async function getRouteCoords(
  oLat: number, oLon: number, dLat: number, dLon: number
): Promise<[number, number][]> {
  const url = `https://router.project-osrm.org/route/v1/driving/${oLon},${oLat};${dLon},${dLat}?overview=simplified&geometries=geojson`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "soccer-manager-app/1.0" } });
    if (!res.ok) throw new Error("osrm failed");
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length === 0) throw new Error("no geometry");
    return coords as [number, number][];
  } catch {
    return [[oLon, oLat], [dLon, dLat]];
  }
}

export async function fetchRouteMapImage(address: string): Promise<Buffer | null> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey || !address) return null;

  try {
    const dest = await geocode(address);
    if (!dest) return null;

    const coords = await getRouteCoords(ORIGIN_LAT, ORIGIN_LON, dest.lat, dest.lon);

    // ルート線（Geoapify geometry: polyline は lon,lat の順でカンマ連結）
    const polyline = coords.map(([lon, lat]) => `${lon},${lat}`).join(",");
    const geometry = `polyline:${polyline};linecolor:%23e8442b;linewidth:5;lineopacity:0.9`;

    // 始点・終点マーカー
    const marker = [
      `lonlat:${ORIGIN_LON},${ORIGIN_LAT};color:%231f78b4;size:medium;type:material;icon:home;whitecircle:no`,
      `lonlat:${dest.lon},${dest.lat};color:%23e8442b;size:medium;type:material;icon:soccer-ball;whitecircle:no`,
    ].join("|");

    // 表示範囲（全座標のbboxに余白を付与）
    const lons = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const padLon = (Math.max(...lons) - Math.min(...lons)) * 0.15 + 0.005;
    const padLat = (Math.max(...lats) - Math.min(...lats)) * 0.15 + 0.005;
    const area = `rect:${Math.min(...lons) - padLon},${Math.min(...lats) - padLat},${Math.max(...lons) + padLon},${Math.max(...lats) + padLat}`;

    const url =
      `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=640&height=420&format=png` +
      `&area=${encodeURIComponent(area)}` +
      `&geometry=${geometry}` +
      `&marker=${marker}` +
      `&apiKey=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}
