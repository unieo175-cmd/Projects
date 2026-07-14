<script setup>
import { ref } from 'vue';
import { formatTime, formatTimeMinutes, formatAmount } from '../utils/csvParser';

defineProps({
  metrics: { type: Object, default: () => ({}) },
  showFormula: { type: Boolean, default: false },
  fraudStats: { type: Object, default: () => ({ bankCard: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, noReceiptCount: 0, fraudBlacklistCount: 0, cardVerifyCount: 0 } }) },
  amountRanges: { type: Array, default: () => [] }
});

const showJisu = ref(true);
const showC2c = ref(true);
const showThirdParty = ref(true);
const showFraud = ref(true);
const showCommercial = ref(true);
</script>

<template>
      <!-- 极速（银行卡） -->
      <div class="metrics-section">
        <div class="section-header" @click="showJisu = !showJisu">
          <h3 class="section-title">极速（银行卡）</h3>
          <span class="toggle-icon">{{ showJisu ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showJisu" class="jisu-content">
          <!-- 1. 充值申请笔数 + 成功配对 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值申请笔数</span>
              <span class="block-value">{{ (metrics.jisuApplicationCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.totalMatchAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item detail-sub-header">
                <span class="detail-label">成功配对</span>
                <span class="detail-value">{{ (metrics.totalMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.totalMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item detail-sub">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.normalMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.normalMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item detail-sub">
                <span class="detail-label">极速提</span>
                <span class="detail-value">{{ (metrics.expressMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.expressMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item" style="margin-top: 8px;">
                <span class="detail-label">建单成功等待无配对</span>
                <span class="detail-value">{{ (metrics.waitingForMatchCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">取无卡06提示</span>
                <span class="detail-value">{{ (metrics.noCard06Count || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">无效申请</span>
                <span class="detail-value">{{ (metrics.jisuInvalidApplicationCount || 0).toLocaleString() }}</span>
              </div>
            </div>
            <div v-if="showFormula" class="block-formula">
              <strong>数据范围：</strong>充值纪录，商户包含「极速充提3」且不含支付宝/微信/test/qa/线下<br>
              <strong>一般卡：</strong>银行卡代号有值且≠AUCTION_PAYMENT_CARD<br>
              <strong>极速提：</strong>银行卡代号=AUCTION_PAYMENT_CARD<br>
              <strong>建单成功等待无配对：</strong>充值纪录中配卡配不到时的笔数（银行卡栏位为空值）<br>
              <strong>取无卡06提示：</strong>payment-极速06统计表中当日商户：全部，错误分类：全部，错误类型：配卡失败 的笔数（资料看更新时间）<br>
              <strong>充值申请笔数：</strong>一般卡 + 极速提 + 建单成功等待无配对 + 取无卡06提示<br>
              <strong>成功配对金额：</strong>使用充值金额（申请金额）计算
            </div>
          </div>

          <!-- 3. 订单成功笔数/金额 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">订单成功</span>
              <span class="block-value">{{ (metrics.totalOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.totalOrderSuccessAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.normalOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.normalOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提</span>
                <span class="detail-value">{{ (metrics.expressOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.expressOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">信评上分</span>
                <span class="detail-value">{{ (metrics.creditScoreSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.creditScoreSuccessAmount || 0) }} 元 / {{ formatTime(metrics.creditScoreAvgTime) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">平均处理时间</span>
                <span class="detail-value">{{ formatTime(metrics.noCreditDowngradeAvgTime) }}</span>
              </div>
            </div>
            <div v-if="showFormula" class="block-formula">
              <strong>一般卡：</strong>银行卡代号有值且≠AUCTION_PAYMENT_CARD，正规化状态≠「未充值」「审核中(已超时)/審核中(已超時)」<br>
              <strong>极速提：</strong>银行卡代号=AUCTION_PAYMENT_CARD，到账金额>0，状态≠「未充值」「审核中(已超时)/審核中(已超時)」<br>
              <strong>信评上分：</strong>到账金额>0 且状态包含「信用」<br>
              <strong>平均处理时间：</strong>到账金额>0 的平均处理时间
            </div>
          </div>

          <!-- 4. 没信评降等配卡 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">没信评降等配卡</span>
              <span class="block-value">
                {{ (metrics.noCreditDowngradeTotal || 0).toLocaleString() }} 笔
              </span>
            </div>
            <div class="block-details amount-list scrollable-list">
              <div
                v-for="amt in amountRanges"
                :key="amt"
                class="detail-item"
              >
                <span class="detail-label">{{ amt.toLocaleString() }} 元</span>
                <span class="detail-value">{{ (metrics.noCreditDowngradeByAmount?.[amt] || 0).toLocaleString() }} 笔</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">其他金额</span>
                <span class="detail-value">{{ (metrics.noCreditDowngradeByAmount?.['other'] || 0).toLocaleString() }} 笔</span>
              </div>
            </div>
            <div v-if="showFormula" class="block-formula">
              <strong>条件：</strong>银行卡代号≠AUCTION_PAYMENT_CARD，到账金额≠0，用户等级≠0且≠-1<br>
              <strong>分组：</strong>按充值金额（申请金额）分组统计
            </div>
          </div>

        </div>
      </div>

      <!-- c2c 和 三方代收 左右布局 -->
      <div class="section-row">
        <!-- c2c 区域 -->
        <div class="metrics-section">
          <div class="section-header" @click="showC2c = !showC2c">
            <h3 class="section-title">c2c</h3>
            <span class="section-value">{{ (metrics.c2cCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.c2cAmount || 0) }} 元</span>
            <span class="toggle-icon">{{ showC2c ? '▼' : '▶' }}</span>
          </div>
          <div v-show="showC2c" class="c2c-content">
            <div class="detail-item">
              <span class="detail-label">点确认（用户确认到账）</span>
              <span class="detail-value">{{ (metrics.c2cConfirmCount || 0).toLocaleString() }} 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">点确认（用户确认到账）-平均处理时间</span>
              <span class="detail-value">{{ formatTimeMinutes(metrics.c2cConfirmAvgTime) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">人工审核:通过</span>
              <span class="detail-value">{{ (metrics.c2cManualAuditCount || 0).toLocaleString() }} 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">审核-成功平均处理时间</span>
              <span class="detail-value">{{ formatTimeMinutes(metrics.c2cAuditSuccessAvgTime) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">用户较久补材料后成功</span>
              <span class="detail-value">{{ (metrics.c2cOver11MinSuccessCount || 0).toLocaleString() }} 笔</span>
            </div>
            <div v-if="showFormula" class="section-formula">
              <strong>c2c：</strong>银行卡代号=AUCTION_PAYMENT_CARD, 到账金额>0, 状态包含「用户确认到帐/用戶確認到帳」<br>
              <strong>点确认：</strong>到账金额>0, 状态包含「用户确认到帐/用戶確認到帳」<br>
              <strong>人工审核:通过：</strong>银行卡代号=AUCTION_PAYMENT_CARD, 到账金额>0, 状态包含「金額補單/金额补单」, 处理时间≤11分钟<br>
              <strong>用户较久补材料后成功：</strong>银行卡代号=AUCTION_PAYMENT_CARD，到账金额>0，状态包含「金額補單/金额补单」，处理时间>11分钟
            </div>
          </div>
        </div>

        <!-- 三方代收 区域 -->
        <div class="metrics-section">
          <div class="section-header" @click="showThirdParty = !showThirdParty">
            <h3 class="section-title">三方代收（一般卡订单成功）</h3>
            <span class="section-value">{{ (metrics.thirdPartyCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.thirdPartyAmount || 0) }} 元</span>
            <span class="toggle-icon">{{ showThirdParty ? '▼' : '▶' }}</span>
          </div>
          <div v-show="showThirdParty" class="c2c-content">
            <!-- 动态显示配置的三方代收卡 -->
            <div v-for="card in (metrics.configuredThirdPartyCards || [])" :key="card.cardNumber" class="detail-item">
              <span class="detail-label">{{ card.name }} ({{ card.cardNumber }})</span>
              <span class="detail-value">{{ ((metrics.thirdPartyByCard && metrics.thirdPartyByCard[card.cardNumber]) ? metrics.thirdPartyByCard[card.cardNumber].count : 0).toLocaleString() }} 笔 / {{ formatAmount((metrics.thirdPartyByCard && metrics.thirdPartyByCard[card.cardNumber]) ? metrics.thirdPartyByCard[card.cardNumber].amount : 0) }} 元</span>
            </div>
            <div v-if="!metrics.configuredThirdPartyCards || metrics.configuredThirdPartyCards.length === 0" class="detail-item" style="color: #999; font-style: italic;">
              <span>尚未配置三方代收卡代号，请至「報表三方設定」新增</span>
            </div>
            <div v-if="showFormula" class="section-formula">
              <strong>数据范围：</strong>商户不含「支付宝/支付寶」、不含「微信」、不含「test」、不含「qa」、不含「線下/线下」，到账金额>0<br>
              <strong>三方代收：</strong>银行卡代号匹配「報表三方設定」配置的卡代号前缀
            </div>
          </div>
        </div>
      </div>

      <!-- 骗分 和 商业平台 左右布局 -->
      <div class="section-row">
        <!-- 骗分没到账来找 区域 -->
        <div class="metrics-section">
          <div class="section-header" @click="showFraud = !showFraud">
            <h3 class="section-title">骗分没到账来找</h3>
            <span class="section-value">{{ formatAmount(fraudStats.bankCard.manualAmount + fraudStats.bankCard.creditAmount) }} 元 / {{ (fraudStats.bankCard.manualCount + fraudStats.bankCard.creditCount).toLocaleString() }} 笔</span>
            <span class="toggle-icon">{{ showFraud ? '▼' : '▶' }}</span>
          </div>
          <div v-show="showFraud" class="c2c-content">
            <div class="detail-item">
              <span class="detail-label">人工</span>
              <span class="detail-value">{{ formatAmount(fraudStats.bankCard.manualAmount) }} 元 / {{ fraudStats.bankCard.manualCount.toLocaleString() }} 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">信评</span>
              <span class="detail-value">{{ formatAmount(fraudStats.bankCard.creditAmount) }} 元 / {{ fraudStats.bankCard.creditCount.toLocaleString() }} 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">没上传回单重复出款充值上分</span>
              <span class="detail-value">{{ (fraudStats.bankCard.noReceiptCount || 0).toLocaleString() }} 笔</span>
            </div>
            <div class="detail-divider"></div>
            <div class="detail-item">
              <span class="detail-label">骗分拉黑</span>
              <span class="detail-value">{{ fraudStats.bankCard.fraudBlacklistCount.toLocaleString() }} 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">卡验及人验</span>
              <span class="detail-value">{{ fraudStats.bankCard.cardVerifyCount.toLocaleString() }} 笔</span>
            </div>
            <div v-if="showFormula" class="section-formula">
              <strong>数据来源：</strong>骗分统计（依筛选日期范围加总）<br>
              <strong>人工：</strong>渠道=银行卡，类型=人工<br>
              <strong>信评：</strong>渠道=银行卡，类型=信评<br>
              <strong>没上传回单重复出款充值上分：</strong>渠道=银行卡，类型=没上传回单重复出款充值上分<br>
              <strong>骗分拉黑：</strong>渠道=银行卡，骗分拉黑笔数<br>
              <strong>卡验及人验：</strong>渠道=银行卡，卡验及人验笔数
            </div>
          </div>
        </div>

        <!-- 商业平台 区域 -->
        <div class="metrics-section">
          <div class="section-header" @click="showCommercial = !showCommercial">
            <h3 class="section-title">商业平台</h3>
            <span class="toggle-icon">{{ showCommercial ? '▼' : '▶' }}</span>
          </div>
          <div v-show="showCommercial" class="c2c-content">
            <div class="detail-item">
              <span class="detail-label">外部充值成功</span>
              <span class="detail-value">{{ (metrics.commercialPlatformTotalSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.commercialPlatformTotalSuccessAmount || 0) }} 元</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">外部充值總申請</span>
              <span class="detail-value">{{ (metrics.commercialPlatformTotalAppCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.commercialPlatformTotalAppAmount || 0) }} 元</span>
            </div>
            <!-- 动态显示所有外部商户 -->
            <template v-if="metrics.commercialPlatformMerchants && metrics.commercialPlatformMerchants.length > 0">
              <template v-for="merchant in metrics.commercialPlatformMerchants" :key="merchant.name">
                <div class="detail-header">{{ merchant.name }}</div>
                <div class="detail-item">
                  <span class="detail-label">充值申请</span>
                  <span class="detail-value">{{ merchant.applicationCount.toLocaleString() }} 笔 / {{ formatAmount(merchant.applicationAmount) }} 元</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">充值成功笔数</span>
                  <span class="detail-value">{{ merchant.successCount.toLocaleString() }} 笔 / {{ formatAmount(merchant.successAmount) }} 元</span>
                </div>
              </template>
            </template>
            <template v-else>
              <div class="detail-header">外部商户</div>
              <div class="detail-item">
                <span class="detail-label">充值申请</span>
                <span class="detail-value">0 笔 / 0 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">充值成功笔数</span>
                <span class="detail-value">0 笔 / 0 元</span>
              </div>
            </template>
            <div v-if="showFormula" class="section-formula">
              <strong>数据范围：</strong>商戶設定中類型為「商業平台」（充值紀錄中商戶名稱含「外部商戶」）<br>
              <strong>充值申请：</strong>符合商户的记录笔数和充值金额<br>
              <strong>充值成功：</strong>状态不含「未充值」且到账金额 > 0 的记录，金额取到账金额
            </div>
          </div>
        </div>
      </div>
</template>
