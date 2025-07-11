import chalk from 'chalk';
import { format } from 'date-fns';
import type { Locale } from '../i18n/messages.js';
import { messages as i18n } from '../i18n/messages.js';
import type { BurnRate, Plan, SessionBlock } from '../models/types.js';

export class Formatter {
  private messages: typeof i18n[Locale];

  constructor(locale: Locale = 'en') {
    this.messages = i18n[locale];
  }

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

  formatTokenStatus(currentTokens: number, limit: number, percentage: number): string {
    const status = percentage >= 90 ? '🔴' : percentage >= 50 ? '🟡' : '🟢';
    return `${status} ${this.messages.tokens}: ${this.formatNumber(currentTokens)} / ${this.formatNumber(limit)}`;
  }

  formatBurnRate(burnRate: BurnRate, indicator: string): string {
    return `${indicator} ${this.messages.burnRate}: ${burnRate.tokensPerMinute.toFixed(1)} ${this.messages.tokensPerMin}`;
  }

  formatTimeRemaining(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours}${this.messages.hours} ${mins}${this.messages.minutes}`;
    }
    return `${mins}${this.messages.minutes}`;
  }

  formatSessionInfo(activeBlock: SessionBlock | null): string {
    if (!activeBlock) {
      return chalk.gray(this.messages.noActiveSession);
    }

    const endTime = format(activeBlock.endTime, 'HH:mm');
    const remainingMinutes = Math.max(
      0,
      Math.floor((activeBlock.endTime.getTime() - Date.now()) / 60000)
    );

    return `${this.messages.sessionEndsAt} ${chalk.cyan(endTime)} (${this.formatTimeRemaining(remainingMinutes)} ${this.messages.remaining})`;
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
    return chalk.blue(this.messages.planNames[plan]);
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
