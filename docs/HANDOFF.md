# 交接メモ

このリポジトリは静的な「令制国マップ」です。公開 Git リポジトリを作る・保守する人向けの手順です。サイト固有のドメインや、個人の名前、サーバ構成は、この文書にもソースにも書かないでください。

## いちどだけの準備

1. Node.js 18 以降を入れる。
2. Python 3 を入れる。書体のサブセット用に:

   ```bash
   pip install fonttools brotli
   ```

   地図を Natural Earth から再生成するときだけ、さらに `pyshp` と `shapely` が必要です。通常のビルドには不要です（`data/map.json` はすでに入っています）。
3. 京華老宋体 v3.0 の原ファイルを、作者の公式な案内に従って入手する（`FONT-NOTICE.md`）。次のいずれかに置く。

   - `.cache/fonts/京華老宋体v3.0.ttf`（推奨）
   - `vendor/fonts/京華老宋体v3.0.ttf`
   - 環境変数 `FONT_FILE`

   SHA-256 が次と一致することを確認する（ビルドも同じ値を要求します）:

   `f7fef9fc413e9e2343f0bb432c51cca41c44b8fe37f071dc86b050896ae9f9e2`

4. ブラウザテスト用に Google Chrome または Chromium を入れる。

## ビルドとテスト

```bash
npm install
npm test
npm run build
npm run serve
```

- `npm test` は `tests/data-check.mjs`、`npm run build`、Playwright（`tests/e2e.spec.js`）をこの順で走らせます。
- 開発用サーバは **http://localhost:4179/** です。4173 番は使わないでください（他のプロジェクトと衝突します）。
- 公式の原書体は作者の案内（微信公眾号と網盤）でのみ入手でき、安定した公開ダウンロード URL はありません。GitHub Actions では環境変数 `FONT_OPTIONAL=1` を立て、サブセットを省略してビルドします。見出しはシステムの明朝体に落ちます。原ファイルを置いた環境では、この変数を立てなければ従来どおり SHA-256 を検証してサブセットします。
- キャッシュbust 用のクエリは `scripts/build.mjs` がビルド時に付けます。作業ツリーがきれいなら git の短縮ハッシュ、汚れているか git が使えないときはソースの内容ハッシュです。`src/app.js` の `__ASSET_VERSION__` と、CSS / フォントの URL も同じ値に置き換わります。手動で数字を上げる必要はありません。
- リポジトリ同梱の OGP 画像（ドメインなし）を描き直すときは、先にビルドしてから `npm run og` です。`scripts/og.py` は `dist/jinghua-sub.woff2` を使います。
- 演示サイトを、リポジトリの外の設定でビルドする例:

  ```bash
  npm run build -- --site /path/to/site.json
  ```

  書き方は `docs/site-config.md` を見てください。その設定ファイル自体はリポジトリに入れません。

## 書体

- リポジトリに `.woff2` や `.ttf` をコミットしないでください。`.gitignore` で除外しています。
- 演示用のサブセット `dist/jinghua-sub.woff2` は、`scripts/subset-font.py` がデータと UI の文字を集めて切り出します。文字を足したらビルドし直すだけで足ります。収録はおおよそ 1500 字、ファイルは約 0.7 MB です（以前の見出しだけ 5 KB より大きいのは、本文と一宮名も同じ書体で出すためです）。
- 作者（特里王）の声明では、改変したフォントファイルの配布が禁じられています。サブセットを「改変」と見る余地があるため、サブセットはビルド成果物に限り、Git には置きません。
- **`FONT-NOTICE.md` は削除しないでください。** クレジットは「京華老宋体（特里王）」です。

## 地図

- `data/map.json` は Natural Earth 10m Admin-1 v5.1.1（パブリックドメイン）から作っています。出所の説明は `data/SOURCES.md` と `LICENSE-DATA.md` にあります。
- 形をやり直すときだけ `python3 scripts/build-map.py` を走らせます。県番号と令制国の対応がずれていないか、`npm run test:data` で確認してください。
- 北海道の幾何に北方四島は含まれません。東京の小笠原は意図的に外しています。
- クリック判定と国名ラベルは `data/kuni-regions.json` です。現行の県境を令制国のおおよその範囲に分けたもので、歴史的国境ではありません。形をやり直すときは `python3 scripts/build-kuni-regions.py`。
- 画面上の短辺が 44px 未満の国は、まず所属の道に拡大し、まだ小さければ近傍（その国の囲みの3倍）へ、その次で選ぶ、という段階です。

## 一宮

- 六十八国の社名と読みは `provinces.json` の `ichinomiya` です。諸説のある国は候補をすべて載せ、`ichinomiya_disputed` を true にします。唯一の正解を決めないでください。
- 巡拝会の「新一の宮」は、六十八国のデータに混ぜないでください。
- 出典の書き方は `data/SOURCES.md` にあります。百科事典の本文をコピーしないでください。

## 公開リポジトリで守ること

- README・ライセンス・文書・ソース・コミットメッセージに、特定の演示サイトのドメインを書かないでください。シェア用の URL は実行時の `location.origin` を使っています。
- 個人の実名、サーバ名、非公開の連絡先、このリポジトリと無関係な別プロジェクトの名前を入れないでください。
- `FONT-NOTICE.md` を消さない。書体を差し替える場合も、特里王の声明とクレジットの扱いは残すか、書体をやめる判断を文書に残してください。
- ライセンスはプログラムが MIT、データは出所ごとに `LICENSE-DATA.md`、書体は別条件、という三段です。混ぜないでください。

## 無視するファイル（再掲）

`node_modules/`、`dist/`、`test-results/`、`playwright-report/`、`.cache/`、`vendor/`、フォント原ファイルとサブセット（`*.ttf` `*.otf` `*.woff` `*.woff2`）、サイト固有の設定（`.site-config.json` や `--site` で渡す JSON）。
