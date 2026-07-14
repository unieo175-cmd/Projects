<script setup>
import { ref, computed, watch } from 'vue';
import { formatAmountInteger } from '../utils/csvParser';
import MetricsAllTab from './MetricsAllTab.vue';
import MetricsBankCardTab from './MetricsBankCardTab.vue';
import MetricsAlipayTab from './MetricsAlipayTab.vue';
import MetricsWechatTab from './MetricsWechatTab.vue';

const props = defineProps({
  metrics: {
    type: Object,
    default: () => ({})
  },
  dateRange: {
    type: Object,
    default: () => ({ dateFrom: '', dateTo: '' })
  },
  dataDate: {
    type: String,
    default: ''
  },
  showFormula: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['channelChange']);

// 渠道切换
const activeChannel = ref('all'); // 'all', 'bankCard', 'alipay', 'wechat'

// 当渠道改变时通知父组件
watch(activeChannel, (newChannel) => {
  emit('channelChange', newChannel);
});

// 金额区间列表
const amountRanges = [100, 200, 300, 500, 1000, 1500, 2000, 3000, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 20000, 30000];

// 从 localStorage 读取骗分统计数据
const fraudStats = computed(() => {
  const defaultStats = {
    bankCard: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, noReceiptCount: 0, fraudBlacklistCount: 0, cardVerifyCount: 0 },
    alipay: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, noReceiptCount: 0, fraudBlacklistCount: 0, cardVerifyCount: 0 },
    wechat: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, noReceiptCount: 0 }
  };

  try {
    const stored = localStorage.getItem('fraudRecords');
    if (!stored) {
      return defaultStats;
    }

    const records = JSON.parse(stored);
    if (!Array.isArray(records)) {
      return defaultStats;
    }

    // 如果没有选择日期范围，使用 dataDate 作为默认（单日）
    let dateFrom = props.dateRange?.dateFrom || '';
    let dateTo = props.dateRange?.dateTo || '';

    // 如果两个日期都是空的，使用 dataDate 作为单日筛选
    if (!dateFrom && !dateTo && props.dataDate) {
      dateFrom = props.dataDate;
      dateTo = props.dataDate;
    }

    // 如果只有开始日期没有结束日期，视为单日筛选
    if (dateFrom && !dateTo) {
      dateTo = dateFrom;
    }

    // 过滤符合日期范围的记录
    let filteredRecords = records;
    if (dateFrom || dateTo) {
      filteredRecords = records.filter(r => {
        if (dateFrom && r.date < dateFrom) return false;
        if (dateTo && r.date > dateTo) return false;
        return true;
      });
    }

  // 初始化结果
  const result = {
    bankCard: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, noReceiptCount: 0, fraudBlacklistCount: 0, cardVerifyCount: 0 },
    alipay: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, noReceiptCount: 0, fraudBlacklistCount: 0, cardVerifyCount: 0 },
    wechat: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, noReceiptCount: 0 }
  };

  // 加总所有符合条件的记录
  filteredRecords.forEach(r => {
    // 银行卡
    result.bankCard.manualCount += parseFloat(r.bankCardManualCount) || 0;
    result.bankCard.manualAmount += parseFloat(r.bankCardManualAmount) || 0;
    result.bankCard.creditCount += parseFloat(r.bankCardCreditCount) || 0;
    result.bankCard.creditAmount += parseFloat(r.bankCardCreditAmount) || 0;
    result.bankCard.noReceiptCount += parseFloat(r.bankCardNoReceiptCount) || 0;
    result.bankCard.fraudBlacklistCount += parseFloat(r.bankCardFraudBlacklistCount) || 0;
    result.bankCard.cardVerifyCount += parseFloat(r.bankCardCardVerifyCount) || 0;

    // 支付宝
    result.alipay.manualCount += parseFloat(r.alipayManualCount) || 0;
    result.alipay.manualAmount += parseFloat(r.alipayManualAmount) || 0;
    result.alipay.creditCount += parseFloat(r.alipayCreditCount) || 0;
    result.alipay.creditAmount += parseFloat(r.alipayCreditAmount) || 0;
    result.alipay.noReceiptCount += parseFloat(r.alipayNoReceiptCount) || 0;
    result.alipay.fraudBlacklistCount += parseFloat(r.alipayFraudBlacklistCount) || 0;
    result.alipay.cardVerifyCount += parseFloat(r.alipayCardVerifyCount) || 0;

    // 微信
    result.wechat.manualCount += parseFloat(r.wechatManualCount) || 0;
    result.wechat.manualAmount += parseFloat(r.wechatManualAmount) || 0;
    result.wechat.creditCount += parseFloat(r.wechatCreditCount) || 0;
    result.wechat.creditAmount += parseFloat(r.wechatCreditAmount) || 0;
    result.wechat.noReceiptCount += parseFloat(r.wechatNoReceiptCount) || 0;
  });

    return result;
  } catch (e) {
    console.error('读取骗分统计数据失败:', e);
    return defaultStats;
  }
});

// 第一区域：重要信息
// 公式：
// - 总申请笔数 = 所有充值笔数
// - 成功率 = 充值成功笔数 (AP > 0) / 总申请笔数
// - 总申请金额 = 充值成功笔数金额加总
// - 平均时间 = 充值成功笔数的 (通知时间 - 建立时间) 平均
// - 掉单笔数 = 充值成功 (AP > 0) 且状态包含「补」
const generalCards = computed(() => [
  {
    title: '总充值金额',
    value: formatAmountInteger(props.metrics.totalApplicationAmount || 0),
    unit: '元',
    color: '#30d158',
    unitColor: '#30d158',
    icon: '💰'
  },
  {
    title: '實際充值成功率',
    value: `${(props.metrics.overallSuccessRate || 0).toFixed(2)}%`,
    successCount: (props.metrics.successfulCount || 0).toLocaleString(),
    totalCount: (props.metrics.totalApplicationCount || 0).toLocaleString(),
    color: '#0a84ff',
    successColor: '#30d158',
    icon: '📈'
  }
]);

// 是否符合日交易分析顯示條件（span >= 2 日）
const isMultiDay = computed(() => {
  const { dateFrom, dateTo } = props.dateRange;
  if (!dateFrom || !dateTo || dateFrom === dateTo) return false;
  const span = Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000);
  return span >= 2;
});

// 跨日天數
const daySpan = computed(() => {
  const { dateFrom, dateTo } = props.dateRange;
  if (!dateFrom || !dateTo) return 0;
  return Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000);
});

// 圖表模式：h4 = 4小時刻度，daily = 每日刻度，daily2 = 每2日刻度
const chartMode = computed(() => {
  const span = daySpan.value;
  if (span <= 3) return 'h4';
  if (span <= 15) return 'daily';
  return 'daily2';
});

// X 軸刻度規則說明
const xAxisRuleText = computed(() => {
  switch (chartMode.value) {
    case 'h4': return 'X 軸：時間，每 4 小時一刻度';
    case 'daily': return 'X 軸：日期，每 1 日一刻度';
    case 'daily2': return 'X 軸：日期，每 2 日一刻度';
  }
});

// 圖表資料（依模式聚合）
const chartData = computed(() => {
  const series = props.metrics.hourlySeries;
  if (!series || series.length === 0) return [];
  const mode = chartMode.value;

  let slots = [];
  if (mode === 'h4') {
    const slotMap = {};
    series.forEach(({ date, hour, count, amount }) => {
      const slotHour = Math.floor(hour / 4) * 4;
      const key = `${date}_${slotHour}`;
      if (!slotMap[key]) slotMap[key] = { date, slotHour, count: 0, amount: 0 };
      slotMap[key].count += count;
      slotMap[key].amount += amount;
    });
    slots = Object.entries(slotMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, d]) => {
        const mm = d.date.slice(5, 7);
        const dd = d.date.slice(8, 10);
        const hh = d.slotHour.toString().padStart(2, '0');
        return { label: `${mm}/${dd} ${hh}:00`, showLabel: true, count: d.count, amount: d.amount };
      });
  } else {
    const dayMap = {};
    series.forEach(({ date, count, amount }) => {
      if (!dayMap[date]) dayMap[date] = { count: 0, amount: 0 };
      dayMap[date].count += count;
      dayMap[date].amount += amount;
    });
    slots = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d], index) => ({
        label: date.slice(5).replace('-', '/'),
        showLabel: mode === 'daily' || index % 2 === 0,
        count: d.count,
        amount: d.amount
      }));
  }

  const maxC = Math.max(...slots.map(s => s.count), 1);
  const maxA = Math.max(...slots.map(s => s.amount), 1);
  return slots.map(s => ({
    ...s,
    countPercent: (s.count / maxC) * 100,
    amountPercent: (s.amount / maxA) * 100
  }));
});

// 最大金額（用於左 Y 軸標籤）
const maxAmount = computed(() => Math.max(...chartData.value.map(d => d.amount), 1));

// 最大筆數（用於右 Y 軸標籤）
const maxCount = computed(() => Math.max(...chartData.value.map(d => d.count), 1));

// 折線上的數據點
const amountLinePoints = computed(() => chartData.value.map(item => ({ percent: item.amountPercent, amount: item.amount })));

// 折線 polyline 點座標
const amountLinePolylinePoints = computed(() => {
  const data = chartData.value;
  if (!data || data.length === 0) return '';
  return data.map((item, index) => {
    const x = (index + 0.5) * 10;
    const y = 100 - item.amountPercent;
    return `${x},${y}`;
  }).join(' ');
});
</script>

<template>
  <div class="metrics-container">
    <!-- 渠道切换 -->
    <div class="channel-tabs">
      <button
        class="channel-tab"
        :class="{ active: activeChannel === 'all' }"
        @click="activeChannel = 'all'"
      >
        全部
      </button>
      <button
        class="channel-tab"
        :class="{ active: activeChannel === 'bankCard' }"
        @click="activeChannel = 'bankCard'"
      >
        极速(银行卡)
      </button>
      <button
        class="channel-tab"
        :class="{ active: activeChannel === 'alipay' }"
        @click="activeChannel = 'alipay'"
      >
        极速(支付宝)
      </button>
      <button
        class="channel-tab"
        :class="{ active: activeChannel === 'wechat' }"
        @click="activeChannel = 'wechat'"
      >
        极速(微信)
      </button>
    </div>

    <MetricsAllTab
      v-if="activeChannel === 'all'"
      :metrics="metrics"
      :show-formula="showFormula"
      :general-cards="generalCards"
      :is-multi-day="isMultiDay"
      :x-axis-rule-text="xAxisRuleText"
      :chart-data="chartData"
      :max-amount="maxAmount"
      :max-count="maxCount"
      :amount-line-points="amountLinePoints"
      :amount-line-polyline-points="amountLinePolylinePoints"
    />
    <MetricsBankCardTab
      v-else-if="activeChannel === 'bankCard'"
      :metrics="metrics"
      :show-formula="showFormula"
      :fraud-stats="fraudStats"
      :amount-ranges="amountRanges"
    />
    <MetricsAlipayTab
      v-else-if="activeChannel === 'alipay'"
      :metrics="metrics"
      :show-formula="showFormula"
      :fraud-stats="fraudStats"
      :amount-ranges="amountRanges"
    />
    <MetricsWechatTab
      v-else-if="activeChannel === 'wechat'"
      :metrics="metrics"
      :show-formula="showFormula"
      :fraud-stats="fraudStats"
      :amount-ranges="amountRanges"
    />
  </div>
</template>

<style>
.metrics-container {
  margin-bottom: 20px;
}

/* 渠道切换按钮 */
.channel-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  background: #fff;
  padding: 6px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.channel-tab {
  flex: 1;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: #666;
  font-size: 14px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.channel-tab:hover {
  color: #333;
  background: #f5f5f5;
}

.channel-tab.active {
  background: #4a4a9e;
  color: #fff;
}

.section-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.section-row > .metrics-section {
  flex: 1;
  margin-bottom: 0;
}

.metrics-section-placeholder {
  flex: 1;
}

.metrics-section {
  margin-bottom: 16px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
  border-bottom: 1px solid #f0f0f0;
}

.section-header:hover {
  background: #fafafa;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.metrics-container .toggle-icon {
  color: #999;
  font-size: 12px;
}

.section-value {
  font-size: 15px;
  font-weight: 600;
  color: #4a4a9e;
  flex: 1;
  text-align: right;
  margin-right: 12px;
}

/* c2c 区域样式 */
.c2c-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 20px;
}

.metrics-grid {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.four-grid {
  grid-template-columns: repeat(4, 1fr);
}

.five-grid {
  grid-template-columns: repeat(5, 1fr);
}

.six-grid {
  grid-template-columns: repeat(6, 1fr);
}

.chart-axis-rule {
  font-size: 11px;
  color: #aaa;
  margin: 2px 0 0;
  font-weight: normal;
}

.tooltip-label {
  color: #fff;
  font-weight: 600;
  margin-bottom: 4px;
  font-size: 10px;
}

/* 日交易分析樣式 */
.hourly-distribution {
  padding: 16px;
}

.chart-legend {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  justify-content: center;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
}

.legend-color {
  width: 14px;
  height: 14px;
  border-radius: 2px;
}

.legend-color.amount-color {
  background: linear-gradient(180deg, #4ecdc4 0%, #44a08d 100%);
}

.legend-color.count-bar-color {
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
}

.legend-line {
  width: 20px;
  height: 2px;
  border-radius: 1px;
  position: relative;
}

.legend-line.amount-line {
  background: #ff9500;
}

.legend-line.amount-line::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ff9500;
  border: none;
}

.hourly-chart-wrapper {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 10px;
  color: #888;
  padding: 0 0 30px;
  min-width: 50px;
}

.y-axis-left {
  text-align: right;
  color: #44a08d;
}

.y-axis-right {
  text-align: left;
  color: #764ba2;
}

.hourly-chart-container {
  position: relative;
  height: 200px;
  flex: 1;
  padding-bottom: 30px;
}

.grid-lines {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.grid-line {
  width: 100%;
  height: 0;
  border-top: 1px dashed #e0e0e0;
}

.amount-line-svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  pointer-events: none;
  overflow: visible;
}

.amount-line {
  fill: none;
  stroke: #ff9500;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.amount-point {
  fill: #ff9500;
  stroke: none;
}

.hourly-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: calc(100% - 30px);
  border-bottom: 1px solid #e8e8e8;
  gap: 2px;
  position: relative;
  z-index: 1;
  overflow: visible;
}

.hour-bar-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  position: relative;
  cursor: pointer;
}

.hour-bar-group:hover .hour-tooltip {
  opacity: 1;
  visibility: visible;
}

.bar-pair {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 1px;
  height: 100%;
  width: 100%;
  margin-top: auto;
}

.hour-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  background: rgba(0, 0, 0, 0.9);
  color: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  z-index: 20;
  text-align: left;
}

.tooltip-amount {
  color: #4ecdc4;
  font-weight: 600;
}

.tooltip-count {
  color: #667eea;
  margin-top: 4px;
}

.bar-amount {
  width: 45%;
  max-width: 8px;
  background: linear-gradient(180deg, #4ecdc4 0%, #44a08d 100%);
  border-radius: 2px 2px 0 0;
  min-height: 2px;
  transition: height 0.3s ease, background 0.2s ease;
}

.bar-count {
  width: 45%;
  max-width: 8px;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  border-radius: 2px 2px 0 0;
  min-height: 2px;
  transition: height 0.3s ease, background 0.2s ease;
}

.hour-bar-group:hover .bar-amount {
  background: linear-gradient(180deg, #5ee7df 0%, #4ecdc4 100%);
}

.hour-bar-group:hover .bar-count {
  background: linear-gradient(180deg, #7c8ff8 0%, #8b5fc0 100%);
}

.hour-label {
  position: absolute;
  bottom: -24px;
  font-size: 9px;
  color: #888;
}

.x-axis-label {
  text-align: center;
  font-size: 11px;
  color: #888;
  margin-top: 8px;
}

.chart-formula {
  font-size: 12px;
  color: #888;
  margin-top: 8px;
}

.metric-card {
  background: #f8f9fa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 14px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.card-icon {
  font-size: 14px;
}

.card-title {
  font-size: 12px;
  color: #666;
}

.card-value {
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.card-unit {
  font-size: 11px;
  font-weight: 400;
  color: #999;
}

/* 极速区域样式 */
.jisu-content {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 16px;
}

.jisu-block {
  background: #f8f9fa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 14px;
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e8e8e8;
}

.block-header.clickable {
  cursor: pointer;
  transition: background 0.2s;
  margin: -14px -14px 12px -14px;
  padding: 14px;
  border-radius: 8px 8px 0 0;
  border-bottom: 1px solid #e8e8e8;
}

.block-header.clickable:hover {
  background: #f0f0f0;
}

.toggle-arrow {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}

.amount-list {
  max-height: 300px;
  overflow-y: auto;
}

.scrollable-list {
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
  background: #f9f9fb;
  border-radius: 6px;
  border: 1px solid #e8e8f0;
}

.scrollable-list::-webkit-scrollbar {
  width: 6px;
}

.scrollable-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.scrollable-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.scrollable-list::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

.block-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.block-value {
  font-size: 14px;
  font-weight: 600;
  color: #4a4a9e;
}

.block-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.block-divider {
  border-top: 1px dashed #d9d9d9;
  margin: 12px 0;
}

.detail-sub {
  padding-left: 16px;
  font-size: 0.9em;
  color: #666;
}

.detail-sub-header {
  font-weight: 600;
  margin-top: 4px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-divider {
  height: 1px;
  background: #e8e8e8;
  margin: 8px 0;
}

.detail-label {
  font-size: 13px;
  color: #666;
}

.detail-value {
  font-size: 13px;
  color: #333;
  font-family: monospace;
}

.detail-item.sub-item {
  padding-left: 16px;
}

.detail-item.sub-item .detail-label {
  color: #999;
}

.detail-header {
  font-size: 13px;
  font-weight: 600;
  color: #4a4a9e;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e8e8e8;
}

.c2c-content > .detail-header:first-child {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}

.detail-item.summary-item {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #e8e8e8;
}

.detail-item.summary-item .detail-label {
  font-weight: 600;
  color: #333;
}

.detail-value.highlight {
  color: #5cb85c;
  font-weight: 700;
  font-size: 15px;
}

.block-formula {
  font-size: 12px;
  color: #888;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e0e0e0;
}

.section-formula {
  font-size: 12px;
  color: #888;
  margin-top: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

/* 说明区块样式 */
.jisu-block.note-block {
  background: #f8f9fa;
  border: 1px dashed #ddd;
}

.jisu-block.note-block .block-header {
  border-bottom: 1px dashed #ddd;
}

.jisu-block.note-block .block-title {
  color: #666;
}

.note-content {
  font-size: 12px;
  color: #999;
  line-height: 1.8;
}

.note-content div {
  padding-left: 8px;
  border-left: 2px solid #ddd;
  margin-bottom: 4px;
}

/* 说明区块（用于 section 底部） */
.section-note {
  padding: 12px 20px;
  background: #f8f9fa;
  border-top: 1px solid #f0f0f0;
}

.note-title {
  font-size: 13px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}

/* 充值分钟分析样式 */
.minute-analysis-content {
  padding: 16px 20px;
}

.minute-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
}

.minute-table th {
  background: #5cb85c;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 12px 16px;
  text-align: left;
}

.minute-table th:nth-child(2),
.minute-table th:nth-child(3) {
  text-align: right;
}

.minute-table th:nth-child(4) {
  text-align: left;
  font-weight: 500;
}

.minute-table td {
  padding: 12px 16px;
  font-size: 14px;
  color: #333;
  border-bottom: 1px solid #f0f0f0;
}

.minute-table td:nth-child(2) {
  text-align: right;
  color: #4a4a9e;
  font-weight: 600;
}

.minute-table td:nth-child(3) {
  text-align: right;
  color: #666;
}

.minute-table tr:last-child td {
  border-bottom: none;
}

.minute-table tr:hover {
  background: #fafafa;
}

.minute-table tr.highlight-row {
  background: #e8f5e9;
}

.minute-table tr.highlight-row td {
  color: #333;
  font-weight: 600;
}

.minute-table tr.highlight-row td:nth-child(2) {
  color: #5cb85c;
}

.minute-table tr.divider-row td {
  padding: 6px 0;
  background: #f5f5f5;
  border-bottom: none;
}

.minute-table td.formula-cell {
  font-size: 12px;
  color: #888;
}

@media (max-width: 1200px) {
  .four-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .five-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .six-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .jisu-content {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .five-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .six-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .jisu-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 500px) {
  .five-grid {
    grid-template-columns: 1fr;
  }
  .six-grid {
    grid-template-columns: 1fr;
  }

  .card-value {
    font-size: 18px;
  }
}
</style>
