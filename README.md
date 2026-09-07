# Java Silver SE 17 統合ノート

Oracle 認定 Java Programmer, Silver SE 17（1Z0-825）の試験範囲を、
全 6 章・62 論点にまとめた学習ノートです。

コード例はすべて **「コンパイルも実行も通る」「コンパイルエラー」「実行時に例外」** の
3 つに色分けしてあります。この試験が実質その三択判定だからです。

📖 **公開ページ:** https://<ユーザー名>.github.io/<リポジトリ名>/

## 収録内容

| 章 | 内容 | 論点数 |
|---|---|---|
| 1 | Java の概要と簡単な Java プログラムの作成 | 7 |
| 2 | Java の基本データ型と文字列の操作 | 12 |
| 3 | 演算子と制御構造 | 12 |
| 4 | クラスの定義とインスタンスの使用 | 10 |
| 5 | 継承とインタフェースの使用 | 11 |
| 6 | 例外処理 | 10 |

各章の末尾に一問一答と、進捗が保存される直前チェックリストが付いています。
サイドバーの検索窓（`/` キーでフォーカス、`Esc` で解除）で全章を横断検索できます。

スマホでは目次が左から出るドロワーになり、章ごとに折り畳まれます。画面上部のバーに
いま読んでいる章と節が出るので、長い本文のどこにいるか分かります。

## リポジトリの構成

編集するのは `src/` だけです。`docs/index.html` は `build.mjs` が生成する成果物で、
手で編集しても次のビルドで上書きされます。

```
src/
├── manifest.json              章と節の一覧。目次と並び順の唯一の定義
├── template.html              <head> と全体の骨格
├── styles/                    CSS。ファイル名の番号順に連結される
│   ├── 01-tokens.css              色・フォントなどの変数
│   ├── 03-layout.css              サイドバーと本文の 2 カラム
│   ├── 07-code.css                コードブロックの 3 分類
│   ├── 20-mobile.css              スマホ向けの調整はすべてここ
│   └── …（全 16 ファイル）
├── scripts/                   JS。ファイル名の番号順に連結される
│   ├── 00-app.js                  名前空間 NoteApp
│   ├── 01-highlight.js            コードの簡易シンタックスハイライト
│   ├── 04-checklist.js            チェックリストと進捗の保存
│   ├── 05-search.js               全文検索
│   ├── 06-topic-index.js          論点インデックスのチップ
│   └── 07-mobile-nav.js           スマホの目次ドロワー
├── data/
│   └── topic-index.json       論点インデックスに並べる語の一覧
└── content/
    ├── hero.html              先頭の見出しと凡例
    ├── topic-index.html       論点インデックスの枠
    ├── footer.html
    └── ch1/ … ch6/            章ごとのディレクトリ
        ├── _chapter.html          章の扉（章題とリード文）
        ├── 01-main-signature.html 1 節 = 1 ファイル
        ├── …
        ├── quiz.html              一問一答
        └── checklist.html         直前チェック

build.mjs                      src/ を docs/index.html に組み立てる
docs/index.html                生成物。GitHub Pages が配信するファイル
```

## ビルド

Node.js 18 以上が必要です。依存パッケージはありません。

```bash
node build.mjs
```

`docs/index.html` が 1 枚の自己完結 HTML として書き出されます。
CSS も JS も埋め込むので、ダウンロードして `file://` で開いても、
オフラインでもそのまま読めます。

生成物が `src/` と一致しているかだけ確かめたいときは:

```bash
node build.mjs --check
```

CI（`.github/workflows/build.yml`）はこれを走らせます。
`src/` を直して `docs/` を更新し忘れると失敗するので、公開ページが古いまま
放置されることはありません。

ローカルで確認するとき、`docs/index.html` はブラウザで直接開けます。
ただしチェックリストの保存（localStorage）は `file://` だと環境によって
効かないので、その動作を見たいときは簡易サーバー越しに開いてください。

```bash
node build.mjs && python -m http.server 8080 --directory docs
```

## 編集のしかた

### 本文を直す

直したい節のファイルを開いて編集し、`node build.mjs` を実行するだけです。
節と目次の対応は `src/manifest.json` にあるので、
「目次のこの項目を直したい」というときはまずそこを引いてください。

### 節を追加する

1. `src/content/chN/` に `12-....html` を作る。中身は `<section id="cN-s12">` で始める。
2. `src/manifest.json` の該当章の `sections` に 1 行足す。

```json
{ "id": "c1-s08", "tn": "08", "label": "目次に出す短い名前", "file": "08-....html" }
```

`id` はファイル内の `<section id>` と一致していなければならず、
ずれているとビルドが止まって理由を教えてくれます。並び替えは `sections` の
順番を入れ替えるだけで、目次にも本文にも反映されます。

### 章を追加する

`src/content/ch7/` を作って `_chapter.html`・各節・`quiz.html`・`checklist.html` を置き、
`manifest.json` の `chapters` に追記します。`key`（`c7` など）は節の id の接頭辞で、
チェックリストの要素 id（`c7-cklist` / `c7-barfill` / `c7-barlab`）にも使います。
食い違っているとビルドが止まります。

### 論点インデックスの語を増やす

`src/data/topic-index.json` に語を足すだけです。
本文に 1 回も出てこない語は自動的に表示されません。

### 見た目を変える

色とフォントは `src/styles/01-tokens.css` の CSS 変数に集約してあります。
CSS は**ファイル名の番号順に連結される**ので、番号が後ろのファイルほど優先されます。
新しく足すときは番号の付け方に注意してください。

### スマホの見た目を変える

狭い画面向けの指定は `src/styles/20-mobile.css` にまとめてあります。
連結順が最後なので、ここに書いた指定が他のファイルより優先されます。
切り替えの境目は 860px です。

PC のサイドバーとスマホのドロワーは**同じ `<nav class="toc">` を使い回して**います。
目次リンクを複製すると検索側の「href → リンク」の対応が壊れるためで、
DOM は 1 つのまま CSS で見た目だけを切り替えています。

## GitHub Pages で公開する

このリポジトリを GitHub に push したあと、一度だけ設定します。

1. リポジトリの **Settings › Pages** を開く
2. **Source** を `Deploy from a branch` にする
3. **Branch** を `main` / `/docs` にして Save

数十秒で `https://<ユーザー名>.github.io/<リポジトリ名>/` に公開されます。
以降は `main` に push するたびに更新されます。

## ライセンス

学習用の個人ノートです。内容は Oracle 公式の試験内容チェックリスト
（1Z0-825-JPN）に準拠していますが、Oracle とは無関係です。
