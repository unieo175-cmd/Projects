<script setup>
import { formatTime, formatAmount, formatAmountInteger } from '../utils/csvParser';

defineProps({
  weeklyMetrics: Object,
  showFormula: Boolean,
})
</script>

<template>
  <!-- ========== 区块四：提現-平均处理时间/提現返利 ========== -->
  <div class="report-section">
    <div class="section-header">
      <h3>提現-平均處理時間/提現返利</h3>
    </div>
    <div class="jisu-content">
      <div class="jisu-block">
        <div class="block-header">
          <span class="block-title">提现平均处理时间</span>
          <span class="block-value"></span>
        </div>
        <div class="block-details">
          <div class="detail-item">
            <span class="detail-label">提现平均处理时间（卡）</span>
            <span class="detail-value">{{ formatTime(weeklyMetrics.withdrawAvgTimeBankCard) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">提现平均处理时间（宝）</span>
            <span class="detail-value">{{ formatTime(weeklyMetrics.withdrawAvgTimeAlipay) }}</span>
          </div>
        </div>
      </div>

      <!-- 极速提现返利 -->
      <div class="jisu-block">
        <div class="block-header">
          <span class="block-title">极速提现返利</span>
          <span class="block-value">{{ formatAmount(weeklyMetrics.jsWithdrawRebate) }} 元</span>
        </div>
        <div v-if="showFormula" class="block-details">
          <div v-if="showFormula" class="detail-item">
            <span class="detail-label">计算公式</span>
            <span class="detail-value note">提现记录H栏(merchantRebate)加总</span>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showFormula" class="section-formula">
      <strong>计算公式说明：</strong><br>
      - 提现平均处理时间（卡）= 提現分析的銀行卡的平均處理時間<br>
      - 提现平均处理时间（宝）= 提現分析的支付寶的平均處理時間<br>
      - 极速提现返利 = 提現紀錄的商戶返利加總
    </div>
  </div>
</template>
