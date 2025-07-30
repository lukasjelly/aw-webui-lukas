import { ref, computed, watch } from 'vue';
import type { DailyTargetsConfig, DistributionMode } from '../types';

const STORAGE_KEY = 'aw-daily-targets-config';

// Default workdays
const WORKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

class DailyTargetsManager {
  private config = ref<DailyTargetsConfig>({
    mode: 'equal' as DistributionMode,
    customTargets: {},
    weeklyTarget: 34.17, // 34h 10m in decimal
    lockedDays: {},
    lastModified: new Date()
  });

  constructor() {
    this.loadFromStorage();
    this.watchForChanges();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedConfig = JSON.parse(stored);
        parsedConfig.lastModified = new Date(parsedConfig.lastModified);
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
      switch (this.config.value.mode) {
        case 'equal':
          return this.getEqualDistribution();
        case 'custom':
          return this.getCustomDistribution();
        default:
          return this.getEqualDistribution();
      }
    });
  }

  private getEqualDistribution(): Record<string, number> {
    const hoursPerDay = this.config.value.weeklyTarget / WORKDAYS.length;
    return WORKDAYS.reduce((acc, day) => {
      acc[day] = hoursPerDay;
      return acc;
    }, {} as Record<string, number>);
  }

  private getCustomDistribution(): Record<string, number> {
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

  // Auto-balance to exactly meet weekly target
  autoBalance() {
    // First, switch to custom mode if not already
    if (this.config.value.mode !== 'custom') {
      this.setMode('custom');
    }

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
    
    // If all days are locked, can't balance
    if (unlockedDays.length === 0) return;
    
    // Calculate target for unlocked days
    const remainingTarget = this.config.value.weeklyTarget - lockedTotal;
    
    // If remaining target is negative or too small, set all unlocked days to minimum
    if (remainingTarget <= 0 || remainingTarget < unlockedDays.length * (5/60)) {
      unlockedDays.forEach(day => {
        currentTargets[day] = 5/60; // Minimum 5 minutes
      });
    } else {
      // Get current total of unlocked days
      const currentUnlockedTotal = unlockedDays.reduce((sum, day) => sum + (currentTargets[day] || 0), 0);
      
      if (currentUnlockedTotal > 0) {
        // Scale proportionally
        const scaleFactor = remainingTarget / currentUnlockedTotal;
        unlockedDays.forEach(day => {
          const newValue = (currentTargets[day] || 0) * scaleFactor;
          currentTargets[day] = Math.max(5/60, newValue); // Ensure minimum
        });
      } else {
        // Distribute equally among unlocked days
        const equalShare = remainingTarget / unlockedDays.length;
        unlockedDays.forEach(day => {
          currentTargets[day] = Math.max(5/60, equalShare);
        });
      }
    }

    this.config.value.customTargets = currentTargets;
  }

  // Set distribution mode
  setMode(mode: DistributionMode) {
    if (mode === 'custom' && Object.keys(this.config.value.customTargets).length === 0) {
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
    
    // If in equal mode, targets will auto-update
    // If in custom mode, keep existing distribution ratios
    if (this.config.value.mode === 'custom') {
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
    let targets: Record<string, number>;
    
    switch (preset) {
      case 'frontLoaded':
        targets = {
          monday: 8,
          tuesday: 8, 
          wednesday: 7,
          thursday: 6,
          friday: 5.17
        };
        break;
      case 'backLoaded':
        targets = {
          monday: 5.17,
          tuesday: 6,
          wednesday: 7,
          thursday: 8,
          friday: 8
        };
        break;
      case 'balanced':
        targets = {
          monday: 7,
          tuesday: 7,
          wednesday: 6.17, // Lighter Wednesday
          thursday: 7,
          friday: 7
        };
        break;
      default: // equal
        targets = this.getEqualDistribution();
        break;
    }

    // Scale to match weekly target
    const presetTotal = Object.values(targets).reduce((sum, h) => sum + h, 0);
    const scaleFactor = this.config.value.weeklyTarget / presetTotal;
    
    WORKDAYS.forEach(day => {
      targets[day] *= scaleFactor;
    });

    this.config.value.mode = 'custom';
    this.config.value.customTargets = targets;
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
    autoBalance: () => dailyTargetsManager.autoBalance(),
    setMode: (mode: DistributionMode) => dailyTargetsManager.setMode(mode),
    setWeeklyTarget: (hours: number) => dailyTargetsManager.setWeeklyTarget(hours),
    getDailyTargetForDate: (dateStr: string) => dailyTargetsManager.getDailyTargetForDate(dateStr),
    applyPreset: (preset: 'equal' | 'frontLoaded' | 'backLoaded' | 'balanced') => dailyTargetsManager.applyPreset(preset),
    isLocked: (day: string) => dailyTargetsManager.isLocked(day),
    toggleLock: (day: string) => dailyTargetsManager.toggleLock(day),
  };
}
