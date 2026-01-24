<script setup>
import { ref, computed } from 'vue';
import { formatTime, formatAmount } from '../utils/csvParser';

const props = defineProps({
  metrics: {
    type: Object,
    default: () => ({})
  }
});

// 渠道切換
const activeChannel = ref('all'); // 'all', 'bankCard', 'alipay', 'wechat'

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
              <span class="card-title">总提现笔数</span>
            </div>
            <div class="card-value" style="color: #0a84ff;">
              {{ (metrics.totalWithdrawCount || 0).toLocaleString() }}
              <span class="card-unit">笔</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="card-header">
              <span class="card-icon">💰</span>
              <span class="card-title">总提现金额</span>
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
              <span class="card-title">总记录数</span>
            </div>
            <div class="card-value" style="color: #8e8e93;">
              {{ (metrics.totalRecords || 0).toLocaleString() }}
              <span class="card-unit">笔</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 状态分布 -->
      <div class="metrics-section">
        <div class="section-header">
          <h3 class="section-title">提现状态分布</h3>
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
