import type { AWBucket, AWEvent, WeeklyTimeData } from '../types';

class AwServerApi {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError(
          'Unable to connect to ActivityWatch server. Please ensure ActivityWatch is running on localhost:5600'
        );
      }
      if (error instanceof Error) {
        throw new ApiError(`Failed to fetch ${endpoint}: ${error.message}`);
      }
      throw new ApiError(`Unknown error occurred while fetching ${endpoint}`);
    }
  }

  async getBuckets(): Promise<AWBucket[]> {
    const buckets = await this.request<Record<string, AWBucket>>('/api/0/buckets/');
    return Object.values(buckets);
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.request<any>('/api/0/info');
      return true;
    } catch (error) {
      return false;
    }
  }

  async getEvents(bucketId: string, start: Date, end: Date): Promise<AWEvent[]> {
    const startStr = start.toISOString();
    const endStr = end.toISOString();
    return this.request<AWEvent[]>(
      `/api/0/buckets/${bucketId}/events?start=${startStr}&end=${endStr}&limit=-1`
    );
  }

  async getDayTimelineData(date: Date): Promise<{
    totalActiveSeconds: number;
    totalInactiveSeconds: number;
    events: Array<{
      start: Date;
      end: Date;
      duration: number;
      type: 'active' | 'inactive';
    }>;
  }> {
    try {
      const buckets = await this.getBuckets();
      const afkBucket = buckets.find(bucket => bucket.type === 'afkstatus');

      if (!afkBucket) {
        throw new Error('Required AFK bucket not found. Make sure ActivityWatch is running.');
      }

      // Set day boundaries
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      // Get AFK events for the day
      const afkEvents = await this.getEvents(afkBucket.id, dayStart, dayEnd);

      // Filter for active periods only
      const activeEvents = afkEvents.filter(event => event.data.status === 'not-afk');

      if (activeEvents.length === 0) {
        return {
          totalActiveSeconds: 0,
          totalInactiveSeconds: 0,
          events: []
        };
      }

      // Calculate total active time and collect active periods
      let totalActiveSeconds = 0;
      const activePeriods: Array<{ start: Date; end: Date; duration: number }> = [];

      activeEvents.forEach(event => {
        const eventStart = new Date(event.timestamp);
        const eventEnd = new Date(eventStart.getTime() + event.duration * 1000);
        
        // Skip zero-duration events
        if (event.duration <= 0) {
          return;
        }
        
        // Calculate the overlap duration with the day
        const overlapStart = eventStart > dayStart ? eventStart : dayStart;
        const overlapEnd = eventEnd < dayEnd ? eventEnd : dayEnd;
        
        if (overlapStart < overlapEnd) {
          const overlapDuration = (overlapEnd.getTime() - overlapStart.getTime()) / 1000;
          
          activePeriods.push({
            start: overlapStart,
            end: overlapEnd,
            duration: overlapDuration
          });
        }
      });

      // Sort active periods by start time
      activePeriods.sort((a, b) => a.start.getTime() - b.start.getTime());

      // Merge overlapping or adjacent active periods
      const mergedPeriods: Array<{ start: Date; end: Date; duration: number }> = [];
      
      for (const period of activePeriods) {
        if (mergedPeriods.length === 0) {
          mergedPeriods.push(period);
        } else {
          const lastPeriod = mergedPeriods[mergedPeriods.length - 1];
          
          // Check if current period overlaps or is adjacent to the last period (within 1 second)
          if (period.start.getTime() <= lastPeriod.end.getTime() + 1000) {
            // Merge periods
            const mergedEnd = period.end > lastPeriod.end ? period.end : lastPeriod.end;
            lastPeriod.end = mergedEnd;
            lastPeriod.duration = (mergedEnd.getTime() - lastPeriod.start.getTime()) / 1000;
          } else {
            mergedPeriods.push(period);
          }
        }
      }

      // Calculate total active seconds from merged periods
      totalActiveSeconds = mergedPeriods.reduce((sum, period) => sum + period.duration, 0);

      if (mergedPeriods.length === 0) {
        return {
          totalActiveSeconds: 0,
          totalInactiveSeconds: 0,
          events: []
        };
      }

      // Find first active time
      const firstActiveTime = mergedPeriods[0].start;

      // Create combined timeline with active and inactive periods
      const timelineEvents: Array<{
        start: Date;
        end: Date;
        duration: number;
        type: 'active' | 'inactive';
      }> = [];

      let totalInactiveSeconds = 0;
      let currentTime = firstActiveTime;

      for (const activePeriod of mergedPeriods) {
        // Add inactive period if there's a gap before this active period
        if (currentTime < activePeriod.start) {
          const inactiveDuration = (activePeriod.start.getTime() - currentTime.getTime()) / 1000;
          totalInactiveSeconds += inactiveDuration;
          
          timelineEvents.push({
            start: new Date(currentTime),
            end: new Date(activePeriod.start),
            duration: inactiveDuration,
            type: 'inactive'
          });
        }

        // Add the active period
        timelineEvents.push({
          start: activePeriod.start,
          end: activePeriod.end,
          duration: activePeriod.duration,
          type: 'active'
        });

        currentTime = activePeriod.end;
      }

      return {
        totalActiveSeconds,
        totalInactiveSeconds,
        events: timelineEvents
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new ApiError(error.message);
      }
      throw new ApiError('Failed to fetch day timeline data');
    }
  }

  async getWeeklyTimeData(start: Date, end: Date): Promise<WeeklyTimeData> {
    try {
      const buckets = await this.getBuckets();
      const afkBucket = buckets.find(bucket => bucket.type === 'afkstatus');
      const windowBucket = buckets.find(bucket => bucket.type === 'currentwindow');

      if (!afkBucket || !windowBucket) {
        throw new Error('Required buckets not found. Make sure ActivityWatch is running.');
      }

      // Calculate daily breakdown (Wednesday to Tuesday)
      const dailyBreakdown: { date: string; hours: number }[] = [];
      const currentDate = new Date(start);
      let totalHours = 0;
      
      // Ensure we start from Wednesday and go through Tuesday (7 days)
      for (let i = 0; i < 7; i++) {
        // Use the same method as timeline for consistency
        const dayData = await this.getDayTimelineData(currentDate);
        const dayHours = dayData.totalActiveSeconds / 3600;

        // Use local date string to avoid timezone issues
        const localDateString = currentDate.getFullYear() + '-' + 
          String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + 
          String(currentDate.getDate()).padStart(2, '0');

        dailyBreakdown.push({
          date: localDateString,
          hours: Math.round(dayHours * 100) / 100,
        });

        totalHours += dayHours;
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return {
        startDate: start,
        endDate: end,
        totalHours: Math.round(totalHours * 100) / 100,
        dailyBreakdown,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new ApiError(error.message);
      }
      throw new ApiError('Failed to fetch weekly time data');
    }
  }
}

class ApiError extends Error {
  public status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export default AwServerApi;
