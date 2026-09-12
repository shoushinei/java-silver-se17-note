# Java Silver SE 17 統合ノート

Oracle 認定 Java Programmer, Silver SE 17（1Z0-825）の試験範囲を、
全 6 章・67 論点にまとめた学習ノートです。

コード例はすべて **「コンパイルも実行も通る」「コンパイルエラー」「実行時に例外」** の
3 つに色分けしてあります。この試験が実質その三択判定だからです。

📖 **公開ページ:** https://shoushinei.github.io/java-silver-se17-note/
✎ **自作模擬試験:** https://shoushinei.github.io/java-silver-se17-note/exams/

## 収録内容

| 章 | 内容 | 論点数 |
|---|---|---|
| 1 | Java の概要と簡単な Java プログラムの作成 | 8 |
| 2 | Java の基本データ型と文字列の操作 | 14 |
| 3 | 演算子と制御構造 | 12 |
| 4 | クラスの定義とインスタンスの使用 | 10 |
| 5 | 継承とインタフェースの使用 | 13 |
| 6 | 例外処理 | 10 |

各章の末尾に一問一答と、進捗が保存される直前チェックリストが付いています。
サイドバーの検索窓（`/` キーでフォーカス、`Esc` で解除）で全章を横断検索できます。

スマホでは目次が左から出るドロワーになり、章ごとに折り畳まれます。画面上部のバーに
いま読んでいる章と節が出るので、長い本文のどこにいるか分かります。

## 自作模擬試験

ノートとは別のページとして、本番と同じ形式（90 分・選択式）の模擬試験を置いています。
問題はすべてオリジナルで、市販の問題集と同じ論点を別のコード・別の設定で問います。

| モード | ページ | 使い方 |
|---|---|---|
| テスト | `exams/01/` | 90 分の制限時間つきで解き、採点して合否の目安を出す |
| 振り返り | `exams/01/review.html` | 全問を正解・解説つきで読む。時間制限なし |

- 気になる問題には「見直し」マークを付けられ、問題一覧からマーク付きだけを絞り込めます。
- 未回答が残っていても提出できます（残り問題数を確認してから提出）。時間切れで自動提出され、未回答は不正解です。
- 途中でタブを閉じても、回答とマークは残ります（時間は進み続けます）。
- 採点後は章ごとの正答率と、不正解・未回答だけの一覧が出ます。各問の解説から、
  統合ノートの該当節（「第5章 10「default / static / private」」のように）へ直接飛べます。
- 合格ラインの目安は 65%（試験ごとに `exam.json` の `passRate` で変えられます）。

## リポジトリの構成

編集するのは `src/` だけです。`docs/` は `build.mjs` が生成する成果物で、
手で編集しても次のビルドで上書きされます。

```
src/
├── note/                      統合ノート
│   ├── manifest.json              章と節の一覧。目次と並び順の唯一の定義
│   ├── template.html              <head> と全体の骨格
│   ├── styles/                    CSS。ファイル名の番号順に連結される
│   │   ├── 01-tokens.css              色・フォントなどの変数
│   │   ├── 03-layout.css              サイドバーと本文の 2 カラム
│   │   ├── 07-code.css                コードブロックの 3 分類
│   │   ├── 20-mobile.css              スマホ向けの調整はすべてここ
│   │   └── …（全 18 ファイル）
│   ├── scripts/                   JS。ファイル名の番号順に連結される
│   │   ├── 00-app.js                  名前空間 NoteApp
│   │   ├── 01-highlight.js            コードの簡易シンタックスハイライト
│   │   ├── 04-checklist.js            チェックリストと進捗の保存
│   │   ├── 05-search.js               全文検索
│   │   ├── 06-topic-index.js          論点インデックスのチップ
│   │   └── 07-mobile-nav.js           スマホの目次ドロワー
│   ├── data/
│   │   └── topic-index.json       論点インデックスに並べる語の一覧
│   └── content/
│       ├── hero.html              先頭の見出しと凡例
│       ├── topic-index.html       論点インデックスの枠
│       ├── footer.html
│       └── ch1/ … ch6/            章ごとのディレクトリ
│           ├── _chapter.html          章の扉（章題とリード文）
│           ├── 01-main-signature.html 1 節 = 1 ファイル
│           ├── …
│           ├── quiz.html              一問一答
│           └── checklist.html         直前チェック
└── exams/                     自作模擬試験
    ├── _engine/                   すべての試験で共通の画面と動き
    │   ├── test.html / exam.js        テストモード（タイマー・マーク・採点）
    │   ├── review.html / review.js    振り返りモード
    │   ├── list.html                  試験の一覧ページ
    │   └── exam.css
    └── 01/                        試験 1 回ぶん
        ├── exam.json                  タイトル・制限時間・合格ライン
        └── q01.md … q60.md            1 問 = 1 ファイル

tools/
├── build-note.mjs             ノートを組み立てる
├── build-exams.mjs            模擬試験を組み立てる
├── exam-md.mjs                問題ファイル（.md）の読み取り
└── verify-exams.mjs           問題のコードを javac / java で実際に確かめる

build.mjs                      両方を組み立てて docs/ に書き出す
docs/                          生成物。GitHub Pages が配信するファイル
├── index.html                     統合ノート
└── exams/                         模擬試験（index.html と 01/index.html・01/review.html）
```

## ビルド

Node.js 18 以上が必要です。依存パッケージはありません。

```bash
node build.mjs
```

`docs/index.html`（ノート）と `docs/exams/` の各ページが、それぞれ 1 枚の自己完結 HTML として書き出されます。
CSS も JS も埋め込むので、ダウンロードして `file://` で開いても、
オフラインでもそのまま読めます。

生成物が `src/` と一致しているかだけ確かめたいときは:

```bash
node build.mjs --check
```

CI（`.github/workflows/build.yml`）はこれと、後述の模擬試験の検証を走らせます。
`src/` を直して `docs/` を更新し忘れると失敗するので、公開ページが古いまま
放置されることはありません。

ローカルで確認するとき、`docs/index.html` はブラウザで直接開けます。
ただしチェックリストの保存（localStorage）は `file://` だと環境によって
効かないので、その動作を見たいときは簡易サーバー越しに開いてください。

```bash
node build.mjs && python -m http.server 8080 --directory docs
```

## 編集のしかた

以下、ノートのパスはすべて `src/note/` からの相対です。

### 本文を直す

直したい節のファイルを開いて編集し、`node build.mjs` を実行するだけです。
節と目次の対応は `manifest.json` にあるので、
「目次のこの項目を直したい」というときはまずそこを引いてください。

### 節を追加する

1. `content/chN/` に `12-....html` を作る。中身は `<section id="cN-s12">` で始める。
2. `manifest.json` の該当章の `sections` に 1 行足す。

```json
{ "id": "c1-s08", "tn": "08", "label": "目次に出す短い名前", "file": "08-....html" }
```

`id` はファイル内の `<section id>` と一致していなければならず、
ずれているとビルドが止まって理由を教えてくれます。並び替えは `sections` の
順番を入れ替えるだけで、目次にも本文にも反映されます。

### 章を追加する

`content/ch7/` を作って `_chapter.html`・各節・`quiz.html`・`checklist.html` を置き、
`manifest.json` の `chapters` に追記します。`key`（`c7` など）は節の id の接頭辞で、
チェックリストの要素 id（`c7-cklist` / `c7-barfill` / `c7-barlab`）にも使います。
食い違っているとビルドが止まります。

### 論点インデックスの語を増やす

`data/topic-index.json` に語を足すだけです。
本文に 1 回も出てこない語は自動的に表示されません。

### 見た目を変える

色とフォントは `styles/01-tokens.css` の CSS 変数に集約してあります。
模擬試験のページもこの変数と、コード・表の CSS をノートから借りています。
CSS は**ファイル名の番号順に連結される**ので、番号が後ろのファイルほど優先されます。
新しく足すときは番号の付け方に注意してください。

### スマホの見た目を変える

狭い画面向けの指定は `styles/20-mobile.css` にまとめてあります。
連結順が最後なので、ここに書いた指定が他のファイルより優先されます。
切り替えの境目は 860px です。

PC のサイドバーとスマホのドロワーは**同じ `<nav class="toc">` を使い回して**います。
目次リンクを複製すると検索側の「href → リンク」の対応が壊れるためで、
DOM は 1 つのまま CSS で見た目だけを切り替えています。

## 模擬試験の編集

### 問題を直す・足す

1 問 = 1 ファイル（`src/exams/01/q07.md` など）で、ファイル名の順に問 1, 2, … と並びます。

````markdown
---
answer: A, C
refs:
  - c5-s10 サブインタフェースの default で親の抽象メソッドを実装できる
---
問題文。

```java title=Main.java
public class Main { ... }
```

- A. 選択肢
- B. …

## 解説
解説本文。

## 検証
@case 正解 A
@stem
@javac
@run Main
@stdout
期待する出力
@end
````

- `answer` … 正解。複数なら `,` 区切り。「〜つ選びなさい」の数はここから自動で決まる
- `refs` … 解説に出す「統合ノートの参照」。節 id と一言
- `title=` を付けた java コードは、問題文に行番号つきで表示される
- 選択肢には `` `コード` `` も書ける。複数行のコードは、選択肢の次の行から字下げして ```` ``` ```` で囲む

`refs` の節 id が `manifest.json` に無いとビルドが止まります。
章ごとの正答率は、この `refs` の先頭の節の章で集計します。

### 問題のコードを確かめる

「## 検証」に書いた手順を、JDK で実際にコンパイル・実行して、
問題と解説が主張する結果（出力・コンパイルエラー・例外）になるかを確かめます。
`@stem` を使えば、問題文に表示しているコードそのものが検証されます。

```bash
node tools/verify-exams.mjs          # すべて
node tools/verify-exams.mjs 01 7     # 試験 01 の問 7 だけ
```

JDK（`javac` / `java`）が必要です。言語仕様は `--release 17` に固定しています。
CI は試験と同じ Java 17 でこれを走らせます。書ける命令の一覧は `tools/verify-exams.mjs` の先頭にあります。

### 試験を追加する

`src/exams/02/` を作り、`exam.json` と `q01.md` 〜 を置いて `node build.mjs` を実行します。
一覧ページ（`docs/exams/index.html`）には自動で並びます。

```json
{ "title": "自作模擬試験 2", "description": "一覧に出す説明", "minutes": 90, "passRate": 0.65 }
```

## GitHub Pages で公開する

このリポジトリを GitHub に push したあと、一度だけ設定します。

1. リポジトリの **Settings › Pages** を開く
2. **Source** を `Deploy from a branch` にする
3. **Branch** を `main` / `/docs` にして Save

数十秒で https://shoushinei.github.io/java-silver-se17-note/ に公開されます。
以降は `main` に push するたびに更新されます。

## ライセンス

学習用の個人ノートです。内容は Oracle 公式の試験内容チェックリスト
（1Z0-825-JPN）に準拠していますが、Oracle とは無関係です。
