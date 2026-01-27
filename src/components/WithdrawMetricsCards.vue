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
  margin-bottom: 20px;
}

/* 渠道切換按鈕 */
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
  border-bottom: 1px solid #f0f0f0;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.metrics-grid {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.four-grid {
  grid-template-columns: repeat(4, 1fr);
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

.card-formula {
  font-size: 10px;
  color: #999;
  margin-top: 6px;
  font-style: italic;
}

/* 提現內容 */
.withdraw-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 20px;
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

.detail-item.sub-item {
  padding-left: 16px;
}

.detail-item.sub-item .detail-label {
  color: #999;
}

/* 提現成功時間區段 - 表格樣式 */
.minute-analysis-content {
  padding: 16px;
}

.minute-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
}

.minute-table th,
.minute-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.minute-table th {
  background: #5cb85c;
  color: #fff;
  font-weight: 600;
}

.minute-table th:nth-child(2),
.minute-table th:nth-child(3),
.minute-table td:nth-child(2),
.minute-table td:nth-child(3) {
  text-align: right;
}

.minute-table td {
  color: #333;
}

.minute-table td:nth-child(2) {
  color: #4a4a9e;
  font-family: monospace;
  font-weight: 600;
}

.minute-table td:nth-child(3) {
  color: #5cb85c;
  font-family: monospace;
}

.minute-table tr:hover {
  background: #fafafa;
}

.minute-table tr.highlight-row {
  background: #e8f5e9;
}

.minute-table tr.highlight-row:hover {
  background: #dcedc8;
}

.minute-table tr.divider-row td {
  padding: 4px;
  background: #f5f5f5;
  border-bottom: none;
}

.minute-table tr.sub-row {
  background: #fafafa;
}

.minute-table tr.sub-row td.indent {
  padding-left: 32px;
  color: #666;
}

.minute-table td.formula-text {
  font-size: 10px;
  color: #999;
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
