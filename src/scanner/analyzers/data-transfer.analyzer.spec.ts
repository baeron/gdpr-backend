import { DataTransferAnalyzer } from './data-transfer.analyzer';
import { RiskLevel } from '../dto/scan-result.dto';

describe('DataTransferAnalyzer', () => {
  let analyzer: DataTransferAnalyzer;

  beforeEach(() => {
    analyzer = new DataTransferAnalyzer();
  });

  describe('generateIssues', () => {
    it('should return empty for no transfers', () => {
      expect(DataTransferAnalyzer.generateIssues({
        highRiskTransfers: [],
        totalUSServices: 0,
      })).toHaveLength(0);
    });

    it('US_DATA_TRANSFERS', () => {
      const issues = DataTransferAnalyzer.generateIssues({
        highRiskTransfers: ['Google Analytics', 'Facebook Pixel'],
        totalUSServices: 2,
      });
      expect(issues.some((i) => i.code === 'US_DATA_TRANSFERS')).toBe(true);
      expect(issues[0].riskLevel).toBe(RiskLevel.HIGH);
    });

    it('should truncate long list of transfers', () => {
      const transfers = Array(8).fill(null).map((_, i) => `Service${i}`);
      const issues = DataTransferAnalyzer.generateIssues({
        highRiskTransfers: transfers,
        totalUSServices: 8,
      });
      expect(issues[0].description).toContain('...');
    });

    it('EXCESSIVE_US_SERVICES when > 10', () => {
      const issues = DataTransferAnalyzer.generateIssues({
        highRiskTransfers: [],
        totalUSServices: 15,
      });
      expect(issues.some((i) => i.code === 'EXCESSIVE_US_SERVICES')).toBe(true);
    });

    it('should NOT flag EXCESSIVE_US_SERVICES when <= 10', () => {
      expect(DataTransferAnalyzer.generateIssues({
        highRiskTransfers: [],
        totalUSServices: 8,
      })).toHaveLength(0);
    });
  });

  describe('isAdequateCountry', () => {
    it('should return true for UK', () => {
      expect(analyzer.isAdequateCountry('United Kingdom')).toBe(true);
    });

    it('should return true for Japan', () => {
      expect(analyzer.isAdequateCountry('japan')).toBe(true);
    });

    it('should return false for US', () => {
      expect(analyzer.isAdequateCountry('United States')).toBe(false);
    });

    it('should return false for China', () => {
      expect(analyzer.isAdequateCountry('China')).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear state', () => {
      analyzer.reset();
      const info = analyzer.getDataTransferInfo();
      expect(info.totalUSServices).toBe(0);
    });
  });
});
