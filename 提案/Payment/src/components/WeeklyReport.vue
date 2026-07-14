<script setup>
import { ref, computed, watch } from 'vue';
import { calculateMetrics, calculateWithdrawMetrics, formatTime, formatAmount, exportWeeklyToExcel, exportDepositToText } from '../utils/csvParser';
import { useWeeklyMetrics, useAnalysisMetrics } from '../composables/useWeeklyMetrics';
import WeeklyBlockDeposit from './WeeklyBlockDeposit.vue';
import WeeklyBlockOrderSuccess from './WeeklyBlockOrderSuccess.vue';
import WeeklyBlockOrderAmount from './WeeklyBlockOrderAmount.vue';
import WeeklyBlockTime from './WeeklyBlockTime.vue';
import WeeklyBlockFraud from './WeeklyBlockFraud.vue';
import WeeklyBlockAnalysis from './WeeklyBlockAnalysis.vue';

const props = defineProps({
  depositRecords: {
    type: Array,
    default: () => []
  },
  withdrawRecords: {
    type: Array,
    default: () => []
  },
  showMetricsAnalysisValues: {
    type: Boolean,
    default: false  // 預設隱藏計算值欄位
  },
  showFormula: {
    type: Boolean,
    default: false
  }
});

// 今日日期
const today = new Date().toISOString().split('T')[0];

// 日期选择（起讫时间）
const startDate = ref('');
const endDate = ref('');

// 日期范围错误信息
const dateRangeError = ref('');

// 导出状态
const isExporting = ref(false);
const exportProgress = ref('');

// 计算状态
const isCalculating = ref(false);
const calculationError = ref('');

// 日期范围
const weekRange = computed(() => {
  if (!startDate.value || !endDate.value) return { start: '', end: '', startDate: null, endDate: null };

  return {
    start: startDate.value,
    end: endDate.value,
    startDate: new Date(startDate.value),
    endDate: new Date(endDate.value)
  };
});

// 使用所有充值记录（不再按日期过滤）
const filteredDepositRecords = computed(() => {
  return props.depositRecords || [];
});

// 使用所有提现记录（不再按日期过滤）
const filteredWithdrawRecords = computed(() => {
  return props.withdrawRecords || [];
});

// 计算充值指标
const depositMetrics = computed(() => {
  if (filteredDepositRecords.value.length === 0) return null;
  try {
    calculationError.value = '';
    // 传入 dataDate 以正确计算 noCard06Count
    const dataDate = weekRange.value?.start || null;
    return calculateMetrics(filteredDepositRecords.value, null, dataDate);
  } catch (error) {
    console.error('充值指标计算错误:', error);
    calculationError.value = error.message || '计算超时，请减少数据量';
    return null;
  }
});

// 计算提现指标
const withdrawMetrics = computed(() => {
  if (filteredWithdrawRecords.value.length === 0) return null;
  try {
    return calculateWithdrawMetrics(filteredWithdrawRecords.value, depositMetrics.value);
  } catch (error) {
    console.error('提现指标计算错误:', error);
    calculationError.value = error.message || '计算超时，请减少数据量';
    return null;
  }
});

// 计算周报重要指标
const { weeklyMetrics } = useWeeklyMetrics(depositMetrics, withdrawMetrics, weekRange, filteredWithdrawRecords);

// ===== 指标数据分析 =====
const { analysisMetrics } = useAnalysisMetrics(filteredDepositRecords, depositMetrics, withdrawMetrics, filteredWithdrawRecords);

// 设置预设日期範圍 - 根据数据自动检测
const setDefaultDate = () => {
  // 从充值记录中获取最早和最晚日期
  let minDate = null;
  let maxDate = null;

  // 检查充值记录
  if (props.depositRecords && props.depositRecords.length > 0) {
    props.depositRecords.forEach(r => {
      if (r.requestTime) {
        const date = r.requestTime.substring(0, 10);
        if (!minDate || date < minDate) minDate = date;
        if (!maxDate || date > maxDate) maxDate = date;
      }
    });
  }

  // 检查提现记录
  if (props.withdrawRecords && props.withdrawRecords.length > 0) {
    props.withdrawRecords.forEach(r => {
      if (r.requestTime) {
        const date = r.requestTime.substring(0, 10);
        if (!minDate || date < minDate) minDate = date;
        if (!maxDate || date > maxDate) maxDate = date;
      }
    });
  }

  // 如果有检测到日期，使用检测到的范围
  if (minDate && maxDate) {
    startDate.value = minDate;
    endDate.value = maxDate;
    console.log('自动检测日期范围:', minDate, '~', maxDate);
  } else {
    // 如果没有数据，使用默认值
    startDate.value = '2026-01-01';
    endDate.value = '2026-01-07';
  }
};

// 监听数据变化，自动更新日期范围
watch(() => [props.depositRecords, props.withdrawRecords], () => {
  if ((props.depositRecords && props.depositRecords.length > 0) ||
      (props.withdrawRecords && props.withdrawRecords.length > 0)) {
    setDefaultDate();
  }
}, { immediate: true });

// 开始日期变更时的防呆
const onStartDateChange = () => {
  if (!startDate.value) return;

  // 开始日期不能超过今日
  if (startDate.value > today) {
    startDate.value = today;
    dateRangeError.value = '开始日期不能超过今日，已自动修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 如果结束日期早于开始日期，自动修正结束日期
  if (endDate.value && endDate.value < startDate.value) {
    endDate.value = startDate.value;
    dateRangeError.value = '结束日期已自动修正为开始日期';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 检查日期范围是否超过一个月
  if (startDate.value && endDate.value) {
    const start = new Date(startDate.value);
    const end = new Date(endDate.value);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    if (diffDays > 31) {
      const maxEnd = new Date(start);
      maxEnd.setDate(maxEnd.getDate() + 31);
      const maxEndStr = maxEnd.toISOString().split('T')[0];
      endDate.value = maxEndStr > today ? today : maxEndStr;
      dateRangeError.value = '日期范围最大一个月，已自动修正';
      setTimeout(() => { dateRangeError.value = ''; }, 2000);
    }
  }
};

// 结束日期变更时的防呆
const onEndDateChange = () => {
  if (!endDate.value) return;

  // 结束日期不能超过今日
  if (endDate.value > today) {
    endDate.value = today;
    dateRangeError.value = '结束日期不能超过今日，已自动修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 结束日期不能早于开始日期
  if (startDate.value && endDate.value < startDate.value) {
    endDate.value = startDate.value;
    dateRangeError.value = '结束日期不能早于开始日期，已自动修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 检查日期范围是否超过一个月
  if (startDate.value && endDate.value) {
    const start = new Date(startDate.value);
    const end = new Date(endDate.value);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    if (diffDays > 31) {
      const minStart = new Date(end);
      minStart.setDate(minStart.getDate() - 31);
      startDate.value = minStart.toISOString().split('T')[0];
      dateRangeError.value = '日期范围最大一个月，已自动修正';
      setTimeout(() => { dateRangeError.value = ''; }, 2000);
    }
  }
};

// 导出周报
const handleExport = async () => {
  if (!weeklyMetrics.value || isExporting.value) return;

  isExporting.value = true;
  exportProgress.value = '准备导出...';

  try {
    const onProgress = (progress) => {
      exportProgress.value = `${progress.message} (${progress.step}/${progress.total})`;
    };

    await exportWeeklyToExcel(
      weeklyMetrics.value,
      analysisMetrics.value,
      weekRange.value,
      depositMetrics.value,
      withdrawMetrics.value,
      onProgress
    );

    exportProgress.value = '导出完成！';
    setTimeout(() => {
      exportProgress.value = '';
    }, 2000);
  } catch (error) {
    console.error('导出失败:', error);
    exportProgress.value = error.message || '导出失败，请重试';
    setTimeout(() => {
      exportProgress.value = '';
    }, 3000);
  } finally {
    isExporting.value = false;
  }
};

// 导出充值纯文本报表
const handleExportText = () => {
  if (!depositMetrics.value) return;
  // 依选择日期范围筛选记录，重新计算指标
  const start = weekRange.value?.start || '';
  const end = weekRange.value?.end || '';
  const inRange = (r) => {
    const dateStr = (r.requestTime || '').split(' ')[0];
    if (start && dateStr < start) return false;
    if (end && dateStr > end) return false;
    return true;
  };
  const dateFilteredDepositRecords = (props.depositRecords || []).filter(inRange);
  const dateFilteredWithdrawRecords = (props.withdrawRecords || []).filter(inRange);
  const filteredDepositMetrics = calculateMetrics(dateFilteredDepositRecords);
  const filteredWithdrawMetrics = calculateWithdrawMetrics(dateFilteredWithdrawRecords, filteredDepositMetrics);
  exportDepositToText(filteredDepositMetrics, weekRange.value, filteredWithdrawMetrics, weeklyMetrics.value);
};

// 查询（数据已自动计算，此按钮用于视觉确认）
const handleQuery = () => {
  // 数据通过 computed 自动更新，无需额外操作
};
</script>

<template>
  <div class="weekly-report">
    <!-- 标题和操作区 -->
    <div class="date-selector">
      <div class="selector-header">
        <h2>日/周报数据汇总</h2>
      </div>
      <div class="selector-content">
        <div class="date-inputs">
          <div class="date-input-group">
            <label>开始日期</label>
            <input type="date" v-model="startDate" :max="today" />
          </div>
          <span class="date-separator">~</span>
          <div class="date-input-group">
            <label>结束日期</label>
            <input type="date" v-model="endDate" :max="today" />
          </div>
          <button @click="handleQuery" class="query-btn">查询</button>
          <button @click="handleExport" class="export-btn" v-if="weeklyMetrics" :disabled="isExporting">
            {{ isExporting ? exportProgress : '导出 Excel' }}
          </button>
          <button @click="handleExportText" class="export-btn text-btn" v-if="depositMetrics">导出纯文本</button>
        </div>
        <div v-if="dateRangeError" class="date-range-error">{{ dateRangeError }}</div>
        <div v-if="calculationError" class="calculation-error">{{ calculationError }}</div>
      </div>
    </div>

    <!-- 数据汇总 -->
    <template v-if="weekRange.start">
      <!-- ========== 区块一：充值申请 ========== -->
      <WeeklyBlockDeposit
        v-if="weeklyMetrics"
        :weeklyMetrics="weeklyMetrics"
        :depositMetrics="depositMetrics"
        :withdrawMetrics="withdrawMetrics"
        :showFormula="showFormula"
      />

      <!-- ========== 区块二：订单成功 ========== -->
      <WeeklyBlockOrderSuccess
        v-if="weeklyMetrics"
        :weeklyMetrics="weeklyMetrics"
        :showFormula="showFormula"
      />

      <!-- ========== 区块三：充值订单成功(金额) ========== -->
      <WeeklyBlockOrderAmount
        v-if="weeklyMetrics"
        :weeklyMetrics="weeklyMetrics"
        :showFormula="showFormula"
      />

      <!-- ========== 区块四：平均处理时间 ========== -->
      <WeeklyBlockTime
        v-if="weeklyMetrics"
        :weeklyMetrics="weeklyMetrics"
        :showFormula="showFormula"
      />

      <!-- ========== 区块五：骗分 ========== -->
      <WeeklyBlockFraud
        v-if="weeklyMetrics"
        :weeklyMetrics="weeklyMetrics"
        :showFormula="showFormula"
      />

      <!-- ========== 区块六：配对率＆空单率（暂时隐藏） ========== -->
      <div class="report-section" v-if="false">
        <div class="section-header">
          <h3>配对率＆空单率</h3>
        </div>
        <div class="jisu-content">
          <!-- 充值配对率 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值配对率</span>
              <span class="block-value">{{ (weeklyMetrics.depositMatchRate * 100).toFixed(2) }}%</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">充值配对总数</span>
                <span class="detail-value">{{ weeklyMetrics.totalMatch.toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">充值申请</span>
                <span class="detail-value">{{ weeklyMetrics.depositApplicationCount.toLocaleString() }}</span>
              </div>
              <div v-if="showFormula" class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">(配一般卡+配极速) / 充值申请</span>
              </div>
            </div>
          </div>

          <!-- 充提配对率 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充提配对率</span>
              <span class="block-value">{{ (weeklyMetrics.depositWithdrawMatchRate * 100).toFixed(2) }}%</span>
            </div>
            <div class="block-details">
              <div v-if="showFormula" class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">公式待确认</span>
              </div>
            </div>
          </div>

          <!-- 配对后成功率 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">配对后成功率</span>
              <span class="block-value success">{{ (weeklyMetrics.successAfterMatchRate * 100).toFixed(2) }}%</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">订单成功总数</span>
                <span class="detail-value">{{ weeklyMetrics.orderSuccessTotal.toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">充值配对总数</span>
                <span class="detail-value">{{ weeklyMetrics.totalMatch.toLocaleString() }}</span>
              </div>
              <div v-if="showFormula" class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">(一般卡+极速+一般提) / 充值配对总数</span>
              </div>
            </div>
          </div>

          <!-- 未充空单率 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">未充空单率</span>
              <span class="block-value warning">{{ (weeklyMetrics.notDepositedEmptyRate * 100).toFixed(2) }}%</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">未充值</span>
                <span class="detail-value">{{ weeklyMetrics.notDeposited.toLocaleString() }}</span>
              </div>
              <div v-if="showFormula" class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">未充值 / 配极速</span>
              </div>
            </div>
          </div>

          <!-- 提现失败率 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">提现失败率</span>
              <span class="block-value warning">{{ (weeklyMetrics.withdrawFailRate * 100).toFixed(2) }}%</span>
            </div>
            <div class="block-details">
              <div v-if="showFormula" class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">公式后补</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          <strong>計算公式說明：</strong><br>
          - 充值配对率 = (充值配對(配一般卡) + 充值配對(配极速)) / 充值申請 × 100%<br>
          - 充提配对率 = 公式待確認<br>
          - 配对后成功率 = (訂單成功(一般卡) + 訂單成功(极速+一般提)) / (充值配對(配一般卡) + 充值配對(配极速)) × 100%<br>
          - 未充空单率 = 未充值 / 充值配對(配极速) × 100%<br>
          - 提现失败率 = 提現失敗筆數 / 總申請筆數 × 100%<br>
          <br>
          <strong>提現失敗條件：</strong>說明≠轉帳完成/转账完成 且 實際轉出金額=空白或0 且 提現狀態≠提現完成/提现完成（按訂單號去重）
        </div>
      </div>

      <div class="no-data" v-if="!weeklyMetrics">
        此周无数据
      </div>

      <!-- ========== 区块七：指标数据分析 ========== -->
      <WeeklyBlockAnalysis
        v-if="analysisMetrics"
        :weeklyMetrics="weeklyMetrics"
        :depositMetrics="depositMetrics"
        :withdrawMetrics="withdrawMetrics"
        :showFormula="showFormula"
        :showMetricsAnalysisValues="showMetricsAnalysisValues"
        :analysisMetrics="analysisMetrics"
      />
    </template>
  </div>
</template>

<style scoped>
.weekly-report {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 日期選擇器 */
.date-selector {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.selector-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.selector-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.date-range-info {
  font-size: 14px;
  color: #666;
  background: #f0f0f0;
  padding: 6px 12px;
  border-radius: 4px;
}

.selector-content {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.date-inputs {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.date-input-group label {
  font-size: 12px;
  color: #666;
}

.date-input-group input[type="date"] {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-size: 14px;
  outline: none;
  min-width: 140px;
}

.date-input-group input[type="date"]:focus {
  border-color: #4a4a9e;
  box-shadow: 0 0 0 2px rgba(74, 74, 158, 0.1);
}

.date-separator {
  color: #666;
  font-size: 16px;
  margin-top: 20px;
}

.date-range-error {
  color: #ff6b6b;
  font-size: 12px;
  background: #fff5f5;
  padding: 6px 12px;
  border-radius: 4px;
}

.export-buttons {
  display: flex;
  gap: 12px;
  margin-left: auto;
}

.date-picker {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-picker label {
  color: #666;
  font-size: 14px;
}

.date-input {
  padding: 10px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-size: 14px;
  outline: none;
}

.date-input:focus {
  border-color: #4a4a9e;
  box-shadow: 0 0 0 3px rgba(74, 74, 158, 0.1);
}

.date-error {
  color: #856404;
  font-size: 14px;
  padding: 8px 12px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
}

.calculation-error {
  color: #721c24;
  font-size: 14px;
  padding: 8px 12px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
  margin-top: 8px;
}

.export-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  background: #5cb85c;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  align-self: flex-end;
  height: 36px;
}

.export-btn:hover {
  background: #4cae4c;
}

.export-btn:disabled {
  background: #9e9e9e;
  cursor: not-allowed;
  opacity: 0.8;
}

.query-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  background: #4a4a9e;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  align-self: flex-end;
  height: 36px;
  transition: background 0.2s;
  margin-left: 10px;
}

.query-btn:hover {
  background: #3a3a8e;
}

.export-btn.text-btn {
  background: #ff9f0a;
  margin-left: 10px;
}

.export-btn.text-btn:hover {
  background: #e68a00;
}

/* 报表区块 */
.report-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.record-count {
  color: #666;
  font-size: 13px;
  background: #f5f5f5;
  padding: 6px 12px;
  border-radius: 6px;
}

/* 指标网格 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.metric-card {
  background: #f8f9fa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 14px;
}

.card-title {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.card-value {
  font-size: 18px;
  font-weight: 700;
  color: #333;
}

/* 渠道网格 */
.channel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.channel-card {
  background: #f8f9fa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 14px;
}

.channel-title {
  font-size: 14px;
  font-weight: 600;
  color: #4a4a9e;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e8e8e8;
}

.channel-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  font-size: 13px;
  color: #666;
}

.stat-value {
  font-size: 13px;
  color: #333;
  font-family: monospace;
}

/* 重要指标网格 */
.important-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

/* 区块样式 (与 MetricsCards.vue 一致) */
.jisu-block {
  background: #f8f9fa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 14px;
}

.jisu-block.highlight-block {
  background: #e8f5e9;
  border: 1px solid #5cb85c;
}

/* 区块内容网格 */
.jisu-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e8e8e8;
}

.block-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.block-value {
  font-size: 16px;
  font-weight: 700;
  color: #4a4a9e;
}

.block-value.success {
  color: #5cb85c;
}

.block-value.warning {
  color: #f0ad4e;
}

.block-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.detail-value.note {
  color: #999;
  font-family: inherit;
  font-style: italic;
  font-size: 11px;
}

/* 无数据 */
.no-data {
  text-align: center;
  color: #999;
  font-size: 14px;
  padding: 40px 20px;
}

/* 区块底部公式说明 */
.section-formula {
  font-size: 12px;
  color: #888;
  margin-top: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

@media (max-width: 768px) {
  .selector-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .jisu-content {
    grid-template-columns: 1fr;
  }

  .channel-grid {
    grid-template-columns: 1fr;
  }

  .important-metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
