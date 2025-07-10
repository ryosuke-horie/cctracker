# Claude Code Usage Monitor - Rate Limit判定手法の調査結果

## 概要

Claude Code Usage Monitorは、Claude AIのトークン使用量をリアルタイムで監視し、Rate Limitを予測するツールです。本ドキュメントでは、このツールがどのようにRate Limitを判定しているかについて、ソースコード調査の結果をまとめます。

## 1. 基本的な仕組み

### 1.1 セッション管理の考え方

- **5時間のローリングセッション**: Claudeは5時間の固定セッションウィンドウで動作
- **複数セッションの同時進行**: 複数のセッションが重なって存在可能
- **実際のリフレッシュタイミング**: ユーザーの最初のメッセージから正確に5時間後

### 1.2 プランごとのトークン制限

```python
limits = {
    "pro": 44000,     # 約7,000相当（加重計算後）
    "max5": 220000,   # 約35,000相当（加重計算後）
    "max20": 880000   # 約140,000相当（加重計算後）
}
```

注：実際のトークン数は、モデルに応じて特殊な重み付け計算が適用されます。

## 2. データの保存と読み込み

### 2.1 データ保存場所

Claudeのセッションデータは以下のパスに保存されます：

1. **標準パス**:
   - `~/.claude/projects`
   - `~/.config/claude/projects`

2. **環境変数によるカスタマイズ**:
   - `CLAUDE_DATA_PATHS`: 複数パスをコロンまたはカンマ区切りで指定
   - `CLAUDE_DATA_PATH`: 単一パスを指定（後方互換性用）

### 2.2 データ形式

各プロジェクトディレクトリに、JSONL（JSON Lines）形式でセッションデータが保存されます：

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "usage": {
    "input_tokens": 1000,
    "output_tokens": 500,
    "cache_creation_input_tokens": 100,
    "cache_read_input_tokens": 50
  },
  "model": "claude-3-opus",
  "message_id": "msg_xxx",
  "request_id": "req_xxx",
  "costUSD": 0.025
}
```

### 2.3 データの重複排除

- `message_id`と`request_id`の組み合わせでユニークキーを生成
- 同一のメッセージが複数回記録されることを防止

## 3. Rate Limit判定の核心的な実装

### 3.1 トークン数の特殊な計算方法

```python
def _calculate_total_tokens(entries):
    total_tokens = 0
    for entry in entries:
        model_name = entry.model.lower()
        
        if "opus" in model_name:
            # Opusモデル: 5倍の重み付け
            total_tokens += 5 * (entry.input_tokens + entry.output_tokens)
        elif "sonnet" in model_name:
            # Sonnetモデル: そのまま
            total_tokens += entry.input_tokens + entry.output_tokens
        else:
            # その他: デフォルトでそのまま
            total_tokens += entry.input_tokens + entry.output_tokens
    
    return total_tokens
```

**重要なポイント**:
- Opusモデルは実際のトークン数の5倍でカウント
- これにより、プランの限度値との比較が適切に行われる
- キャッシュトークンは合計に含まれない

### 3.2 セッションブロックの識別

```python
class SessionBlockIdentifier:
    def __init__(self, timezone_obj, reset_hours, session_hours=5):
        self.timezone_obj = timezone_obj
        self.reset_hours = reset_hours
        self.session_hours = session_hours
```

セッションブロックの作成条件：
1. **時間境界超過**: 次のエントリが現在ブロックの終了時刻を超えた場合
2. **非アクティブギャップ**: 前のエントリから5時間以上経過した場合

### 3.3 アクティブセッションの判定

```python
def _mark_active_blocks(blocks):
    current_time = datetime.now(timezone.utc)
    for block in blocks:
        if not block.is_gap and block.end_time > current_time:
            block.is_active = True
```

## 4. バーンレート（消費速度）の計算

### 4.1 過去1時間のデータ収集

```python
def calculate_hourly_burn_rate(blocks):
    current_time = datetime.now(timezone.utc)
    one_hour_ago = current_time - timedelta(hours=1)
    
    # 過去1時間に重なるすべてのセッションからトークンを集計
    total_tokens = 0
    for block in blocks:
        if block.end_time > one_hour_ago:
            # セッションが1時間以内に存在する場合
            total_tokens += _calculate_proportional_tokens(block, one_hour_ago, current_time)
```

### 4.2 予測計算

- トークン/分の消費速度を計算
- 残りトークン数から枯渇予想時刻を算出
- セッションリセット時刻より前に枯渇する場合は警告

## 5. 自動検出機能

### 5.1 プラン自動切り替え

1. Pro制限（44,000トークン）を超過を検出
2. 過去のセッションから最大使用量を検索
3. `custom_max`モードに自動切り替え
4. ユーザーに通知メッセージを表示

### 5.2 最大使用量の発見

```python
def find_highest_token_count(blocks):
    max_tokens = 0
    for block in blocks:
        if not block.is_gap:
            weighted_tokens = _calculate_weighted_tokens(block.entries)
            max_tokens = max(max_tokens, weighted_tokens)
    return max_tokens
```

## 6. リアルタイム監視の実装

### 6.1 更新サイクル

- 3秒ごとにデータを再読み込み
- ファイルシステムの変更を検出
- 新しいエントリをセッションブロックに追加

### 6.2 表示の最適化

- ターミナルのちらつき防止（カーソル制御）
- カラーコーディング（緑・黄・赤）による視覚的フィードバック
- プログレスバーによる使用状況の可視化

## 7. 実装の特徴と工夫

### 7.1 精度向上の工夫

1. **モデル別の重み付け**: Opusモデルの5倍カウントにより、実際の制限と一致
2. **重複排除**: message_idとrequest_idの組み合わせで確実な重複除去
3. **比例配分計算**: セッションが時間境界をまたぐ場合の正確な計算

### 7.2 ユーザビリティの考慮

1. **自動検出**: ユーザーが制限を知らなくても適切に動作
2. **タイムゾーン対応**: ローカルタイムでの表示と計算
3. **予測機能**: トークン枯渇の事前警告

## まとめ

Claude Code Usage Monitorは、以下の手法でRate Limitを判定しています：

1. **データソース**: `~/.claude/projects`以下のJSONLファイルから使用状況を読み取り
2. **計算方法**: モデルに応じた重み付け（Opus: 5倍）でトークン数を計算
3. **セッション管理**: 5時間のローリングウィンドウでセッションを追跡
4. **予測機能**: 過去1時間のバーンレートから将来の枯渇時刻を予測
5. **自動調整**: 制限超過時に過去の最大使用量から新しい制限を自動設定

この実装により、ユーザーはRate Limitに達する前に適切な対策を取ることができ、Claude AIの利用を最適化できます。