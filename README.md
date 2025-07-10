# cctracker

Claude Code Rate Limit Tracker - Real-time monitoring tool for Claude AI token usage

## 概要

cctrackerは、Claude AIのトークン使用量をリアルタイムで監視し、Rate Limitを予測するCLIツールです。5時間のセッションウィンドウでのトークン消費を追跡し、制限に達する前に警告を表示します。

## 特徴

- 🔄 **リアルタイム監視** - 3秒ごとに使用状況を更新
- 📊 **視覚的なプログレスバー** - トークン使用率を色分けして表示
- 🔮 **スマート予測** - 現在の消費速度から枯渇時刻を予測
- 🤖 **自動プラン検出** - 過去の使用履歴から利用中のプランを自動判定
- 📋 **複数プラン対応** - Pro、Max5、Max20、カスタムプランに対応
- 🎯 **制限超過時の自動切り替え** - Pro制限を超えた場合、自動的にカスタム制限に適応

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
npm run dev
```

## 使い方

### 基本的な使用方法

```bash
# 自動プラン検出で起動（推奨）
npx cctracker

# 手動でプランを指定
npx cctracker --plan max5

# 自動検出を無効化してProプランで起動
npx cctracker --plan pro --no-auto-detect

# カスタムデータパスを指定
npx cctracker --data-path /path/to/claude/data

# リフレッシュ間隔を変更（秒単位）
npx cctracker --refresh 5

# 使用状況の詳細情報を確認
npx cctracker info
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

# 開発モード
npm run dev

# 型チェック
npm run typecheck

# リント
npm run lint

# テスト
npm test
```

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