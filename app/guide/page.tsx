"use client";
import { useState } from "react";
import BackHeader from "@/components/BackHeader";

// 画像スロット: /public/guide/ に同名PNGを置くと表示。無ければプレースホルダ。
function Shot({ src, caption }: { src: string; caption: string }) {
  const [ok, setOk] = useState(true);
  return (
    <figure className="my-3">
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/guide/${src}`} alt={caption} onError={() => setOk(false)}
          className="w-full rounded-xl border border-gray-200 shadow-sm" />
      ) : (
        <div className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-10 text-center text-gray-400">
          <div className="text-3xl mb-1">📷</div>
          <div className="text-xs">画像（{src}）</div>
        </div>
      )}
      <figcaption className="text-xs text-gray-400 mt-1 text-center">{caption}</figcaption>
    </figure>
  );
}

function Section({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
      <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-2"><span className="text-xl">{emoji}</span>{title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
      <span className="font-bold">⚠️ 注意　</span>{children}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 w-5 h-5 rounded-full bg-stone-700 text-white text-xs flex items-center justify-center font-bold">{n}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function GuidePage() {
  return (
    <main className="max-w-lg md:max-w-3xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="使い方ガイド" />
      <p className="text-xs text-gray-400 mb-4">はじめての方はここを読めばひと通り使えます。</p>

      <Section emoji="📱" title="このアプリでできること">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>試合・合宿管理</b>：試合／合宿の予定・会場・時刻・配車当番の確認</li>
          <li><b>通常練習</b>：練習の予定・会場・バケツ当番</li>
          <li><b>当番一覧</b>：配車・備品持帰り・バケツ当番の順番と担当の設定</li>
          <li><b>役割予定</b>：選手ごとの担当予定</li>
          <li><b>リーグ戦戦績</b>：西三河リーグの順位・星取表</li>
          <li><b>コーチ飲食費</b>：立て替えた飲み物・お弁当代の記録</li>
          <li><b>選手マスタ</b>：背番号・班・ビブス番号など（編集はパスワード）</li>
          <li><b>まとめ役・会計担当</b>：Excel出力</li>
          <li><b>備品管理／費用徴収管理／備忘録</b></li>
        </ul>
      </Section>

      <Section emoji="🔁" title="毎回の基本の流れ（まとめ役）">
        <Step n={1}><b>BAND予定取込み</b>：「試合・合宿管理」または「通常練習」で緑の<b>「🎵 BAND予定取込み」</b>を押し、出てきた予定を<b>「追加」</b>します。</Step>
        <Shot src="band-import.png" caption="BAND予定取込み → 追加" />
        <Step n={2}><b>種別・精算・BAND投稿リンクを確認</b>：取込み直後は種別が「その他」・精算が「精算なし」のままなので、試合詳細の<b>「編集」</b>から実際の種別（公式戦／TM／合宿）と精算あり・なしを設定してください。</Step>
        <Shot src="edit-match.jpg" caption="試合詳細 →「編集」" />
        <Shot src="edit-match-form.jpg" caption="種別・精算・BAND投稿リンクを入力" />
        <p>BAND投稿リンクは、BANDの該当予定を開き右上の<b>「⋮」→「URLをコピーする」</b>でコピーしたものを「BAND投稿リンク1」に貼り付けます。</p>
        <Shot src="band-url-copy.jpg" caption="BAND側で「⋮」→「URLをコピーする」" />
        <Step n={3}><b>当番一覧で紐付け</b>：当番一覧の各回で<b>「試合選択／練習選択」</b>を押し、その回に対応する試合・練習を選びます。</Step>
        <Shot src="link.png" caption="当番一覧で試合・練習を紐付け" />
        <Step n={4}><b>担当を確認・編集</b>：配車当番・備品持帰り・バケツ当番を確認し、必要なら<b>「変更」</b>や<b>「当番変更」</b>で編集します。</Step>
        <Shot src="edit-duty.png" caption="紐付けた当番の確認・編集" />
        <Warn>配車当番・バケツ当番は、<b>試合日／練習日が「紐付け」されていないと変更できません</b>。まず紐付けをしてください。</Warn>
      </Section>

      <Section emoji="🔄" title="当番を交代したとき（全員）">
        <p>「配車当番」や「バケツ当番」を交代した際は、アプリ上でも変更をお願いします。</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>当番一覧で対象の回の<b>「当番変更」</b>（配車・備品）または<b>「変更」</b>（バケツ）を押して担当を直します。</li>
        </ul>
        <Shot src="duty-change.png" caption="当番変更（誰と誰を交代）" />
        <Warn>当番を変更するには、その回に<b>試合・練習がセット（紐付け）</b>されている必要があります。<br />紐付けができていない・分からないときは<b>諒母までご連絡ください</b>。</Warn>
      </Section>

      <Section emoji="🧃" title="コーチ飲食費の入力（全員）">
        <p>コーチの飲み物・お弁当代などを立て替えたら、忘れずに入力してください。</p>
        <Step n={1}>「コーチ飲食費」→<b>「＋ 費用を追加」</b></Step>
        <Step n={2}>日付・<b>内容（飲み物／お弁当 など）</b>・金額・購入者（自分の名前）を入力</Step>
        <Step n={3}>可能ならレシート写真も添付して保存</Step>
        <Shot src="coach-expense.png" caption="コーチ飲食費の入力" />
      </Section>

      <Section emoji="🪣" title="バケツ当番について">
        <p>バケツ当番は当番一覧で<b>次の4回分まで</b>を表示・設定します。</p>
        <Warn>試合の追加や天候によって予定が変わることが多いため、<b>あえて4回分までしかセットしない</b>仕様にしています。先の分は都度セットしてください。</Warn>
      </Section>

      {/* 取り決め */}
      <h2 className="text-base font-bold text-gray-800 mt-6 mb-2">📋 アプリでの「役割」と「運用」</h2>

      <Section emoji="🙋" title="1. 個人（全員）">
        <p className="font-semibold">・当番の変更</p>
        <p>「配車当番」や「バケツ当番」を交代した際は、アプリ上の変更をお願いします。</p>
        <p className="font-semibold mt-2">・コーチ飲食費の入力</p>
        <p>コーチの飲食費を立て替えてくださった時は、忘れずにデータ入力をお願いします。</p>
      </Section>

      <Section emoji="🧑‍💼" title="2. まとめ役">
        <p className="font-semibold">・BAND（バンド）との連携・取り込み</p>
        <p>BANDに試合・練習の予定が登録された際、アプリ側への「BAND予定の取り込み」をお願いします。
        また試合などの予定が後から入った場合、バケツ当番や配車当番の担当予定が変更されますので、アプリ側の変更・更新をお願いします。</p>
        <p className="font-semibold mt-2">・当番変更時の再確認</p>
        <p>当番変更が行われた際、アプリ上で変更が完了しているか最終確認をお願いします。</p>
      </Section>

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
        <div className="font-bold mb-1">※ 注意事項</div>
        バケツ当番や配車当番を変更する際には、<b>試合や練習予定がセットされていないと変更はできません。</b><br />
        （変更時、セットができていない時は、<b>諒母までご連絡ください</b>）
      </div>
    </main>
  );
}
