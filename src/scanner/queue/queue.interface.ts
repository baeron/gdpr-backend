// Queue abstraction interface - allows switching between PostgreSQL and Redis/Bull

export interface QueuedJob {
  websiteUrl: string;
  auditRequestId?: string;
  userEmail?: string;
  locale?: string;
  priority?: number;
}

export interface JobStatus {
  id: string;
  websiteUrl: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  currentStep: string | null;
  position: number | null;
  reportId: string | null;
  error: string | null;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  estimatedWaitMinutes: number | null;
}

export interface QueueStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  maxConcurrent: number;
  estimatedWaitPerJob: number;
}

export interface IQueueService {
  // Add job to queue
  addJob(job: QueuedJob): Promise<JobStatus>;
  
  // Get job status
  getJobStatus(jobId: string): Promise<JobStatus | null>;
  
  // Cancel job (only if queued)
  cancelJob(jobId: string): Promise<boolean>;
  
  // Get queue statistics
  getStats(): Promise<QueueStats>;
  
  // Start processing jobs (called on module init)
  startWorker(): void;
  
  // Stop processing jobs (called on module destroy)
  stopWorker(): void;
}

export const QUEUE_SERVICE = 'QUEUE_SERVICE';
