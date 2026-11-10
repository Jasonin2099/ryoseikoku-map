# サイト設定（任意）

公開する場所の正規 URL や OGP 画像を足したいときだけ使います。この設定は源のツリーには含めません。

`site.json` の例:

```json
{
  "canonical": "https://example.example/",
  "ogImage": "https://example.example/og.png",
  "ogImageFile": "/absolute/path/to/og.png",
  "extraBody": "",
  "extraScripts": []
}
```

- `canonical` があるとき、`link rel="canonical"` と `og:url`、`twitter` 用の絶対画像 URL を書きます。
- `ogImageFile` があるとき、その PNG を `dist/og.png` にコピーします。
- `extraBody` は `</body>` の直前に差し込む HTML です。
- `extraScripts` は追加のスクリプト URL です。

ビルド:

```bash
npm run build -- --site /path/to/site.json
```
