<script setup>
import { ref, computed } from 'vue';
import { calculateMetrics, calculateWithdrawMetrics, formatTime, formatAmount, exportCompareToExcel } from '../utils/csvParser';

const props = defineProps({
  historyList: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['load', 'delete', 'refresh']);

// 比较模式
const compareMode = ref(false);
const selectedRecords = ref([]);
const compareResult = ref(null);
const isComparing = ref(false);

// IndexedDB 配置
const DB_NAME = 'VerifyDataDB';
const DB_VERSION = 2;
const HISTORY_STORE_NAME = 'uploadHistory';

// 打开数据库
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

// 加载完整历史记录
const loadFullHistory = async (id) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([HISTORY_STORE_NAME], 'readonly');
    const store = transaction.objectStore(HISTORY_STORE_NAME);
    const request = store.get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        const result = request.result?.data;
        if (result) {
          try {
            resolve(JSON.parse(result));
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (e) {
    console.error('加载历史记录失败:', e);
    return null;
  }
};

// 格式化上传时间
const formatUploadTime = (isoString) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 格式化日期范围
const formatDateRange = (range) => {
  if (!range) return '-';
  if (range.start === range.end) return range.start;
  return `${range.start} ~ ${range.end}`;
};

// 切换比较模式
const toggleCompareMode = () => {
  compareMode.value = !compareMode.value;
  selectedRecords.value = [];
  compareResult.value = null;
};

// 选择记录进行比较
const toggleSelectRecord = (id) => {
  const index = selectedRecords.value.indexOf(id);
  if (index === -1) {
    if (selectedRecords.value.length < 2) {
      selectedRecords.value.push(id);
    } else {
      // 已选择2个，替换第一个
      selectedRecords.value.shift();
      selectedRecords.value.push(id);
    }
  } else {
    selectedRecords.value.splice(index, 1);
  }
};

// 执行比较
const doCompare = async () => {
  if (selectedRecords.value.length !== 2) {
    alert('请选择两组数据进行比较');
    return;
  }

  isComparing.value = true;

  try {
    const [id1, id2] = selectedRecords.value;
    const record1 = await loadFullHistory(id1);
    const record2 = await loadFullHistory(id2);

    if (!record1 || !record2) {
      alert('无法加载选中的历史记录');
      return;
    }

    // 计算充值指标
    const deposit1 = calculateMetrics(record1.depositRecords || [], null, record1.dataDateRange?.start);
    const deposit2 = calculateMetrics(record2.depositRecords || [], null, record2.dataDateRange?.start);

    // 计算提现指标
    const withdraw1 = calculateWithdrawMetrics(record1.withdrawRecords || [], deposit1);
    const withdraw2 = calculateWithdrawMetrics(record2.withdrawRecords || [], deposit2);

    compareResult.value = {
      record1: {
        id: id1,
        dateRange: record1.dataDateRange,
        uploadTime: record1.uploadTime,
        deposit: deposit1,
        withdraw: withdraw1,
        depositRecords: record1.depositRecords,
        withdrawRecords: record1.withdrawRecords,
      },
      record2: {
        id: id2,
        dateRange: record2.dataDateRange,
        uploadTime: record2.uploadTime,
        deposit: deposit2,
        withdraw: withdraw2,
        depositRecords: record2.depositRecords,
        withdrawRecords: record2.withdrawRecords,
      }
    };
  } catch (e) {
    console.error('比较失败:', e);
    alert('比较失败: ' + e.message);
  } finally {
    isComparing.value = false;
  }
};

// 计算差异（带颜色）
const getDiff = (val1, val2, isPercentage = false, isTime = false) => {
  const diff = val2 - val1;
  if (diff === 0) return { value: '-', class: '' };

  let displayValue;
  if (isTime) {
    displayValue = (diff > 0 ? '+' : '') + formatTime(Math.abs(diff));
    if (diff < 0) displayValue = '-' + formatTime(Math.abs(diff));
  } else if (isPercentage) {
    displayValue = (diff > 0 ? '+' : '') + diff.toFixed(2) + '%';
  } else {
    displayValue = (diff > 0 ? '+' : '') + formatAmount(diff);
  }

  return {
    value: displayValue,
    class: diff > 0 ? 'diff-positive' : 'diff-negative'
  };
};

// 返回列表
const backToList = () => {
  compareResult.value = null;
};

// 导出比较报表
const exportCompare = () => {
  if (!compareResult.value) return;
  exportCompareToExcel(compareResult.value);
};

// 比较指标配置
const depositCompareMetrics = [
  { key: 'totalApplicationCount', label: '总申请笔数' },
  { key: 'successfulCount', label: '充值成功笔数' },
  { key: 'overallSuccessRate', label: '成功率', isPercentage: true },
  { key: 'totalApplicationAmount', label: '总申请金额' },
  { key: 'overallAvgTime', label: '平均处理时间', isTime: true },
  { key: 'overallDropOrderCount', label: '掉单笔数' },
  { key: 'jisuApplicationCount', label: '银行卡申请笔数' },
  { key: 'totalOrderSuccessCount', label: '银行卡订单成功' },
  { key: 'totalOrderSuccessAmount', label: '银行卡订单金额' },
  { key: 'alipayApplicationCount', label: '支付宝申请笔数' },
  { key: 'alipayTotalOrderSuccessCount', label: '支付宝订单成功' },
  { key: 'alipayTotalOrderSuccessAmount', label: '支付宝订单金额' },
  { key: 'wechatApplicationCount', label: '微信申请笔数' },
  { key: 'wechatTotalOrderSuccessCount', label: '微信订单成功' },
  { key: 'wechatTotalOrderSuccessAmount', label: '微信订单金额' },
];

const withdrawCompareMetrics = [
  { key: 'totalWithdrawCount', label: '总提现笔数' },
  { key: 'totalWithdrawAmount', label: '总提现金额' },
  { key: 'avgProcessingTime', label: '平均处理时间', isTime: true },
  { key: 'bankCardWithdrawCount', label: '银行卡提现笔数' },
  { key: 'bankCardWithdrawAmount', label: '银行卡提现金额' },
  { key: 'bankCardAvgTime', label: '银行卡平均时间', isTime: true },
  { key: 'alipayWithdrawCount', label: '支付宝提现笔数' },
  { key: 'alipayWithdrawAmount', label: '支付宝提现金额' },
  { key: 'alipayAvgTime', label: '支付宝平均时间', isTime: true },
];
</script>

<template>
  <div class="history-view">
    <!-- 比较结果视图 -->
    <template v-if="compareResult">
      <div class="compare-header">
        <button class="back-btn" @click="backToList">← 返回列表</button>
        <h3>数据比较</h3>
        <button class="export-btn" @click="exportCompare">导出比较报表</button>
      </div>

      <div class="compare-info">
        <div class="compare-item">
          <span class="label">数据 A:</span>
          <span class="value">{{ formatDateRange(compareResult.record1.dateRange) }}</span>
        </div>
        <div class="compare-item compare-vs">VS</div>
        <div class="compare-item">
          <span class="label">数据 B:</span>
          <span class="value">{{ formatDateRange(compareResult.record2.dateRange) }}</span>
        </div>
      </div>

      <!-- 充值指标比较 -->
      <div class="compare-section">
        <h4>充值指标比较</h4>
        <table class="compare-table">
          <thead>
            <tr>
              <th>指标</th>
              <th>数据 A</th>
              <th>数据 B</th>
              <th>差异</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="metric in depositCompareMetrics" :key="metric.key">
              <td>{{ metric.label }}</td>
              <td>
                <template v-if="metric.isTime">{{ formatTime(compareResult.record1.deposit?.[metric.key] || 0) }}</template>
                <template v-else-if="metric.isPercentage">{{ (compareResult.record1.deposit?.[metric.key] || 0).toFixed(2) }}%</template>
                <template v-else>{{ formatAmount(compareResult.record1.deposit?.[metric.key] || 0) }}</template>
              </td>
              <td>
                <template v-if="metric.isTime">{{ formatTime(compareResult.record2.deposit?.[metric.key] || 0) }}</template>
                <template v-else-if="metric.isPercentage">{{ (compareResult.record2.deposit?.[metric.key] || 0).toFixed(2) }}%</template>
                <template v-else>{{ formatAmount(compareResult.record2.deposit?.[metric.key] || 0) }}</template>
              </td>
              <td :class="getDiff(compareResult.record1.deposit?.[metric.key] || 0, compareResult.record2.deposit?.[metric.key] || 0, metric.isPercentage, metric.isTime).class">
                {{ getDiff(compareResult.record1.deposit?.[metric.key] || 0, compareResult.record2.deposit?.[metric.key] || 0, metric.isPercentage, metric.isTime).value }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 提现指标比较 -->
      <div class="compare-section">
        <h4>提现指标比较</h4>
        <table class="compare-table">
          <thead>
            <tr>
              <th>指标</th>
              <th>数据 A</th>
              <th>数据 B</th>
              <th>差异</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="metric in withdrawCompareMetrics" :key="metric.key">
              <td>{{ metric.label }}</td>
              <td>
                <template v-if="metric.isTime">{{ formatTime(compareResult.record1.withdraw?.[metric.key] || 0) }}</template>
                <template v-else>{{ formatAmount(compareResult.record1.withdraw?.[metric.key] || 0) }}</template>
              </td>
              <td>
                <template v-if="metric.isTime">{{ formatTime(compareResult.record2.withdraw?.[metric.key] || 0) }}</template>
                <template v-else>{{ formatAmount(compareResult.record2.withdraw?.[metric.key] || 0) }}</template>
              </td>
              <td :class="getDiff(compareResult.record1.withdraw?.[metric.key] || 0, compareResult.record2.withdraw?.[metric.key] || 0, false, metric.isTime).class">
                {{ getDiff(compareResult.record1.withdraw?.[metric.key] || 0, compareResult.record2.withdraw?.[metric.key] || 0, false, metric.isTime).value }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 历史列表视图 -->
    <template v-else>
      <div class="history-header">
        <h3>上传纪录</h3>
        <div class="header-actions">
          <button class="compare-mode-btn" :class="{ active: compareMode }" @click="toggleCompareMode">
            {{ compareMode ? '取消比较' : '比较模式' }}
          </button>
          <button class="refresh-btn" @click="emit('refresh')">刷新</button>
        </div>
      </div>

      <div v-if="compareMode" class="compare-toolbar">
        <span class="selected-count">已选择: {{ selectedRecords.length }} / 2</span>
        <button class="do-compare-btn" :disabled="selectedRecords.length !== 2 || isComparing" @click="doCompare">
          {{ isComparing ? '比较中...' : '开始比较' }}
        </button>
      </div>

      <div v-if="props.historyList.length === 0" class="empty-history">
        <div class="empty-icon">📭</div>
        <p>暂无历史记录</p>
        <p class="hint">上传数据后，点击侧边栏「保存到纪录」按钮保存</p>
      </div>

      <div v-else class="history-list">
        <div
          v-for="record in props.historyList"
          :key="record.id"
          class="history-card"
          :class="{ selected: selectedRecords.includes(record.id) }"
          @click="compareMode && toggleSelectRecord(record.id)"
        >
          <div class="card-header">
            <div class="date-range">{{ formatDateRange(record.dataDateRange) }}</div>
            <div v-if="compareMode" class="select-indicator">
              {{ selectedRecords.includes(record.id) ? '✓' : '' }}
            </div>
          </div>

          <div class="card-body">
            <div class="stat-row">
              <span class="stat-label">上传时间</span>
              <span class="stat-value">{{ formatUploadTime(record.uploadTime) }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">充值记录</span>
              <span class="stat-value">{{ (record.depositCount || 0).toLocaleString() }} 笔</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">提现记录</span>
              <span class="stat-value">{{ (record.withdrawCount || 0).toLocaleString() }} 笔</span>
            </div>

            <div v-if="record.metrics" class="metrics-preview">
              <div class="metric-item">
                <span class="metric-label">充值成功</span>
                <span class="metric-value">{{ (record.metrics.deposit?.successfulCount || 0).toLocaleString() }}</span>
              </div>
              <div class="metric-item">
                <span class="metric-label">成功率</span>
                <span class="metric-value">{{ (record.metrics.deposit?.overallSuccessRate || 0).toFixed(2) }}%</span>
              </div>
            </div>
          </div>

          <div class="card-actions" v-if="!compareMode">
            <button class="action-btn load-btn" @click.stop="emit('load', record.id)">载入</button>
            <button class="action-btn delete-btn" @click.stop="emit('delete', record.id)">删除</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.history-view {
  padding: 0;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.history-header h3 {
  color: #00d9ff;
  font-size: 18px;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.compare-mode-btn,
.refresh-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.compare-mode-btn {
  background: rgba(0, 217, 255, 0.1);
  border: 1px solid rgba(0, 217, 255, 0.5);
  color: #00d9ff;
}

.compare-mode-btn:hover,
.compare-mode-btn.active {
  background: rgba(0, 217, 255, 0.2);
  border-color: #00d9ff;
}

.refresh-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.compare-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 217, 255, 0.1);
  border: 1px solid rgba(0, 217, 255, 0.3);
  border-radius: 8px;
  margin-bottom: 20px;
}

.selected-count {
  color: #00d9ff;
  font-size: 14px;
}

.do-compare-btn {
  padding: 8px 20px;
  background: linear-gradient(135deg, #00d9ff 0%, #00a8cc 100%);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.do-compare-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 217, 255, 0.3);
}

.do-compare-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-history {
  text-align: center;
  padding: 60px 20px;
  background: #16213e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-history p {
  color: rgba(255, 255, 255, 0.7);
  margin: 8px 0;
}

.empty-history .hint {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.history-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.history-card {
  background: #16213e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s;
}

.history-card:hover {
  border-color: rgba(0, 217, 255, 0.5);
}

.history-card.selected {
  border-color: #00d9ff;
  box-shadow: 0 0 0 2px rgba(0, 217, 255, 0.2);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: rgba(0, 217, 255, 0.1);
  border-bottom: 1px solid #2a2a4a;
}

.date-range {
  font-size: 16px;
  font-weight: 600;
  color: #00d9ff;
}

.select-indicator {
  width: 24px;
  height: 24px;
  border: 2px solid #00d9ff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #00d9ff;
  font-size: 14px;
  font-weight: bold;
}

.card-body {
  padding: 16px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.stat-value {
  color: #fff;
  font-size: 13px;
}

.metrics-preview {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #2a2a4a;
}

.metric-item {
  flex: 1;
  text-align: center;
}

.metric-label {
  display: block;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  margin-bottom: 4px;
}

.metric-value {
  display: block;
  color: #00ff88;
  font-size: 16px;
  font-weight: 600;
}

.card-actions {
  display: flex;
  border-top: 1px solid #2a2a4a;
}

.action-btn {
  flex: 1;
  padding: 12px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.load-btn {
  background: rgba(0, 217, 255, 0.1);
  color: #00d9ff;
  border-right: 1px solid #2a2a4a;
}

.load-btn:hover {
  background: rgba(0, 217, 255, 0.2);
}

.delete-btn {
  background: rgba(255, 100, 100, 0.1);
  color: #ff6464;
}

.delete-btn:hover {
  background: rgba(255, 100, 100, 0.2);
}

/* 比较结果样式 */
.compare-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.compare-header h3 {
  color: #00d9ff;
  font-size: 18px;
  margin: 0;
}

.back-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.export-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, #00ff88 0%, #00cc6a 100%);
  border: none;
  border-radius: 6px;
  color: #000;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.export-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
}

.compare-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 16px;
  background: #16213e;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  margin-bottom: 20px;
}

.compare-item {
  text-align: center;
}

.compare-item .label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  margin-right: 8px;
}

.compare-item .value {
  color: #00d9ff;
  font-size: 16px;
  font-weight: 600;
}

.compare-vs {
  color: rgba(255, 255, 255, 0.5);
  font-size: 20px;
  font-weight: bold;
}

.compare-section {
  margin-bottom: 24px;
}

.compare-section h4 {
  color: #00d9ff;
  font-size: 15px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2a2a4a;
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  background: #16213e;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  overflow: hidden;
}

.compare-table th,
.compare-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #2a2a4a;
}

.compare-table th {
  background: #0f1628;
  color: #00d9ff;
  font-weight: 600;
  font-size: 13px;
}

.compare-table td {
  color: #e0e0e0;
  font-size: 13px;
}

.compare-table tr:last-child td {
  border-bottom: none;
}

.compare-table tr:hover {
  background: rgba(0, 217, 255, 0.05);
}

.diff-positive {
  color: #00ff88 !important;
  font-weight: 600;
}

.diff-negative {
  color: #ff6464 !important;
  font-weight: 600;
}

@media (max-width: 768px) {
  .history-list {
    grid-template-columns: 1fr;
  }

  .compare-info {
    flex-direction: column;
    gap: 10px;
  }

  .compare-table {
    font-size: 12px;
  }

  .compare-table th,
  .compare-table td {
    padding: 8px 10px;
  }
}
</style>
