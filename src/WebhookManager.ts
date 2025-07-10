import { GeofenceEvent, ActivityRecognitionResult, HealthAlert } from './index';

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  events: WebhookEventType[];
  isActive: boolean;
  retryConfig: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
    baseDelay: number;
    maxDelay: number;
  };
  filterConfig?: {
    regions?: string[];
    activities?: string[];
    severities?: string[];
    conditions?: Record<string, any>;
  };
  authConfig?: {
    type: 'none' | 'bearer' | 'api_key' | 'basic' | 'custom';
    credentials: Record<string, string>;
  };
  timeout: number;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  metadata?: Record<string, any>;
}

export type WebhookEventType = 
  | 'geofence.enter' 
  | 'geofence.exit' 
  | 'activity.change'
  | 'health.alert'
  | 'system.status'
  | 'location.update';

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: number;
  webhookId: string;
  data: any;
  metadata?: Record<string, any>;
  signature?: string;
}

export interface WebhookDeliveryAttempt {
  id: string;
  webhookId: string;
  payload: WebhookPayload;
  attempt: number;
  timestamp: number;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  responseStatus?: number;
  responseBody?: string;
  error?: string;
  nextRetryAt?: number;
}

export interface WebhookStats {
  webhookId: string;
  totalAttempts: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageResponseTime: number;
  lastDeliveryAt?: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  errorRate: number;
}

export class WebhookManager {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveryQueue: WebhookDeliveryAttempt[] = [];
  private stats: Map<string, WebhookStats> = new Map();
  private rateLimitTracking: Map<string, { requests: number; resetTime: number }> = new Map();
  private isProcessing = false;
  private processingInterval?: any;
  private secretKey: string;

  constructor(secretKey?: string) {
    this.secretKey = secretKey || this.generateSecretKey();
    this.startProcessing();
  }

  // Webhook Configuration Management
  addWebhook(config: Omit<WebhookConfig, 'id'>): string {
    const id = this.generateId();
    const webhook: WebhookConfig = {
      ...config,
      id,
      isActive: config.isActive ?? true,
      timeout: config.timeout || 30000,
      retryConfig: {
        maxRetries: config.retryConfig?.maxRetries ?? 3,
        backoffStrategy: config.retryConfig?.backoffStrategy ?? 'exponential',
        baseDelay: config.retryConfig?.baseDelay ?? 1000,
        maxDelay: config.retryConfig?.maxDelay ?? 60000
      }
    };

    this.webhooks.set(id, webhook);
    this.initializeStats(id);

    return id;
  }

  removeWebhook(webhookId: string): boolean {
    const removed = this.webhooks.delete(webhookId);
    if (removed) {
      this.stats.delete(webhookId);
      this.rateLimitTracking.delete(webhookId);
      // Remove pending deliveries for this webhook
      this.deliveryQueue = this.deliveryQueue.filter(d => d.webhookId !== webhookId);
    }
    return removed;
  }

  updateWebhook(webhookId: string, updates: Partial<WebhookConfig>): boolean {
    const existing = this.webhooks.get(webhookId);
    if (!existing) return false;

    this.webhooks.set(webhookId, { ...existing, ...updates });
    return true;
  }

  getWebhook(webhookId: string): WebhookConfig | undefined {
    return this.webhooks.get(webhookId);
  }

  getAllWebhooks(): WebhookConfig[] {
    return Array.from(this.webhooks.values());
  }

  getActiveWebhooks(): WebhookConfig[] {
    return this.getAllWebhooks().filter(w => w.isActive);
  }

  // Event Triggering
  async triggerGeofenceEvent(event: GeofenceEvent): Promise<void> {
    const eventType: WebhookEventType = event.eventType === 'enter' ? 'geofence.enter' : 'geofence.exit';
    await this.triggerWebhooks(eventType, event, { regionId: event.regionId });
  }

  async triggerActivityEvent(event: ActivityRecognitionResult): Promise<void> {
    await this.triggerWebhooks('activity.change', event, { activity: event.activity });
  }

  async triggerHealthAlert(alert: HealthAlert): Promise<void> {
    await this.triggerWebhooks('health.alert', alert, { severity: alert.severity });
  }

  async triggerLocationUpdate(location: any): Promise<void> {
    await this.triggerWebhooks('location.update', location);
  }

  async triggerSystemStatus(status: any): Promise<void> {
    await this.triggerWebhooks('system.status', status);
  }

  private async triggerWebhooks(
    eventType: WebhookEventType, 
    data: any, 
    filterContext?: Record<string, any>
  ): Promise<void> {
    const relevantWebhooks = this.getWebhooksForEvent(eventType, filterContext);

    for (const webhook of relevantWebhooks) {
      if (!this.checkRateLimit(webhook)) {
        console.warn(`Rate limit exceeded for webhook ${webhook.id}`);
        continue;
      }

      const payload: WebhookPayload = {
        event: eventType,
        timestamp: Date.now(),
        webhookId: webhook.id,
        data,
        metadata: webhook.metadata,
        signature: this.generateSignature(data)
      };

      this.queueDelivery(webhook, payload);
    }
  }

  private getWebhooksForEvent(
    eventType: WebhookEventType, 
    filterContext?: Record<string, any>
  ): WebhookConfig[] {
    return this.getActiveWebhooks().filter(webhook => {
      // Check if webhook listens to this event type
      if (!webhook.events.includes(eventType)) {
        return false;
      }

      // Apply filters if configured
      if (webhook.filterConfig && filterContext) {
        return this.applyFilters(webhook.filterConfig, filterContext);
      }

      return true;
    });
  }

  private applyFilters(filterConfig: NonNullable<WebhookConfig['filterConfig']>, context: Record<string, any>): boolean {
    // Region filter
    if (filterConfig.regions && context.regionId) {
      if (!filterConfig.regions.includes(context.regionId)) {
        return false;
      }
    }

    // Activity filter
    if (filterConfig.activities && context.activity) {
      if (!filterConfig.activities.includes(context.activity)) {
        return false;
      }
    }

    // Severity filter
    if (filterConfig.severities && context.severity) {
      if (!filterConfig.severities.includes(context.severity)) {
        return false;
      }
    }

    // Custom conditions (simplified implementation)
    if (filterConfig.conditions) {
      for (const [key, value] of Object.entries(filterConfig.conditions)) {
        if (context[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  // Delivery Queue Management
  private queueDelivery(webhook: WebhookConfig, payload: WebhookPayload): void {
    const delivery: WebhookDeliveryAttempt = {
      id: this.generateId(),
      webhookId: webhook.id,
      payload,
      attempt: 1,
      timestamp: Date.now(),
      status: 'pending'
    };

    this.deliveryQueue.push(delivery);
  }

  private async processDeliveryQueue(): Promise<void> {
    if (this.isProcessing || this.deliveryQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const pendingDeliveries = this.deliveryQueue.filter(d => 
        d.status === 'pending' || (d.status === 'retrying' && (!d.nextRetryAt || Date.now() >= d.nextRetryAt))
      );

      // Process up to 10 deliveries concurrently
      const batch = pendingDeliveries.slice(0, 10);
      const promises = batch.map(delivery => this.attemptDelivery(delivery));
      
      // Wait for all promises to complete
      await Promise.all(promises.map(p => p.catch(() => {})));

      // Clean up completed deliveries
      this.deliveryQueue = this.deliveryQueue.filter(d => 
        d.status === 'pending' || d.status === 'retrying'
      );

    } finally {
      this.isProcessing = false;
    }
  }

  private async attemptDelivery(delivery: WebhookDeliveryAttempt): Promise<void> {
    const webhook = this.webhooks.get(delivery.webhookId);
    if (!webhook || !webhook.isActive) {
      delivery.status = 'failed';
      delivery.error = 'Webhook not found or inactive';
      return;
    }

    const startTime = Date.now();

    try {
      const response = await this.makeHttpRequest(webhook, delivery.payload);
      const responseTime = Date.now() - startTime;

      delivery.status = 'success';
      delivery.responseStatus = response.status;
      delivery.responseBody = response.body;

      this.updateStats(webhook.id, true, responseTime);

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      delivery.status = 'failed';
      delivery.error = error.message;
      delivery.responseStatus = error.status;

      this.updateStats(webhook.id, false, responseTime);

      // Schedule retry if attempts remaining
      if (delivery.attempt < webhook.retryConfig.maxRetries) {
        delivery.status = 'retrying';
        delivery.attempt++;
        delivery.nextRetryAt = this.calculateNextRetryTime(webhook.retryConfig, delivery.attempt);
      }
    }
  }

  private async makeHttpRequest(webhook: WebhookConfig, payload: WebhookPayload): Promise<{
    status: number;
    body: string;
  }> {
    const headers = { ...webhook.headers };
    
    // Add authentication headers
    this.addAuthHeaders(headers, webhook.authConfig);
    
    // Add content type
    headers['Content-Type'] = 'application/json';
    
    // Add signature header
    if (payload.signature) {
      headers['X-Webhook-Signature'] = payload.signature;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), webhook.timeout);

    try {
      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const body = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${body}`);
      }

      return {
        status: response.status,
        body
      };

    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${webhook.timeout}ms`);
      }
      
      throw error;
    }
  }

  private addAuthHeaders(headers: Record<string, string>, authConfig?: WebhookConfig['authConfig']): void {
    if (!authConfig || authConfig.type === 'none') {
      return;
    }

    switch (authConfig.type) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${authConfig.credentials.token}`;
        break;
      case 'api_key':
        headers[authConfig.credentials.header || 'X-API-Key'] = authConfig.credentials.key;
        break;
      case 'basic':
        const credentials = btoa(`${authConfig.credentials.username}:${authConfig.credentials.password}`);
        headers['Authorization'] = `Basic ${credentials}`;
        break;
      case 'custom':
        Object.assign(headers, authConfig.credentials);
        break;
    }
  }

  // Rate Limiting
  private checkRateLimit(webhook: WebhookConfig): boolean {
    if (!webhook.rateLimit) return true;

    const now = Date.now();
    const tracking = this.rateLimitTracking.get(webhook.id);

    if (!tracking || now >= tracking.resetTime) {
      // Reset or initialize rate limit window
      this.rateLimitTracking.set(webhook.id, {
        requests: 1,
        resetTime: now + webhook.rateLimit.windowMs
      });
      return true;
    }

    if (tracking.requests >= webhook.rateLimit.maxRequests) {
      return false; // Rate limit exceeded
    }

    tracking.requests++;
    return true;
  }

  // Statistics and Monitoring
  private initializeStats(webhookId: string): void {
    this.stats.set(webhookId, {
      webhookId,
      totalAttempts: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      averageResponseTime: 0,
      errorRate: 0
    });
  }

  private updateStats(webhookId: string, success: boolean, responseTime: number): void {
    const stats = this.stats.get(webhookId);
    if (!stats) return;

    stats.totalAttempts++;
    
    if (success) {
      stats.successfulDeliveries++;
      stats.lastSuccessAt = Date.now();
    } else {
      stats.failedDeliveries++;
      stats.lastFailureAt = Date.now();
    }

    stats.lastDeliveryAt = Date.now();
    stats.averageResponseTime = (stats.averageResponseTime * (stats.totalAttempts - 1) + responseTime) / stats.totalAttempts;
    stats.errorRate = stats.failedDeliveries / stats.totalAttempts;
  }

  getWebhookStats(webhookId: string): WebhookStats | undefined {
    return this.stats.get(webhookId);
  }

  getAllWebhookStats(): WebhookStats[] {
    return Array.from(this.stats.values());
  }

  // Retry Logic
  private calculateNextRetryTime(retryConfig: WebhookConfig['retryConfig'], attempt: number): number {
    let delay: number;

    if (retryConfig.backoffStrategy === 'linear') {
      delay = retryConfig.baseDelay * attempt;
    } else {
      delay = retryConfig.baseDelay * Math.pow(2, attempt - 1);
    }

    delay = Math.min(delay, retryConfig.maxDelay);
    
    // Add some jitter to prevent thundering herd
    delay += Math.random() * 1000;

    return Date.now() + delay;
  }

  // Security
  private generateSignature(data: any): string {
    const payload = JSON.stringify(data);
    return this.hmacSha256(payload, this.secretKey);
  }

  verifySignature(payload: string, signature: string): boolean {
    const expectedSignature = this.hmacSha256(payload, this.secretKey);
    return signature === expectedSignature;
  }

  private hmacSha256(data: string, key: string): string {
    // Simple hash implementation for demo - in production use proper crypto
    return btoa(data + key).slice(0, 32);
  }

  // Processing Control
  private startProcessing(): void {
    // Process queue every 5 seconds
    this.processingInterval = setInterval(() => {
      this.processDeliveryQueue().catch(error => {
        console.error('Error processing webhook delivery queue:', error);
      });
    }, 5000);
  }

  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  // Manual Operations
  async retryFailedDeliveries(webhookId?: string): Promise<number> {
    const failedDeliveries = this.deliveryQueue.filter(d => 
      d.status === 'failed' && (!webhookId || d.webhookId === webhookId)
    );

    failedDeliveries.forEach(delivery => {
      delivery.status = 'pending';
      delivery.attempt = 1;
      delivery.nextRetryAt = undefined;
    });

    return failedDeliveries.length;
  }

  getPendingDeliveries(webhookId?: string): WebhookDeliveryAttempt[] {
    return this.deliveryQueue.filter(d => 
      (d.status === 'pending' || d.status === 'retrying') &&
      (!webhookId || d.webhookId === webhookId)
    );
  }

  getDeliveryHistory(webhookId: string, limit: number = 100): WebhookDeliveryAttempt[] {
    // In practice, this would query a persistent storage
    return this.deliveryQueue
      .filter(d => d.webhookId === webhookId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Testing and Validation
  async testWebhook(webhookId: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload: WebhookPayload = {
      event: 'system.status',
      timestamp: Date.now(),
      webhookId,
      data: { test: true, message: 'Webhook test payload' },
      signature: this.generateSignature({ test: true })
    };

    const startTime = Date.now();

    try {
      await this.makeHttpRequest(webhook, testPayload);
      return {
        success: true,
        responseTime: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  // Utility Methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateSecretKey(): string {
    // Simple random key generation for demo
    return Math.random().toString(36).repeat(4).slice(0, 32);
  }

  // Cleanup
  cleanup(): void {
    this.stopProcessing();
    this.webhooks.clear();
    this.deliveryQueue.length = 0;
    this.stats.clear();
    this.rateLimitTracking.clear();
  }
}