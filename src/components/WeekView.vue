<template>
  <div class="week-view">
    <h2 class="week-title">Weekly Time Tracking</h2>
    <p class="week-subtitle">Wednesday to Tuesday work week</p>
    <div class="week-range">
      <span class="date-range">
        {{ formatDate(weekStart) }} - {{ formatDate(weekEnd) }}
      </span>
      <div class="week-navigation">
        <button @click="previousWeek" class="nav-btn">← Previous Week</button>
        <button @click="nextWeek" class="nav-btn">Next Week →</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

interface Props {
  weekStart: Date;
  weekEnd: Date;
}

interface Emits {
  (e: 'week-changed', start: Date, end: Date): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const previousWeek = () => {
  const newStart = new Date(props.weekStart);
  newStart.setDate(newStart.getDate() - 7);
  const newEnd = new Date(props.weekEnd);
  newEnd.setDate(newEnd.getDate() - 7);
  emit('week-changed', newStart, newEnd);
};

const nextWeek = () => {
  const newStart = new Date(props.weekStart);
  newStart.setDate(newStart.getDate() + 7);
  const newEnd = new Date(props.weekEnd);
  newEnd.setDate(newEnd.getDate() + 7);
  emit('week-changed', newStart, newEnd);
};
</script>

<style scoped>
.week-view {
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.week-title {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
  font-size: 1.5rem;
  font-weight: 600;
}

.week-subtitle {
  margin: 0 0 1rem 0;
  color: #7f8c8d;
  font-size: 0.9rem;
  font-style: italic;
}

.week-range {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.date-range {
  font-size: 1.1rem;
  font-weight: 500;
  color: #34495e;
}

.week-navigation {
  display: flex;
  gap: 0.5rem;
}

.nav-btn {
  padding: 0.5rem 1rem;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.nav-btn:hover {
  background: #2980b9;
}

.nav-btn:active {
  transform: translateY(1px);
}

@media (max-width: 600px) {
  .week-range {
    flex-direction: column;
    align-items: stretch;
  }
  
  .week-navigation {
    justify-content: center;
  }
}
</style>
