import { Injectable } from '@nestjs/common';
import { RiskLevel, ScanIssue } from './dto/scan-result.dto';

/**
 * Calculates overall risk level and compliance score from scan issues.
 */
@Injectable()
export class ScoreCalculatorService {
  /**
   * Determine the overall risk level based on the highest severity issue.
   */
  calculateOverallRisk(issues: ScanIssue[]): RiskLevel {
    if (issues.some((i) => i.riskLevel === RiskLevel.CRITICAL)) {
      return RiskLevel.CRITICAL;
    }
    if (issues.some((i) => i.riskLevel === RiskLevel.HIGH)) {
      return RiskLevel.HIGH;
    }
    if (issues.some((i) => i.riskLevel === RiskLevel.MEDIUM)) {
      return RiskLevel.MEDIUM;
    }
    return RiskLevel.LOW;
  }

  /**
   * Calculate a 0-100 compliance score based on issue severity.
   *
   * Deductions:
   *   CRITICAL → -30
   *   HIGH     → -20
   *   MEDIUM   → -10
   *   LOW      → -5
   */
  calculateScore(issues: ScanIssue[]): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.riskLevel) {
        case RiskLevel.CRITICAL:
          score -= 30;
          break;
        case RiskLevel.HIGH:
          score -= 20;
          break;
        case RiskLevel.MEDIUM:
          score -= 10;
          break;
        case RiskLevel.LOW:
          score -= 5;
          break;
      }
    }

    return Math.max(0, score);
  }
}
