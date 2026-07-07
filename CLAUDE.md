@AGENTS.md

# サッカークラブ マネジメントApp（トラヴェッソ 5年生）

保護者向けのチーム運営アプリ。試合/練習の予定、配車・備品・バケツ当番、費用徴収、
コーチ飲食費、選手マスタ、リーグ戦戦績、Excel出力などを管理する。

## セッション運用ルール（重要）

このフォルダがアプリの最終的な置き場所。**今後は移動しない**。
- 作業開始時は必ずこのフォルダに `cd` してから `claude` を起動する
- そうすれば `--continue` / `--resume` でセッション継続が保たれる（セッションはcwdパスに紐づく）
- フォルダを移動すると継続が途切れる

## 技術スタック / 構成
- Next.js App Router（TypeScript）+ Tailwind CSS。UIは日本語、変数/関数は英語キャメルケース
- データは **Googleスプレッドシート**（`lib/sheets.ts` 経由。サービスアカウント）。DBは無し
- ホスティング: Vercel。GitHub `itsuki-yano/soccer-manager` の main へ push で自動デプロイ
- デプロイは基本 `git push`（本番URL: https://soccer-manager-one.vercel.app）
- 変更後は `npx tsc --noEmit`（`.next/types/validator.ts` のエラーは古いキャッシュなので無視可）と `npx next build` を通してから push

## 2デプロイ構成（保護者用 / 子供用）
同一リポジトリから2つのVercelプロジェクトを配信:
- 保護者用: `soccer-manager-one`（全機能）
- 子供用: `soccer-manager-kids`（閲覧専用）
- 閲覧専用は環境変数 `VIEW_ONLY=true` / `NEXT_PUBLIC_VIEW_ONLY=true`
  - サーバー: `middleware.ts` が GET 以外の /api を 403 でブロック
  - クライアント: `lib/viewOnly.ts` の `VIEW_ONLY` で編集UIを隠し、メニューを
    `VIEW_ONLY_PATHS`（試合/練習/リーグ/選手マスタ）に限定
- 両デプロイとも同じGoogleシートを参照（GOOGLE_* env は共通）

## 主要な環境変数（Vercel）
- `GOOGLE_SPREADSHEET_ID` / `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY`（必須）
- `BLOB_READ_WRITE_TOKEN`（画像アップロード: レシート/備品/ロゴ）
- `BAND_ICAL_URL`（BAND予定取込みのiCalフィード。本番のみ）
- `GEOAPIFY_API_KEY`（Excelのルート地図。任意）
- `VIEW_ONLY` / `NEXT_PUBLIC_VIEW_ONLY`（子供用のみ true）

## Googleシートのタブ（列）  ※`lib/sheets.ts` ensureSheets が正
- settings: key, value
- parents(選手マスタ): id, playerName, furigana, jerseyNumber(練習着番号), group(班),
  carCapacity(乗車人数), bucketOrder, uniformNumber, blueBibsNumber, yellowBibsNumber, blueBibsMemo  … A:K
- matches(試合): id, date, matchType, matchName, opponent, venue, address, distanceKm, carCount,
  needsSettlement, bandUid, equipmentBringIn, equipmentBringOut, settlementStatus, skippedDrivers,
  bandUrl1, bandUrl2, startTime, endTime  … A:S
- drivers(配車当番): matchId, parentName
- practices(練習): id, date, type, venue, startTime, endTime, bandUid, address, bandUrl  … A:I
- bucket_duties(バケツ当番): id, practiceId, bringPersonName, returnPersonName
- duty_swaps(当番変更): id, personA, personB, appliedFromSlotIndex, fromDate, kind, returnSlotIndex
- duty_links(当番一覧の紐付け): matchId  ← 当番一覧に表示する試合IDの集合（サーバー保存）
- coach_expenses: id, date, description, amount, claimed(精算状況:""=未精算/請求中/精算済み), purchaserName, receiptUrl
- fees / fee_payments / equipment / links(BANDトーク) / memos / export_history
- audit_log(操作履歴): time, ip, device, method, path, detail

## ドメイン知識・重要仕様
- **当番一覧のローテーション**: 直近の過去試合の班から班ローテ(1→2→3→4→1…)を順に割当。
  次スロットの配車班 = 現スロットの備品持帰り班。表示は max(4, 今後の試合数) スロット。
- **当番一覧の紐付け**: `duty_links`(試合ID)に保存。紐付け試合を日付順にスロットへ詰めるため
  試合終了後もズレない・端末間で共有される（旧localStorage方式は廃止。初回に自動移行）。
  試合選択ピッカーは未紐付けの未来試合のみ表示。
- **当番変更(スワップ)**: 起点が配車(driver)か備品(equip)かで挙動が異なる。
  driver: 起点配車 A→B / 代役Bの班の次の当番(備品+配車) B→A。
  equip: 起点備品 C→D / 次スロット配車 C→D。coverage経過(driver3/equip2試合)で自動非表示。
- **距離は往復**。かりがね小学校(35.013439,137.018478)を出発地に距離API(GSI→Nominatim→OSRM)で算出。
- **BAND取込み**: 試合=band-calendar / 練習=band-practices（iCal）。RRULE展開、住所は郵便番号以降のみ、
  会場がband.us投稿URLを持てば bandUrl に自動セット。BAND側で削除された未来予定は同期時に連動削除(確認あり)。
- **Excel出力(まとめ役・会計担当)**: A4縦・4試合/ページ、情報左＋ルート地図右(Geoapify)、
  会計担当は明細下段に1セル(頭にチーム名)。配車担当者明細・飲み物代は別シート。金額はコーチ飲食費のみ。
- **操作履歴**: middlewareが書込みAPIを汎用記録。`lib/audit.ts` の `logDetail()` で
  試合削除/紐付け/解除/当番変更を詳細付きで記録。設定→操作履歴(/audit)で確認。
- **選手マスタ編集はパスワード 0404**。

## よくある落とし穴
- Googleシートは "true" を "TRUE"（大文字）で保存する → boolean比較は `.toLowerCase()`。
- `appendRow` はA列の行数から次行を計算して書く（append表検出の列ズレ対策。過去にバグあり）。
- 新しい列を足したら GET/POST/PUT の範囲(A:○)と、Match等を手組みしている
  export/route.ts・export/preview・matches/page.tsx importEvent も更新すること。
