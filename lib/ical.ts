// BAND の iCal を読むための共通処理。
// 試合(band-calendar)と練習(band-practices)で同じ feed を別実装していたため、
// 繰り返し予定の対応が練習側だけ入って試合側が取り残される状態になっていた。
// 取りこぼしを防ぐためパースと繰り返し展開はここに集約する（fetch や画面都合は持たせない）。

export interface ICalEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  location: string;
  description: string;
  url: string;
  rrule?: string;
  exdates?: string[];
}

// 折り返された行を元に戻す
function unfold(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

export function parseIcal(text: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  let inEvent = false;
  let current: Partial<ICalEvent> = {};

  for (const line of unfold(text)) {
    if (line.trim() === "BEGIN:VEVENT") { inEvent = true; current = {}; }
    else if (line.trim() === "END:VEVENT") {
      inEvent = false;
      if (current.uid && current.summary && current.dtstart) events.push(current as ICalEvent);
    } else if (inEvent) {
      const colonIdx = line.indexOf(":");
      if (colonIdx < 0) continue;
      const key = line.slice(0, colonIdx).split(";")[0].toUpperCase();
      const val = line.slice(colonIdx + 1).trim();
      const unescape = (s: string) =>
        s.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
      if (key === "UID") current.uid = val;
      else if (key === "SUMMARY") current.summary = unescape(val);
      else if (key === "LOCATION") current.location = unescape(val);
      else if (key === "DTSTART") current.dtstart = val;
      else if (key === "DTEND") current.dtend = val;
      else if (key === "DESCRIPTION") current.description = unescape(val);
      else if (key === "URL") current.url = val;
      else if (key === "RRULE") current.rrule = val;
      else if (key === "EXDATE") {
        // 複数日付（カンマ区切り）に対応し YYYY-MM-DD で蓄積
        const dates = val.split(",").map((v) => {
          const c = v.replace(/[TZ]/g, "").slice(0, 8);
          return `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`;
        });
        current.exdates = [...(current.exdates ?? []), ...dates];
      }
    }
  }
  return events;
}

export function parseDate(value: string): string {
  const c = (value ?? "").replace(/[TZ]/g, "");
  const d = c.slice(0, 8);
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

export function parseTime(value: string): string {
  const c = (value ?? "").replace(/[TZ]/g, "");
  const t = c.slice(8, 12);
  return t.length >= 4 ? `${t.slice(0, 2)}:${t.slice(2, 4)}` : "";
}

// BAND投稿URL（https://band.us/band/.../post/...）を抽出
export function extractPostUrl(e: Partial<ICalEvent>): string {
  const re = /https?:\/\/band\.us\/\S+/i;
  if (e.url && re.test(e.url)) return e.url.match(re)![0];
  if (e.description) { const m = e.description.match(re); if (m) return m[0]; }
  if (e.url) return e.url;
  return "";
}

// 「日本、〒448-0011 愛知県…」→「愛知県…」（郵便番号より後だけ採用）
export function cleanAddress(raw: string): string {
  const s = (raw ?? "").trim();
  const m = s.match(/〒?\s*\d{3}-?\d{4}\s*(.+)$/);
  if (m && m[1].trim()) return m[1].trim();
  return s.replace(/^日本[、,\s]*/, "").trim();
}

// 繰り返し予定だけ日付ごとに一意なIDにする。
// 単発は元のUIDのまま（取り込み済みデータのIDを変えないため、ここは必ず分岐させる）
export function buildBandUid(uid: string, date: string, hasRrule: boolean): string {
  return hasRrule ? `${uid}_${date}` : uid;
}

const WEEKDAY_MAP: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// BYDAY のエントリ。MONTHLY の "1SU"(第1日曜) のような序数付き指定に対応する。
type ByDayEntry = { ordinal: number | null; weekday: number };

function parseByDay(value: string | undefined): ByDayEntry[] {
  if (!value) return [];
  return value
    .split(",")
    .map((raw): ByDayEntry | null => {
      const m = raw.trim().toUpperCase().match(/^([+-]?\d+)?([A-Z]{2})$/);
      if (!m) return null;
      const weekday = WEEKDAY_MAP[m[2]];
      if (weekday === undefined) return null;
      return { ordinal: m[1] ? parseInt(m[1], 10) : null, weekday };
    })
    .filter((x): x is ByDayEntry => x !== null);
}

// 指定年月の「第n曜日」の日付。ordinal が負なら月末から数える（-1SU = 最終日曜）。
function nthWeekdayOfMonth(year: number, month: number, weekday: number, ordinal: number): Date | null {
  if (ordinal > 0) {
    const first = new Date(year, month, 1);
    const day = 1 + ((weekday - first.getDay() + 7) % 7) + (ordinal - 1) * 7;
    const d = new Date(year, month, day);
    return d.getMonth() === month ? d : null;
  }
  const last = new Date(year, month + 1, 0);
  const day = last.getDate() - ((last.getDay() - weekday + 7) % 7) + (ordinal + 1) * 7;
  if (day < 1) return null;
  const d = new Date(year, month, day);
  return d.getMonth() === month ? d : null;
}

// RRULE を展開して開催日(YYYY-MM-DD)の配列を返す。FREQ=WEEKLY/DAILY/MONTHLY に対応。
export function expandRecurrence(
  startDate: string,
  rrule: string | undefined,
  exdates: string[] | undefined
): string[] {
  if (!rrule) return [startDate];

  const rules: Record<string, string> = {};
  rrule.split(";").forEach((part) => {
    const [k, v] = part.split("=");
    if (k && v) rules[k.toUpperCase()] = v;
  });

  const freq = rules.FREQ;
  const interval = Math.max(1, parseInt(rules.INTERVAL ?? "1", 10) || 1);
  const count = rules.COUNT ? parseInt(rules.COUNT, 10) : undefined;
  const until = rules.UNTIL
    ? (() => { const c = rules.UNTIL.replace(/[TZ]/g, "").slice(0, 8); return `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`; })()
    : undefined;
  const bydayEntries = parseByDay(rules.BYDAY);

  const start = new Date(startDate + "T00:00:00");
  // 終了境界: UNTIL があればそれ、なければ開始から1年後を上限
  const horizon = new Date(start);
  horizon.setFullYear(horizon.getFullYear() + 1);
  const exSet = new Set(exdates ?? []);
  const out: string[] = [];
  const limit = 366;

  const pushDate = (d: Date) => {
    const s = ymd(d);
    if (until && s > until) return false;
    if (d > horizon) return false;
    if (!exSet.has(s)) out.push(s);
    return true;
  };

  if (freq === "WEEKLY") {
    const days = (bydayEntries.length > 0 ? bydayEntries.map((e) => e.weekday) : [start.getDay()]).sort((a, b) => a - b);
    // 開始週の日曜日を基準に interval 週ごとに進める
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    for (let w = 0; w < limit; w++) {
      const base = new Date(weekStart);
      base.setDate(base.getDate() + w * interval * 7);
      if (base > horizon) break;
      let stop = false;
      for (const wd of days) {
        const d = new Date(base);
        d.setDate(d.getDate() + wd);
        if (d < start || d > horizon) continue;
        const s = ymd(d);
        if (until && s > until) { stop = true; break; }
        if (!exSet.has(s)) out.push(s);
        if (count && out.length >= count) { stop = true; break; }
      }
      if (stop) break;
    }
  } else if (freq === "DAILY") {
    const d = new Date(start);
    for (let i = 0; out.length < limit; i++) {
      if (!pushDate(d)) break;
      if (count && out.length >= count) break;
      d.setDate(d.getDate() + interval);
    }
  } else if (freq === "MONTHLY") {
    if (bydayEntries.length > 0) {
      // 「毎月第n曜日」形式。指定のしかたは3通りあり、取り違えると
      // もっともらしい別の日付になってしまうので分けて扱う。
      //   BYDAY=2SU            → 第2日曜
      //   BYDAY=SU;BYSETPOS=2  → 第2日曜（Googleカレンダー等がこの形で出す）
      //   BYDAY=SU             → その月の日曜すべて
      const bysetpos = (rules.BYSETPOS ?? "")
        .split(",")
        .map((n) => parseInt(n.trim(), 10))
        .filter((n) => !Number.isNaN(n) && n !== 0);

      for (let i = 0; i < limit; i++) {
        const base = new Date(start.getFullYear(), start.getMonth() + i * interval, 1);
        if (base > horizon) break;

        // その月でBYDAYに該当する日を全て洗い出す
        let cands: Date[] = [];
        for (const e of bydayEntries) {
          if (e.ordinal !== null) {
            const d = nthWeekdayOfMonth(base.getFullYear(), base.getMonth(), e.weekday, e.ordinal);
            if (d) cands.push(d);
          } else {
            for (let n = 1; n <= 5; n++) {
              const d = nthWeekdayOfMonth(base.getFullYear(), base.getMonth(), e.weekday, n);
              if (d) cands.push(d);
            }
          }
        }
        cands.sort((a, b) => a.getTime() - b.getTime());

        // BYSETPOS があれば「何番目か」で絞る（-1 なら最後）
        if (bysetpos.length > 0) {
          const picked: Date[] = [];
          for (const pos of bysetpos) {
            const idx = pos > 0 ? pos - 1 : cands.length + pos;
            if (idx >= 0 && idx < cands.length) picked.push(cands[idx]);
          }
          cands = picked.sort((a, b) => a.getTime() - b.getTime());
        }

        let stop = false;
        for (const d of cands) {
          if (d < start || d > horizon) continue;
          const s = ymd(d);
          if (until && s > until) { stop = true; break; }
          if (!exSet.has(s)) out.push(s);
          if (count && out.length >= count) { stop = true; break; }
        }
        if (stop) break;
      }
    } else {
      const d = new Date(start);
      for (let i = 0; out.length < limit; i++) {
        if (!pushDate(d)) break;
        if (count && out.length >= count) break;
        d.setMonth(d.getMonth() + interval);
      }
    }
  } else {
    return [startDate];
  }

  return [...new Set(out)].sort();
}

// 予定名から試合か練習かを振り分ける。ここを1箇所にして取りこぼしを防ぐ。
// BANDでは「自主練習」が「自主トレ」と書かれることがあり、「練習」だけで
// 判定すると試合側に流れてしまうため両方を見る。
// 「トレーニングマッチ」は試合なので巻き込まないこと。
export function isPracticeSummary(summary: string): boolean {
  return /練習|自主トレ/.test(summary ?? "");
}

// 「自主練習　お休み」のような、その回が無いことを知らせる予定。
// 予定として取り込むと実在しない練習ができてしまうため除外する。
export function isCancelledSummary(summary: string): boolean {
  return /お休み|中止/.test(summary ?? "");
}

// 取り込み済みの予定がBAND側にまだ存在するか。
// BANDで単発予定を後から繰り返しに変更すると、feed側のIDが "uid" から "uid_YYYY-MM-DD" に
// 変わるため、そのままでは「BANDで削除された」と誤判定してしまう。日付サフィックス付きの
// IDが1つでもあれば生存とみなす（BANDのUID自体に "_" を含む場合があるので形式で判定する）。
// BANDは繰り返し予定を編集すると系列のUID自体を振り直す
//（例: .../999924992/20260725@band.us → .../999924992/20260905@band.us）。
// そのためIDだけで突き合わせると、取り込み済みの予定が「新規」として再掲され、
// 追加すると重複ができてしまう。IDが変わっても同じ回だと分かるよう
// 「日付＋名称」でも突き合わせるためのキー。
export function occurrenceKey(date: string, label: string): string {
  return `${date}|${(label ?? "").trim()}`;
}

export function isStillInFeed(bandUid: string, feedUids: Set<string>): boolean {
  if (!bandUid) return false;
  if (feedUids.has(bandUid)) return true;
  const prefix = `${bandUid}_`;
  for (const id of feedUids) {
    if (id.startsWith(prefix) && /^\d{4}-\d{2}-\d{2}$/.test(id.slice(prefix.length))) return true;
  }
  return false;
}
