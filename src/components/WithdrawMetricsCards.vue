<script setup>
import { computed } from 'vue';
import { formatTime, formatAmount } from '../utils/csvParser';

const props = defineProps({
  metrics: {
    type: Object,
    default: () => ({})
  }
});

// 狀態分佈排序（按數量由高到低）
const sortedStatusDistribution = computed(() => {
  const dist = props.metrics.statusDistribution || {};
  return Object.entries(dist)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({ status, count }));
});

// 計算總筆數
const totalCount = computed(() => {
  return sortedStatusDistribution.value.reduce((sum, item) => sum + item.count, 0);
});
</script>

<template>
  <div class="metrics-container">
    <!-- 重要資訊 -->
    <div class="metrics-section">
      <div class="section-header">
        <h3 class="section-title">提現總覽</h3>
      </div>
      <div class="metrics-grid four-grid">
        <div class="metric-card">
          <div class="card-header">
            <span class="card-icon">📊</span>
            <span class="card-title">總提現筆數</span>
          </div>
          <div class="card-value" style="color: #0a84ff;">
            {{ (metrics.totalWithdrawCount || 0).toLocaleString() }}
            <span class="card-unit">筆</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="card-header">
            <span class="card-icon">💰</span>
            <span class="card-title">總提現金額</span>
          </div>
          <div class="card-value" style="color: #30d158;">
            {{ formatAmount(metrics.totalWithdrawAmount || 0) }}
            <span class="card-unit">元</span>
          </div>
        </div>

        <div class="metric-card">
          <div class="card-header">
            <span class="card-icon">⏱️</span>
            <span class="card-title">平均處理時間</span>
          </div>
          <div class="card-value" style="color: #0a84ff;">
            {{ formatTime(metrics.avgProcessingTime) }}
          </div>
        </div>

        <div class="metric-card">
          <div class="card-header">
            <span class="card-icon">📋</span>
            <span class="card-title">總記錄數</span>
          </div>
          <div class="card-value" style="color: #8e8e93;">
            {{ (metrics.totalRecords || 0).toLocaleString() }}
            <span class="card-unit">筆</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 狀態分佈 -->
    <div class="metrics-section">
      <div class="section-header">
        <h3 class="section-title">提現狀態分佈</h3>
      </div>
      <div class="status-grid">
        <div
          v-for="item in sortedStatusDistribution"
          :key="item.status"
          class="status-item"
        >
          <span class="status-label">{{ item.status }}</span>
          <div class="status-bar-container">
            <div
              class="status-bar"
              :style="{ width: (item.count / totalCount * 100) + '%' }"
            ></div>
          </div>
          <span class="status-count">{{ item.count.toLocaleString() }}</span>
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
  margin-bottom: 20px;
  background: #1c1c1e;
  border-radius: 16px;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.metrics-grid {
  display: grid;
  gap: 12px;
  padding: 0 16px 16px;
}

.four-grid {
  grid-template-columns: repeat(4, 1fr);
}

.metric-card {
  background: #2c2c2e;
  border-radius: 12px;
  padding: 16px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.card-icon {
  font-size: 16px;
}

.card-title {
  font-size: 13px;
  color: #8e8e93;
}

.card-value {
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.card-unit {
  font-size: 12px;
  font-weight: 400;
  color: #8e8e93;
}

/* 狀態分佈 */
.status-grid {
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-label {
  width: 200px;
  font-size: 13px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-bar-container {
  flex: 1;
  height: 20px;
  background: #2c2c2e;
  border-radius: 4px;
  overflow: hidden;
}

.status-bar {
  height: 100%;
  background: linear-gradient(90deg, #0a84ff, #5e5ce6);
  border-radius: 4px;
  transition: width 0.3s;
  min-width: 2px;
}

.status-count {
  width: 80px;
  text-align: right;
  font-size: 13px;
  color: #8e8e93;
  font-family: monospace;
}

@media (max-width: 1200px) {
  .four-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .four-grid {
    grid-template-columns: 1fr;
  }

  .status-label {
    width: 150px;
  }
}
</style>
