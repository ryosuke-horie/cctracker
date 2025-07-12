export const messages = {
  en: {
    // Formatter messages
    tokens: 'Tokens',
    burnRate: 'Burn Rate',
    tokensPerMin: 'tokens/min',
    sessionEndsAt: 'Session ends at',
    remaining: 'remaining',
    noActiveSession: 'No active session',
    planNames: {
      pro: 'Claude Pro (~7k tokens)',
      max5: 'Claude Max5 (~35k tokens)',
      max20: 'Claude Max20 (~140k tokens)',
      custom_max: 'Custom Max (auto-detected)',
    },

    // Monitor messages
    usageMonitor: 'Claude Code Usage Monitor',
    usageStatus: 'Claude Code Usage Status',
    plan: 'Plan',
    monitorStopped: 'Monitor stopped',
    pressCtrlCToExit: 'Press Ctrl+C to exit',
    tokensWillDeplete: 'Tokens will deplete before session reset!',
    tokenLimitNearlyReached: 'Token limit nearly reached!',
    detectedUsageAboveProLimit: 'Detected usage above Pro limit. Switching to custom_max mode.',
    errorUpdatingMonitor: 'Error updating monitor',
    errorFetchingUsageData: 'Error fetching usage data',

    // CLI messages
    autoDetectingPlan: 'Auto-detecting plan from usage history...',
    detectedPlan: 'Detected plan',
    confidence: 'confidence',
    maxTokensUsed: 'Max tokens used',
    couldNotAutoDetect: 'Could not auto-detect plan, using default (pro)',
    invalidPlan: 'Invalid plan',
    validPlans: 'Valid plans are',
    failedToFetchUsageData: 'Failed to fetch usage data',
    dataPathsInfo: 'Claude Data Paths',
    defaultPaths: 'Default paths',
    discoveredPaths: 'Discovered paths',
    noClaudeDataFound: 'No Claude data directories found',
    usageAnalysis: 'Usage Analysis',
    estimatedActualTokens: 'Estimated actual tokens',
    tips: 'Tips',
    tipEnvVar: 'Use CLAUDE_DATA_PATH environment variable to set custom path',
    tipDataPath: 'Use --data-path option to override the default path',
    tipAutoDetect: 'Use --plan auto (or just omit --plan) for automatic plan detection',
    tipEnsureRunning: 'Make sure Claude Code is running and has created session data',
    startingMonitor: 'Starting Claude Code Usage Monitor...',
    refreshInterval: 'Refresh interval',
    dataPath: 'Data path',
    failedToStartMonitor: 'Failed to start monitor',
    unknownCommand: 'unknown command',
    seeHelp: 'See --help for available commands',

    // Time formatting
    hours: 'h',
    minutes: 'm',
  },
  ja: {
    // Formatter messages
    tokens: 'トークン',
    burnRate: 'バーンレート',
    tokensPerMin: 'トークン/分',
    sessionEndsAt: 'セッション終了時刻:',
    remaining: '残り',
    noActiveSession: 'アクティブなセッションなし',
    planNames: {
      pro: 'Claude Pro (~7k トークン)',
      max5: 'Claude Max5 (~35k トークン)',
      max20: 'Claude Max20 (~140k トークン)',
      custom_max: 'カスタム Max (自動検出)',
    },

    // Monitor messages
    usageMonitor: 'Claude Code 使用状況モニター',
    usageStatus: 'Claude Code 使用状況',
    plan: 'プラン',
    monitorStopped: 'モニターを停止しました',
    pressCtrlCToExit: 'Ctrl+C で終了',
    tokensWillDeplete: 'セッションリセット前にトークンが枯渇します！',
    tokenLimitNearlyReached: 'トークン制限に近づいています！',
    detectedUsageAboveProLimit:
      'Pro制限を超える使用を検出しました。custom_maxモードに切り替えます。',
    errorUpdatingMonitor: 'モニター更新エラー',
    errorFetchingUsageData: '使用状況データの取得エラー',

    // CLI messages
    autoDetectingPlan: '使用履歴からプランを自動検出中...',
    detectedPlan: '検出されたプラン',
    confidence: '信頼度',
    maxTokensUsed: '最大使用トークン数',
    couldNotAutoDetect: 'プランを自動検出できませんでした。デフォルト (pro) を使用します',
    invalidPlan: '無効なプラン',
    validPlans: '有効なプラン',
    failedToFetchUsageData: '使用状況データの取得に失敗しました',
    dataPathsInfo: 'Claude データパス',
    defaultPaths: 'デフォルトパス',
    discoveredPaths: '検出されたパス',
    noClaudeDataFound: 'Claude データディレクトリが見つかりません',
    usageAnalysis: '使用状況分析',
    estimatedActualTokens: '推定実際トークン数',
    tips: 'ヒント',
    tipEnvVar: 'CLAUDE_DATA_PATH 環境変数を使用してカスタムパスを設定',
    tipDataPath: '--data-path オプションでデフォルトパスを上書き',
    tipAutoDetect: '--plan auto（または--planを省略）で自動プラン検出',
    tipEnsureRunning: 'Claude Code が実行中でセッションデータが作成されていることを確認',
    startingMonitor: 'Claude Code 使用状況モニターを開始中...',
    refreshInterval: '更新間隔',
    dataPath: 'データパス',
    failedToStartMonitor: 'モニターの開始に失敗しました',
    unknownCommand: '不明なコマンド',
    seeHelp: '利用可能なコマンドは --help を参照',

    // Time formatting
    hours: '時間',
    minutes: '分',
  },
} as const;

export type Locale = keyof typeof messages;
export type MessageKey = keyof typeof messages.en;
