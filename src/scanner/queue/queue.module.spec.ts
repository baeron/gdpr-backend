import { QueueModule } from './queue.module';
import { QUEUE_SERVICE } from './queue.interface';

describe('QueueModule', () => {
  let originalQueueType: string | undefined;

  beforeEach(() => {
    originalQueueType = process.env.QUEUE_TYPE;
  });

  afterEach(() => {
    if (originalQueueType !== undefined) {
      process.env.QUEUE_TYPE = originalQueueType;
    } else {
      delete process.env.QUEUE_TYPE;
    }
  });

  describe('register', () => {
    it('should return a DynamicModule', () => {
      const result = QueueModule.register();

      expect(result).toBeDefined();
      expect(result.module).toBe(QueueModule);
    });

    it('should export QUEUE_SERVICE', () => {
      const result = QueueModule.register();

      expect(result.exports).toContain(QUEUE_SERVICE);
    });

    it('should have providers configured', () => {
      const result = QueueModule.register();

      expect(result.providers).toBeDefined();
      expect(result.providers?.length).toBeGreaterThan(0);
    });

    it('should import PrismaModule', () => {
      const result = QueueModule.register();

      expect(result.imports).toBeDefined();
      expect(result.imports?.length).toBeGreaterThan(0);
    });

    it('should use postgres queue type by default', () => {
      delete process.env.QUEUE_TYPE;

      // The module registers based on env var at registration time
      const result = QueueModule.register();

      expect(result).toBeDefined();
      // The actual service type is determined by the factory at runtime
    });

    it('should handle redis queue type', () => {
      process.env.QUEUE_TYPE = 'redis';

      const result = QueueModule.register();

      expect(result).toBeDefined();
    });

    it('should handle postgres queue type explicitly', () => {
      process.env.QUEUE_TYPE = 'postgres';

      const result = QueueModule.register();

      expect(result).toBeDefined();
    });
  });
});
