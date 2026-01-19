import { Test, TestingModule } from '@nestjs/testing';
import { ScannerService } from './scanner.service';
import { Browser, BrowserContext, Page } from 'playwright';
import * as playwright from 'playwright';

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

describe('ScannerService', () => {
  let service: ScannerService;
  let mockBrowser: jest.Mocked<Browser>;
  let mockContext: jest.Mocked<BrowserContext>;
  let mockPage: jest.Mocked<Page>;

  beforeEach(async () => {
    mockPage = {
      on: jest.fn(),
      url: jest.fn().mockReturnValue('http://example.com'),
      goto: jest.fn().mockResolvedValue(null),
      waitForTimeout: jest.fn(),
      close: jest.fn(),
      content: jest.fn().mockResolvedValue('<html></html>'),
      evaluate: jest.fn().mockResolvedValue([]),
      context: jest.fn(() => mockContext),
    } as any;

    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
      cookies: jest.fn().mockResolvedValue([]),
    } as any;

    mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn(),
    } as any;

    (playwright.chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ScannerService],
    }).compile();

    service = module.get<ScannerService>(ScannerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should launch browser only once', async () => {
    // We need to mock some of the analyzers internal behavior or just test the browser launch
    // Since analyzers are instantiated in the constructor, we can't easily mock them without changing the service

    // Call scanWebsite multiple times concurrently
    const scanPromise1 = service.scanWebsite('http://example.com');
    const scanPromise2 = service.scanWebsite('http://example.org');

    try {
        await Promise.all([scanPromise1, scanPromise2]);
    } catch (e) {
        // We expect errors because we haven't mocked everything perfectly for the full scan
    }

    expect(playwright.chromium.launch).toHaveBeenCalledTimes(1);
  });

  it('should implement OnModuleDestroy and close browser', async () => {
    await service.scanWebsite('http://example.com');
    await service.onModuleDestroy();
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
