<script setup>
import { formatTime, formatAmount, formatAmountInteger } from '../utils/csvParser';

defineProps({
  weeklyMetrics: Object,
  depositMetrics: Object,
  showFormula: Boolean,
})
</script>

<template>
  <!-- ========== 区块一：充值申请 ========== -->
  <div class="report-section">
    <div class="section-header">
      <h3>充值申请</h3>
    </div>
    <div class="jisu-content">
      <!-- 充值申请 -->
      <div class="jisu-block">
        <div class="block-header">
          <span class="block-title">充值申请</span>
          <span class="block-value">{{ weeklyMetrics.depositApplicationCount.toLocaleString() }}</span>
        </div>
        <div class="block-details">
          <div class="detail-item">
            <span class="detail-label">银行卡</span>
            <span class="detail-value">{{ (depositMetrics?.jisuApplicationCount || 0).toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝</span>
            <span class="detail-value">{{ (depositMetrics?.alipayApplicationCount || 0).toLocaleString() }}</span>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          銀行卡申請筆數 + 支付寶申請筆數
        </div>
      </div>

      <!-- 极速充值等待最终无配对 -->
      <div class="jisu-block">
        <div class="block-header">
          <span class="block-title">极速充值等待最终无配对</span>
          <span class="block-value">{{ weeklyMetrics.jsWaitingNoMatch.toLocaleString() }}</span>
        </div>
        <div class="block-details">
          <div class="detail-item">
            <span class="detail-label">银行卡</span>
            <span class="detail-value">{{ (weeklyMetrics.bankCardJsWaitingNoMatch || 0).toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝</span>
            <span class="detail-value">{{ (weeklyMetrics.alipayJsWaitingNoMatch || 0).toLocaleString() }}</span>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          銀行卡(建單成功等待無配對+取無卡06提示) + 支付寶(建單成功等待無配對+取無卡06提示)<br>
          建單成功等待無配對 = bankCardCode為空的記錄數<br>
          取無卡06提示 = 數據來源：極速06統計表，依據商戶名稱判斷渠道加總（暫帶0）
        </div>
      </div>

      <!-- 充值配对(配一般卡) -->
      <div class="jisu-block">
        <div class="block-header">
          <span class="block-title">成功配对(配一般卡)</span>
          <span class="block-value">{{ weeklyMetrics.matchNormalCard.toLocaleString() }}</span>
        </div>
        <div class="block-details">
          <div class="detail-item">
            <span class="detail-label">银行卡成功配对一般卡</span>
            <span class="detail-value">{{ weeklyMetrics.matchNormalCardBankCard.toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝成功配对一般卡</span>
            <span class="detail-value">{{ weeklyMetrics.matchNormalCardAlipay.toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">一般宝</span>
            <span class="detail-value">{{ weeklyMetrics.matchNormalCardBao.toLocaleString() }}</span>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          銀行卡一般卡 + 支付寶一般卡 + 一般寶
        </div>
      </div>

      <!-- 充值配对(配JS) -->
      <div class="jisu-block">
        <div class="block-header">
          <span class="block-title">成功配对(配极速)</span>
          <span class="block-value">{{ weeklyMetrics.matchJS.toLocaleString() }}</span>
        </div>
        <div class="block-details">
          <div class="detail-item">
            <span class="detail-label">银行卡极速提</span>
            <span class="detail-value">{{ weeklyMetrics.matchJSBankCard.toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝极速提(卡)</span>
            <span class="detail-value">{{ weeklyMetrics.matchJSAlipayKa.toLocaleString() }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">支付宝极速提(宝)</span>
            <span class="detail-value">{{ weeklyMetrics.matchJSAlipayBao.toLocaleString() }}</span>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          銀行卡極速提 + 支付寶極速提(卡) + 極速提(寶)
        </div>
      </div>
    </div>
  </div>
</template>
