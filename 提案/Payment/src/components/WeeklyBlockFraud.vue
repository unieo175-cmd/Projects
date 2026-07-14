<script setup>
import { formatTime, formatAmount, formatAmountInteger } from '../utils/csvParser';

defineProps({
  weeklyMetrics: Object,
  showFormula: Boolean,
})
</script>

<template>
  <!-- ========== 区块五：骗分 ========== -->
  <div class="report-section">
    <div class="section-header">
      <h3>骗分统计</h3>
    </div>
    <div class="jisu-content">
      <!-- 骗分 总计 -->
      <div class="jisu-block highlight-block">
        <div class="block-header">
          <span class="block-title">骗分总计</span>
          <span class="block-value warning">{{ formatAmount(weeklyMetrics.fraudAmount) }} 元</span>
        </div>
        <div class="block-details">
          <div class="detail-item">
            <span class="detail-label">银行卡骗分没到账来找(人工)</span>
            <span class="detail-value">{{ formatAmount(weeklyMetrics.fraudBankCardManual) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">银行卡骗分没到账来找(信评)</span>
            <span class="detail-value">{{ formatAmount(weeklyMetrics.fraudBankCardCredit) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝骗分没到账来找(人工)</span>
            <span class="detail-value">{{ formatAmount(weeklyMetrics.fraudAlipayManual) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝骗分没到账来找(信评)</span>
            <span class="detail-value">{{ formatAmount(weeklyMetrics.fraudAlipayCredit) }} 元</span>
          </div>
        </div>
      </div>

      <!-- 骗分成本占比 -->
      <div class="jisu-block">
        <div class="block-header">
          <span class="block-title">骗分成本占比</span>
          <span class="block-value warning">{{ (weeklyMetrics.fraudCostRatio * 100).toFixed(2) }}%</span>
        </div>
        <div v-if="showFormula" class="block-details">
          <div v-if="showFormula" class="detail-item">
            <span class="detail-label">计算公式</span>
            <span class="detail-value note">骗分 / 配极速充值订单成功(金额)</span>
          </div>
        </div>
      </div>

    </div>
    <div v-if="showFormula" class="section-formula">
      <strong>计算公式说明：</strong><br>
      - 數據來源：選單中的「騙分統計」（依篩選日期範圍加總）<br>
      - 骗分 = 银行卡骗分(人工+信评) + 支付宝骗分(人工+信评)<br>
      - 骗分成本占比 = 骗分 / 配极速充值订单成功(金额) × 100%
    </div>
  </div>
</template>
