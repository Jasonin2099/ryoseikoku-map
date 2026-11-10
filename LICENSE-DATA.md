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

## 令制国の境界（`data/map.json` と `data/kuni-regions.json` の国の幾何）

幕末期の村域データから復元した令制国の境界です。クリエイティブ・コモンズ 表示-継承 4.0 国際（CC BY-SA 4.0）です。利用時は出典を表示し、同じライセンスで再配布してください。

https://creativecommons.org/licenses/by-sa/4.0/

原典と加工の関係、クレジットの書き方は `data/SOURCES.md` を見てください。要約すると:

- みるラボ 令制国ポリゴン（CC BY-SA 4.0）https://miru-lab.jp/contents/ryoseikoku-map
- 『幕末期近世村領域データセット』（CODH作成）「幕末期近世村領域データ」（本田謙一）https://geoshape.ex.nii.ac.jp/av/ ／ https://github.com/yaoyue00085856/Kyudaka_agrivillage
- 農業集落境界データ（2015年農林業センサス、農林水産省。出典を明示して利用可）

境界は2015年の農業集落界による近似的な再構成であり、当時の正確な国境そのものではありません。このプロジェクトでは、原典の73カ国を伝統的な68国（陸奥・出羽を統合）へ再統合し、ランベルト正角円錐図法で投影しています。

再生成する手順は `scripts/build-map.py` と `data/SOURCES.md` を見てください。

## 北海道・琉球の外形（`data/map.json` の hokkaido / ryukyu）

Natural Earth 10m Admin-1 States and Provinces, version 5.1.1 を簡略化し、この地図のキャンバスに投影したものです。Natural Earth のデータはパブリックドメインです。

https://www.naturalearthdata.com/about/terms-of-use/

## 書体

京華老宋体（特里王）は上記とは別条件です。原ファイルもサブセットもこのリポジトリには入れていません。`FONT-NOTICE.md` を見てください。
