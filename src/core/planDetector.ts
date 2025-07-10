import { SessionBlock, Plan } from '../models/types.js';
import { TokenCalculator, PLAN_LIMITS } from './tokenCalculator.js';

export class PlanDetector {
  private tokenCalculator: TokenCalculator;

  constructor() {
    this.tokenCalculator = new TokenCalculator();
  }

  /**
   * 過去のセッションデータから使用しているプランを自動検出
   */
  detectPlan(blocks: SessionBlock[]): Plan {
    // 過去のセッションから最大トークン使用量を取得
    const maxTokensUsed = this.tokenCalculator.detectMaxTokensFromHistory(blocks);
    
    if (maxTokensUsed === 0) {
      // データがない場合はProをデフォルトとする
      return 'pro';
    }

    // 使用量に基づいてプランを判定
    // 実際の使用量がプラン制限の80%以上に達していれば、そのプランを使用していると推定
    const threshold = 0.8;

    if (maxTokensUsed >= PLAN_LIMITS.max20 * threshold) {
      return 'max20';
    } else if (maxTokensUsed >= PLAN_LIMITS.max5 * threshold) {
      return 'max5';
    } else if (maxTokensUsed >= PLAN_LIMITS.pro * threshold) {
      // Pro制限の80%を超えているが、Max5には届いていない場合
      // 実際にはMax5以上のプランを使用している可能性が高い
      if (maxTokensUsed > PLAN_LIMITS.pro) {
        return 'max5';
      }
      return 'pro';
    }

    return 'pro';
  }

  /**
   * より詳細なプラン分析を提供
   */
  analyzePlanUsage(blocks: SessionBlock[]): {
    detectedPlan: Plan;
    maxTokensUsed: number;
    confidence: 'high' | 'medium' | 'low';
    recommendation?: string;
  } {
    const maxTokensUsed = this.tokenCalculator.detectMaxTokensFromHistory(blocks);
    const detectedPlan = this.detectPlan(blocks);
    
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let recommendation: string | undefined;

    if (maxTokensUsed === 0) {
      confidence = 'low';
      recommendation = 'No usage data found. Using default Pro plan.';
    } else if (maxTokensUsed > PLAN_LIMITS.max20 * 0.95) {
      confidence = 'high';
      recommendation = 'Usage clearly indicates Max20 plan.';
    } else if (maxTokensUsed > PLAN_LIMITS.max5 * 0.95) {
      confidence = 'high';
      recommendation = 'Usage clearly indicates Max5 or higher plan.';
    } else if (maxTokensUsed > PLAN_LIMITS.pro) {
      confidence = 'medium';
      recommendation = 'Usage exceeds Pro limits. Likely using Max5 or higher.';
    } else if (maxTokensUsed > PLAN_LIMITS.pro * 0.8) {
      confidence = 'medium';
      recommendation = 'Usage near Pro limits. Plan detection may be uncertain.';
    } else {
      confidence = 'high';
      recommendation = 'Usage within Pro plan limits.';
    }

    return {
      detectedPlan,
      maxTokensUsed,
      confidence,
      recommendation
    };
  }

  /**
   * 実際のトークン数（重み付け前）を推定
   */
  estimateActualTokens(weightedTokens: number, blocks: SessionBlock[]): number {
    // セッションブロックから主要なモデルを特定
    let opusCount = 0;
    let totalCount = 0;

    for (const block of blocks) {
      if (!block.isGap) {
        for (const entry of block.entries) {
          if (entry.model.toLowerCase().includes('opus')) {
            opusCount++;
          }
          totalCount++;
        }
      }
    }

    if (totalCount === 0) {
      return weightedTokens;
    }

    // Opusの使用比率から平均的な重み付け係数を推定
    const opusRatio = opusCount / totalCount;
    const averageWeight = opusRatio * 5 + (1 - opusRatio) * 1;
    
    return Math.round(weightedTokens / averageWeight);
  }
}