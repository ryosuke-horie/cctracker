# npm公開・デプロイメントガイド

## 概要

cctrackerをnpmパッケージとして公開し、`npx cctracker`で実行できるようにするためのデプロイメントガイドです。

## 現在の準備状況

### ✅ 完了済み

- **パッケージ構成**: 必要なファイルとスクリプトが適切に設定済み
- **CLI実行環境**: shebangライン、binエントリ、files設定が完了
- **ローカル動作確認**: `npm link`による動作確認済み
- **品質保証**: テストカバレッジ89%、型チェック、リント全て通過

### ⏳ 実装待ち

- **npm認証設定**: 公開アカウントの設定
- **パッケージ名確認**: 既存パッケージとの重複チェック
- **公開自動化**: GitHub Actions による自動デプロイ
- **バージョン管理**: セマンティックバージョニング戦略

## 公開前チェックリスト

### 1. パッケージ設定の確認

```bash
# 現在の設定確認
cat package.json | grep -A5 -B5 '"name"\|"version"\|"bin"\|"files"'

# 期待される設定
{
  "name": "cctracker",
  "version": "0.1.0",
  "bin": {
    "cctracker": "./dist/cli.js"
  },
  "files": [
    "dist/**/*"
  ]
}
```

### 2. ビルドとパッケージ検証

```bash
# ビルド実行
npm run build

# パッケージ構成確認
npm pack --dry-run

# ローカル動作確認
npm link
cctracker --help
npm unlink -g cctracker
```

### 3. 品質保証チェック

```bash
# 全チェック実行
npm run lint          # リント
npm run typecheck     # 型チェック
npm run test:run      # テスト実行
npm run test:coverage # カバレッジ確認（89%以上）
```

## 公開手順

### 方法1: 手動公開

```bash
# 1. npm認証
npm login

# 2. パッケージ名の可用性確認
npm view cctracker

# 3. 公開前最終確認
npm run build
npm run test:run

# 4. 公開実行
npm publish

# 5. 動作確認
npx cctracker
```

### 方法2: GitHub Actions自動公開

#### ワークフロー設定例

```yaml
# .github/workflows/publish.yml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:run
      
      - name: Build
        run: npm run build
      
      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

#### 公開用タグ作成

```bash
# バージョンアップとタグ作成
npm version patch  # 0.1.0 → 0.1.1
npm version minor  # 0.1.0 → 0.2.0
npm version major  # 0.1.0 → 1.0.0

# タグをリモートにプッシュ
git push origin --tags
```

## バージョン管理戦略

### セマンティックバージョニング

- **MAJOR** (X.0.0): 破壊的変更
  - CLIオプションの削除・変更
  - 設定ファイル形式の変更
  - 最小Node.jsバージョンの引き上げ

- **MINOR** (0.X.0): 機能追加
  - 新しいCLIコマンドの追加
  - 新しいオプションの追加
  - 新しいプラン対応

- **PATCH** (0.0.X): バグ修正
  - 既存機能の修正
  - パフォーマンス改善
  - 依存関係の更新

### プレリリース版

```bash
# ベータ版公開
npm version prerelease --preid=beta  # 0.1.0-beta.0
npm publish --tag beta

# インストール方法
npx cctracker@beta
```

## 公開後の管理

### 1. メトリクス監視

```bash
# ダウンロード数確認
npm view cctracker

# 詳細統計
npm info cctracker
```

### 2. 問題対応

```bash
# 特定バージョンの取り下げ
npm unpublish cctracker@0.1.0

# 非推奨マーク
npm deprecate cctracker@0.1.0 "Please upgrade to 0.1.1"
```

### 3. アップデート通知

#### package.jsonの更新

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/cctracker.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/cctracker/issues"
  },
  "homepage": "https://github.com/yourusername/cctracker#readme"
}
```

## トラブルシューティング

### よくある問題

1. **認証エラー**: `npm login`で認証情報を確認
2. **パッケージ名重複**: `npm view <name>`で確認後、名前変更
3. **ビルドエラー**: `npm run build`の成功を確認
4. **権限エラー**: npm組織の権限設定を確認

### 公開前の最終確認

```bash
# 完全なクリーンビルド
rm -rf node_modules dist
npm install
npm run build
npm run test:run

# パッケージ内容確認
tar -tzf $(npm pack)
```

## セキュリティ考慮事項

1. **npm TOKEN**: GitHub Secretsで管理
2. **依存関係**: 定期的な脆弱性チェック
3. **公開範囲**: 不要なファイルの除外設定

```bash
# セキュリティチェック
npm audit
npm audit fix
```

## 関連ドキュメント

- [開発ルール](./開発ルール.md) - コード品質とCI/CD要件
- [README.md](../README.md) - インストール手順とnpx実行方法
- [テスト仕様書](./テスト仕様書.md) - 品質保証の詳細

---

## 📋 実装チェックリスト

### 公開準備
- [ ] npm認証設定完了
- [ ] パッケージ名の可用性確認
- [ ] 全品質チェック通過（lint, typecheck, test）
- [ ] ビルド成功確認
- [ ] ローカル動作確認

### 自動化設定
- [ ] GitHub Actionsワークフロー作成
- [ ] NPM_TOKENシークレット設定
- [ ] バージョン管理戦略の決定
- [ ] リリースノートテンプレート作成

### 公開後フォローアップ
- [ ] インストール動作確認
- [ ] ドキュメント更新
- [ ] 使用統計の監視設定
- [ ] 問題報告チャンネルの整備

このガイドに従って、cctrackerをnpmパッケージとして安全かつ効率的に公開できます。