# 開発

必要:

- Node.js 18 以降
- Google Chrome または Chromium（Playwright が使います）
- Python 3（書体のサブセット。地図を再生成するときも使う）
- `fonttools` と `brotli`（`pip install fonttools brotli`）
- 京華老宋体 v3.0 の原ファイル（`FONT-NOTICE.md` の手順で置き、SHA-256 を確認する）。CI など原ファイルが置けない環境では `FONT_OPTIONAL=1` でサブセットを省略できる

```bash
npm install
npm test          # データの検査、書体のサブセット、ビルド、Playwright
npm run build     # dist/ を生成（サブセットも含む）
npm run serve     # dist/ を http://localhost:4179/ で配信
python3 scripts/subset-font.py   # サブセットだけ作り直す
```

テストはビルド済みの `dist/` を見ます。先に `npm run build` してから `npx playwright test` しても構いません。`npm test` はビルドを内包します。

地図幾何を Natural Earth からやり直すときだけ:

```bash
# pyshp と shapely が必要（仮想環境でも可）
python3 scripts/build-map.py
```

## 無視するファイル

`.gitignore` に書いてあるとおり、次はリポジトリに入れません。

- `node_modules/`
- `dist/`（サブセット書体を含むビルド成果物）
- `test-results/` と `playwright-report/`
- `.cache/` と `vendor/`（Natural Earth の zip、書体の原ファイルなど）
- `*.ttf` / `*.otf` / `*.woff` / `*.woff2`
- サイト固有の設定（正規 URL や配信用の追加マークアップ）

`FONT-NOTICE.md` は削除しないでください。
