import { ref, computed, watch } from 'vue';
import type { DailyTargetsConfig, DistributionMode } from '../types';

const STORAGE_KEY = 'aw-daily-targets-config';

// Default workdays
const WORKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

class DailyTargetsManager {
  private config = ref<DailyTargetsConfig>({
    mode: 'custom' as DistributionMode,
    customTargets: {},
    weeklyTarget: 34.17, // 34h 10m in decimal
    lockedDays: {},
    lastModified: new Date()
  });

  constructor() {
    this.loadFromStorage();
    this.watchForChanges();
    
    // Ensure we always have custom targets initialized with equal distribution if empty
    if (Object.keys(this.config.value.customTargets).length === 0) {
      const hoursPerDay = this.config.value.weeklyTarget / WORKDAYS.length;
      const equalTargets = WORKDAYS.reduce((acc, day) => {
        acc[day] = hoursPerDay;
        return acc;
      }, {} as Record<string, number>);
      this.config.value.customTargets = equalTargets;
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedConfig = JSON.parse(stored);
        parsedConfig.lastModified = new Date(parsedConfig.lastModified);
        
        // Convert old "equal" mode to "custom" mode with equal distribution
        if (parsedConfig.mode === 'equal') {
          parsedConfig.mode = 'custom';
          if (!parsedConfig.customTargets || Object.keys(parsedConfig.customTargets).length === 0) {
            const hoursPerDay = parsedConfig.weeklyTarget / WORKDAYS.length;
            parsedConfig.customTargets = WORKDAYS.reduce((acc, day) => {
              acc[day] = hoursPerDay;
              return acc;
            }, {} as Record<string, number>);
          }
        }
        
        this.config.value = { ...this.config.value, ...parsedConfig };
      }
    } catch (error) {
      console.warn('Failed to load daily targets config from storage:', error);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config.value));
    } catch (error) {
      console.warn('Failed to save daily targets config to storage:', error);
    }
  }

  private watchForChanges() {
    watch(() => [this.config.value.mode, this.config.value.weeklyTarget, this.config.value.customTargets, this.config.value.lockedDays], () => {
      this.config.value.lastModified = new Date();
      this.saveToStorage();
    }, { deep: true });
  }

  // Computed daily targets based on current mode
  get dailyTargets() {
    return computed(() => {
      return this.getCustomDistribution();
    });
  }

  private getCustomDistribution(): Record<string, number> {
    // If no custom targets are set, initialize with equal distribution
    if (Object.keys(this.config.value.customTargets).length === 0) {
      const hoursPerDay = this.config.value.weeklyTarget / WORKDAYS.length;
      const equalTargets = WORKDAYS.reduce((acc, day) => {
        acc[day] = hoursPerDay;
        return acc;
      }, {} as Record<string, number>);
      this.config.value.customTargets = equalTargets;
    }
    return { ...this.config.value.customTargets };
  }

  // Smart redistribution when a single day is modified
  updateDayTarget(day: string, newHours: number) {
    if (!WORKDAYS.includes(day)) return;
    
    // Don't allow updating locked days
    if (this.isLocked(day)) return;

    const currentTargets = { ...this.dailyTargets.value };
    const oldHours = currentTargets[day] || 0;
    const difference = newHours - oldHours;
    
    // Filter out locked days from redistribution
    const lockedDays = this.config.value.lockedDays || {};
    const otherDays = WORKDAYS.filter(d => d !== day && !lockedDays[d]);

    // Update the modified day
    currentTargets[day] = newHours;

    // Redistribute the difference across other unlocked days
    if (otherDays.length > 0) {
      const adjustmentPerDay = -difference / otherDays.length;
      
      otherDays.forEach(otherDay => {
        const currentHours = currentTargets[otherDay] || 0;
        const newDayHours = Math.max(5/60, currentHours + adjustmentPerDay); // Minimum 5 minutes per day
        currentTargets[otherDay] = newDayHours;
      });
    }

    // Switch to custom mode and save
    this.config.value.mode = 'custom';
    this.config.value.customTargets = currentTargets;
  }

  // Auto-set targets based on logged time data
  setFromLoggedData(weeklyTimeData: any) {
    const currentTargets = { ...this.config.value.customTargets };
    const lockedDays = this.config.value.lockedDays || {};
    
    // Convert dates to day names and get logged hours
    if (weeklyTimeData?.dailyBreakdown) {
      weeklyTimeData.dailyBreakdown.forEach((dayData: {date: string, hours: number}) => {
        // Only process days that have actual logged time (more than 0 hours)
        if (dayData.hours <= 0) return;
        
        const date = new Date(dayData.date);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];
        
        // Only update workdays that aren't locked and have logged time
        if (WORKDAYS.includes(dayName) && !lockedDays[dayName]) {
          // Round to nearest 5-minute increment and ensure minimum
          const roundedHours = Math.max(5/60, Math.round(dayData.hours * 12) / 12);
          currentTargets[dayName] = roundedHours;
        }
      });
    }

    this.config.value.customTargets = currentTargets;
  }

  // Set distribution mode
  setMode(mode: DistributionMode) {
    // Since we only support 'custom' mode now, always ensure custom targets are initialized
    if (Object.keys(this.config.value.customTargets).length === 0) {
      // Initialize custom targets with equal distribution calculation
      const hoursPerDay = this.config.value.weeklyTarget / WORKDAYS.length;
      const equalTargets = WORKDAYS.reduce((acc, day) => {
        acc[day] = hoursPerDay;
        return acc;
      }, {} as Record<string, number>);
      
      this.config.value.customTargets = equalTargets;
    }
    this.config.value.mode = mode;
  }

  // Update weekly target and redistribute
  setWeeklyTarget(hours: number) {
    this.config.value.weeklyTarget = hours;
    
    // Keep existing distribution ratios in custom mode
    const currentTargets = { ...this.config.value.customTargets };
    const currentTotal = Object.values(currentTargets).reduce((sum, h) => sum + h, 0);
    
    if (currentTotal > 0) {
      const scaleFactor = hours / currentTotal;
      WORKDAYS.forEach(day => {
        if (currentTargets[day]) {
          currentTargets[day] *= scaleFactor;
        }
      });
      this.config.value.customTargets = currentTargets;
    }
  }

  // Get daily target for a specific date string
  getDailyTargetForDate(dateStr: string): number {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Convert to our day names
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    
    if (!WORKDAYS.includes(dayName)) {
      return 0; // No target for weekends
    }
    
    return this.dailyTargets.value[dayName] || 0;
  }

  // Getters
  get mode() {
    return computed(() => this.config.value.mode);
  }

  get weeklyTarget() {
    return computed(() => this.config.value.weeklyTarget);
  }

  get weeklyTotal() {
    return computed(() => {
      return Object.values(this.dailyTargets.value).reduce((sum, hours) => sum + hours, 0);
    });
  }

  get isWeeklyTargetMet() {
    return computed(() => {
      return Math.abs(this.weeklyTotal.value - this.config.value.weeklyTarget) < 0.01;
    });
  }

  // Preset distributions
  applyPreset(preset: 'equal' | 'frontLoaded' | 'backLoaded' | 'balanced') {
    const currentTargets = { ...this.config.value.customTargets };
    const lockedDays = this.config.value.lockedDays || {};
    
    // Calculate total of locked days
    let lockedTotal = 0;
    const unlockedDays: string[] = [];
    
    WORKDAYS.forEach(day => {
      if (lockedDays[day]) {
        lockedTotal += currentTargets[day] || 0;
      } else {
        unlockedDays.push(day);
      }
    });
    
    // If all days are locked, can't apply preset
    if (unlockedDays.length === 0) return;
    
    // Get preset pattern for unlocked days only
    let presetTargets: Record<string, number>;
    
    switch (preset) {
      case 'frontLoaded':
        presetTargets = {
          monday: 8,
          tuesday: 8, 
          wednesday: 7,
          thursday: 6,
          friday: 5.17
        };
        break;
      case 'backLoaded':
        presetTargets = {
          monday: 5.17,
          tuesday: 6,
          wednesday: 7,
          thursday: 8,
          friday: 8
        };
        break;
      case 'balanced':
        presetTargets = {
          monday: 7,
          tuesday: 7,
          wednesday: 6.17, // Lighter Wednesday
          thursday: 7,
          friday: 7
        };
        break;
      default: // equal
        // Create equal distribution inline
        const equalShare = this.config.value.weeklyTarget / WORKDAYS.length;
        presetTargets = WORKDAYS.reduce((acc, day) => {
          acc[day] = equalShare;
          return acc;
        }, {} as Record<string, number>);
        break;
    }

    // Calculate remaining target after accounting for locked days
    const remainingTarget = this.config.value.weeklyTarget - lockedTotal;
    
    // If remaining target is too small, set all unlocked days to minimum
    if (remainingTarget <= 0 || remainingTarget < unlockedDays.length * (5/60)) {
      unlockedDays.forEach(day => {
        currentTargets[day] = 5/60; // Minimum 5 minutes
      });
    } else {
      // Get preset total for unlocked days only
      const unlockedPresetTotal = unlockedDays.reduce((sum, day) => sum + (presetTargets[day] || 0), 0);
      
      if (unlockedPresetTotal > 0) {
        // Scale preset pattern to fit remaining target
        const scaleFactor = remainingTarget / unlockedPresetTotal;
        
        unlockedDays.forEach(day => {
          const scaledValue = (presetTargets[day] || 0) * scaleFactor;
          currentTargets[day] = Math.max(5/60, scaledValue); // Ensure minimum
        });
      } else {
        // Fallback: distribute equally among unlocked days
        const equalShare = remainingTarget / unlockedDays.length;
        unlockedDays.forEach(day => {
          currentTargets[day] = Math.max(5/60, equalShare);
        });
      }
    }

    this.config.value.mode = 'custom';
    this.config.value.customTargets = currentTargets;
  }

  // Lock/unlock functionality
  isLocked(day: string): boolean {
    return this.config.value.lockedDays?.[day] || false;
  }

  toggleLock(day: string) {
    if (!this.config.value.lockedDays) {
      this.config.value.lockedDays = {};
    }
    this.config.value.lockedDays[day] = !this.config.value.lockedDays[day];
  }

  get lockedDays() {
    return computed(() => this.config.value.lockedDays || {});
  }
}

// Create singleton instance
const dailyTargetsManager = new DailyTargetsManager();

export function useDailyTargets() {
  return {
    // Reactive properties
    dailyTargets: dailyTargetsManager.dailyTargets,
    mode: dailyTargetsManager.mode,
    weeklyTarget: dailyTargetsManager.weeklyTarget,
    weeklyTotal: dailyTargetsManager.weeklyTotal,
    isWeeklyTargetMet: dailyTargetsManager.isWeeklyTargetMet,
    lockedDays: dailyTargetsManager.lockedDays,
    
    // Methods
    updateDayTarget: (day: string, hours: number) => dailyTargetsManager.updateDayTarget(day, hours),
    setFromLoggedData: (weeklyTimeData: any) => dailyTargetsManager.setFromLoggedData(weeklyTimeData),
    setMode: (mode: DistributionMode) => dailyTargetsManager.setMode(mode),
    setWeeklyTarget: (hours: number) => dailyTargetsManager.setWeeklyTarget(hours),
    getDailyTargetForDate: (dateStr: string) => dailyTargetsManager.getDailyTargetForDate(dateStr),
    applyPreset: (preset: 'equal' | 'frontLoaded' | 'backLoaded' | 'balanced') => dailyTargetsManager.applyPreset(preset),
    isLocked: (day: string) => dailyTargetsManager.isLocked(day),
    toggleLock: (day: string) => dailyTargetsManager.toggleLock(day),
  };
}
