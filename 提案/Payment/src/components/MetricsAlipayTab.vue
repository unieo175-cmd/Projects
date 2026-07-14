<script setup>
import { ref } from 'vue';
import { formatTime, formatTimeMinutes, formatAmount } from '../utils/csvParser';

defineProps({
  metrics: { type: Object, default: () => ({}) },
  showFormula: { type: Boolean, default: false },
  fraudStats: { type: Object, default: () => ({ alipay: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, noReceiptCount: 0, fraudBlacklistCount: 0, cardVerifyCount: 0 } }) },
  amountRanges: { type: Array, default: () => [] }
});

const showAlipay = ref(true);
const showAlipayC2c = ref(true);
const showAlipayThirdParty = ref(true);
const showAlipayCommercial = ref(true);
const showAlipayFraud = ref(true);
</script>

<template>
      <!-- 极速（支付宝） -->
      <div class="metrics-section">
        <div class="section-header" @click="showAlipay = !showAlipay">
          <h3 class="section-title">极速（支付宝）</h3>
          <span class="toggle-icon">{{ showAlipay ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showAlipay" class="jisu-content">
          <!-- 1. 充值申请笔数 + 成功配对 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值申请笔数</span>
              <span class="block-value">{{ (metrics.alipayApplicationCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayTotalMatchAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item detail-sub-header">
                <span class="detail-label">成功配对</span>
                <span class="detail-value">{{ (metrics.alipayTotalMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayTotalMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item detail-sub">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.alipayNormalMatchCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayNormalMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item detail-sub">
                <span class="detail-label">一般宝</span>
                <span class="detail-value">{{ (metrics.alipayExpressCardAppCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayExpressBaoMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item detail-sub">
                <span class="detail-label">极速提(卡)</span>
                <span class="detail-value">{{ (metrics.alipayJisuTikaCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayJisuTikaMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item detail-sub">
                <span class="detail-label">极速提(宝)</span>
                <span class="detail-value">{{ (metrics.alipayJisuTibaoCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayJisuTibaoMatchAmount || 0) }} 元</span>
              </div>
              <div class="detail-item" style="margin-top: 8px;">
                <span class="detail-label">建单成功等待无配对</span>
                <span class="detail-value">{{ (metrics.alipayWaitingForMatchCount || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">取无卡06提示</span>
                <span class="detail-value">0</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">无效申请</span>
                <span class="detail-value">{{ (metrics.alipayInvalidApplicationCount || 0).toLocaleString() }}</span>
              </div>
            </div>
            <div v-if="showFormula" class="block-formula">
              <strong>数据范围：</strong>充值纪录，商户含「支付宝」且不含test/qa/线下<br>
              <strong>一般卡：</strong>银行卡代号有值且≠AUCTION_PAYMENT_CARD，银行名称≠支付宝/支付宝(企)/微信支付<br>
              <strong>一般宝：</strong>银行卡代号有值且≠AUCTION_PAYMENT_CARD，银行名称=支付宝/支付宝(企)/微信支付<br>
              <strong>极速提(卡)：</strong>银行卡代号=AUCTION_PAYMENT_CARD，银行名称≠支付宝/支付宝(企)/微信支付<br>
              <strong>极速提(宝)：</strong>银行卡代号=AUCTION_PAYMENT_CARD，银行名称=支付宝/支付宝(企)/微信支付<br>
              <strong>建单成功等待无配对：</strong>未充值且银行卡为空的笔数（配不到银行卡）<br>
              <strong>取无卡06提示：</strong>payment-极速06统计记录中，商户号的极速模式：为支付宝，错误类型：取卡失败 的笔数<br>
              <strong>无效申请：</strong>payment 充值纪录中未充值且商户号为空，但银行卡栏位有值<br>
              <strong>充值申请笔数：</strong>一般卡 + 一般宝 + 极速提(卡) + 极速提(宝) + 建单成功等待无配对 + 取无卡06提示 + 无效申请<br>
              <strong>成功配对金额：</strong>使用充值金额计算
            </div>
          </div>

          <!-- 2. 订单成功笔数/金额 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">订单成功</span>
              <span class="block-value">{{ (metrics.alipayTotalOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayTotalOrderSuccessAmount || 0) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ (metrics.alipayNormalOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayNormalOrderSuccessAmount || 0) }} 元 / {{ metrics.alipayNormalMatchCount > 0 ? ((metrics.alipayNormalOrderSuccessCount || 0) / metrics.alipayNormalMatchCount * 100).toFixed(2) + '%' : '0.00%' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">一般宝</span>
                <span class="detail-value">{{ (metrics.alipayBaoOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayBaoOrderSuccessAmount || 0) }} 元 / {{ metrics.alipayExpressCardAppCount > 0 ? ((metrics.alipayBaoOrderSuccessCount || 0) / metrics.alipayExpressCardAppCount * 100).toFixed(2) + '%' : '0.00%' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提(卡)</span>
                <span class="detail-value">{{ (metrics.alipayJisuTikaOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayJisuTikaOrderSuccessAmount || 0) }} 元 / {{ metrics.alipayJisuTikaCount > 0 ? ((metrics.alipayJisuTikaOrderSuccessCount || 0) / metrics.alipayJisuTikaCount * 100).toFixed(2) + '%' : '0.00%' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提(宝)</span>
                <span class="detail-value">{{ (metrics.alipayJisuTibaoOrderSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayJisuTibaoOrderSuccessAmount || 0) }} 元 / {{ metrics.alipayJisuTibaoCount > 0 ? ((metrics.alipayJisuTibaoOrderSuccessCount || 0) / metrics.alipayJisuTibaoCount * 100).toFixed(2) + '%' : '0.00%' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">信评上分</span>
                <span class="detail-value">{{ (metrics.alipayCreditScoreSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayCreditScoreSuccessAmount || 0) }} 元 / {{ formatTime(metrics.alipayCreditScoreAvgTime) }}</span>
              </div>
              <div class="detail-item sub-item">
                <span class="detail-label">其中信评不含图文复核</span>
                <span class="detail-value">{{ (metrics.alipayCreditNoTuwenCount || 0).toLocaleString() }} 笔 / {{ formatTime(metrics.alipayCreditNoTuwenAvgTime) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">平均处理时间</span>
                <span class="detail-value">{{ formatTime(metrics.alipayNoCreditDowngradeAvgTime) }}</span>
              </div>
            </div>
            <div v-if="showFormula" class="block-formula">
              <strong>订单成功条件：</strong>正规化状态有值且≠未充值/图文复核(已超时)/圖文複核(已超時)/审核中(已超时)/審核中(已超時)<br>
              <strong>一般卡：</strong>银行卡代号有值且≠AUCTION_PAYMENT_CARD，银行名称≠支付宝/支付宝(企)/微信支付 + 上述条件<br>
              <strong>一般宝：</strong>银行卡代号有值且≠AUCTION_PAYMENT_CARD，银行名称=支付宝/支付宝(企)/微信支付 + 上述条件<br>
              <strong>极速提(卡)：</strong>银行卡代号=AUCTION_PAYMENT_CARD，银行名称≠支付宝/支付宝(企)/微信支付 + 上述条件<br>
              <strong>极速提(宝)：</strong>银行卡代号=AUCTION_PAYMENT_CARD，银行名称=支付宝/支付宝(企)/微信支付 + 上述条件<br>
              <strong>信评上分：</strong>状态包含「信用評分上分/信用评分上分」<br>
              <strong>其中信评不含图文复核：</strong>银行卡代号=AUCTION_PAYMENT_CARD，到账金额>0，状态包含「信用評分上分/信用评分上分」且≠「信用評分上分(圖文覆核)/信用评分上分(图文复核)」<br>
              <strong>平均处理时间：</strong>到账金额>0 的平均处理时间
            </div>
          </div>

          <!-- 4. 没信评降等配卡 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">没信评降等配卡</span>
              <span class="block-value">
                {{ (metrics.alipayNoCreditDowngradeTotal || 0).toLocaleString() }} 笔
              </span>
            </div>
            <div class="block-details amount-list scrollable-list">
              <div
                v-for="amt in amountRanges"
                :key="amt"
                class="detail-item"
              >
                <span class="detail-label">{{ amt.toLocaleString() }} 元</span>
                <span class="detail-value">{{ (metrics.alipayNoCreditDowngradeByAmount?.[amt] || 0).toLocaleString() }} 笔</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">其他金额</span>
                <span class="detail-value">{{ (metrics.alipayNoCreditDowngradeByAmount?.['other'] || 0).toLocaleString() }} 笔</span>
              </div>
            </div>
            <div v-if="showFormula" class="block-formula">
              <strong>条件：</strong>银行卡代号≠AUCTION_PAYMENT_CARD，到账金额≠0，用户等级≠0且≠-1<br>
              <strong>分组：</strong>按充值金额（申请金额）分组统计
            </div>
          </div>
        </div>
      </div>

      <!-- c2c 和 三方代收 左右布局（支付宝） -->
      <div class="section-row">
        <!-- c2c 区域 -->
        <div class="metrics-section">
          <div class="section-header" @click="showAlipayC2c = !showAlipayC2c">
            <h3 class="section-title">c2c</h3>
            <span class="section-value">{{ (metrics.alipayC2cCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayC2cAmount || 0) }} 元</span>
            <span class="toggle-icon">{{ showAlipayC2c ? '▼' : '▶' }}</span>
          </div>
          <div v-show="showAlipayC2c" class="c2c-content">
            <div class="detail-item">
              <span class="detail-label">点确认（用户确认到账）</span>
              <span class="detail-value">{{ (metrics.alipayC2cConfirmCount || 0).toLocaleString() }} 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">点确认（用户确认到账）-平均处理时间</span>
              <span class="detail-value">{{ formatTimeMinutes(metrics.alipayC2cConfirmAvgTime) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">人工审核:通过</span>
              <span class="detail-value">{{ (metrics.alipayC2cManualAuditCount || 0).toLocaleString() }} 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">审核-成功平均处理时间</span>
              <span class="detail-value">{{ formatTimeMinutes(metrics.alipayC2cAuditSuccessAvgTime) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">用户较久补材料后成功</span>
              <span class="detail-value">{{ (metrics.alipayC2cOver11MinSuccessCount || 0).toLocaleString() }} 笔</span>
            </div>
            <div v-if="showFormula" class="section-formula">
              <strong>c2c：</strong>银行卡代号=AUCTION_PAYMENT_CARD，到账金额>0，状态包含「用户确认到帐/用戶確認到帳」<br>
              <strong>点确认：</strong>到账金额>0，状态包含「用户确认到帐/用戶確認到帳」<br>
              <strong>人工审核:通过：</strong>银行卡代号包含AUCTION，到账金额>0，状态包含「金額補單/金额补单」，处理时间≤11分钟<br>
              <strong>用户较久补材料后成功：</strong>银行卡代号=AUCTION_PAYMENT_CARD，到账金额>0，状态包含「金額補單/金额补单」，处理时间>11分钟
            </div>
          </div>
        </div>

        <!-- 三方代收 区域（支付宝） -->
        <div class="metrics-section">
          <div class="section-header" @click="showAlipayThirdParty = !showAlipayThirdParty">
            <h3 class="section-title">三方代收（一般卡订单成功）</h3>
            <span class="section-value">{{ (metrics.alipayThirdPartyCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayThirdPartyAmount || 0) }} 元</span>
            <span class="toggle-icon">{{ showAlipayThirdParty ? '▼' : '▶' }}</span>
          </div>
          <div v-show="showAlipayThirdParty" class="c2c-content">
            <!-- 动态显示配置的三方代收卡 -->
            <div v-for="card in (metrics.configuredThirdPartyCards || [])" :key="card.cardNumber" class="detail-item">
              <span class="detail-label">{{ card.name }} ({{ card.cardNumber }})</span>
              <span class="detail-value">{{ ((metrics.alipayThirdPartyByCard && metrics.alipayThirdPartyByCard[card.cardNumber]) ? metrics.alipayThirdPartyByCard[card.cardNumber].count : 0).toLocaleString() }} 笔 / {{ formatAmount((metrics.alipayThirdPartyByCard && metrics.alipayThirdPartyByCard[card.cardNumber]) ? metrics.alipayThirdPartyByCard[card.cardNumber].amount : 0) }} 元</span>
            </div>
            <div v-if="!metrics.configuredThirdPartyCards || metrics.configuredThirdPartyCards.length === 0" class="detail-item" style="color: #999; font-style: italic;">
              <span>尚未配置三方代收卡代号，请至「報表三方設定」新增</span>
            </div>
            <div v-if="showFormula" class="section-formula">
              <strong>数据范围：</strong>商户含「支付宝/支付寶」、不含「test」、不含「qa」、不含「線下/线下」，到账金额>0<br>
              <strong>三方代收：</strong>银行卡代号匹配「報表三方設定」配置的卡代号前缀
            </div>
          </div>
        </div>
      </div>

      <!-- 骗分 和 宝转卡渠道 左右布局（支付宝） -->
      <div class="section-row">
        <!-- 骗分没到账来找 区域 -->
        <div class="metrics-section">
          <div class="section-header" @click="showAlipayFraud = !showAlipayFraud">
            <h3 class="section-title">骗分没到账来找</h3>
            <span class="section-value">{{ formatAmount(fraudStats.alipay.manualAmount + fraudStats.alipay.creditAmount) }} 元 / {{ (fraudStats.alipay.manualCount + fraudStats.alipay.creditCount).toLocaleString() }} 笔</span>
            <span class="toggle-icon">{{ showAlipayFraud ? '▼' : '▶' }}</span>
          </div>
          <div v-show="showAlipayFraud" class="c2c-content">
            <div class="detail-item">
              <span class="detail-label">人工</span>
              <span class="detail-value">{{ formatAmount(fraudStats.alipay.manualAmount) }} 元 / {{ fraudStats.alipay.manualCount.toLocaleString() }} 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">信评</span>
              <span class="detail-value">{{ formatAmount(fraudStats.alipay.creditAmount) }} 元 / {{ fraudStats.alipay.creditCount.toLocaleString() }} 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">没上传回单重复出款充值上分</span>
              <span class="detail-value">{{ fraudStats.alipay.noReceiptCount.toLocaleString() }} 笔</span>
            </div>
            <div class="detail-divider"></div>
            <div class="detail-item">
              <span class="detail-label">骗分拉黑</span>
              <span class="detail-value">{{ fraudStats.alipay.fraudBlacklistCount.toLocaleString() }} 笔</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">卡验及人验</span>
              <span class="detail-value">{{ fraudStats.alipay.cardVerifyCount.toLocaleString() }} 笔</span>
            </div>
            <div v-if="showFormula" class="section-formula">
              <strong>数据来源：</strong>骗分统计（依筛选日期范围加总）<br>
              <strong>人工：</strong>渠道=支付宝，类型=人工<br>
              <strong>信评：</strong>渠道=支付宝，类型=信评<br>
              <strong>没上传回单重复出款充值上分：</strong>渠道=支付宝，没上传回单笔数<br>
              <strong>骗分拉黑：</strong>渠道=支付宝，骗分拉黑笔数<br>
              <strong>卡验及人验：</strong>渠道=支付宝，卡验及人验笔数
            </div>
          </div>
        </div>

        <!-- 宝转卡渠道及宝转宝渠道 提现申请笔数统计 -->
      <div class="metrics-section">
        <div class="section-header">
          <h3 class="section-title">宝转卡渠道及宝转宝渠道 提现申请笔数统计</h3>
        </div>
        <div class="c2c-content">
          <div class="detail-header">宝转卡渠道，配支付宝提现</div>
          <div class="detail-item">
            <span class="detail-label">申请</span>
            <span class="detail-value">{{ (metrics.alipayBaoZhuanKaCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayBaoZhuanKaAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">成功</span>
            <span class="detail-value">{{ (metrics.alipayBaoZhuanKaSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayBaoZhuanKaSuccessAmount || 0) }} 元</span>
          </div>

          <div class="detail-header">宝转宝渠道，配银行卡提现</div>
          <div class="detail-item">
            <span class="detail-label">申请</span>
            <span class="detail-value">{{ (metrics.alipayBaoZhuanBaoCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayBaoZhuanBaoAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">成功</span>
            <span class="detail-value">{{ (metrics.alipayBaoZhuanBaoSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayBaoZhuanBaoSuccessAmount || 0) }} 元</span>
          </div>

          <div class="detail-item summary-item">
            <span class="detail-label">整体 配对成功/提现申请</span>
            <span class="detail-value highlight">{{ (metrics.alipayOverallMatchRate || 0).toFixed(2) }}%</span>
          </div>
          <div v-if="showFormula" class="section-formula">
            <strong>宝转卡渠道 申请：</strong>商户包含「转卡」，银行卡代号=AUCTION_PAYMENT_CARD，银行名称=支付宝<br>
            <strong>宝转卡渠道 成功：</strong>上述条件 + 到账金额≠0<br>
            <strong>宝转宝渠道 申请：</strong>商户包含「宝)」，银行卡代号=AUCTION_PAYMENT_CARD，银行名称≠支付宝<br>
            <strong>宝转宝渠道 成功：</strong>上述条件 + 到账金额≠0<br>
            <strong>整体 配对成功/提现申请：</strong><br>
            　分子 = 银行卡订单成功极速提金额 + 支付宝订单成功极速提(卡)金额 + 支付宝订单成功极速提(宝)金额<br>
            　分母 = 支付宝提现申请金额 + 银行卡提现申请金额（来自提现分析）
          </div>
        </div>
      </div>
      </div>

      <!-- 商业平台（支付宝） -->
      <div class="metrics-section">
        <div class="section-header" @click="showAlipayCommercial = !showAlipayCommercial">
          <h3 class="section-title">商业平台</h3>
          <span class="toggle-icon">{{ showAlipayCommercial ? '▼' : '▶' }}</span>
        </div>
        <div v-show="showAlipayCommercial" class="c2c-content">
          <div class="detail-item">
            <span class="detail-label">外部充值成功</span>
            <span class="detail-value">{{ (metrics.alipayCommercialPlatformTotalSuccessCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayCommercialPlatformTotalSuccessAmount || 0) }} 元</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">外部充值總申請</span>
            <span class="detail-value">{{ (metrics.alipayCommercialPlatformTotalAppCount || 0).toLocaleString() }} 笔 / {{ formatAmount(metrics.alipayCommercialPlatformTotalAppAmount || 0) }} 元</span>
          </div>
          <div v-if="showFormula" class="section-formula">
            <strong>数据范围：</strong>商戶極速模式為「支付寶」且商戶名稱以「外部商戶」開頭<br>
            <strong>外部充值成功：</strong>狀態不含「未充值」且到帳金額 > 0<br>
            <strong>外部充值總申請：</strong>符合商戶條件的所有記錄（不限狀態）
          </div>
        </div>
      </div>
</template>
