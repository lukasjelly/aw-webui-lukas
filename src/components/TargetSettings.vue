<template>
  <div class="target-settings">
    <!-- Header -->
    <div class="settings-header">
      <h3>Daily Targets Configuration</h3>
      <div class="weekly-summary">
        <span :class="{ 'on-target': isWeeklyTargetMet }">
          Total: {{ formatHoursMinutes(weeklyTotal) }} / {{ formatHoursMinutes(weeklyTarget) }}
        </span>
      </div>
    </div>

    <!-- Weekly Target Input -->
    <div class="section">
      <div class="section-title">Weekly Target</div>
      <div class="time-stepper-group">
        <button @click="decreaseWeeklyTarget" class="stepper-btn" :disabled="weeklyTarget <= (5/60)">−</button>
        <div class="time-display">
          {{ formatHoursMinutes(weeklyTarget) }}
        </div>
        <button @click="increaseWeeklyTarget" class="stepper-btn">+</button>
      </div>
    </div>

    <!-- Distribution Mode -->
    <div class="section">
      <div class="section-title">Distribution Mode</div>
      <div class="mode-options">
        <label class="mode-option">
          <input 
            type="radio" 
            name="distribution-mode"
            value="equal" 
            :checked="mode === 'equal'"
            @change="handleModeChange"
          />
          <span>Equal Distribution</span>
          <small>Same hours every day</small>
        </label>
        
        <label class="mode-option">
          <input 
            type="radio" 
            name="distribution-mode"
            value="custom" 
            :checked="mode === 'custom'"
            @change="handleModeChange"
          />
          <span>Custom</span>
          <small>Individual daily targets</small>
        </label>
      </div>
    </div>

    <!-- Quick Presets (only show in custom mode) -->
    <div v-if="mode === 'custom'" class="section">
      <div class="section-title">Quick Presets</div>
      <div class="preset-buttons">
        <button @click="applyPreset('equal')" class="preset-btn">
          Equal
        </button>
        <button @click="applyPreset('frontLoaded')" class="preset-btn">
          Front-loaded
        </button>
        <button @click="applyPreset('backLoaded')" class="preset-btn">
          Back-loaded
        </button>
        <button @click="applyPreset('balanced')" class="preset-btn">
          Balanced
        </button>
      </div>
    </div>

    <!-- Weekly Distribution (only show in custom mode) -->
    <div v-if="mode === 'custom'" class="section">
      <div class="section-title">
        Weekly Distribution
        <button @click="autoBalance" class="balance-btn" title="Auto-balance to meet weekly target">
          ⚖️ Balance
        </button>
      </div>
      
      <!-- Interactive distribution chart -->
      <div class="interactive-distribution">
        <div class="distribution-bars">
          <div v-for="day in workdays" :key="day" class="interactive-bar">
            <div class="bar-label">{{ formatDayName(day) }}</div>
            <div class="bar-container" 
                 @wheel="handleWheel(day, $event)"
                 @click="handleBarClick(day, $event)"
                 :title="`${formatDayName(day)}: ${formatHoursMinutes(dailyTargets[day] || 0)} - Click or scroll to adjust`"
                 :class="{ 'locked': isLocked(day) }">
              <div 
                class="bar-fill" 
                :style="{ 
                  height: `${getBarHeight(dailyTargets[day] || 0)}%` 
                }"
              ></div>
              <div class="bar-overlay">
                <button @click.stop="increaseDayTarget(day)" 
                        class="bar-btn increase"
                        :disabled="isLocked(day)"
                        title="Increase by 5 minutes">+</button>
                <button @click.stop="decreaseDayTarget(day)" 
                        class="bar-btn decrease" 
                        :disabled="(dailyTargets[day] || 0) <= (5/60) || isLocked(day)"
                        title="Decrease by 5 minutes">−</button>
              </div>
              <button @click.stop="toggleLock(day)" 
                      class="lock-btn"
                      :title="isLocked(day) ? 'Unlock this day' : 'Lock this day'"
                      :class="{ 'locked': isLocked(day) }">
                {{ isLocked(day) ? '🔒' : '🔓' }}
              </button>
            </div>
            <div class="bar-value" :class="{ 'locked': isLocked(day) }">
              {{ formatHoursMinutes(dailyTargets[day] || 0) }}
              <span v-if="isLocked(day)" class="lock-indicator">🔒</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Info Section -->
    <div class="info-section">
      <div class="info-item">
        <strong>💡 Tips:</strong>
        <ul>
          <li>Targets apply to weekdays only (Wed-Tue work week)</li>
          <li>Changes auto-save to your browser</li>
          <li>Custom mode allows precise daily control</li>
          <li>Click the lock 🔓/🔒 to prevent a day from changing</li>
          <li>Balance button adjusts only unlocked days</li>
          <li>Use presets for common patterns</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDailyTargets } from '../composables/useDailyTargets';

const {
  dailyTargets,
  mode,
  weeklyTarget,
  weeklyTotal,
  isWeeklyTargetMet,
  updateDayTarget: updateDayTargetRaw,
  autoBalance,
  setMode,
  setWeeklyTarget,
  applyPreset,
  toggleLock,
  isLocked,
} = useDailyTargets();

const workdays = ['wednesday', 'thursday', 'friday', 'monday', 'tuesday'];

// Helper functions for time formatting
function formatHoursMinutes(decimalHours: number): string {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

function formatDayName(day: string): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

// Weekly target stepper functions (5-minute intervals = 5/60 hours = 0.0833... hours)
function increaseWeeklyTarget() {
  setWeeklyTarget(weeklyTarget.value + (5/60));
}

function decreaseWeeklyTarget() {
  const newValue = Math.max((5/60), weeklyTarget.value - (5/60));
  setWeeklyTarget(newValue);
}

// Daily target stepper functions (5-minute intervals = 5/60 hours = 0.0833... hours)
function increaseDayTarget(day: string) {
  const currentValue = dailyTargets.value[day] || 0;
  updateDayTargetRaw(day, currentValue + (5/60));
}

function decreaseDayTarget(day: string) {
  const currentValue = dailyTargets.value[day] || 0;
  const newValue = Math.max(0, currentValue - (5/60));
  updateDayTargetRaw(day, newValue);
}

function handleModeChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const newMode = target.value as 'equal' | 'custom';
  setMode(newMode);
}

// Handle mouse wheel for adjusting values
function handleWheel(day: string, event: WheelEvent) {
  if (isLocked(day)) return; // Don't adjust locked days
  
  event.preventDefault();
  const delta = Math.sign(event.deltaY); // 1 for down (decrease), -1 for up (increase)
  
  if (delta > 0) {
    decreaseDayTarget(day);
  } else {
    increaseDayTarget(day);
  }
}

// Handle bar clicks for direct manipulation
function handleBarClick(day: string, event: MouseEvent) {
  if (isLocked(day)) return; // Don't adjust locked days
  
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const clickY = event.clientY - rect.top;
  const percentage = 1 - (clickY / rect.height); // Inverted because 0% is at bottom
  
  // Calculate target based on click position (max 10 hours)
  const maxTarget = 10;
  const newTarget = Math.max(5/60, Math.round((percentage * maxTarget) * 12) / 12); // Round to 5-minute increments
  
  updateDayTargetRaw(day, newTarget);
}

// Calculate bar height for visualization
function getBarHeight(value: number): number {
  const maxTarget = Math.max(8, Math.max(...Object.values(dailyTargets.value)));
  return Math.min(100, (value / maxTarget) * 100);
}
</script>

<style scoped>
.target-settings {
  max-width: 600px;
  margin: 0 auto;
  padding: 1.5rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.settings-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.5rem;
}

.weekly-summary {
  font-weight: 600;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  background: #f8f9fa;
  color: #6c757d;
}

.weekly-summary.on-target {
  background: #d4edda;
  color: #155724;
}

.section {
  margin-bottom: 2rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #34495e;
  font-size: 1.1rem;
}

.weekly-input {
  padding: 0.5rem;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  font-size: 1rem;
  width: 80px;
  text-align: center;
}

.weekly-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.time-stepper-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  justify-content: center;
}

.stepper-btn {
  width: 40px;
  height: 40px;
  border: 2px solid #007bff;
  border-radius: 8px;
  background: white;
  color: #007bff;
  font-size: 1.25rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stepper-btn:hover:not(:disabled) {
  background: #007bff;
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.2);
}

.stepper-btn:disabled {
  border-color: #e9ecef;
  color: #6c757d;
  cursor: not-allowed;
  opacity: 0.5;
}

.time-display {
  min-width: 100px;
  text-align: center;
  font-weight: 600;
  font-size: 1.1rem;
  color: #2c3e50;
  padding: 0.5rem 1rem;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 6px;
}

.mode-options {
  display: grid;
  gap: 0.75rem;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-option:hover {
  border-color: #007bff;
  background: #f8f9fa;
}

.mode-option input[type="radio"]:checked + span {
  color: #007bff;
  font-weight: 600;
}

.mode-option span {
  font-weight: 500;
}

.mode-option small {
  color: #6c757d;
  margin-left: auto;
}

.preset-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
}

.preset-btn {
  padding: 0.75rem 1rem;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.preset-btn:hover {
  border-color: #007bff;
  background: #f8f9fa;
  color: #007bff;
}

.balance-btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid #28a745;
  border-radius: 4px;
  background: #28a745;
  color: white;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.balance-btn:hover {
  background: #218838;
  transform: translateY(-1px);
}

.daily-inputs {
  display: grid;
  gap: 1rem;
}

.day-input {
  display: grid;
  grid-template-columns: 100px 1fr;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  background: #f8f9fa;
}

.day-label {
  font-weight: 500;
  color: #495057;
}

.distribution-preview {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.preview-title {
  font-weight: 600;
  margin-bottom: 1rem;
  text-align: center;
  color: #495057;
}

.preview-bars {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 0.5rem;
  height: 120px;
}

.preview-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.bar-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6c757d;
  text-transform: uppercase;
}

.bar-container {
  width: 100%;
  height: 80px;
  background: #e9ecef;
  border-radius: 4px 4px 0 0;
  display: flex;
  align-items: end;
  position: relative;
}

.bar-fill {
  width: 100%;
  background: linear-gradient(to top, #007bff, #66b3ff);
  border-radius: 4px 4px 0 0;
  min-height: 4px;
}

.bar-value {
  font-size: 0.75rem;
  font-weight: 600;
  color: #495057;
}

.info-section {
  margin-top: 2rem;
  padding: 1rem;
  background: #e3f2fd;
  border-radius: 8px;
  border-left: 4px solid #2196f3;
}

.info-item strong {
  color: #1976d2;
  display: block;
  margin-bottom: 0.5rem;
}

.info-item ul {
  margin: 0;
  padding-left: 1.25rem;
}

.info-item li {
  margin-bottom: 0.25rem;
  color: #424242;
  font-size: 0.9rem;
}

/* Responsive design */
@media (max-width: 768px) {
  .target-settings {
    padding: 1rem;
    margin: 0.5rem;
  }
  
  .settings-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .day-input {
    grid-template-columns: 1fr;
    gap: 0.5rem;
    text-align: center;
  }

  .time-stepper-group {
    justify-content: center;
  }
  
  .preset-buttons {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .preview-bars {
    height: 100px;
  }
}

/* Interactive Distribution Chart */
.interactive-distribution {
  margin-top: 1rem;
}

.distribution-bars {
  display: flex;
  gap: 1rem;
  align-items: end;
  height: 200px;
  margin: 1rem 0;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.interactive-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.interactive-bar .bar-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #495057;
  margin-bottom: 0.5rem;
}

.interactive-bar .bar-container {
  position: relative;
  width: 40px;
  height: 140px;
  background: #e9ecef;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.interactive-bar .bar-container.locked {
  background: #f8f9fa;
  border-color: #dc3545;
  cursor: not-allowed;
}

.interactive-bar .bar-container:hover:not(.locked) {
  border-color: #007bff;
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.2);
}

.interactive-bar .bar-fill {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, #28a745, #20c997);
  border-radius: 2px;
  transition: height 0.3s ease;
  min-height: 2px;
}

.interactive-bar .bar-container.locked .bar-fill {
  background: linear-gradient(to top, #dc3545, #fd7e14);
}

.lock-btn {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 20px;
  height: 20px;
  border: 1px solid #6c757d;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  color: #6c757d;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 10;
}

.lock-btn:hover {
  background: white;
  border-color: #495057;
  transform: scale(1.1);
}

.lock-btn.locked {
  background: #dc3545;
  border-color: #dc3545;
  color: white;
}

.bar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.interactive-bar .bar-container:hover .bar-overlay {
  opacity: 1;
}

.bar-btn {
  background: rgba(0, 123, 255, 0.9);
  color: white;
  border: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 2px auto;
  transition: all 0.2s ease;
}

.bar-btn:hover {
  background: #0056b3;
  transform: scale(1.1);
}

.bar-btn:disabled {
  background: rgba(108, 117, 125, 0.5);
  cursor: not-allowed;
  transform: none;
}

.bar-btn.increase {
  margin-top: 2px;
}

.bar-btn.decrease {
  margin-bottom: 2px;
}

.interactive-bar .bar-value {
  font-size: 0.75rem;
  color: #6c757d;
  margin-top: 0.5rem;
  text-align: center;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.interactive-bar .bar-value.locked {
  color: #dc3545;
  font-weight: 600;
}

.lock-indicator {
  font-size: 0.6rem;
}
</style>
