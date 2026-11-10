# データライセンス

このリポジトリのデータは出所によってライセンスが異なります。詳細は `data/SOURCES.md` を見てください。

## プロジェクトが書いた本文（`provinces.json` の origin / origin_ja / ref / ref_ja など）

Creative Commons CC0 1.0 Universal。著作権を主張しません。

https://creativecommons.org/publicdomain/zero/1.0/

## 延喜式に基づく等級・距離（`grade` / `distance`）

分類そのものは10世紀の『延喜式』に記された事実です。原典はパブリックドメインです。このリポジトリでは事実として再録しており、CC0 1.0 とします。

## 国府の所在郡（`kokufu`）

『和名類聚抄』『拾芥抄』などに見える郡名の事実です。原典はパブリックドメインです。このリポジトリでは事実として再録しており、CC0 1.0 とします。史料間で記載が異なる場合は、出典を分けて残しています。

## 一宮（`ichinomiya`）

各令制国の一宮の社名と読みです。複数の名簿を照合した事実の一覧で、候補が複数ある国はすべて載せ「諸説」と記します。特定の一社を唯一の正解としてはいません。再録は CC0 1.0 とします。出典の詳細は `data/SOURCES.md` を見てください。

## 現行都道府県の地図幾何（`data/map.json`）

Natural Earth 10m Admin-1 States and Provinces, version 5.1.1 を簡略化し、この地図のキャンバスに投影したものです。Natural Earth のデータはパブリックドメインです。

https://www.naturalearthdata.com/about/terms-of-use/

再生成する手順は `scripts/build-map.py` と `data/SOURCES.md` を見てください。

## 令制国のクリック範囲（`data/kuni-regions.json`）

現行都道府県界を、令制国ごとのおおよその範囲に分けたものです。歴史的国境ではありません。幾何の出所は Natural Earth（パブリックドメイン）、分割はこのプロジェクトの作成で CC0 1.0 です。詳細は `data/SOURCES.md` を見てください。

## 書体

京華老宋体（特里王）は上記とは別条件です。原ファイルもサブセットもこのリポジトリには入れていません。`FONT-NOTICE.md` を見てください。
