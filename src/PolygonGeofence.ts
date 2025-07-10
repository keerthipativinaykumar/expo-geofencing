export interface Point {
  latitude: number;
  longitude: number;
}

export interface PolygonGeofenceRegion {
  id: string;
  name?: string;
  vertices: Point[];
  notifyOnEntry: boolean;
  notifyOnExit: boolean;
  metadata?: Record<string, any>;
}

export interface GeofenceHierarchy {
  id: string;
  parentId?: string;
  children: string[];
  inheritSettings: boolean;
  overrides?: Partial<PolygonGeofenceRegion>;
}

export interface TimeBasedRule {
  id: string;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  daysOfWeek: number[]; // 0-6, Sunday = 0
  timezone?: string;
  isActive: boolean;
}

export interface ConditionalRule {
  id: string;
  condition: 'weather' | 'traffic' | 'activity' | 'custom';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
  isActive: boolean;
}

export interface AdvancedGeofenceRegion extends PolygonGeofenceRegion {
  type: 'circle' | 'polygon';
  // For circular geofences
  center?: Point;
  radius?: number;
  // Time-based activation
  timeRules?: TimeBasedRule[];
  // Conditional activation
  conditionalRules?: ConditionalRule[];
  // Hierarchy
  hierarchy?: GeofenceHierarchy;
  // Performance optimization
  boundingBox?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
}

export class PolygonGeofenceManager {
  private geofences: Map<string, AdvancedGeofenceRegion> = new Map();
  private spatialIndex: Map<string, Set<string>> = new Map(); // Grid-based spatial index
  private hierarchies: Map<string, GeofenceHierarchy> = new Map();
  
  // Grid size for spatial indexing (in degrees)
  private readonly GRID_SIZE = 0.01; // ~1.11 km at equator

  // Add a geofence region
  addGeofence(region: Omit<AdvancedGeofenceRegion, 'boundingBox'>): string {
    const geofence: AdvancedGeofenceRegion = {
      ...region,
      boundingBox: this.calculateBoundingBox(region)
    };

    this.geofences.set(region.id, geofence);
    this.addToSpatialIndex(geofence);
    
    if (geofence.hierarchy) {
      this.hierarchies.set(region.id, geofence.hierarchy);
      this.updateHierarchyReferences(geofence.hierarchy);
    }

    return region.id;
  }

  // Remove a geofence region
  removeGeofence(regionId: string): boolean {
    const geofence = this.geofences.get(regionId);
    if (!geofence) return false;

    this.removeFromSpatialIndex(geofence);
    this.geofences.delete(regionId);
    
    if (geofence.hierarchy) {
      this.removeFromHierarchy(regionId);
    }

    return true;
  }

  // Update a geofence region
  updateGeofence(regionId: string, updates: Partial<AdvancedGeofenceRegion>): boolean {
    const existing = this.geofences.get(regionId);
    if (!existing) return false;

    // Remove from spatial index with old data
    this.removeFromSpatialIndex(existing);

    // Apply updates
    const updated: AdvancedGeofenceRegion = {
      ...existing,
      ...updates,
      boundingBox: this.calculateBoundingBox({ ...existing, ...updates })
    };

    // Add back to spatial index with new data
    this.geofences.set(regionId, updated);
    this.addToSpatialIndex(updated);

    return true;
  }

  // Check if a point is inside any geofences
  checkLocation(point: Point, timestamp: number = Date.now()): {
    entered: AdvancedGeofenceRegion[];
    exited: AdvancedGeofenceRegion[];
    inside: AdvancedGeofenceRegion[];
  } {
    const candidateGeofences = this.getCandidateGeofences(point);
    const result = {
      entered: [] as AdvancedGeofenceRegion[],
      exited: [] as AdvancedGeofenceRegion[],
      inside: [] as AdvancedGeofenceRegion[]
    };

    for (const geofence of candidateGeofences) {
      // Check time-based rules
      if (!this.isTimeRuleActive(geofence, timestamp)) {
        continue;
      }

      // Check conditional rules
      if (!this.areConditionalRulesActive(geofence)) {
        continue;
      }

      const isInside = this.isPointInside(point, geofence);
      const wasInside = geofence.metadata?.wasInside || false;

      if (isInside) {
        result.inside.push(geofence);
        
        if (!wasInside && geofence.notifyOnEntry) {
          result.entered.push(geofence);
        }
      } else if (wasInside && geofence.notifyOnExit) {
        result.exited.push(geofence);
      }

      // Update state
      geofence.metadata = { ...geofence.metadata, wasInside: isInside };
    }

    return result;
  }

  // Point-in-polygon check for complex shapes
  private isPointInside(point: Point, geofence: AdvancedGeofenceRegion): boolean {
    if (geofence.type === 'circle') {
      return this.isPointInCircle(point, geofence);
    } else {
      return this.isPointInPolygon(point, geofence.vertices);
    }
  }

  private isPointInCircle(point: Point, geofence: AdvancedGeofenceRegion): boolean {
    if (!geofence.center || !geofence.radius) return false;
    
    const distance = this.calculateDistance(
      point.latitude,
      point.longitude,
      geofence.center.latitude,
      geofence.center.longitude
    );
    
    return distance <= geofence.radius;
  }

  // Ray casting algorithm for polygon containment
  private isPointInPolygon(point: Point, vertices: Point[]): boolean {
    if (vertices.length < 3) return false;

    let inside = false;
    const x = point.longitude;
    const y = point.latitude;

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const xi = vertices[i].longitude;
      const yi = vertices[i].latitude;
      const xj = vertices[j].longitude;
      const yj = vertices[j].latitude;

      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  // Spatial indexing for performance optimization
  private addToSpatialIndex(geofence: AdvancedGeofenceRegion): void {
    if (!geofence.boundingBox) return;

    const gridCells = this.getGridCells(geofence.boundingBox);
    
    for (const cell of gridCells) {
      if (!this.spatialIndex.has(cell)) {
        this.spatialIndex.set(cell, new Set());
      }
      this.spatialIndex.get(cell)!.add(geofence.id);
    }
  }

  private removeFromSpatialIndex(geofence: AdvancedGeofenceRegion): void {
    if (!geofence.boundingBox) return;

    const gridCells = this.getGridCells(geofence.boundingBox);
    
    for (const cell of gridCells) {
      const cellSet = this.spatialIndex.get(cell);
      if (cellSet) {
        cellSet.delete(geofence.id);
        if (cellSet.size === 0) {
          this.spatialIndex.delete(cell);
        }
      }
    }
  }

  private getCandidateGeofences(point: Point): AdvancedGeofenceRegion[] {
    const cellKey = this.getGridCell(point.latitude, point.longitude);
    const candidateIds = this.spatialIndex.get(cellKey) || new Set();
    
    // Also check adjacent cells for edge cases
    const adjacentCells = this.getAdjacentCells(cellKey);
    for (const cell of adjacentCells) {
      const cellIds = this.spatialIndex.get(cell);
      if (cellIds) {
        cellIds.forEach(id => candidateIds.add(id));
      }
    }

    const candidates: AdvancedGeofenceRegion[] = [];
    for (const id of candidateIds) {
      const geofence = this.geofences.get(id);
      if (geofence) {
        candidates.push(geofence);
      }
    }

    return candidates;
  }

  private getGridCell(lat: number, lng: number): string {
    const latGrid = Math.floor(lat / this.GRID_SIZE);
    const lngGrid = Math.floor(lng / this.GRID_SIZE);
    return `${latGrid},${lngGrid}`;
  }

  private getGridCells(boundingBox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }): string[] {
    const cells: string[] = [];
    
    const minLatGrid = Math.floor(boundingBox.minLat / this.GRID_SIZE);
    const maxLatGrid = Math.floor(boundingBox.maxLat / this.GRID_SIZE);
    const minLngGrid = Math.floor(boundingBox.minLng / this.GRID_SIZE);
    const maxLngGrid = Math.floor(boundingBox.maxLng / this.GRID_SIZE);

    for (let lat = minLatGrid; lat <= maxLatGrid; lat++) {
      for (let lng = minLngGrid; lng <= maxLngGrid; lng++) {
        cells.push(`${lat},${lng}`);
      }
    }

    return cells;
  }

  private getAdjacentCells(cellKey: string): string[] {
    const [lat, lng] = cellKey.split(',').map(Number);
    const adjacent: string[] = [];

    for (let dLat = -1; dLat <= 1; dLat++) {
      for (let dLng = -1; dLng <= 1; dLng++) {
        if (dLat === 0 && dLng === 0) continue;
        adjacent.push(`${lat + dLat},${lng + dLng}`);
      }
    }

    return adjacent;
  }

  // Bounding box calculation
  private calculateBoundingBox(geofence: AdvancedGeofenceRegion): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } {
    if (geofence.type === 'circle' && geofence.center && geofence.radius) {
      // For circular geofences, calculate bounding box from center and radius
      const latOffset = (geofence.radius / 111000); // Rough conversion: 1 degree ≈ 111 km
      const lngOffset = latOffset / Math.cos(geofence.center.latitude * Math.PI / 180);

      return {
        minLat: geofence.center.latitude - latOffset,
        maxLat: geofence.center.latitude + latOffset,
        minLng: geofence.center.longitude - lngOffset,
        maxLng: geofence.center.longitude + lngOffset
      };
    } else {
      // For polygon geofences, find min/max coordinates
      const lats = geofence.vertices.map(v => v.latitude);
      const lngs = geofence.vertices.map(v => v.longitude);

      return {
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        minLng: Math.min(...lngs),
        maxLng: Math.max(...lngs)
      };
    }
  }

  // Time-based rule checking
  private isTimeRuleActive(geofence: AdvancedGeofenceRegion, timestamp: number): boolean {
    if (!geofence.timeRules || geofence.timeRules.length === 0) {
      return true; // No time rules means always active
    }

    const date = new Date(timestamp);
    const dayOfWeek = date.getDay();
    const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

    for (const rule of geofence.timeRules) {
      if (!rule.isActive) continue;

      // Check day of week
      if (!rule.daysOfWeek.includes(dayOfWeek)) continue;

      // Check time range
      if (this.isTimeInRange(timeString, rule.startTime, rule.endTime)) {
        return true;
      }
    }

    return false;
  }

  private isTimeInRange(time: string, startTime: string, endTime: string): boolean {
    const timeMinutes = this.timeToMinutes(time);
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    if (startMinutes <= endMinutes) {
      // Normal case: start < end (e.g., 09:00 - 17:00)
      return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
    } else {
      // Overnight case: start > end (e.g., 22:00 - 06:00)
      return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Conditional rule checking (stub - would integrate with external services)
  private areConditionalRulesActive(geofence: AdvancedGeofenceRegion): boolean {
    if (!geofence.conditionalRules || geofence.conditionalRules.length === 0) {
      return true;
    }

    // For now, assume all conditional rules are active
    // In practice, this would check weather APIs, traffic data, etc.
    return geofence.conditionalRules.every(rule => rule.isActive);
  }

  // Hierarchy management
  private updateHierarchyReferences(hierarchy: GeofenceHierarchy): void {
    this.hierarchies.set(hierarchy.id, hierarchy);

    // Update parent's children list
    if (hierarchy.parentId) {
      const parent = this.hierarchies.get(hierarchy.parentId);
      if (parent && !parent.children.includes(hierarchy.id)) {
        parent.children.push(hierarchy.id);
      }
    }
  }

  private removeFromHierarchy(regionId: string): void {
    const hierarchy = this.hierarchies.get(regionId);
    if (!hierarchy) return;

    // Remove from parent's children
    if (hierarchy.parentId) {
      const parent = this.hierarchies.get(hierarchy.parentId);
      if (parent) {
        parent.children = parent.children.filter(id => id !== regionId);
      }
    }

    // Update children to remove parent reference
    for (const childId of hierarchy.children) {
      const child = this.hierarchies.get(childId);
      if (child) {
        child.parentId = undefined;
      }
    }

    this.hierarchies.delete(regionId);
  }

  // Utility methods
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

  // Public API methods
  getGeofence(regionId: string): AdvancedGeofenceRegion | undefined {
    return this.geofences.get(regionId);
  }

  getAllGeofences(): AdvancedGeofenceRegion[] {
    return Array.from(this.geofences.values());
  }

  getGeofencesByType(type: 'circle' | 'polygon'): AdvancedGeofenceRegion[] {
    return this.getAllGeofences().filter(g => g.type === type);
  }

  getActiveGeofences(timestamp: number = Date.now()): AdvancedGeofenceRegion[] {
    return this.getAllGeofences().filter(g => 
      this.isTimeRuleActive(g, timestamp) && this.areConditionalRulesActive(g)
    );
  }

  getStatistics(): {
    totalGeofences: number;
    circularGeofences: number;
    polygonGeofences: number;
    timeBasedGeofences: number;
    conditionalGeofences: number;
    hierarchicalGeofences: number;
    spatialIndexSize: number;
  } {
    const all = this.getAllGeofences();
    
    return {
      totalGeofences: all.length,
      circularGeofences: all.filter(g => g.type === 'circle').length,
      polygonGeofences: all.filter(g => g.type === 'polygon').length,
      timeBasedGeofences: all.filter(g => g.timeRules && g.timeRules.length > 0).length,
      conditionalGeofences: all.filter(g => g.conditionalRules && g.conditionalRules.length > 0).length,
      hierarchicalGeofences: all.filter(g => g.hierarchy).length,
      spatialIndexSize: this.spatialIndex.size
    };
  }

  // Bulk operations for performance
  addMultipleGeofences(geofences: Omit<AdvancedGeofenceRegion, 'boundingBox'>[]): string[] {
    const ids: string[] = [];
    
    for (const geofence of geofences) {
      ids.push(this.addGeofence(geofence));
    }
    
    return ids;
  }

  removeMultipleGeofences(regionIds: string[]): boolean[] {
    return regionIds.map(id => this.removeGeofence(id));
  }

  // Validation
  validatePolygon(vertices: Point[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (vertices.length < 3) {
      errors.push('Polygon must have at least 3 vertices');
    }

    // Check for valid coordinates
    for (const vertex of vertices) {
      if (vertex.latitude < -90 || vertex.latitude > 90) {
        errors.push(`Invalid latitude: ${vertex.latitude}`);
      }
      if (vertex.longitude < -180 || vertex.longitude > 180) {
        errors.push(`Invalid longitude: ${vertex.longitude}`);
      }
    }

    // Check for self-intersection (simplified check)
    if (vertices.length > 3 && this.hasSimpleSelfIntersection(vertices)) {
      errors.push('Polygon has self-intersections');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private hasSimpleSelfIntersection(vertices: Point[]): boolean {
    // Simplified check for self-intersection
    // In practice, you'd want a more robust algorithm
    for (let i = 0; i < vertices.length - 1; i++) {
      for (let j = i + 2; j < vertices.length; j++) {
        if (j === vertices.length - 1 && i === 0) continue; // Skip adjacent edges
        
        // Check if edges intersect (this is a simplified version)
        // Real implementation would use proper line intersection algorithm
      }
    }
    
    return false; // Simplified - always return false for now
  }
}