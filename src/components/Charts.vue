<script setup>
import { computed } from 'vue';

const props = defineProps({
  records: {
    type: Array,
    default: () => []
  }
});

// Calculate status distribution
const statusDistribution = computed(() => {
  const dist = {
    success: 0,
    invalid: 0,
    budan: 0,
    other: 0
  };

  props.records.forEach(r => {
    if (r.isSuccess && !r.isBuDan) dist.success++;
    else if (r.isInvalid) dist.invalid++;
    else if (r.isBuDan) dist.budan++;
    else dist.other++;
  });

  const total = props.records.length || 1;

  return [
    { label: '成功', value: dist.success, percent: (dist.success / total * 100).toFixed(1), color: '#30d158' },
    { label: '未充值', value: dist.invalid, percent: (dist.invalid / total * 100).toFixed(1), color: '#ff453a' },
    { label: '補單', value: dist.budan, percent: (dist.budan / total * 100).toFixed(1), color: '#ff9f0a' },
    { label: '其他', value: dist.other, percent: (dist.other / total * 100).toFixed(1), color: '#8e8e93' }
  ].filter(d => d.value > 0);
});

// Calculate amount distribution by bank
const bankDistribution = computed(() => {
  const bankMap = new Map();

  props.records.forEach(r => {
    if (r.receivedAmount > 0 && r.bankName) {
      const current = bankMap.get(r.bankName) || 0;
      bankMap.set(r.bankName, current + r.receivedAmount);
    }
  });

  return Array.from(bankMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, amount]) => ({ name, amount }));
});

// Calculate hourly distribution
const hourlyDistribution = computed(() => {
  const hours = new Array(24).fill(0);

  props.records.forEach(r => {
    if (r.requestTime && r.receivedAmount > 0) {
      const match = r.requestTime.match(/(\d{2}):\d{2}:\d{2}/);
      if (match) {
        const hour = parseInt(match[1]);
        hours[hour]++;
      }
    }
  });

  const max = Math.max(...hours) || 1;
  return hours.map((count, hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    count,
    percent: (count / max * 100)
  }));
});

const maxBankAmount = computed(() => {
  if (bankDistribution.value.length === 0) return 1;
  return Math.max(...bankDistribution.value.map(b => b.amount));
});
</script>

<template>
  <div class="charts-container">
    <!-- Status Distribution -->
    <div class="chart-card">
      <h3>狀態分佈</h3>
      <div class="donut-chart">
        <svg viewBox="0 0 100 100" class="donut">
          <circle
            v-for="(item, index) in statusDistribution"
            :key="item.label"
            cx="50"
            cy="50"
            r="40"
            fill="none"
            :stroke="item.color"
            stroke-width="12"
            :stroke-dasharray="`${item.percent * 2.51} ${251 - item.percent * 2.51}`"
            :stroke-dashoffset="statusDistribution.slice(0, index).reduce((acc, d) => acc - d.percent * 2.51, 62.75)"
            class="donut-segment"
          />
        </svg>
        <div class="donut-center">
          <span class="donut-total">{{ records.length.toLocaleString() }}</span>
          <span class="donut-label">總數</span>
        </div>
      </div>
      <div class="legend">
        <div v-for="item in statusDistribution" :key="item.label" class="legend-item">
          <span class="legend-dot" :style="{ background: item.color }"></span>
          <span class="legend-label">{{ item.label }}</span>
          <span class="legend-value">{{ item.value.toLocaleString() }} ({{ item.percent }}%)</span>
        </div>
      </div>
    </div>

    <!-- Bank Distribution -->
    <div class="chart-card">
      <h3>銀行金額分佈 (Top 8)</h3>
      <div class="bar-chart">
        <div v-for="bank in bankDistribution" :key="bank.name" class="bar-row">
          <span class="bar-label">{{ bank.name }}</span>
          <div class="bar-container">
            <div
              class="bar-fill"
              :style="{ width: (bank.amount / maxBankAmount * 100) + '%' }"
            ></div>
          </div>
          <span class="bar-value">{{ (bank.amount / 10000).toFixed(1) }}萬</span>
        </div>
      </div>
    </div>

    <!-- Hourly Distribution -->
    <div class="chart-card wide">
      <h3>24小時交易分佈</h3>
      <div class="hourly-chart">
        <div v-for="item in hourlyDistribution" :key="item.hour" class="hour-bar">
          <div class="hour-fill" :style="{ height: item.percent + '%' }"></div>
          <span class="hour-label">{{ item.hour.split(':')[0] }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.charts-container {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.chart-card {
  background: #1c1c1e;
  border-radius: 16px;
  padding: 20px;
}

.chart-card.wide {
  grid-column: span 2;
}

.chart-card h3 {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

/* Donut Chart */
.donut-chart {
  position: relative;
  width: 160px;
  height: 160px;
  margin: 0 auto 16px;
}

.donut {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.donut-segment {
  transition: stroke-dasharray 0.3s;
}

.donut-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.donut-total {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}

.donut-label {
  display: block;
  font-size: 12px;
  color: #8e8e93;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-label {
  color: #fff;
  font-size: 14px;
  flex: 1;
}

.legend-value {
  color: #8e8e93;
  font-size: 14px;
  font-family: monospace;
}

/* Bar Chart */
.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-label {
  width: 80px;
  font-size: 12px;
  color: #8e8e93;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-container {
  flex: 1;
  height: 20px;
  background: #2c2c2e;
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #0a84ff, #5e5ce6);
  border-radius: 4px;
  transition: width 0.3s;
}

.bar-value {
  width: 60px;
  text-align: right;
  font-size: 12px;
  color: #fff;
  font-family: monospace;
}

/* Hourly Chart */
.hourly-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 120px;
  gap: 4px;
}

.hour-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.hour-fill {
  width: 100%;
  background: linear-gradient(180deg, #0a84ff, #5e5ce6);
  border-radius: 2px 2px 0 0;
  margin-top: auto;
  transition: height 0.3s;
  min-height: 2px;
}

.hour-label {
  font-size: 10px;
  color: #8e8e93;
  margin-top: 8px;
}

@media (max-width: 900px) {
  .charts-container {
    grid-template-columns: 1fr;
  }

  .chart-card.wide {
    grid-column: span 1;
  }
}
</style>
