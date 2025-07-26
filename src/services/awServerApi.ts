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

  async getWeeklyTimeData(start: Date, end: Date): Promise<WeeklyTimeData> {
    try {
      const buckets = await this.getBuckets();
      const afkBucket = buckets.find(bucket => bucket.type === 'afkstatus');
      const windowBucket = buckets.find(bucket => bucket.type === 'currentwindow');

      if (!afkBucket || !windowBucket) {
        throw new Error('Required buckets not found. Make sure ActivityWatch is running.');
      }

      // Get AFK events to filter out inactive time
      const afkEvents = await this.getEvents(afkBucket.id, start, end);
      const activeEvents = afkEvents.filter(event => event.data.status === 'not-afk');

      // Calculate total active time
      const totalSeconds = activeEvents.reduce((sum, event) => sum + event.duration, 0);
      const totalHours = totalSeconds / 3600;

      // Calculate daily breakdown (Wednesday to Tuesday)
      const dailyBreakdown: { date: string; hours: number }[] = [];
      const currentDate = new Date(start);
      
      // Ensure we start from Wednesday and go through Tuesday (7 days)
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const dayEvents = activeEvents.filter(event => {
          const eventDate = new Date(event.timestamp);
          const eventEnd = new Date(eventDate.getTime() + event.duration * 1000);
          
          // Check if event overlaps with this day
          return (eventDate <= dayEnd && eventEnd >= dayStart);
        });

        // Calculate duration for events that overlap with this day
        let daySeconds = 0;
        dayEvents.forEach(event => {
          const eventStart = new Date(event.timestamp);
          const eventEnd = new Date(eventStart.getTime() + event.duration * 1000);
          
          // Calculate the overlap duration
          const overlapStart = eventStart > dayStart ? eventStart : dayStart;
          const overlapEnd = eventEnd < dayEnd ? eventEnd : dayEnd;
          
          if (overlapStart < overlapEnd) {
            daySeconds += (overlapEnd.getTime() - overlapStart.getTime()) / 1000;
          }
        });

        const dayHours = daySeconds / 3600;

        // Use local date string to avoid timezone issues
        const localDateString = currentDate.getFullYear() + '-' + 
          String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + 
          String(currentDate.getDate()).padStart(2, '0');

        dailyBreakdown.push({
          date: localDateString,
          hours: Math.round(dayHours * 100) / 100,
        });

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
