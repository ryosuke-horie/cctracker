import chalk from 'chalk';
import { SessionBlock, BurnRate, Plan } from '../models/types.js';
import { format } from 'date-fns';

export class Formatter {
  formatProgressBar(percentage: number, width = 40): string {
    const filled = Math.min(Math.round((percentage / 100) * width), width);
    const empty = Math.max(width - filled, 0);
    
    let color: typeof chalk.green;
    if (percentage >= 90) {
      color = chalk.red;
    } else if (percentage >= 50) {
      color = chalk.yellow;
    } else {
      color = chalk.green;
    }
    
    const bar = color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    return `[${bar}] ${percentage.toFixed(1)}%`;
  }

  formatTokenStatus(
    currentTokens: number,
    limit: number,
    percentage: number
  ): string {
    const status = percentage >= 90 ? '🔴' : percentage >= 50 ? '🟡' : '🟢';
    return `${status} Tokens: ${this.formatNumber(currentTokens)} / ${this.formatNumber(limit)}`;
  }

  formatBurnRate(burnRate: BurnRate, indicator: string): string {
    return `${indicator} Burn Rate: ${burnRate.tokensPerMinute.toFixed(1)} tokens/min`;
  }

  formatTimeRemaining(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  formatSessionInfo(activeBlock: SessionBlock | null): string {
    if (!activeBlock) {
      return chalk.gray('No active session');
    }
    
    const endTime = format(activeBlock.endTime, 'HH:mm');
    const remainingMinutes = Math.max(
      0,
      Math.floor((activeBlock.endTime.getTime() - Date.now()) / 60000)
    );
    
    return `Session ends at ${chalk.cyan(endTime)} (${this.formatTimeRemaining(remainingMinutes)} remaining)`;
  }

  formatWarning(message: string): string {
    return chalk.yellow(`⚠️  ${message}`);
  }

  formatError(message: string): string {
    return chalk.red(`❌ ${message}`);
  }

  formatSuccess(message: string): string {
    return chalk.green(`✅ ${message}`);
  }

  formatPlan(plan: Plan): string {
    const planNames = {
      pro: 'Claude Pro (~7k tokens)',
      max5: 'Claude Max5 (~35k tokens)',
      max20: 'Claude Max20 (~140k tokens)',
      custom_max: 'Custom Max (auto-detected)'
    };
    
    return chalk.blue(planNames[plan]);
  }

  private formatNumber(num: number): string {
    return num.toLocaleString();
  }

  clearScreen(): void {
    console.clear();
    console.log('\x1Bc'); // Clear screen and scrollback
  }

  moveCursorUp(lines: number): void {
    process.stdout.write(`\x1B[${lines}A`);
  }

  hideCursor(): void {
    process.stdout.write('\x1B[?25l');
  }

  showCursor(): void {
    process.stdout.write('\x1B[?25h');
  }
}