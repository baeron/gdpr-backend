import { ScoreCalculatorService } from './score-calculator.service';
import { RiskLevel, ScanIssue } from './dto/scan-result.dto';

describe('ScoreCalculatorService', () => {
  let service: ScoreCalculatorService;

  beforeEach(() => {
    service = new ScoreCalculatorService();
  });

  const makeIssue = (riskLevel: RiskLevel): ScanIssue => ({
    code: 'TEST',
    title: 'Test',
    description: 'Test',
    riskLevel,
    recommendation: 'Fix',
  });

  describe('calculateOverallRisk', () => {
    it('should return CRITICAL when any critical issue', () => {
      expect(service.calculateOverallRisk([makeIssue(RiskLevel.CRITICAL)])).toBe(RiskLevel.CRITICAL);
    });

    it('should return HIGH when highest is HIGH', () => {
      expect(service.calculateOverallRisk([makeIssue(RiskLevel.LOW), makeIssue(RiskLevel.HIGH)])).toBe(RiskLevel.HIGH);
    });

    it('should return MEDIUM when highest is MEDIUM', () => {
      expect(service.calculateOverallRisk([makeIssue(RiskLevel.MEDIUM)])).toBe(RiskLevel.MEDIUM);
    });

    it('should return LOW when all LOW', () => {
      expect(service.calculateOverallRisk([makeIssue(RiskLevel.LOW)])).toBe(RiskLevel.LOW);
    });

    it('should return LOW when empty', () => {
      expect(service.calculateOverallRisk([])).toBe(RiskLevel.LOW);
    });
  });

  describe('calculateScore', () => {
    it('should return 100 for no issues', () => {
      expect(service.calculateScore([])).toBe(100);
    });

    it('should deduct 30 for CRITICAL', () => {
      expect(service.calculateScore([makeIssue(RiskLevel.CRITICAL)])).toBe(70);
    });

    it('should deduct 20 for HIGH', () => {
      expect(service.calculateScore([makeIssue(RiskLevel.HIGH)])).toBe(80);
    });

    it('should deduct 10 for MEDIUM', () => {
      expect(service.calculateScore([makeIssue(RiskLevel.MEDIUM)])).toBe(90);
    });

    it('should deduct 5 for LOW', () => {
      expect(service.calculateScore([makeIssue(RiskLevel.LOW)])).toBe(95);
    });

    it('should not go below 0', () => {
      const issues = Array(10).fill(makeIssue(RiskLevel.CRITICAL));
      expect(service.calculateScore(issues)).toBe(0);
    });

    it('should accumulate deductions', () => {
      const issues = [
        makeIssue(RiskLevel.CRITICAL),
        makeIssue(RiskLevel.HIGH),
        makeIssue(RiskLevel.MEDIUM),
        makeIssue(RiskLevel.LOW),
      ];
      expect(service.calculateScore(issues)).toBe(35);
    });
  });
});
