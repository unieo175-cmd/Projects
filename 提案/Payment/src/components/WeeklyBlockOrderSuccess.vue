<script setup>
import { formatTime, formatAmount, formatAmountInteger } from '../utils/csvParser';

defineProps({
  weeklyMetrics: Object,
  showFormula: Boolean,
})
</script>

<template>
  <!-- ========== 区块二：订单成功 ========== -->
  <div class="report-section">
    <div class="section-header">
      <h3>充值订单成功（笔数）</h3>
    </div>
    <div class="jisu-content">
      <!-- 订单成功(加总笔数) -->
      <div class="jisu-block highlight-block">
        <div class="block-header">
          <span class="block-title">订单成功(加总笔数)</span>
          <span class="block-value success">{{ weeklyMetrics.orderSuccessTotal.toLocaleString() }}</span>
        </div>
        <div class="block-details">
          <div class="detail-item">
            <span class="detail-label">订单成功(一般卡)</span>
            <span class="detail-value">{{ weeklyMetrics.orderSuccessNormalCard.toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">订单成功(极速+一般提)</span>
            <span class="detail-value">{{ weeklyMetrics.orderSuccessJS.toLocaleString() }}</span>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          订单成功(一般卡) + 订单成功(极速+一般提)
        </div>
      </div>

      <!-- 订单成功(一般卡) -->
      <div class="jisu-block">
        <div class="block-header">
          <span class="block-title">订单成功(一般卡)</span>
          <span class="block-value">{{ weeklyMetrics.orderSuccessNormalCard.toLocaleString() }}</span>
        </div>
        <div class="block-details">
          <div class="detail-item">
            <span class="detail-label">银行卡（一般卡）</span>
            <span class="detail-value">{{ weeklyMetrics.orderSuccessNormalCardBankCard.toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝（一般卡）</span>
            <span class="detail-value">{{ weeklyMetrics.orderSuccessNormalCardAlipay.toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝（一般宝）</span>
            <span class="detail-value">{{ weeklyMetrics.orderSuccessNormalCardBao.toLocaleString() }}</span>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          银行卡（一般卡） + 支付宝（一般卡） + 支付宝（一般宝）
        </div>
      </div>

      <!-- 订单成功(极速+一般提) -->
      <div class="jisu-block">
        <div class="block-header">
          <span class="block-title">订单成功(极速+一般提)</span>
          <span class="block-value">{{ weeklyMetrics.orderSuccessJS.toLocaleString() }}</span>
        </div>
        <div class="block-details">
          <div class="detail-item">
            <span class="detail-label">银行卡极速提</span>
            <span class="detail-value">{{ weeklyMetrics.orderSuccessJSBankCard.toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝极速提(卡)</span>
            <span class="detail-value">{{ weeklyMetrics.orderSuccessJSAlipayKa.toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝极速提(宝)</span>
            <span class="detail-value">{{ weeklyMetrics.orderSuccessJSAlipayBao.toLocaleString() }}</span>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          銀行卡訂單成功極速提 + 支付寶訂單成功極速提(卡) + 極速提(寶)
        </div>
      </div>

      <!-- 无卡空单率 -->
      <div class="jisu-block">
        <div class="block-header">
          <span class="block-title">无卡空单率</span>
          <span class="block-value warning">{{ (weeklyMetrics.emptyOrderRate * 100).toFixed(2) }}%</span>
        </div>
        <div class="block-details">
          <div v-if="showFormula" class="detail-item">
            <span class="detail-label">计算公式</span>
            <span class="detail-value note">极速充值等待最终无配对 / 充值申请</span>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          极速充值等待最終無配對 / 充值申請 × 100%
        </div>
      </div>
    </div>
  </div>
</template>
