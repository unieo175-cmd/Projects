<script setup>
import { ref } from 'vue';
import { formatTime, formatTimeMinutes, formatAmount } from '../utils/csvParser';

defineProps({
  metrics: { type: Object, default: () => ({}) },
  showFormula: { type: Boolean, default: false },
  fraudStats: { type: Object, default: () => ({ wechat: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, noReceiptCount: 0 } }) },
  amountRanges: { type: Array, default: () => [] }
});

const showWechat = ref(true);
const showWechatC2c = ref(false);
const showWechatThirdParty = ref(false);
const showWechatFraud = ref(false);
const showWechatCommercial = ref(true);
</script>

<template>
      <!-- 极速（微信） -->
      <div class="metrics-section">
        <div class="section-header" @click="showWechat = !showWechat">
          <h3 class="section-title">极速（微信）</h3>
          <span class="toggle-icon">{{ showWechat ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showWechat" class="jisu-content">
          <!-- 1. 充值申请笔数 + 成功配对 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值申请笔数</span>
              <span class="block-value">{{ (metrics.wechatApplicationCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatTotalMatchAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item detail-sub-header">
                <span class="detail-label">成功配对</span>
                <span class="detail-value">{{ (metrics.wechatTotalMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatTotalMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item detail-sub">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.wechatNormalMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatNormalMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item detail-sub">
                <span class="detail-label">一般微</span>
                <span class="detail-value">{{ (metrics.wechatExpressBaoMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatExpressBaoMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item detail-sub">
                <span class="detail-label">极速提(卡)</span>
                <span class="detail-value">{{ (metrics.wechatJisuTikaMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatJisuTikaMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item detail-sub">
                <span class="detail-label">极速提(微)</span>
                <span class="detail-value">{{ (metrics.wechatJisuTibaoMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatJisuTibaoMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item" style="margin-top: 8px;">
                <span class="detail-label">建单成功等待无配对</span>
                <span class="detail-value">{{ (metrics.wechatWaitingForMatchCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">取无卡06提示</span>
                <span class="detail-value">0</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">无效申请</span>
                <span class="detail-value">{{ (metrics.wechatInvalidApplicationCount || 0).toLocaleString() }}</span>
              </div>
            </div>
            <div v-if="showFormula" class="block-formula">
              <strong>数据范围：</strong>充值纪录，商户含「微信」且不含test/qa/线下<br>
              <strong>一般卡：</strong>银行卡代号有值且≠AUCTION_PAYMENT_CARD，银行名称≠支付宝/支付宝(企)/微信支付<br>
              <strong>一般微：</strong>银行卡代号有值且≠AUCTION_PAYMENT_CARD，银行名称=微信支付<br>
              <strong>极速提(卡)：</strong>银行卡代号=AUCTION_PAYMENT_CARD，银行名称≠支付宝/支付宝(企)/微信支付<br>
              <strong>极速提(微)：</strong>银行卡代号=AUCTION_PAYMENT_CARD，银行名称=微信支付<br>
              <strong>建单成功等待无配对：</strong>未充值且银行卡为空的笔数（配不到银行卡）<br>
              <strong>取无卡06提示：</strong>payment-极速06统计记录中，商户号的极速模式：为微信，错误类型：取卡失败 的笔数<br>
              <strong>无效申请：</strong>payment 充值纪录中未充值且商户号为空，但银行卡栏位有值<br>
              <strong>充值申请笔数：</strong>一般卡 + 一般微 + 极速提(卡) + 极速提(微) + 建单成功等待无配对 + 取无卡06提示 + 无效申请<br>
              <strong>成功配对金额：</strong>使用充值金额计算
            </div>
          </div>

          <!-- 2. 订单成功笔数/金额 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">订单成功</span>
              <span class="block-value">{{ (metrics.wechatTotalOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatTotalOrderSuccessAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.wechatNormalOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatNormalOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">一般微</span>
                <span class="detail-value">{{ (metrics.wechatBaoOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatBaoOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提(卡)</span>
                <span class="detail-value">{{ (metrics.wechatJisuTikaOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatJisuTikaOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提(微)</span>
                <span class="detail-value">{{ (metrics.wechatJisuTibaoOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatJisuTibaoOrderSuccessAmount || 0) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">信评上分</span>
                <span class="detail-value">{{ (metrics.wechatCreditScoreSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatCreditScoreSuccessAmount || 0) }} 元 / {{ formatTime(metrics.wechatCreditScoreAvgTime) }}</span>
              </div>
              <div class="detail-item sub-item">
                <span class="detail-label">其中信评不含图文复核</span>
                <span class="detail-value">0 笔 / 00:00:00</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">平均处理时间</span>
                <span class="detail-value">{{ formatTime(metrics.wechatNoCreditDowngradeAvgTime) }}</span>
              </div>
            </div>
            <div v-if="showFormula" class="block-formula">
              <strong>订单成功条件：</strong>正规化状态有值且≠未充值/图文复核(已超时)/圖文複核(已超時)/审核中(已超时)/審核中(已超時)<br>
              <strong>一般卡：</strong>银行卡代号有值且≠AUCTION_PAYMENT_CARD，银行名称≠支付宝/支付宝(企)/微信支付 + 上述条件<br>
              <strong>一般微：</strong>银行卡代号有值且≠AUCTION_PAYMENT_CARD，银行名称=微信支付 + 上述条件<br>
              <strong>极速提(卡)：</strong>银行卡代号=AUCTION_PAYMENT_CARD，银行名称≠支付宝/支付宝(企)/微信支付 + 上述条件<br>
              <strong>极速提(微)：</strong>银行卡代号=AUCTION_PAYMENT_CARD，银行名称=微信支付 + 上述条件<br>
              <strong>信评上分：</strong>到账金额>0 且状态包含「信用」<br>
              <strong>平均处理时间：</strong>到账金额>0，用户等级≠0且≠-1 的平均处理时间
            </div>
          </div>

          <!-- 4. 没信评降等配卡 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">没信评降等配卡</span>
              <span class="block-value">
                {{ (metrics.wechatNoCreditDowngradeTotal || 0).toLocaleString() }} 笔
              </span>
            </div>
            <div class="block-details amount-list scrollable-list">
              <div
                v-for="amt in amountRanges"
                :key="amt"
                class="detail-item"
              >
                <span class="detail-label">{{ amt.toLocaleString() }} 元</span>
                <span class="detail-value">{{ (metrics.wechatNoCreditDowngradeByAmount?.[amt] || 0).toLocaleString() }} 笔</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">其他金额</span>
                <span class="detail-value">{{ (metrics.wechatNoCreditDowngradeByAmount?.['other'] || 0).toLocaleString() }} 笔</span>
              </div>
            </div>
            <div v-if="showFormula" class="block-formula">
              <strong>条件：</strong>银行卡代号≠AUCTION_PAYMENT_CARD，到账金额≠0，用户等级≠0且≠-1<br>
              <strong>分组：</strong>按充值金额（申请金额）分组统计
            </div>
          </div>
        </div>
      </div>

      <!-- c2c 和 三方代收 左右布局（微信） -->
      <div class="section-row">
        <!-- c2c 区域（微信） -->
        <div class="metrics-section">
          <div class="section-header" @click="showWechatC2c = !showWechatC2c">
            <h3 class="section-title">c2c</h3>
            <span class="section-value">{{ (metrics.wechatC2cCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatC2cAmount || 0) }} 元</span>
            <span class="toggle-icon">{{ showWechatC2c ? '▼' : '▶' }}</span>
          </div>
          <div v-show="showWechatC2c" class="c2c-content">
            <div class="detail-item">
              <span class="detail-label">点确认（用户确认到账）</span>
              <span class="detail-value">{{ (metrics.wechatUserConfirmCount || 0).toLocaleString() }} 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">点确认（用户确认到账）-平均处理时间</span>
              <span class="detail-value">{{ formatTimeMinutes(metrics.wechatC2cConfirmAvgTime) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">人工审核:通过</span>
              <span class="detail-value">{{ (metrics.wechatManualAuditPassCount || 0).toLocaleString() }} 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">审核-成功平均处理时间</span>
              <span class="detail-value">{{ formatTimeMinutes(metrics.wechatC2cAuditSuccessAvgTime) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">用户较久补材料后成功</span>
              <span class="detail-value">{{ (metrics.wechatOver11minCount || 0).toLocaleString() }} 笔</span>
            </div>
            <div v-if="showFormula" class="section-formula">
              <strong>c2c：</strong>银行卡代号=AUCTION_PAYMENT_CARD，到账金额>0，状态包含「用户确认到帐/用戶確認到帳」<br>
              <strong>点确认：</strong>到账金额>0，状态包含「用户确认到帐/用戶確認到帳」<br>
              <strong>人工审核:通过：</strong>银行卡代号包含AUCTION，到账金额>0，状态包含「金額補單/金额补单」，处理时间≤11分钟<br>
              <strong>用户较久补材料后成功：</strong>银行卡代号=AUCTION_PAYMENT_CARD，到账金额>0，状态包含「金額補單/金额补单」，处理时间>11分钟
            </div>
          </div>
        </div>

        <!-- 三方代收 区域（微信） -->
        <div class="metrics-section">
          <div class="section-header" @click="showWechatThirdParty = !showWechatThirdParty">
            <h3 class="section-title">三方代收（一般卡订单成功）</h3>
            <span class="section-value">{{ (metrics.wechatThirdPartyCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatThirdPartyAmount || 0) }} 元</span>
            <span class="toggle-icon">{{ showWechatThirdParty ? '▼' : '▶' }}</span>
          </div>
          <div v-show="showWechatThirdParty" class="c2c-content">
            <!-- 动态显示配置的三方代收卡 -->
            <div v-for="card in (metrics.configuredThirdPartyCards || [])" :key="card.cardNumber" class="detail-item">
              <span class="detail-label">{{ card.name }} ({{ card.cardNumber }})</span>
              <span class="detail-value">{{ ((metrics.wechatThirdPartyByCard && metrics.wechatThirdPartyByCard[card.cardNumber]) ? metrics.wechatThirdPartyByCard[card.cardNumber].count : 0).toLocaleString() }} 笔 / {{ formatAmount((metrics.wechatThirdPartyByCard && metrics.wechatThirdPartyByCard[card.cardNumber]) ? metrics.wechatThirdPartyByCard[card.cardNumber].amount : 0) }} 元</span>
            </div>
            <div v-if="!metrics.configuredThirdPartyCards || metrics.configuredThirdPartyCards.length === 0" class="detail-item" style="color: #999; font-style: italic;">
              <span>尚未配置三方代收卡代号，请至「報表三方設定」新增</span>
            </div>
            <div v-if="showFormula" class="section-formula">
              <strong>数据范围：</strong>商户含「微信」、不含「test」、不含「qa」、不含「線下/线下」，到账金额>0<br>
              <strong>三方代收：</strong>银行卡代号匹配「報表三方設定」配置的卡代号前缀
            </div>
          </div>
        </div>
      </div>

      <!-- 骗分 左右布局（微信） -->
      <div class="section-row">
        <!-- 骗分没到账来找 区域（微信） -->
        <div class="metrics-section">
          <div class="section-header" @click="showWechatFraud = !showWechatFraud">
            <h3 class="section-title">骗分没到账来找</h3>
            <span class="section-value">{{ formatAmount(fraudStats.wechat.manualAmount + fraudStats.wechat.creditAmount) }} 元 / {{ (fraudStats.wechat.manualCount + fraudStats.wechat.creditCount).toLocaleString() }} 笔</span>
            <span class="toggle-icon">{{ showWechatFraud ? '▼' : '▶' }}</span>
          </div>
          <div v-show="showWechatFraud" class="c2c-content">
            <div class="detail-item">
              <span class="detail-label">人工</span>
              <span class="detail-value">{{ formatAmount(fraudStats.wechat.manualAmount) }} 元 / {{ fraudStats.wechat.manualCount.toLocaleString() }} 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">信评</span>
              <span class="detail-value">{{ formatAmount(fraudStats.wechat.creditAmount) }} 元 / {{ fraudStats.wechat.creditCount.toLocaleString() }} 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">没上传回单重复出款充值上分</span>
              <span class="detail-value">{{ (fraudStats.wechat.noReceiptCount || 0).toLocaleString() }} 笔</span>
            </div>
            <div class="detail-divider"></div>
            <div class="detail-item">
              <span class="detail-label">骗分拉黑</span>
              <span class="detail-value">0 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">卡验及人验</span>
              <span class="detail-value">0 笔</span>
            </div>
            <div v-if="showFormula" class="section-formula">
              <strong>数据来源：</strong>骗分统计（依筛选日期范围加总）<br>
              <strong>人工：</strong>渠道=微信，类型=人工<br>
              <strong>信评：</strong>渠道=微信，类型=信评<br>
              <strong>没上传回单重复出款充值上分：</strong>渠道=微信，类型=没上传回单重复出款充值上分<br>
              <strong>骗分拉黑：</strong>渠道=微信，骗分拉黑笔数<br>
              <strong>卡验及人验：</strong>渠道=微信，卡验及人验笔数
            </div>
          </div>
        </div>
        <!-- 占位区域 -->
        <div class="metrics-section-placeholder"></div>
      </div>

      <!-- 商业平台（微信） -->
      <div class="metrics-section">
        <div class="section-header" @click="showWechatCommercial = !showWechatCommercial">
          <h3 class="section-title">商业平台</h3>
          <span class="toggle-icon">{{ showWechatCommercial ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showWechatCommercial" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">外部充值成功</span>
            <span class="detail-value">{{ (metrics.wechatCommercialPlatformTotalSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatCommercialPlatformTotalSuccessAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">外部充值總申請</span>
            <span class="detail-value">{{ (metrics.wechatCommercialPlatformTotalAppCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.wechatCommercialPlatformTotalAppAmount || 0) }} 元</span>
          </div>
          <div v-if="showFormula" class="section-formula">
            <strong>数据范围：</strong>商戶極速模式為「微信」且商戶名稱以「外部商戶」開頭<br>
            <strong>外部充值成功：</strong>狀態不含「未充值」且到帳金額 > 0<br>
            <strong>外部充值總申請：</strong>符合商戶條件的所有記錄（不限狀態）
          </div>
        </div>
      </div>
</template>
