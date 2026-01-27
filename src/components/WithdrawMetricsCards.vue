<script setup>
import { ref, computed } from 'vue';
import { formatTime, formatAmount } from '../utils/csvParser';

// 格式化時間為 mm:ss 格式
const formatTimeShort = (seconds) => {
  if (!seconds || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const props = defineProps({
  metrics: {
    type: Object,
    default: () => ({})
  }
});

// 渠道切換
const activeChannel = ref('all'); // 'all', 'bankCard', 'alipay', 'wechat'

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

    <!-- ========== 全部渠道 ========== -->
    <template v-if="activeChannel === 'all'">
      <!-- 重要信息 -->
      <div class="metrics-section">
        <div class="section-header">
          <h3 class="section-title">提现总览</h3>
        </div>
        <div class="metrics-grid four-grid">
          <div class="metric-card">
            <div class="card-header">
              <span class="card-icon">📊</span>
              <span class="card-title">总提现成功笔数</span>
            </div>
            <div class="card-value" style="color: #0a84ff;">
              {{ (metrics.totalWithdrawCount || 0).toLocaleString() }}
              <span class="card-unit">笔</span>
            </div>
            <div class="card-formula">公式：實際轉出金額 > 0</div>
          </div>

          <div class="metric-card">
            <div class="card-header">
              <span class="card-icon">💰</span>
              <span class="card-title">总提现成功金额</span>
            </div>
            <div class="card-value" style="color: #30d158;">
              {{ formatAmount(metrics.totalWithdrawAmount || 0) }}
              <span class="card-unit">元</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="card-header">
              <span class="card-icon">⏱️</span>
              <span class="card-title">平均处理时间</span>
            </div>
            <div class="card-value" style="color: #0a84ff;">
              {{ formatTime(metrics.avgProcessingTime) }}
            </div>
          </div>

          <div class="metric-card">
            <div class="card-header">
              <span class="card-icon">📋</span>
              <span class="card-title">总提现申请笔数</span>
            </div>
            <div class="card-value" style="color: #8e8e93;">
              {{ (metrics.totalRecords || 0).toLocaleString() }}
              <span class="card-unit">笔</span>
            </div>
            <div class="card-formula">公式：所有記錄（排除test/qa商戶）</div>
          </div>
        </div>
      </div>

      <!-- 提現成功時間區段 -->
      <div class="metrics-section">
        <div class="section-header">
          <h3 class="section-title">提現成功時間區段</h3>
        </div>
        <div class="minute-analysis-content">
          <table class="minute-table">
            <thead>
              <tr>
                <th>項目</th>
                <th>筆數/百分比</th>
                <th>金額</th>
              </tr>
            </thead>
            <tbody>
              <tr class="highlight-row">
                <td>总提现成功笔数</td>
                <td>{{ (metrics.withdrawSuccessTotalCount || 0).toLocaleString() }}</td>
                <td>{{ formatAmount(metrics.withdrawSuccessTotalAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>2分钟内出款</td>
                <td>{{ (metrics.withdrawWithin2MinCount || 0).toLocaleString() }} ({{ (metrics.withdrawWithin2MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.withdrawWithin2MinAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>2-5分钟出款</td>
                <td>{{ (metrics.withdrawWithin2to5MinCount || 0).toLocaleString() }} ({{ (metrics.withdrawWithin2to5MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.withdrawWithin2to5MinAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>5-15分钟出款</td>
                <td>{{ (metrics.withdrawWithin5to15MinCount || 0).toLocaleString() }} ({{ (metrics.withdrawWithin5to15MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.withdrawWithin5to15MinAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>15-30分钟出款</td>
                <td>{{ (metrics.withdrawWithin15to30MinCount || 0).toLocaleString() }} ({{ (metrics.withdrawWithin15to30MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.withdrawWithin15to30MinAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>超过30分钟出款</td>
                <td>{{ (metrics.withdrawOver30MinCount || 0).toLocaleString() }} ({{ (metrics.withdrawOver30MinRatio || 0).toFixed(2) }}%)</td>
                <td>{{ formatAmount(metrics.withdrawOver30MinAmount || 0) }} 元</td>
              </tr>
              <tr class="sub-row">
                <td class="indent">平均时间-卡(Q)</td>
                <td>{{ formatTimeShort(metrics.bankCardAvgTime) }}</td>
                <td>--</td>
              </tr>
              <tr class="sub-row">
                <td class="indent">平均时间-宝(R)</td>
                <td>{{ formatTimeShort(metrics.alipayAvgTime) }}</td>
                <td>--</td>
              </tr>
              <tr class="divider-row">
                <td colspan="3"></td>
              </tr>
              <tr>
                <td>提现成功率</td>
                <td>{{ (metrics.withdrawSuccessRate || 0).toFixed(2) }}%</td>
                <td>--</td>
              </tr>
              <tr>
                <td>提现失败笔数</td>
                <td>{{ (metrics.withdrawFailedCount || 0).toLocaleString() }}</td>
                <td>--</td>
              </tr>
              <tr>
                <td>无卡空单率</td>
                <td>{{ (metrics.withdrawEmptyOrderRate || 0).toFixed(2) }}%</td>
                <td>--</td>
              </tr>
              <tr>
                <td>订单成功</td>
                <td>{{ (metrics.withdrawOrderSuccessCount || 0).toLocaleString() }}</td>
                <td>{{ formatAmount(metrics.withdrawOrderSuccessAmount || 0) }} 元</td>
              </tr>
              <tr>
                <td>订单成功占比</td>
                <td>{{ (metrics.withdrawOrderSuccessRate || 0).toFixed(2) }}%</td>
                <td>--</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- ========== 银行卡渠道 ========== -->
    <template v-else-if="activeChannel === 'bankCard'">
      <div class="metrics-section">
        <div class="section-header">
          <h3 class="section-title">提现总览</h3>
        </div>
        <div class="withdraw-content">
          <div class="detail-item">
            <span class="detail-label">提现申请</span>
            <span class="detail-value">{{ (metrics.bankCardWithdrawCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.bankCardWithdrawAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">充值配对率</span>
            <span class="detail-value">{{ ((metrics.bankCardMatchRate || 0) * 100).toFixed(2) }}%</span>
          </div>
          <div class="detail-item sub-item">
            <span class="detail-label">充值申请</span>
            <span class="detail-value">{{ (metrics.bankCardDepositAppCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item sub-item">
            <span class="detail-label">成功配对</span>
            <span class="detail-value">{{ (metrics.bankCardDepositMatchCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">配对后成功率</span>
            <span class="detail-value">{{ ((metrics.bankCardSuccessAfterMatchRate || 0) * 100).toFixed(2) }}%</span>
          </div>
          <div class="detail-item sub-item">
            <span class="detail-label">充值成功笔数</span>
            <span class="detail-value">{{ (metrics.bankCardDepositSuccessCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item sub-item">
            <span class="detail-label">成功配对笔数</span>
            <span class="detail-value">{{ (metrics.bankCardDepositMatchCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">平均时间</span>
            <span class="detail-value">{{ formatTime(metrics.bankCardAvgTime) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ========== 支付宝渠道 ========== -->
    <template v-else-if="activeChannel === 'alipay'">
      <div class="metrics-section">
        <div class="section-header">
          <h3 class="section-title">提现总览</h3>
        </div>
        <div class="withdraw-content">
          <div class="detail-item">
            <span class="detail-label">提现申请</span>
            <span class="detail-value">{{ (metrics.alipayWithdrawCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayWithdrawAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">充值配对率</span>
            <span class="detail-value">{{ ((metrics.alipayMatchRate || 0) * 100).toFixed(2) }}%</span>
          </div>
          <div class="detail-item sub-item">
            <span class="detail-label">充值申请</span>
            <span class="detail-value">{{ (metrics.alipayDepositAppCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item sub-item">
            <span class="detail-label">成功配对</span>
            <span class="detail-value">{{ (metrics.alipayDepositMatchCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">配对后成功率</span>
            <span class="detail-value">{{ ((metrics.alipaySuccessAfterMatchRate || 0) * 100).toFixed(2) }}%</span>
          </div>
          <div class="detail-item sub-item">
            <span class="detail-label">充值成功笔数</span>
            <span class="detail-value">{{ (metrics.alipayDepositSuccessCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item sub-item">
            <span class="detail-label">成功配对笔数</span>
            <span class="detail-value">{{ (metrics.alipayDepositMatchCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">平均时间</span>
            <span class="detail-value">{{ formatTime(metrics.alipayAvgTime) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ========== 微信渠道 ========== -->
    <template v-else-if="activeChannel === 'wechat'">
      <div class="metrics-section">
        <div class="section-header">
          <h3 class="section-title">提现总览</h3>
        </div>
        <div class="withdraw-content">
          <div class="detail-item">
            <span class="detail-label">提现申请</span>
            <span class="detail-value">{{ (metrics.wechatWithdrawCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatWithdrawAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">充值配对率</span>
            <span class="detail-value">{{ ((metrics.wechatMatchRate || 0) * 100).toFixed(2) }}%</span>
          </div>
          <div class="detail-item sub-item">
            <span class="detail-label">充值申请</span>
            <span class="detail-value">{{ (metrics.wechatDepositAppCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item sub-item">
            <span class="detail-label">成功配对</span>
            <span class="detail-value">{{ (metrics.wechatDepositMatchCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">配对后成功率</span>
            <span class="detail-value">{{ ((metrics.wechatSuccessAfterMatchRate || 0) * 100).toFixed(2) }}%</span>
          </div>
          <div class="detail-item sub-item">
            <span class="detail-label">充值成功笔数</span>
            <span class="detail-value">{{ (metrics.wechatDepositSuccessCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item sub-item">
            <span class="detail-label">成功配对笔数</span>
            <span class="detail-value">{{ (metrics.wechatDepositMatchCount || 0).toLocaleString() }} 笔</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">平均时间</span>
            <span class="detail-value">{{ formatTime(metrics.wechatAvgTime) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.metrics-container {
  margin-bottom: 24px;
}

/* 渠道切換按鈕 */
.channel-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  background: #1c1c1e;
  padding: 8px;
  border-radius: 12px;
}

.channel-tab {
  flex: 1;
  padding: 12px 20px;
  border: none;
  background: transparent;
  color: #8e8e93;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.channel-tab:hover {
  color: #fff;
  background: #2c2c2e;
}

.channel-tab.active {
  background: #0a84ff;
  color: #fff;
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

.card-formula {
  font-size: 11px;
  color: #6e6e73;
  margin-top: 6px;
  font-style: italic;
}

/* 提現內容 */
.withdraw-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 20px 16px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 14px;
  color: #8e8e93;
}

.detail-value {
  font-size: 14px;
  color: #fff;
  font-family: monospace;
}

.detail-item.sub-item {
  padding-left: 20px;
}

.detail-item.sub-item .detail-label {
  color: #6e6e73;
}

/* 提現成功時間區段 - 表格樣式 */
.minute-analysis-content {
  padding: 0 16px 16px;
}

.minute-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.minute-table th,
.minute-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #3a3a3c;
}

.minute-table th {
  background: #3a3a3c;
  color: #8e8e93;
  font-weight: 600;
}

.minute-table th:nth-child(2),
.minute-table th:nth-child(3),
.minute-table td:nth-child(2),
.minute-table td:nth-child(3) {
  text-align: right;
}

.minute-table td {
  color: #fff;
}

.minute-table td:nth-child(2) {
  color: #0a84ff;
  font-family: monospace;
}

.minute-table td:nth-child(3) {
  color: #30d158;
  font-family: monospace;
}

.minute-table tr:hover {
  background: #2c2c2e;
}

.minute-table tr.highlight-row {
  background: #1a3a5c;
}

.minute-table tr.highlight-row:hover {
  background: #1a4a6c;
}

.minute-table tr.divider-row td {
  padding: 4px;
  border-bottom: 2px solid #3a3a3c;
}

.minute-table tr.sub-row {
  background: #252528;
}

.minute-table tr.sub-row td.indent {
  padding-left: 32px;
  color: #8e8e93;
}

.minute-table td.formula-text {
  font-size: 11px;
  color: #6e6e73;
  font-style: italic;
  font-family: inherit;
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
