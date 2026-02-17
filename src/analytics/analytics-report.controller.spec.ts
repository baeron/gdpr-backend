import { AnalyticsReportController } from './analytics-report.controller';
import { AnalyticsReportService } from './analytics-report.service';

describe('AnalyticsReportController', () => {
  let controller: AnalyticsReportController;
  let mockReportService: Partial<AnalyticsReportService>;

  beforeEach(() => {
    mockReportService = {
      getOverview: jest.fn().mockResolvedValue({ totalSessions: 100 }),
      getGeoReport: jest.fn().mockResolvedValue({ countries: [] }),
      getSourcesReport: jest.fn().mockResolvedValue({ sources: [] }),
      getFunnelReport: jest.fn().mockResolvedValue({ steps: [] }),
      getPagesReport: jest.fn().mockResolvedValue({ pages: [] }),
    };
    controller = new AnalyticsReportController(mockReportService as AnalyticsReportService);
  });

  describe('getOverview', () => {
    it('should return overview without date params', async () => {
      const result = await controller.getOverview();
      expect(mockReportService.getOverview).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toHaveProperty('totalSessions', 100);
    });

    it('should pass date params when provided', async () => {
      await controller.getOverview('2026-01-01', '2026-01-31');
      expect(mockReportService.getOverview).toHaveBeenCalledWith(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );
    });
  });

  describe('getGeoReport', () => {
    it('should return geo report', async () => {
      const result = await controller.getGeoReport();
      expect(mockReportService.getGeoReport).toHaveBeenCalled();
      expect(result).toHaveProperty('countries');
    });

    it('should pass date params', async () => {
      await controller.getGeoReport('2026-01-01', '2026-01-31');
      expect(mockReportService.getGeoReport).toHaveBeenCalledWith(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
      );
    });
  });

  describe('getSourcesReport', () => {
    it('should return sources report', async () => {
      const result = await controller.getSourcesReport();
      expect(mockReportService.getSourcesReport).toHaveBeenCalled();
      expect(result).toHaveProperty('sources');
    });
  });

  describe('getFunnelReport', () => {
    it('should return funnel report', async () => {
      const result = await controller.getFunnelReport();
      expect(mockReportService.getFunnelReport).toHaveBeenCalled();
      expect(result).toHaveProperty('steps');
    });
  });

  describe('getPagesReport', () => {
    it('should return pages report', async () => {
      const result = await controller.getPagesReport();
      expect(mockReportService.getPagesReport).toHaveBeenCalled();
      expect(result).toHaveProperty('pages');
    });
  });
});
