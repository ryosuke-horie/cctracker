export interface UsageEntry {
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUSD?: number;
  model: string;
  messageId?: string;
  requestId?: string;
}

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface SessionBlock {
  id: string;
  startTime: Date;
  endTime: Date;
  actualEndTime?: Date;
  isActive: boolean;
  isGap: boolean;
  entries: UsageEntry[];
  tokenCounts: TokenCounts;
  costUSD: number;
  models: string[];
  durationMinutes: number;
}

export interface BurnRate {
  tokensPerMinute: number;
  costPerHour: number;
}

export interface UsageProjection {
  projectedTotalTokens: number;
  projectedTotalCost: number;
  remainingMinutes: number;
}

export type Plan = 'pro' | 'max5' | 'max20' | 'custom_max';

export interface PlanLimits {
  pro: number;
  max5: number;
  max20: number;
  custom_max?: number;
}

export interface RawUsageData {
  timestamp: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  message?: {
    id?: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  model?: string;
  message_id?: string;
  request_id?: string;
  requestId?: string;
  cost?: number;
  costUSD?: number;
}
