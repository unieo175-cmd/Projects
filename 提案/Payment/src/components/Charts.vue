<script setup>
import { computed } from 'vue';

const props = defineProps({
  records: {
    type: Array,
    default: () => []
  }
});

// 筛选成功配对的记录（与重要信息-总申请笔数公式一致）
// 银行卡成功配对：极速充提3 且非支付宝/微信，有 bankCardCode
// 支付宝成功配对：包含支付宝/支付宝，有 bankCardCode
// 微信成功配对：包含微信，有 bankCardCode
const matchedRecords = computed(() => {
  return props.records.filter(r => {
    const hasJiSu = r.merchant && r.merchant.includes('极速充提3');
    const hasAlipay = r.merchant && (r.merchant.includes('支付宝') || r.merchant.includes('支付宝'));
    const hasWechat = r.merchant && r.merchant.includes('微信');

    // 银行卡成功配对
    const isBankCardMatched = hasJiSu && !hasAlipay && !hasWechat && r.bankCardCode;
    // 支付宝成功配对
    const isAlipayMatched = hasAlipay && r.bankCardCode;
    // 微信成功配对
    const isWechatMatched = hasWechat && r.bankCardCode;

    return isBankCardMatched || isAlipayMatched || isWechatMatched;
  });
});

// 充值成功的记录（AP > 0）
const successRecords = computed(() => matchedRecords.value.filter(r => r.receivedAmount > 0));

// 所有充值成功的记录（包含线下商户，用于银行金额分布和24小时交易分布）
const allSuccessRecords = computed(() => props.records.filter(r => r.receivedAmount > 0));

// 充值成功总笔数
const successTotalCount = computed(() => successRecords.value.length);

// Calculate channel distribution (充值渠道占比)
// 极速银行卡/支付宝/微信/三方 的充值成功占比
const channelDistribution = computed(() => {
  const dist = {
    bankCard: { count: 0, amount: 0 },
    alipay: { count: 0, amount: 0 },
    wechat: { count: 0, amount: 0 },
    thirdParty: { count: 0, amount: 0 }
  };

  // 判断是否为三方代收
  const isThirdParty = (bankCardCode) => {
    if (!bankCardCode) return false;
    const code = bankCardCode.toLowerCase();
    // 特定三方代收代码
    if (bankCardCode === 'GB-DahaomenJFB' || bankCardCode === 'HTc2cdeposit' ||
        bankCardCode === 'DDFdeposit' || bankCardCode === 'UC1020') {
      return true;
    }
    // 非 gb/auction 开头的也是三方
    if (!code.startsWith('gb') && !code.startsWith('auction')) {
      return true;
    }
    return false;
  };

  // 遍历所有充值成功记录 (receivedAmount > 0)
  props.records.filter(r => r.receivedAmount > 0).forEach(r => {
    const hasJiSu = r.merchant && r.merchant.includes('极速充提3');
    const hasAlipay = r.merchant && (r.merchant.includes('支付宝') || r.merchant.includes('支付宝'));
    const hasWechat = r.merchant && r.merchant.includes('微信');

    if (hasAlipay) {
      dist.alipay.count++;
      dist.alipay.amount += r.receivedAmount;
    } else if (hasWechat) {
      dist.wechat.count++;
      dist.wechat.amount += r.receivedAmount;
    } else if (hasJiSu) {
      // 极速银行卡需要进一步判断是否为三方
      if (isThirdParty(r.bankCardCode)) {
        dist.thirdParty.count++;
        dist.thirdParty.amount += r.receivedAmount;
      } else {
        dist.bankCard.count++;
        dist.bankCard.amount += r.receivedAmount;
      }
    } else {
      // 非极速充提3的其他商户归类为三方
      dist.thirdParty.count++;
      dist.thirdParty.amount += r.receivedAmount;
    }
  });

  const total = dist.bankCard.count + dist.alipay.count + dist.wechat.count + dist.thirdParty.count || 1;

  return [
    { label: '极速银行卡', value: dist.bankCard.count, amount: dist.bankCard.amount, percent: (dist.bankCard.count / total * 100).toFixed(1), color: '#0a84ff' },
    { label: '支付宝', value: dist.alipay.count, amount: dist.alipay.amount, percent: (dist.alipay.count / total * 100).toFixed(1), color: '#30d158' },
    { label: '微信', value: dist.wechat.count, amount: dist.wechat.amount, percent: (dist.wechat.count / total * 100).toFixed(1), color: '#34c759' },
    { label: '三方', value: dist.thirdParty.count, amount: dist.thirdParty.amount, percent: (dist.thirdParty.count / total * 100).toFixed(1), color: '#ff9f0a' }
  ].filter(d => d.value > 0);
});

// Calculate amount distribution by bank (使用所有充值成功记录，包含线下商户)
const bankDistribution = computed(() => {
  const bankMap = new Map();

  allSuccessRecords.value.forEach(r => {
    if (r.bankName) {
      const current = bankMap.get(r.bankName) || 0;
      bankMap.set(r.bankName, current + r.receivedAmount);
    }
  });

  return Array.from(bankMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, amount]) => ({ name, amount }));
});

const maxBankAmount = computed(() => {
  if (bankDistribution.value.length === 0) return 1;
  return Math.max(...bankDistribution.value.map(b => b.amount));
});

// 状态分布：极速银行卡/支付宝/微信/外部商戶/线下 充值成功比例
// 範圍：所有商戶但排除 test/qa
const statusDistribution = computed(() => {
  const dist = {
    bankCard: { count: 0, amount: 0 },      // 极速银行卡
    alipay: { count: 0, amount: 0 },        // 极速支付宝
    wechat: { count: 0, amount: 0 },        // 极速微信
    external: { count: 0, amount: 0 },      // 外部商戶
    offline: { count: 0, amount: 0 }        // 线下
  };

  // 訂單成功條件：正規化狀態有值且≠未充值/图文复核(已超时)/审核中(已超时)
  const isOrderSuccess = (r) => {
    const status = r.normalizedStatus || r.status || '';
    if (!status) return false;
    if (status.includes('未充值')) return false;
    if (status.includes('图文复核(已超时)') || status.includes('圖文複核(已超時)')) return false;
    if (status.includes('审核中(已超时)') || status.includes('審核中(已超時)')) return false;
    return true;
  };

  // 外部商戶判斷：商戶名稱以「外部商戶」開頭
  const isExternalMerchant = (merchant) => {
    if (!merchant) return false;
    return merchant.startsWith('外部商戶') || merchant.startsWith('外部商户');
  };

  // 外部商戶充值成功條件：狀態不含「未充值」且金額>0
  const isExternalSuccess = (r) => {
    const status = r.status || '';
    if (status.includes('未充值')) return false;
    return (r.amount || 0) > 0;
  };

  // 遍历所有记录
  // 統一充值成功條件：到帳金額 > 0（與重要信息的總充值成功筆數一致）
  props.records.forEach(r => {
    const merchant = r.merchant || '';
    const m = merchant.toLowerCase();

    // 排除 test/qa
    if (m.includes('test') || m.includes('qa')) return;

    // 基本充值成功條件：到帳金額 > 0
    const receivedAmount = r.receivedAmount || 0;
    if (receivedAmount <= 0) return;

    const hasJiSu = merchant.includes('极速充提3');
    const hasOffline = merchant.includes('線下') || merchant.includes('线下');
    const hasAlipay = merchant.includes('支付宝') || merchant.includes('支付寶');
    const hasWechat = merchant.includes('微信');

    // 1. 外部商戶（以「外部商戶」開頭）
    if (isExternalMerchant(merchant)) {
      dist.external.count++;
      dist.external.amount += receivedAmount;
    }
    // 2. 线下商戶
    else if (hasOffline) {
      dist.offline.count++;
      dist.offline.amount += receivedAmount;
    }
    // 3. 极速支付宝
    else if (hasJiSu && hasAlipay) {
      dist.alipay.count++;
      dist.alipay.amount += receivedAmount;
    }
    // 4. 极速微信
    else if (hasJiSu && hasWechat) {
      dist.wechat.count++;
      dist.wechat.amount += receivedAmount;
    }
    // 5. 极速银行卡
    else if (hasJiSu && !hasAlipay && !hasWechat) {
      dist.bankCard.count++;
      dist.bankCard.amount += receivedAmount;
    }
    // 6. 其他商戶（非以上分類但到帳金額>0）
    else {
      dist.external.count++;
      dist.external.amount += receivedAmount;
    }
  });

  const total = dist.bankCard.count + dist.alipay.count + dist.wechat.count + dist.external.count + dist.offline.count || 1;

  return [
    { label: '极速银行卡', value: dist.bankCard.count, amount: dist.bankCard.amount, percent: (dist.bankCard.count / total * 100).toFixed(1), color: '#ff9f0a' },
    { label: '极速支付宝', value: dist.alipay.count, amount: dist.alipay.amount, percent: (dist.alipay.count / total * 100).toFixed(1), color: '#0a84ff' },
    { label: '极速微信', value: dist.wechat.count, amount: dist.wechat.amount, percent: (dist.wechat.count / total * 100).toFixed(1), color: '#30d158' },
    { label: '外部商戶', value: dist.external.count, amount: dist.external.amount, percent: (dist.external.count / total * 100).toFixed(1), color: '#af52de' },
    { label: '线下', value: dist.offline.count, amount: dist.offline.amount, percent: (dist.offline.count / total * 100).toFixed(1), color: '#8e8e93' }
  ].filter(d => d.value > 0);
});

// 状态分布总笔数
const statusTotalCount = computed(() => {
  return statusDistribution.value.reduce((sum, item) => sum + item.value, 0);
});
</script>

<template>
  <div class="charts-container">
    <!-- 状态分布：极速银行卡/支付宝/微信 充值成功比例 -->
    <div class="chart-card">
      <h3>充值成功占比</h3>
      <div class="donut-chart">
        <svg viewBox="0 0 100 100" class="donut">
          <circle
            v-for="(item, index) in statusDistribution"
            :key="item.label"
            cx="50"
            cy="50"
            r="40"
            fill="none"
            :stroke="item.color"
            stroke-width="12"
            :stroke-dasharray="`${item.percent * 2.51} ${251 - item.percent * 2.51}`"
            :stroke-dashoffset="statusDistribution.slice(0, index).reduce((acc, d) => acc - d.percent * 2.51, 62.75)"
            class="donut-segment"
          />
        </svg>
        <div class="donut-center">
          <span class="donut-total">{{ statusTotalCount.toLocaleString() }}</span>
          <span class="donut-label">充值成功</span>
        </div>
      </div>
      <div class="legend">
        <div v-for="item in statusDistribution" :key="item.label" class="legend-item">
          <span class="legend-dot" :style="{ background: item.color }"></span>
          <span class="legend-label">{{ item.label }}</span>
          <span class="legend-value">
            {{ item.value.toLocaleString() }} ({{ item.percent }}%)
          </span>
        </div>
      </div>
    </div>

    <!-- Channel Distribution (暂时隐藏) -->
    <div class="chart-card" v-if="false">
      <h3>充值渠道占比</h3>
      <div class="donut-chart">
        <svg viewBox="0 0 100 100" class="donut">
          <circle
            v-for="(item, index) in channelDistribution"
            :key="item.label"
            cx="50"
            cy="50"
            r="40"
            fill="none"
            :stroke="item.color"
            stroke-width="12"
            :stroke-dasharray="`${item.percent * 2.51} ${251 - item.percent * 2.51}`"
            :stroke-dashoffset="channelDistribution.slice(0, index).reduce((acc, d) => acc - d.percent * 2.51, 62.75)"
            class="donut-segment"
          />
        </svg>
        <div class="donut-center">
          <span class="donut-total">{{ successTotalCount.toLocaleString() }}</span>
          <span class="donut-label">充值成功</span>
        </div>
      </div>
      <div class="legend">
        <div v-for="item in channelDistribution" :key="item.label" class="legend-item">
          <span class="legend-dot" :style="{ background: item.color }"></span>
          <span class="legend-label">{{ item.label }}</span>
          <span class="legend-value">
            {{ item.value.toLocaleString() }} ({{ item.percent }}%)
            <template v-if="item.amount > 0"> / {{ (item.amount / 10000).toFixed(1) }}万</template>
          </span>
        </div>
      </div>
    </div>

    <!-- Bank Distribution -->
    <div class="chart-card">
      <h3>银行金额分布 (Top 10)</h3>
      <div class="bar-chart">
        <div v-for="bank in bankDistribution" :key="bank.name" class="bar-row">
          <span class="bar-label">
            {{ bank.name }}
            <span class="bar-tooltip">{{ bank.name }}</span>
          </span>
          <div class="bar-container">
            <div
              class="bar-fill"
              :style="{ width: (bank.amount / maxBankAmount * 100) + '%' }"
            ></div>
          </div>
          <span class="bar-value">{{ (bank.amount / 10000).toFixed(1) }}万</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.charts-container {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.chart-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.chart-card h3 {
  color: #333;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
}

/* Donut Chart */
.donut-chart {
  position: relative;
  width: 160px;
  height: 160px;
  margin: 0 auto 16px;
}

.donut {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.donut-segment {
  transition: stroke-dasharray 0.3s;
}

.donut-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.donut-total {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #333;
}

.donut-label {
  display: block;
  font-size: 12px;
  color: #666;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-label {
  color: #333;
  font-size: 13px;
  flex: 1;
}

.legend-value {
  color: #666;
  font-size: 13px;
  font-family: monospace;
}

/* Bar Chart */
.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-label {
  width: 80px;
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;
  cursor: pointer;
}

.bar-tooltip {
  display: none;
  position: absolute;
  left: 0;
  bottom: 100%;
  background: #333;
  color: #fff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  z-index: 10;
  margin-bottom: 4px;
}

.bar-label:hover .bar-tooltip {
  display: block;
}

.bar-container {
  flex: 1;
  height: 20px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #FF9800, #FFB74D);
  border-radius: 4px;
  transition: width 0.3s;
}

.bar-value {
  width: 60px;
  text-align: right;
  font-size: 12px;
  color: #333;
  font-family: monospace;
}

@media (max-width: 900px) {
  .charts-container {
    grid-template-columns: 1fr;
  }
}
</style>
