<script setup>
import { formatTime, formatAmount, formatAmountInteger } from '../utils/csvParser';

defineProps({
  weeklyMetrics: Object,
  showFormula: Boolean,
})
</script>

<template>
  <!-- ========== 区块三：充值订单成功(金额) ========== -->
  <div class="report-section">
    <div class="section-header">
      <h3>充值订单成功(金额)</h3>
    </div>
    <div class="jisu-content">
      <!-- 充值订单成功(加总金额) -->
      <div class="jisu-block highlight-block">
        <div class="block-header">
          <span class="block-title">充值订单成功(加总金额)</span>
          <span class="block-value success">{{ formatAmount(weeklyMetrics.orderSuccessAmountTotal) }} 元</span>
        </div>
        <div class="block-details">
          <div class="detail-item">
            <span class="detail-label">银行卡（一般卡）（金额）</span>
            <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountNormalCard) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">极速+一般提(金额)</span>
            <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountJS) }} 元</span>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          配一般卡金额 + 配极速金额
        </div>
      </div>

      <!-- 订单成功(一般卡)(金额) -->
      <div class="jisu-block">
        <div class="block-header">
          <span class="block-title">订单成功(一般卡)(金额)</span>
          <span class="block-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountNormalCard) }} 元</span>
        </div>
        <div class="block-details">
          <div class="detail-item">
            <span class="detail-label">银行卡（一般卡）（金额）</span>
            <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountNormalCardBankCard) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝（一般卡）（金额）</span>
            <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountNormalCardAlipay) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝（一般宝）（金额）</span>
            <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountNormalCardBao) }} 元</span>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          银行卡订单成功一般卡金额 + 支付宝订单成功一般卡金额 + 支付宝订单成功一般宝金额
        </div>
      </div>

      <!-- 极速+一般提(金额) -->
      <div class="jisu-block">
        <div class="block-header">
          <span class="block-title">极速+一般提(金额)</span>
          <span class="block-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountJS) }} 元</span>
        </div>
        <div class="block-details">
          <div class="detail-item">
            <span class="detail-label">银行卡极速提(金额)</span>
            <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountJSBankCard) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝极速提(卡)(金额)</span>
            <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountJSAlipayKa) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝极速提(宝)(金额)</span>
            <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountJSAlipayBao) }} 元</span>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          银行卡极速提金额 + 支付宝极速提(卡)金额 + 支付宝极速提(宝)金额
        </div>
      </div>

    </div>
  </div>
</template>
