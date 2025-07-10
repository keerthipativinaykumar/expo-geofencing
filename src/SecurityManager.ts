import CryptoJS from 'crypto-js';

export interface PrivacyZone {
  id: string;
  name: string;
  type: 'hospital' | 'government' | 'school' | 'religious' | 'residential' | 'custom';
  center: { latitude: number; longitude: number };
  radius: number;
  bufferZone?: number; // Additional privacy buffer in meters
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface SecurityConfig {
  encryptionEnabled: boolean;
  encryptionKey?: string;
  dataAnonymization: boolean;
  privacyZonesEnabled: boolean;
  minAccuracy: number; // Minimum location accuracy to accept
  locationPrecisionReduction: number; // Reduce precision by this many decimal places
  auditLogging: boolean;
  sensitiveDataMasking: boolean;
  certificatePinning?: {
    domains: string[];
    certificates: string[];
  };
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: string;
  userId?: string;
  locationData?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  metadata?: Record<string, any>;
  hash: string; // For integrity verification
}

export interface LocationProcessingResult {
  allowed: boolean;
  processedLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  violations: string[];
  appliedPolicies: string[];
}

export class SecurityManager {
  private config: SecurityConfig;
  private privacyZones: Map<string, PrivacyZone> = new Map();
  private auditLog: AuditLogEntry[] = [];
  private encryptionKey: string;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      encryptionEnabled: true,
      dataAnonymization: false,
      privacyZonesEnabled: true,
      minAccuracy: 100, // 100 meters
      locationPrecisionReduction: 2, // Reduce to ~1km accuracy
      auditLogging: true,
      sensitiveDataMasking: true,
      ...config
    };

    this.encryptionKey = config.encryptionKey || this.generateEncryptionKey();
    this.initializeDefaultPrivacyZones();
  }

  // Privacy Zone Management
  addPrivacyZone(zone: Omit<PrivacyZone, 'id'>): string {
    const id = this.generateId();
    const privacyZone: PrivacyZone = {
      ...zone,
      id,
      isActive: true
    };

    this.privacyZones.set(id, privacyZone);
    this.logAuditEvent('privacy_zone_added', { zoneId: id, type: zone.type });
    
    return id;
  }

  removePrivacyZone(zoneId: string): boolean {
    const removed = this.privacyZones.delete(zoneId);
    if (removed) {
      this.logAuditEvent('privacy_zone_removed', { zoneId });
    }
    return removed;
  }

  updatePrivacyZone(zoneId: string, updates: Partial<PrivacyZone>): boolean {
    const zone = this.privacyZones.get(zoneId);
    if (!zone) return false;

    this.privacyZones.set(zoneId, { ...zone, ...updates });
    this.logAuditEvent('privacy_zone_updated', { zoneId, updates });
    return true;
  }

  getPrivacyZones(): PrivacyZone[] {
    return Array.from(this.privacyZones.values());
  }

  getActivePrivacyZones(): PrivacyZone[] {
    return this.getPrivacyZones().filter(zone => zone.isActive);
  }

  // Location Processing and Privacy Protection
  processLocation(location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp?: number;
    userId?: string;
  }): LocationProcessingResult {
    const result: LocationProcessingResult = {
      allowed: true,
      violations: [],
      appliedPolicies: []
    };

    // Check minimum accuracy requirement
    if (location.accuracy > this.config.minAccuracy) {
      result.violations.push(`Location accuracy ${location.accuracy}m exceeds minimum required ${this.config.minAccuracy}m`);
      result.allowed = false;
    }

    // Check privacy zones
    if (this.config.privacyZonesEnabled) {
      const violatedZones = this.checkPrivacyZoneViolations(location);
      if (violatedZones.length > 0) {
        result.violations.push(...violatedZones.map(zone => `Location within privacy zone: ${zone.name} (${zone.type})`));
        result.allowed = false;
      }
    }

    // Apply data processing if allowed
    if (result.allowed || this.shouldProcessDespiteViolations(result.violations)) {
      result.processedLocation = this.applyLocationProcessingPolicies(location);
      result.appliedPolicies = this.getAppliedPolicies();
    }

    // Audit log the processing
    this.logAuditEvent('location_processed', {
      allowed: result.allowed,
      violations: result.violations,
      appliedPolicies: result.appliedPolicies,
      userId: location.userId
    }, result.processedLocation);

    return result;
  }

  private checkPrivacyZoneViolations(location: { latitude: number; longitude: number }): PrivacyZone[] {
    const violations: PrivacyZone[] = [];
    const activeZones = this.getActivePrivacyZones();

    for (const zone of activeZones) {
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        zone.center.latitude,
        zone.center.longitude
      );

      const effectiveRadius = zone.radius + (zone.bufferZone || 0);
      
      if (distance <= effectiveRadius) {
        violations.push(zone);
      }
    }

    return violations;
  }

  private applyLocationProcessingPolicies(location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  }): { latitude: number; longitude: number; accuracy: number } {
    let processedLocation = { ...location };

    // Apply anonymization if enabled
    if (this.config.dataAnonymization) {
      processedLocation = this.anonymizeLocation(processedLocation);
    }

    // Apply precision reduction
    if (this.config.locationPrecisionReduction > 0) {
      processedLocation = this.reducePrecision(processedLocation, this.config.locationPrecisionReduction);
    }

    return processedLocation;
  }

  private shouldProcessDespiteViolations(violations: string[]): boolean {
    // Allow processing for some non-critical violations
    const nonCriticalKeywords = ['accuracy'];
    return violations.every(violation => 
      nonCriticalKeywords.some(keyword => violation.toLowerCase().includes(keyword))
    );
  }

  private getAppliedPolicies(): string[] {
    const policies: string[] = [];

    if (this.config.dataAnonymization) {
      policies.push('data_anonymization');
    }
    if (this.config.locationPrecisionReduction > 0) {
      policies.push('precision_reduction');
    }
    if (this.config.privacyZonesEnabled) {
      policies.push('privacy_zones_check');
    }
    if (this.config.minAccuracy) {
      policies.push('accuracy_filtering');
    }

    return policies;
  }

  // Data Encryption and Decryption
  encryptData(data: any): string {
    if (!this.config.encryptionEnabled) {
      return JSON.stringify(data);
    }

    try {
      const jsonString = JSON.stringify(data);
      return CryptoJS.AES.encrypt(jsonString, this.encryptionKey).toString();
    } catch (error) {
      throw new Error(`Encryption failed: ${error}`);
    }
  }

  decryptData<T>(encryptedData: string): T {
    if (!this.config.encryptionEnabled) {
      return JSON.parse(encryptedData);
    }

    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedString);
    } catch (error) {
      throw new Error(`Decryption failed: ${error}`);
    }
  }

  // Data Anonymization
  anonymizeLocation(location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  }): { latitude: number; longitude: number; accuracy: number } {
    // Add random noise to coordinates (differential privacy approach)
    const noiseScale = 0.001; // ~111 meters at equator
    const latNoise = (Math.random() - 0.5) * noiseScale;
    const lngNoise = (Math.random() - 0.5) * noiseScale;

    return {
      latitude: location.latitude + latNoise,
      longitude: location.longitude + lngNoise,
      accuracy: Math.max(location.accuracy, 100) // Ensure minimum accuracy uncertainty
    };
  }

  reducePrecision(location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  }, decimalPlaces: number): { latitude: number; longitude: number; accuracy: number } {
    const factor = Math.pow(10, Math.max(0, 6 - decimalPlaces));
    
    return {
      latitude: Math.round(location.latitude * factor) / factor,
      longitude: Math.round(location.longitude * factor) / factor,
      accuracy: Math.max(location.accuracy, this.calculatePrecisionAccuracy(decimalPlaces))
    };
  }

  private calculatePrecisionAccuracy(decimalPlaces: number): number {
    // Approximate accuracy based on decimal places
    const accuracyMap: Record<number, number> = {
      0: 111000, // ~111 km
      1: 11100,  // ~11 km
      2: 1110,   // ~1.1 km
      3: 111,    // ~111 m
      4: 11,     // ~11 m
      5: 1,      // ~1 m
      6: 0.1     // ~10 cm
    };
    
    return accuracyMap[Math.max(0, 6 - decimalPlaces)] || 111000;
  }

  // Sensitive Data Masking
  maskSensitiveData(data: any): any {
    if (!this.config.sensitiveDataMasking) {
      return data;
    }

    const sensitiveFields = ['userId', 'deviceId', 'email', 'phone'];
    const masked = { ...data };

    for (const field of sensitiveFields) {
      if (masked[field]) {
        masked[field] = this.maskValue(masked[field]);
      }
    }

    return masked;
  }

  private maskValue(value: string): string {
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    
    const start = value.substring(0, 2);
    const end = value.substring(value.length - 2);
    const middle = '*'.repeat(value.length - 4);
    
    return start + middle + end;
  }

  // Audit Logging
  private logAuditEvent(
    action: string, 
    metadata?: Record<string, any>, 
    locationData?: { latitude: number; longitude: number; accuracy: number },
    userId?: string
  ): void {
    if (!this.config.auditLogging) return;

    const entry: AuditLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      action,
      userId,
      locationData,
      metadata,
      hash: '' // Will be set below
    };

    // Generate integrity hash
    const { hash, ...entryWithoutHash } = entry;
    entry.hash = this.generateAuditHash(entryWithoutHash);
    
    this.auditLog.push(entry);
    
    // Keep only recent entries to prevent memory issues
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  getAuditLog(filter?: {
    action?: string;
    userId?: string;
    startTime?: number;
    endTime?: number;
  }): AuditLogEntry[] {
    let filteredLog = [...this.auditLog];

    if (filter) {
      filteredLog = filteredLog.filter(entry => {
        if (filter.action && entry.action !== filter.action) return false;
        if (filter.userId && entry.userId !== filter.userId) return false;
        if (filter.startTime && entry.timestamp < filter.startTime) return false;
        if (filter.endTime && entry.timestamp > filter.endTime) return false;
        return true;
      });
    }

    return filteredLog;
  }

  verifyAuditLogIntegrity(): { valid: boolean; corruptedEntries: string[] } {
    const corruptedEntries: string[] = [];

    for (const entry of this.auditLog) {
      const expectedHash = this.generateAuditHash({ ...entry, hash: '' });
      if (entry.hash !== expectedHash) {
        corruptedEntries.push(entry.id);
      }
    }

    return {
      valid: corruptedEntries.length === 0,
      corruptedEntries
    };
  }

  private generateAuditHash(entry: any): string {
    const dataToHash = JSON.stringify(entry, Object.keys(entry).sort());
    return CryptoJS.SHA256(dataToHash).toString();
  }

  // Certificate Pinning (for API communications)
  validateCertificate(domain: string, certificate: string): boolean {
    if (!this.config.certificatePinning) return true;

    const pinnedCerts = this.config.certificatePinning.certificates;
    const pinnedDomains = this.config.certificatePinning.domains;

    if (!pinnedDomains.includes(domain)) return true;

    return pinnedCerts.includes(certificate);
  }

  // Utility Methods
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateEncryptionKey(): string {
    return CryptoJS.lib.WordArray.random(256/8).toString();
  }

  // Initialize default privacy zones for common sensitive locations
  private initializeDefaultPrivacyZones(): void {
    // These are example zones - in practice, these would be loaded from a database
    const defaultZones: Omit<PrivacyZone, 'id'>[] = [
      // Example: Hospital
      {
        name: 'General Hospital Privacy Zone',
        type: 'hospital',
        center: { latitude: 37.7749, longitude: -122.4194 }, // Example coordinates
        radius: 200,
        bufferZone: 50,
        isActive: true,
        metadata: { reason: 'HIPAA privacy protection' }
      },
      // Example: Government building
      {
        name: 'Government Building Privacy Zone',
        type: 'government',
        center: { latitude: 37.7849, longitude: -122.4094 },
        radius: 100,
        bufferZone: 25,
        isActive: true,
        metadata: { reason: 'Security sensitive area' }
      }
    ];

    // Only add if privacy zones are enabled
    if (this.config.privacyZonesEnabled) {
      defaultZones.forEach(zone => this.addPrivacyZone(zone));
    }
  }

  // Configuration Management
  updateConfig(updates: Partial<SecurityConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };
    
    this.logAuditEvent('security_config_updated', {
      oldConfig: this.maskSensitiveData(oldConfig),
      newConfig: this.maskSensitiveData(this.config)
    });
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  // Security Health Check
  performSecurityHealthCheck(): {
    score: number;
    recommendations: string[];
    issues: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check encryption
    if (!this.config.encryptionEnabled) {
      issues.push('Data encryption is disabled');
      recommendations.push('Enable data encryption for sensitive location data');
      score -= 20;
    }

    // Check privacy zones
    if (!this.config.privacyZonesEnabled) {
      issues.push('Privacy zones are disabled');
      recommendations.push('Enable privacy zones to protect sensitive locations');
      score -= 15;
    }

    // Check audit logging
    if (!this.config.auditLogging) {
      issues.push('Audit logging is disabled');
      recommendations.push('Enable audit logging for compliance and security monitoring');
      score -= 15;
    }

    // Check minimum accuracy
    if (this.config.minAccuracy > 500) {
      issues.push('Minimum accuracy threshold is too high');
      recommendations.push('Consider lowering minimum accuracy for better location filtering');
      score -= 10;
    }

    // Check certificate pinning
    if (!this.config.certificatePinning) {
      recommendations.push('Consider implementing certificate pinning for API communications');
      score -= 5;
    }

    return {
      score: Math.max(0, score),
      recommendations,
      issues
    };
  }
}