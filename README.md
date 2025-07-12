# cctracker

Claude Code Rate Limit Tracker - Real-time monitoring tool for Claude AI token usage

## 概要

cctrackerは、Claude AIのトークン使用量をリアルタイムで監視し、Rate Limitを予測するCLIツールです。5時間のセッションウィンドウでのトークン消費を追跡し、制限に達する前に警告を表示します。

## 特徴

- 📊 **クイック確認** - 現在の使用状況を即座に表示して終了（デフォルト動作）
- 🔄 **リアルタイム監視** - watchモードで3秒ごとに使用状況を継続更新
- 📊 **視覚的なプログレスバー** - トークン使用率を色分けして表示
- 🔮 **スマート予測** - 現在の消費速度から枯渇時刻を予測
- 🤖 **自動プラン検出** - 過去の使用履歴から利用中のプランを自動判定
- 📋 **複数プラン対応** - Pro、Max5、Max20、カスタムプランに対応
- 🎯 **制限超過時の自動切り替え** - Pro制限を超えた場合、自動的にカスタム制限に適応
- 🌐 **日本語表示対応** - `--ja`オプションで全てのメッセージを日本語で表示

## インストール

### npxで実行（推奨）

```bash
npx cctracker
```

### グローバルインストール

```bash
npm install -g cctracker
cctracker
```

### ローカル開発

```bash
git clone https://github.com/yourusername/cctracker.git
cd cctracker
npm install

# 開発モードで実行
npm run dev

# 開発モードでオプションを渡す（-- を使用してnpmとスクリプトのオプションを区切る）
npm run dev -- --ja
npm run dev -- watch --ja
npm run dev -- info --ja

# または直接実行
npx tsx src/cli.ts --ja
npx tsx src/cli.ts watch --ja
```

## 使い方

### 基本的な使用方法

```bash
# 現在の使用状況を確認（単発実行、デフォルト）
npx cctracker

# 日本語で表示
npx cctracker --ja

# 継続的に監視（watchモード）
npx cctracker watch

# watchモードで日本語表示
npx cctracker watch --ja

# watchモードで手動プランを指定
npx cctracker watch --plan max5

# watchモードでリフレッシュ間隔を変更（秒単位）
npx cctracker watch --refresh 5

# 自動検出を無効化してProプランで確認
npx cctracker --plan pro --no-auto-detect

# カスタムデータパスを指定
npx cctracker --data-path /path/to/claude/data

# 使用状況の詳細情報を確認
npx cctracker info

# 詳細情報を日本語で確認
npx cctracker info --ja
```

### プランオプション

| プラン | トークン制限 | 説明 |
|--------|------------|------|
| `auto` | 自動判定 | 過去の使用履歴から最適なプランを自動選択（デフォルト） |
| `pro` | ~7,000 | Claude Pro |
| `max5` | ~35,000 | Claude Max5 |
| `max20` | ~140,000 | Claude Max20 |
| `custom_max` | 自動検出 | 過去の最大使用量から自動設定 |

### 設定情報の確認

```bash
# Claudeのデータパスを確認
npx cctracker info
```

## 環境変数

```bash
# カスタムデータパスを設定
export CLAUDE_DATA_PATH=/path/to/claude/projects

# 複数のパスを指定（コロンまたはカンマ区切り）
export CLAUDE_DATA_PATHS=/path1:/path2:/path3
```

## トークン計算の仕組み

cctrackerは、モデルに応じて特殊な重み付けを行います：

- **Opusモデル**: 実際のトークン数 × 5
- **Sonnetモデル**: 実際のトークン数 × 1
- **その他**: 実際のトークン数 × 1

この重み付けにより、プランの制限値と適切に比較できます。

## 開発

```bash
# ビルド
npm run build

# 開発モードで実行
npm run dev

# 開発モードでオプション付き実行
npm run dev -- --ja
npm run dev -- watch --plan max5

# 型チェック
npm run typecheck

# Biomeでリント・フォーマット
npm run check
npm run check:fix

# テスト
npm run test
npm run test:run  # 単発実行
npm run test:coverage  # カバレッジ付き

# 全チェック（CI相当）
npm run typecheck && npm run check && npm run build && npm run test:run
```

### 開発時の注意点

- オプションを`npm run dev`に渡す場合は`--`で区切る：`npm run dev -- --ja`
- または直接実行する：`npx tsx src/cli.ts --ja`
- Pre-pushフックで自動的にlint・test・typecheckが実行されます

## 要件

- Node.js 18.0.0 以上
- Claude Codeが実行され、セッションデータが生成されていること

## トラブルシューティング

### "No active session found" エラー

1. Claude Codeを起動して、少なくとも2つのメッセージを送信してください
2. カスタムデータパスを指定してみてください：
   ```bash
   npx cctracker --data-path ~/.config/claude/projects
   ```

### データが見つからない

```bash
# 利用可能なパスを確認
npx cctracker info
```

## ライセンス

MIT License

## 貢献

Issues and Pull Requests are welcome!

## クレジット

このプロジェクトは[Claude Code Usage Monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor)にインスパイアされています。