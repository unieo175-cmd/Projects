<script setup>
import { computed } from 'vue';
import { formatTime, formatAmount } from '../utils/csvParser';

const props = defineProps({
  metrics: {
    type: Object,
    default: () => ({})
  }
});

// 第一區域：重要資訊
const importantCards = computed(() => [
  {
    title: '總申請筆數',
    value: (props.metrics.totalApplicationCount || 0).toLocaleString(),
    unit: `(成功率 ${(props.metrics.successRate || 0).toFixed(2)}%)`,
    color: '#0a84ff',
    icon: '📊'
  },
  {
    title: '總申請金額',
    value: formatAmount(props.metrics.totalApplicationAmount || 0),
    unit: '元',
    color: '#30d158',
    icon: '💰'
  },
  {
    title: '平均處理時間',
    value: formatTime(props.metrics.avgTimeSeconds),
    unit: '',
    color: '#0a84ff',
    icon: '⏱️'
  },
  {
    title: '無效申請',
    value: (props.metrics.invalidCount || 0).toLocaleString(),
    unit: `(${(props.metrics.invalidRatio || 0).toFixed(2)}%)`,
    color: '#ff453a',
    icon: '❌'
  },
  {
    title: '掉單筆數',
    value: (props.metrics.dropOrderCount || 0).toLocaleString(),
    unit: `(${(props.metrics.dropOrderRatio || 0).toFixed(2)}%)`,
    color: '#ff9f0a',
    icon: '⚠️'
  }
]);

// 第二區域：時間分佈
const timeCards = computed(() => [
  {
    title: '2分鐘內',
    value: (props.metrics.within2MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within2MinRatio || 0).toFixed(2)}%)`,
    color: '#30d158',
    icon: '⚡'
  },
  {
    title: '3-5分鐘',
    value: (props.metrics.within3to5MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within3to5MinRatio || 0).toFixed(2)}%)`,
    color: '#5e5ce6',
    icon: '🕐'
  },
  {
    title: '5-15分鐘',
    value: (props.metrics.within5to15MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within5to15MinRatio || 0).toFixed(2)}%)`,
    color: '#ff9f0a',
    icon: '🕑'
  },
  {
    title: '15-30分鐘',
    value: (props.metrics.within15to30MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.within15to30MinRatio || 0).toFixed(2)}%)`,
    color: '#ff9f0a',
    icon: '🕒'
  },
  {
    title: '30分鐘以上',
    value: (props.metrics.over30MinCount || 0).toLocaleString(),
    unit: `(${(props.metrics.over30MinRatio || 0).toFixed(2)}%)`,
    color: '#ff453a',
    icon: '🕓'
  }
]);
</script>

<template>
  <div class="metrics-container">
    <!-- 第一區域：重要資訊 -->
    <div class="metrics-section">
      <h3 class="section-title">重要資訊</h3>
      <div class="metrics-grid important-grid">
        <div
          v-for="card in importantCards"
          :key="card.title"
          class="metric-card"
        >
          <div class="card-header">
            <span class="card-icon">{{ card.icon }}</span>
            <span class="card-title">{{ card.title }}</span>
          </div>
          <div class="card-value" :style="{ color: card.color }">
            {{ card.value }}
            <span class="card-unit">{{ card.unit }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 第二區域：時間分佈 -->
    <div class="metrics-section">
      <h3 class="section-title">處理時間分佈</h3>
      <div class="metrics-grid time-grid">
        <div
          v-for="card in timeCards"
          :key="card.title"
          class="metric-card"
        >
          <div class="card-header">
            <span class="card-icon">{{ card.icon }}</span>
            <span class="card-title">{{ card.title }}</span>
          </div>
          <div class="card-value" :style="{ color: card.color }">
            {{ card.value }}
            <span class="card-unit">{{ card.unit }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metrics-container {
  margin-bottom: 24px;
}

.metrics-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 16px;
  padding-left: 4px;
}

.metrics-grid {
  display: grid;
  gap: 16px;
}

.important-grid {
  grid-template-columns: repeat(5, 1fr);
}

.time-grid {
  grid-template-columns: repeat(5, 1fr);
}

.metric-card {
  background: #1c1c1e;
  border-radius: 16px;
  padding: 20px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.metric-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.card-icon {
  font-size: 20px;
}

.card-title {
  font-size: 14px;
  color: #8e8e93;
}

.card-value {
  font-size: 26px;
  font-weight: 700;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.card-unit {
  font-size: 13px;
  font-weight: 400;
  color: #8e8e93;
}

@media (max-width: 1200px) {
  .important-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .time-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .important-grid,
  .time-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 500px) {
  .important-grid,
  .time-grid {
    grid-template-columns: 1fr;
  }

  .card-value {
    font-size: 22px;
  }
}
</style>
