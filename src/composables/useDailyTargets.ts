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

  // Auto-set targets based on logged time data and distribute remaining hours
  setFromLoggedData(weeklyTimeData: any) {
    const currentTargets = { ...this.config.value.customTargets };
    const lockedDays = this.config.value.lockedDays || {};
    
    // Track logged hours and updated days, including locked days for total calculation
    let totalAccountedHours = 0;
    const updatedDays: string[] = [];
    const loggedHours: Record<string, number> = {};
    
    // Convert dates to day names and get logged hours
    if (weeklyTimeData?.dailyBreakdown) {
      weeklyTimeData.dailyBreakdown.forEach((dayData: {date: string, hours: number}) => {
        const date = new Date(dayData.date);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];
        
        // Track all workday logged hours, even if 0
        if (WORKDAYS.includes(dayName)) {
          loggedHours[dayName] = dayData.hours;
          
          if (lockedDays[dayName]) {
            // For locked days, include their current target in total accounted hours
            totalAccountedHours += currentTargets[dayName] || 0;
          } else if (dayData.hours > 0) {
            // Only update unlocked days that have actual logged time
            // Use exact logged hours, just ensure minimum of 5 minutes
            const exactHours = Math.max(5/60, dayData.hours);
            currentTargets[dayName] = exactHours;
            totalAccountedHours += exactHours;
            updatedDays.push(dayName);
          }
        }
      });
    }
    
    // Account for locked days that don't have logged data
    WORKDAYS.forEach(day => {
      if (lockedDays[day] && !(day in loggedHours)) {
        // This locked day has no data in the current week, include its current target
        totalAccountedHours += currentTargets[day] || 0;
      }
    });
    
    // Calculate remaining hours to distribute
    const remainingTarget = this.config.value.weeklyTarget - totalAccountedHours;
    
    // Get days that weren't updated (no logged time, not locked) and are unlocked
    const remainingDays = WORKDAYS.filter(day => 
      !updatedDays.includes(day) && !lockedDays[day]
    );
    
    // Distribute remaining hours among days without logged time and unlocked
    if (remainingDays.length > 0 && remainingTarget > 0) {
      const hoursPerRemainingDay = Math.max(5/60, remainingTarget / remainingDays.length);
      
      remainingDays.forEach(day => {
        currentTargets[day] = Math.round(hoursPerRemainingDay * 12) / 12; // Round to 5-minute increments
      });
    } else if (remainingDays.length > 0) {
      // If no remaining target, set to minimum
      remainingDays.forEach(day => {
        currentTargets[day] = 5/60; // Minimum 5 minutes
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

  // Apply equal distribution preset
  applyEqualPreset() {
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
    
    // Calculate remaining target after accounting for locked days
    const remainingTarget = this.config.value.weeklyTarget - lockedTotal;
    
    // If remaining target is too small, set all unlocked days to minimum
    if (remainingTarget <= 0 || remainingTarget < unlockedDays.length * (5/60)) {
      unlockedDays.forEach(day => {
        currentTargets[day] = 5/60; // Minimum 5 minutes
      });
    } else {
      // Distribute equally among unlocked days
      const equalShare = remainingTarget / unlockedDays.length;
      unlockedDays.forEach(day => {
        currentTargets[day] = Math.max(5/60, equalShare);
      });
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
    applyEqualPreset: () => dailyTargetsManager.applyEqualPreset(),
    isLocked: (day: string) => dailyTargetsManager.isLocked(day),
    toggleLock: (day: string) => dailyTargetsManager.toggleLock(day),
  };
}
