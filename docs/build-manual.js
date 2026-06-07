const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  LevelFormat, ExternalHyperlink, Header, Footer, PageNumber,
} = require("docx");
const fs = require("fs");
const path = require("path");

// A4サイズ (DXA)
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1134; // 2cm
const CONTENT_W = PAGE_W - MARGIN * 2;

const BLUE     = "1F4E79";
const BLUE_MID = "2E75B6";
const BLUE_LT  = "D6E4F0";
const BLUE_HDR = "BDD7EE";
const GRAY_LT  = "F2F2F2";
const GRAY_BG  = "EDEDED";
const GREEN_LT = "E2EFDA";
const YELLOW_LT= "FFFACD";
const WHITE    = "FFFFFF";
const TEXT_COL = "1A1A2E";

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function hCell(text, w, bg = BLUE_HDR) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: cellBorders,
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 20, font: "Meiryo", color: BLUE })],
    })],
  });
}

function dCell(text, w, bg = WHITE, bold = false) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: cellBorders,
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    children: [new Paragraph({
      children: [new TextRun({ text, size: 20, font: "Meiryo", bold, color: TEXT_COL })],
    })],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE_MID, space: 4 } },
    children: [new TextRun({ text, bold: true, size: 36, font: "Meiryo", color: BLUE })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, font: "Meiryo", color: BLUE_MID })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: 22, font: "Meiryo", color: "444444" })],
  });
}

function para(text, opts = {}) {
  const parts = text.split(/(`[^`]+`)/g);
  const runs = parts.map(p => {
    if (p.startsWith("`") && p.endsWith("`")) {
      return new TextRun({ text: p.slice(1, -1), font: "Courier New", size: 18, color: "C7254E", highlight: "yellow" });
    }
    // bold inline
    const bparts = p.split(/(\*\*[^*]+\*\*)/g);
    return bparts.map(bp => {
      if (bp.startsWith("**") && bp.endsWith("**")) {
        return new TextRun({ text: bp.slice(2, -2), bold: true, size: opts.size || 20, font: "Meiryo", color: TEXT_COL });
      }
      return new TextRun({ text: bp, size: opts.size || 20, font: "Meiryo", color: opts.color || TEXT_COL });
    });
  }).flat();
  return new Paragraph({ children: runs, spacing: { after: 80 }, ...opts.paraProps });
}

function bullet(text, level = 0) {
  const indent = level === 0 ? { left: 480, hanging: 240 } : { left: 720, hanging: 240 };
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const runs = parts.map(p => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return new TextRun({ text: p.slice(2, -2), bold: true, size: 20, font: "Meiryo", color: TEXT_COL });
    }
    return new TextRun({ text: p, size: 20, font: "Meiryo", color: TEXT_COL });
  }).flat();
  return new Paragraph({
    numbering: { reference: "bullets", level },
    indent,
    children: runs,
    spacing: { after: 60 },
  });
}

function numbered(text, n) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const runs = parts.map(p => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return new TextRun({ text: p.slice(2, -2), bold: true, size: 20, font: "Meiryo", color: TEXT_COL });
    }
    return new TextRun({ text: p, size: 20, font: "Meiryo", color: TEXT_COL });
  }).flat();
  return new Paragraph({
    numbering: { reference: `numbered-${n}`, level: 0 },
    indent: { left: 480, hanging: 240 },
    children: runs,
    spacing: { after: 60 },
  });
}

function tip(text, bg = YELLOW_LT, prefix = "💡 ポイント") {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: noBorders,
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      children: [
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: prefix, bold: true, size: 19, font: "Meiryo", color: "7B6000" })] }),
        new Paragraph({ children: [new TextRun({ text, size: 19, font: "Meiryo", color: TEXT_COL })] }),
      ],
    })] })],
    margins: { top: 120, bottom: 120 },
  });
}

function warning(text) {
  return tip(text, "FFF3CD", "⚠️ 注意");
}

function spacer(size = 120) {
  return new Paragraph({ children: [new TextRun("")], spacing: { after: size } });
}

function divider() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 2 } },
    spacing: { after: 200 },
    children: [new TextRun("")],
  });
}

// ───── Tables ─────
function menuTable() {
  const rows_data = [
    ["⚽", "試合・合宿管理", "試合登録・配車当番の設定"],
    ["🧃", "コーチ飲食費",   "飲み物代・食事代の管理"],
    ["👟", "選手マスタ",     "選手・班・背番号の登録"],
    ["📊", "Excel出力",      "精算書をダウンロード"],
    ["🎒", "備品管理",       "備品・救急セットの在庫管理"],
    ["💰", "費用徴収管理",   "合宿費・クラブ費の徴収状況"],
    ["📝", "備忘録",         "連絡事項・メモの記録"],
    ["⚙️",  "設定",          "チーム名・ガソリン単価"],
  ];
  const colW = [800, 2800, 6006];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colW,
    rows: [
      new TableRow({ children: [hCell("アイコン", colW[0]), hCell("機能名", colW[1]), hCell("用途", colW[2])] }),
      ...rows_data.map((r, i) => new TableRow({ children: [
        dCell(r[0], colW[0], i % 2 === 0 ? GRAY_LT : WHITE),
        dCell(r[1], colW[1], i % 2 === 0 ? GRAY_LT : WHITE, true),
        dCell(r[2], colW[2], i % 2 === 0 ? GRAY_LT : WHITE),
      ]})),
    ],
  });
}

function matchInputTable() {
  const rows_data = [
    ["日付",    "試合日（必須）"],
    ["種別",    "公式戦 / 合宿 / TM / その他"],
    ["試合名",  "リーグ名など"],
    ["対戦相手","チーム名"],
    ["会場名",  "グラウンド名など（必須）"],
    ["住所",    "入力すると距離を自動計算"],
    ["精算あり","ONにすると精算書に反映"],
  ];
  const colW = [2800, 6806];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colW,
    rows: [
      new TableRow({ children: [hCell("入力項目", colW[0]), hCell("説明", colW[1])] }),
      ...rows_data.map((r, i) => new TableRow({ children: [
        dCell(r[0], colW[0], i % 2 === 0 ? GRAY_LT : WHITE, true),
        dCell(r[1], colW[1], i % 2 === 0 ? GRAY_LT : WHITE),
      ]})),
    ],
  });
}

function parentTable() {
  const rows_data = [
    ["選手名（漢字）", "フルネーム（必須）"],
    ["ふりがな",       "並び順に使用"],
    ["背番号",         "数字"],
    ["班",             "1〜の数字（配車当番選択時の絞り込みに使用）"],
    ["乗車可能人数",   "車に乗せられる人数"],
  ];
  const colW = [2800, 6806];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colW,
    rows: [
      new TableRow({ children: [hCell("項目", colW[0]), hCell("説明", colW[1])] }),
      ...rows_data.map((r, i) => new TableRow({ children: [
        dCell(r[0], colW[0], i % 2 === 0 ? GRAY_LT : WHITE, true),
        dCell(r[1], colW[1], i % 2 === 0 ? GRAY_LT : WHITE),
      ]})),
    ],
  });
}

function coachTable() {
  const rows_data = [
    ["日付",     "購入日（必須）"],
    ["内容",     "「お茶代」「昼食代」など（必須）"],
    ["金額",     "円（必須）"],
    ["請求状況", "任意メモ"],
  ];
  const colW = [2800, 6806];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colW,
    rows: [
      new TableRow({ children: [hCell("項目", colW[0]), hCell("説明", colW[1])] }),
      ...rows_data.map((r, i) => new TableRow({ children: [
        dCell(r[0], colW[0], i % 2 === 0 ? GRAY_LT : WHITE, true),
        dCell(r[1], colW[1], i % 2 === 0 ? GRAY_LT : WHITE),
      ]})),
    ],
  });
}

function previewStatusTable() {
  const rows_data = [
    ["未請求",  "まだ請求書を出していない試合"],
    ["請求中",  "請求書を発行済みの試合"],
    ["精算済み","入金確認済みの試合"],
  ];
  const colW = [2800, 6806];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colW,
    rows: [
      new TableRow({ children: [hCell("ステータス", colW[0]), hCell("内容", colW[1])] }),
      ...rows_data.map((r, i) => new TableRow({ children: [
        dCell(r[0], colW[0], i % 2 === 0 ? GRAY_LT : WHITE, true),
        dCell(r[1], colW[1], i % 2 === 0 ? GRAY_LT : WHITE),
      ]})),
    ],
  });
}

function excelSheetTable() {
  const rows_data = [
    ["未請求",      "未請求の試合一覧と費用明細"],
    ["請求中",      "請求中の試合一覧と費用明細"],
    ["精算済み",    "精算済みの試合一覧と費用明細"],
    ["飲み物代請求","コーチ飲食費の一覧"],
  ];
  const colW = [2800, 6806];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colW,
    rows: [
      new TableRow({ children: [hCell("シート名", colW[0]), hCell("内容", colW[1])] }),
      ...rows_data.map((r, i) => new TableRow({ children: [
        dCell(r[0], colW[0], i % 2 === 0 ? GRAY_LT : WHITE, true),
        dCell(r[1], colW[1], i % 2 === 0 ? GRAY_LT : WHITE),
      ]})),
    ],
  });
}

function feesInputTable() {
  const rows_data = [
    ["費用名",    "「2024年合宿費」など"],
    ["カテゴリ",  "合宿費用 / クラブ費 / イベント費用 / その他"],
    ["金額",      "1人あたりの金額"],
    ["締切日",    "徴収期限"],
    ["説明",      "備考"],
  ];
  const colW = [2800, 6806];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colW,
    rows: [
      new TableRow({ children: [hCell("項目", colW[0]), hCell("説明", colW[1])] }),
      ...rows_data.map((r, i) => new TableRow({ children: [
        dCell(r[0], colW[0], i % 2 === 0 ? GRAY_LT : WHITE, true),
        dCell(r[1], colW[1], i % 2 === 0 ? GRAY_LT : WHITE),
      ]})),
    ],
  });
}

function settingsTable() {
  const rows_data = [
    ["チーム名",          "Excel出力時のヘッダーに使用", "トラヴェッソ 5年生"],
    ["リーグ名",          "Excel出力時に使用",           "西三河リーグ"],
    ["ガソリン単価(円/km)","配車費用の計算基準",          "16円/km"],
    ["デフォルト会計担当者","任意",                       "-"],
  ];
  const colW = [2600, 4500, 2506];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colW,
    rows: [
      new TableRow({ children: [hCell("項目", colW[0]), hCell("説明", colW[1]), hCell("初期値", colW[2])] }),
      ...rows_data.map((r, i) => new TableRow({ children: [
        dCell(r[0], colW[0], i % 2 === 0 ? GRAY_LT : WHITE, true),
        dCell(r[1], colW[1], i % 2 === 0 ? GRAY_LT : WHITE),
        dCell(r[2], colW[2], i % 2 === 0 ? GRAY_LT : WHITE),
      ]})),
    ],
  });
}

// 出力ボタン説明ボックス
function exportButtonTable() {
  const buttons = [
    { icon: "📋", title: "請求中作成", bg: "FFF9C4", desc: "ステータスが「請求中」の試合のみを出力します。\n既に請求書を出した試合の一覧を印刷・共有したいときに使います。" },
    { icon: "📤", title: "未請求発行", bg: "FFE0B2", desc: "未請求の試合を全て「請求中」に変更してから出力します。\n何件変更するか確認画面が表示されます。新しい請求書をまとめて発行するときに使います。" },
    { icon: "✅", title: "精算済発行", bg: "DCEDC8", desc: "期間を指定して「精算済み」の試合のみを出力します。\n精算が完了した試合を期間指定で集計・報告するときに使います。" },
    { icon: "📊", title: "全て出力",   bg: "BBDEFB", desc: "期間を指定して全ステータスの試合を3シートで出力します。\n全体の状況を一覧化したいときに使います。" },
  ];
  const colW = [1200, 2200, 6206];
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colW,
    rows: [
      new TableRow({ children: [hCell("", colW[0]), hCell("ボタン名", colW[1]), hCell("動作・用途", colW[2])] }),
      ...buttons.map((b, i) => new TableRow({ children: [
        new TableCell({
          width: { size: colW[0], type: WidthType.DXA },
          borders: cellBorders,
          shading: { fill: b.bg, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 80, right: 80 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: b.icon, size: 28, font: "Meiryo" })] })],
        }),
        new TableCell({
          width: { size: colW[1], type: WidthType.DXA },
          borders: cellBorders,
          shading: { fill: b.bg, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 140, right: 140 },
          children: [new Paragraph({ children: [new TextRun({ text: b.title, bold: true, size: 20, font: "Meiryo", color: TEXT_COL })] })],
        }),
        dCell(b.desc, colW[2], i % 2 === 0 ? GRAY_LT : WHITE),
      ]})),
    ],
  });
}

// ───── Cover page ─────
function coverSection() {
  return [
    spacer(1200),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: "⚽", size: 96, font: "Meiryo" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: "トラヴェッソ 5年生", size: 40, font: "Meiryo", color: "666666" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: "マネジメントApp", size: 72, bold: true, font: "Meiryo", color: BLUE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: "操作マニュアル", size: 44, font: "Meiryo", color: BLUE_MID })],
    }),
    new Table({
      width: { size: 6000, type: WidthType.DXA },
      columnWidths: [6000],
      rows: [new TableRow({ children: [new TableCell({
        width: { size: 6000, type: WidthType.DXA },
        borders: noBorders,
        shading: { fill: BLUE_LT, type: ShadingType.CLEAR },
        margins: { top: 200, bottom: 200, left: 300, right: 300 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [
            new TextRun({ text: "アプリURL: ", size: 22, font: "Meiryo", color: "555555" }),
            new TextRun({ text: "https://soccer-manager-one.vercel.app", size: 22, font: "Meiryo", color: BLUE_MID, underline: {} }),
          ]}),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: "対象: チームマネージャー（保護者）", size: 22, font: "Meiryo", color: "555555" }),
          ]}),
        ],
      })]})],
    }),
    spacer(400),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "2026年6月", size: 22, font: "Meiryo", color: "999999" })],
    }),
  ];
}

// ───── TOC page ─────
function tocSection() {
  const items = [
    ["1", "アプリ概要"],
    ["2", "ホーム画面"],
    ["3", "試合・合宿管理"],
    ["4", "選手マスタ"],
    ["5", "コーチ飲食費"],
    ["6", "Excel出力（精算書）"],
    ["7", "備品管理"],
    ["8", "費用徴収管理"],
    ["9", "備忘録"],
    ["10", "設定"],
    ["", "よくある質問"],
  ];
  return [
    h1("目次"),
    spacer(80),
    ...items.map(([n, title]) => new Paragraph({
      spacing: { after: 140 },
      tabStops: [{ type: "right", position: CONTENT_W }],
      children: [
        new TextRun({ text: n ? `${n}.  ${title}` : `    ${title}`, size: 24, font: "Meiryo", color: TEXT_COL }),
      ],
      border: { bottom: { style: BorderStyle.DOTTED, size: 1, color: "CCCCCC", space: 4 } },
    })),
  ];
}

// ───── Main content ─────
function buildChildren() {
  let numberedCounter = 0;
  function nextNumbered() { numberedCounter++; return `numbered-${numberedCounter}`; }

  const n1 = nextNumbered();
  const n2 = nextNumbered();
  const n3 = nextNumbered();
  const n4 = nextNumbered();
  const n5 = nextNumbered();

  return [
    // ── カバーページ ──
    ...coverSection(),
    new Paragraph({ pageBreakBefore: true, children: [new TextRun("")] }),

    // ── 目次 ──
    ...tocSection(),
    new Paragraph({ pageBreakBefore: true, children: [new TextRun("")] }),

    // ── 1. アプリ概要 ──
    h1("1. アプリ概要"),
    para("チームの試合・合宿にまつわる**配車費用の精算**や**備品管理**などを一元管理するWebアプリです。"),
    para("データはGoogleスプレッドシートに自動保存されるため、複数のマネージャーがリアルタイムで共有できます。スマートフォンのブラウザから操作できます。"),
    spacer(160),
    divider(),

    // ── 2. ホーム画面 ──
    h1("2. ホーム画面"),
    para("アプリを開くと最初に表示されるメニュー画面です。各機能へのリンクが並んでいます。"),
    spacer(80),
    h2("メニュー一覧"),
    menuTable(),
    spacer(160),
    h2("BANDトーク"),
    para("画面下部にBANDトークへのリンクを登録できます。"),
    bullet("**追加:** 「＋ 追加」ボタンから名称とURLを入力"),
    bullet("**編集・削除:** 各リンクの「編集」「削除」ボタン"),
    spacer(160),
    divider(),

    // ── 3. 試合・合宿管理 ──
    h1("3. 試合・合宿管理"),
    h2("3-1. 試合一覧画面"),
    h3("表示切り替え"),
    bullet("**一覧表示:** 日付順にカード表示（今後の予定 / 過去の試合）"),
    bullet("**カレンダー表示:** 月ごとのカレンダーで日程を確認"),
    h3("フィルター"),
    bullet("種別（公式戦 / 合宿 / TM / その他）で絞り込み"),
    bullet("「精算あり のみ」で精算が必要な試合だけ表示"),
    spacer(80),
    h2("3-2. 手動で試合を登録する"),
    para("「＋ 追加」ボタンをタップして以下の項目を入力します。"),
    spacer(80),
    matchInputTable(),
    spacer(120),
    tip("住所を入力すると「かりがね小学校」からの往復距離が自動計算されます（約0.8秒後）。住所が空白または認識できない場合は距離が0kmになります。"),
    spacer(160),
    h2("3-3. BANDカレンダーから一括インポート"),
    numbered("一覧画面の「**BAND同期**」ボタンをタップ", n1),
    numbered("BANDの予定が一覧表示される", n1),
    numbered("個別に「追加」、または「全てインポート」で一括登録", n1),
    spacer(120),
    warning("距離0km警告: 住所から距離を計算できなかった場合、インポート後に警告が表示されます。「編集画面を開く」から住所を修正してください。"),
    spacer(160),
    h2("3-4. 試合詳細・編集"),
    para("試合カードをタップすると詳細画面が開きます。"),
    spacer(80),
    h3("配車当番の登録"),
    numbered("「配車当番を編集」ボタンをタップ", n2),
    numbered("選手一覧からドライバーを選択（班フィルターで絞り込み可能）", n2),
    numbered("カスタム名を直接入力することも可能", n2),
    numbered("「保存」で確定 → 台数は自動的に当番人数に設定されます", n2),
    spacer(80),
    h3("持ち帰り当番の登録"),
    numbered("「持ち帰り当番を編集」ボタンをタップ", n3),
    numbered("担当者を選択して保存", n3),
    spacer(80),
    h3("距離の再計算"),
    para("住所欄の横にある「再計算」ボタンをタップすると最新の距離に更新されます。"),
    h3("精算ステータス"),
    bullet("**精算なし / 精算あり:** トグルで切り替え（精算書への反映）"),
    h3("前回当番を引き継ぐ"),
    para("直前の試合の配車当番をそのまま引き継げます（確認メッセージが表示されます）。"),
    spacer(160),
    divider(),

    // ── 4. 選手マスタ ──
    h1("4. 選手マスタ"),
    para("チームに所属する選手・保護者の情報を管理します。配車当番の選択画面で使用されます。"),
    spacer(80),
    h2("登録項目"),
    parentTable(),
    spacer(120),
    h2("班フィルター"),
    para("「全員 / 1班 / 2班 / …」ボタンで表示を絞り込めます。班を設定しておくと、配車当番の選択がスムーズになります。"),
    spacer(160),
    divider(),

    // ── 5. コーチ飲食費 ──
    h1("5. コーチ飲食費"),
    para("コーチへの飲み物代・食事代を記録します。Excel精算書の「飲み物代請求」シートに自動反映されます。"),
    spacer(80),
    h2("登録項目"),
    coachTable(),
    spacer(160),
    divider(),

    // ── 6. Excel出力 ──
    h1("6. Excel出力（精算書）"),
    para("配車費用の精算書を Excelファイル（.xlsx）でダウンロードします。"),
    spacer(80),
    h2("出力前のプレビュー"),
    para("画面上部に費用サマリーが表示されます。各試合のバッジをタップするとステータスを変更できます。"),
    spacer(80),
    previewStatusTable(),
    spacer(120),
    h2("4種類の出力ボタン"),
    spacer(80),
    exportButtonTable(),
    spacer(120),
    h2("出力されるExcelの構成"),
    excelSheetTable(),
    spacer(120),
    para("各シートには以下の列が含まれます："),
    bullet("No. / 日付 / 曜日 / 対戦相手 / 会場 / 距離(km) / 1台費用 / 台数 / 合計費用 / 当番名"),
    bullet("当番別の支払い明細（誰がいくら払うか）"),
    spacer(120),
    tip("費用計算式: 往復距離(km) × ガソリン単価(円/km)、10円単位で四捨五入"),
    spacer(160),
    divider(),

    // ── 7. 備品管理 ──
    h1("7. 備品管理"),
    para("チームの備品（ボール・ビブス・救急セットなど）の在庫を管理します。"),
    spacer(80),
    h2("基本操作"),
    bullet("**追加:** 「＋ 追加」ボタン → 名称・数量・メモを入力"),
    bullet("**数量変更:** 「＋」「－」ボタンで増減（編集モード時）"),
    bullet("**写真登録:** カメラアイコンから写真を撮影・アップロード"),
    spacer(80),
    h2("編集モード"),
    para("画面右上の「編集」ボタンで編集モードに切り替えると、以下の操作ができます："),
    bullet("名称・メモのインライン編集"),
    bullet("子アイテムの追加（入れ子構造で管理可能）"),
    bullet("削除ボタンの表示"),
    spacer(80),
    h2("入れ子構造"),
    para("「救急セット」の中に「絆創膏」「消毒液」などを子アイテムとして登録できます。"),
    spacer(160),
    divider(),

    // ── 8. 費用徴収管理 ──
    h1("8. 費用徴収管理"),
    para("合宿費・クラブ費などの徴収状況を選手ごとに管理します。"),
    spacer(80),
    h2("費用の新規作成"),
    para("「＋ 新規費用」から登録します："),
    spacer(80),
    feesInputTable(),
    spacer(120),
    h2("徴収状況の更新"),
    para("費用詳細画面で各選手の「未納 / 徴収済」をタップして切り替えます。"),
    para("「全員を徴収済みにする」ボタンで一括更新も可能です。"),
    spacer(80),
    h2("フィルター"),
    bullet("班別フィルター（1班 / 2班 / …）"),
    bullet("「未納のみ」表示で未納者だけ確認"),
    spacer(160),
    divider(),

    // ── 9. 備忘録 ──
    h1("9. 備忘録"),
    para("連絡事項・メモを自由に記録できます。"),
    spacer(80),
    bullet("**作成:** テキストエリアに入力して「追加」"),
    bullet("**編集:** 各メモの「修正」ボタン"),
    bullet("**削除:** 「削除」ボタン（確認画面あり）"),
    bullet("**URLリンク:** メモ内に https://... を入力すると自動でリンクになります"),
    spacer(160),
    divider(),

    // ── 10. 設定 ──
    h1("10. 設定"),
    spacer(80),
    settingsTable(),
    spacer(120),
    para("変更後「保存」ボタンをタップしてください。"),
    spacer(80),
    tip("設定画面の「スプレッドシートを開く」からGoogleスプレッドシートを直接確認できます。データのバックアップや手動確認に便利です。"),
    spacer(160),
    divider(),

    // ── FAQ ──
    h1("よくある質問"),
    spacer(80),

    h2("Q. 距離が0kmになってしまう"),
    para("住所が正確に入力されていない場合、距離を自動計算できません。"),
    para("試合詳細画面で「住所」欄に正確な住所（例：愛知県豊田市○○町1-1）を入力し、「再計算」をタップしてください。"),
    spacer(80),

    h2("Q. BANDの予定が取得できない"),
    para("BAND iCalのURLが正しく設定されているか確認してください。"),
    spacer(80),

    h2("Q. 精算ステータスを間違えて変更してしまった"),
    para("Excel出力画面のプレビューでステータスバッジをタップすると「未請求 → 請求中 → 精算済み → 未請求…」と循環して変更できます。"),
    spacer(80),

    h2("Q. データはどこに保存されていますか？"),
    para("Googleスプレッドシートに保存されています。設定画面の「スプレッドシートを開く」から直接確認できます。"),
    spacer(160),

    // footer spacer
    spacer(200),
  ];
}

// ───── Numbering config ─────
function buildNumberingConfig(maxN) {
  const config = [
    {
      reference: "bullets",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "•",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 480, hanging: 240 } } },
      }, {
        level: 1, format: LevelFormat.BULLET, text: "◦",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 240 } } },
      }],
    },
  ];
  for (let i = 1; i <= maxN; i++) {
    config.push({
      reference: `numbered-${i}`,
      levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: "%1.",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 480, hanging: 240 } } },
      }],
    });
  }
  return config;
}

// ───── Build ─────
const children = buildChildren();

const doc = new Document({
  numbering: { config: buildNumberingConfig(20) },
  styles: {
    default: {
      document: { run: { font: "Meiryo", size: 20, color: TEXT_COL } },
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Meiryo", color: BLUE },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Meiryo", color: BLUE_MID },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Meiryo", color: "444444" },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE_MID, space: 4 } },
          children: [
            new TextRun({ text: "トラヴェッソ 5年生 マネジメントApp 操作マニュアル", size: 16, font: "Meiryo", color: "888888" }),
            new TextRun({ text: "\t", size: 16 }),
          ],
          tabStops: [{ type: "right", position: CONTENT_W }],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: BLUE_MID, space: 4 } },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "- ", size: 16, font: "Meiryo", color: "888888" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Meiryo", color: "888888" }),
            new TextRun({ text: " -", size: 16, font: "Meiryo", color: "888888" }),
          ],
        })],
      }),
    },
    children,
  }],
});

const outPath = path.join(__dirname, "マニュアル.docx");
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log("Created:", outPath, `(${(buf.length / 1024).toFixed(1)} KB)`);
});
