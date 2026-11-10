# 令制国マップ

日本の令制国（旧国名）を、いまの都道府県から辿る地図です。地図をタップすると、読み方、五畿七道、延喜式の等級と距離、国府の所在郡、一宮、地名の由来が出ます。日本語と中国語を切り替えられます。

この地図は現行の都道府県境です。令制国そのものの国境ではありません。

## 使い方

静的なファイルだけです。`dist/` を任意のウェブサーバに置けば動きます。

```bash
npm install
# 京華老宋体の原ファイルを FONT-NOTICE.md の手順で置き、sha256 を確認してから:
npm test
npm run build
```

`npm run build` のあと、`dist/` に完成ファイルが出ます。開発中に確認するときは:

```bash
npm run serve
```

ブラウザで `http://localhost:4179/` を開いてください。

サイト固有の正規 URL や OGP を足す場合は、リポジトリの外に設定ファイルを置き、次のようにビルドします。設定の書き方は `docs/site-config.md` にあります。

```bash
npm run build -- --site /path/to/site.json
```

## 中身

- `src/` — HTML / CSS / JavaScript の源
- `data/provinces.json` — 六十八国の本文と分類
- `data/map.json` — 現行都道府県の簡略図（Natural Earth 5.1.1、パブリックドメイン。`data/SOURCES.md` を見てください）
- `tests/` — データの検査と、ブラウザでの操作確認
- `scripts/subset-font.py` — 京華老宋体の原ファイルから、演示用サブセットを `dist/` へ作る
- `scripts/build-map.py` — Natural Earth から `data/map.json` を再生成する（通常は不要）

見出し書体は京華老宋体（特里王）です。原ファイルもサブセットもこのリポジトリには入れていません。入手・検証・ビルドの手順は `FONT-NOTICE.md` を必ず読んでください。`FONT-NOTICE.md` は削除しないでください。

## ライセンス

- プログラム（HTML / CSS / JS とビルド用スクリプト）: MIT（`LICENSE`）
- データ: 出所により異なります（`LICENSE-DATA.md` と `data/SOURCES.md`）
- 書体: 特里王の声明に従います（`FONT-NOTICE.md`）。MIT でも OFL でもありません
