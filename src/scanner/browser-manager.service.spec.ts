import { BrowserManagerService } from './browser-manager.service';

describe('BrowserManagerService', () => {
  let service: BrowserManagerService;

  beforeEach(() => {
    service = new BrowserManagerService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('isBrowserCrashError', () => {
    it('should detect "browser has been closed"', () => {
      expect(service.isBrowserCrashError(new Error('browser has been closed'))).toBe(true);
    });

    it('should detect "Target page, context or browser"', () => {
      expect(service.isBrowserCrashError(new Error('Target page, context or browser has been closed'))).toBe(true);
    });

    it('should detect "Browser closed"', () => {
      expect(service.isBrowserCrashError(new Error('Browser closed'))).toBe(true);
    });

    it('should detect "Protocol error"', () => {
      expect(service.isBrowserCrashError(new Error('Protocol error (Runtime.callFunctionOn)'))).toBe(true);
    });

    it('should return false for non-browser errors', () => {
      expect(service.isBrowserCrashError(new Error('timeout'))).toBe(false);
    });

    it('should handle non-Error objects', () => {
      expect(service.isBrowserCrashError('string error')).toBe(false);
    });
  });

  describe('closeBrowser', () => {
    it('should not throw when no browser is open', async () => {
      await expect(service.closeBrowser()).resolves.not.toThrow();
    });
  });

  describe('closeContext', () => {
    it('should not throw when context close fails', async () => {
      const fakeContext = {
        close: jest.fn().mockRejectedValue(new Error('already closed')),
      } as any;
      await expect(service.closeContext(fakeContext)).resolves.not.toThrow();
    });
  });
});
