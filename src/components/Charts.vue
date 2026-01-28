<script setup>
import { computed } from 'vue';

const props = defineProps({
  records: {
    type: Array,
    default: () => []
  }
});

// 篩選成功配對的記錄（與重要信息-總申請筆數公式一致）
// 銀行卡成功配對：极速充提3 且非支付寶/微信，有 bankCardCode
// 支付寶成功配對：包含支付宝/支付寶，有 bankCardCode
// 微信成功配對：包含微信，有 bankCardCode
const matchedRecords = computed(() => {
  return props.records.filter(r => {
    const hasJiSu = r.merchant && r.merchant.includes('极速充提3');
    const hasAlipay = r.merchant && (r.merchant.includes('支付宝') || r.merchant.includes('支付寶'));
    const hasWechat = r.merchant && r.merchant.includes('微信');

    // 銀行卡成功配對
    const isBankCardMatched = hasJiSu && !hasAlipay && !hasWechat && r.bankCardCode;
    // 支付寶成功配對
    const isAlipayMatched = hasAlipay && r.bankCardCode;
    // 微信成功配對
    const isWechatMatched = hasWechat && r.bankCardCode;

    return isBankCardMatched || isAlipayMatched || isWechatMatched;
  });
});

// 充值成功的記錄（AP > 0）
const successRecords = computed(() => matchedRecords.value.filter(r => r.receivedAmount > 0));

// 充值成功總筆數
const successTotalCount = computed(() => successRecords.value.length);

// Calculate channel distribution (充值渠道佔比)
// 極速銀行卡/支付寶/微信/三方 的充值成功佔比
const channelDistribution = computed(() => {
  const dist = {
    bankCard: { count: 0, amount: 0 },
    alipay: { count: 0, amount: 0 },
    wechat: { count: 0, amount: 0 },
    thirdParty: { count: 0, amount: 0 }
  };

  // 判斷是否為三方代收
  const isThirdParty = (bankCardCode) => {
    if (!bankCardCode) return false;
    const code = bankCardCode.toLowerCase();
    // 特定三方代收代碼
    if (bankCardCode === 'GB-DahaomenJFB' || bankCardCode === 'HTc2cdeposit' ||
        bankCardCode === 'DDFdeposit' || bankCardCode === 'UC1020') {
      return true;
    }
    // 非 gb/auction 開頭的也是三方
    if (!code.startsWith('gb') && !code.startsWith('auction')) {
      return true;
    }
    return false;
  };

  // 遍歷所有充值成功記錄 (receivedAmount > 0)
  props.records.filter(r => r.receivedAmount > 0).forEach(r => {
    const hasJiSu = r.merchant && r.merchant.includes('极速充提3');
    const hasAlipay = r.merchant && (r.merchant.includes('支付宝') || r.merchant.includes('支付寶'));
    const hasWechat = r.merchant && r.merchant.includes('微信');

    if (hasAlipay) {
      dist.alipay.count++;
      dist.alipay.amount += r.receivedAmount;
    } else if (hasWechat) {
      dist.wechat.count++;
      dist.wechat.amount += r.receivedAmount;
    } else if (hasJiSu) {
      // 極速銀行卡需要進一步判斷是否為三方
      if (isThirdParty(r.bankCardCode)) {
        dist.thirdParty.count++;
        dist.thirdParty.amount += r.receivedAmount;
      } else {
        dist.bankCard.count++;
        dist.bankCard.amount += r.receivedAmount;
      }
    } else {
      // 非极速充提3的其他商戶歸類為三方
      dist.thirdParty.count++;
      dist.thirdParty.amount += r.receivedAmount;
    }
  });

  const total = dist.bankCard.count + dist.alipay.count + dist.wechat.count + dist.thirdParty.count || 1;

  return [
    { label: '極速銀行卡', value: dist.bankCard.count, amount: dist.bankCard.amount, percent: (dist.bankCard.count / total * 100).toFixed(1), color: '#0a84ff' },
    { label: '支付寶', value: dist.alipay.count, amount: dist.alipay.amount, percent: (dist.alipay.count / total * 100).toFixed(1), color: '#30d158' },
    { label: '微信', value: dist.wechat.count, amount: dist.wechat.amount, percent: (dist.wechat.count / total * 100).toFixed(1), color: '#34c759' },
    { label: '三方', value: dist.thirdParty.count, amount: dist.thirdParty.amount, percent: (dist.thirdParty.count / total * 100).toFixed(1), color: '#ff9f0a' }
  ].filter(d => d.value > 0);
});

// Calculate amount distribution by bank (使用充值成功記錄)
const bankDistribution = computed(() => {
  const bankMap = new Map();

  successRecords.value.forEach(r => {
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

// Calculate hourly distribution (使用充值成功記錄，顯示筆數和金額)
const hourlyDistribution = computed(() => {
  const hoursData = new Array(24).fill(null).map(() => ({ count: 0, amount: 0 }));

  successRecords.value.forEach(r => {
    if (r.requestTime) {
      const match = r.requestTime.match(/(\d{2}):\d{2}:\d{2}/);
      if (match) {
        const hour = parseInt(match[1]);
        hoursData[hour].count++;
        hoursData[hour].amount += r.receivedAmount;
      }
    }
  });

  const maxCount = Math.max(...hoursData.map(h => h.count)) || 1;
  return hoursData.map((data, hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    count: data.count,
    amount: data.amount,
    percent: (data.count / maxCount * 100)
  }));
});

const maxBankAmount = computed(() => {
  if (bankDistribution.value.length === 0) return 1;
  return Math.max(...bankDistribution.value.map(b => b.amount));
});
</script>

<template>
  <div class="charts-container">
    <!-- Channel Distribution (暫時隱藏) -->
    <div class="chart-card" v-if="false">
      <h3>充值渠道佔比</h3>
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
            <template v-if="item.amount > 0"> / {{ (item.amount / 10000).toFixed(1) }}萬</template>
          </span>
        </div>
      </div>
    </div>

    <!-- Bank Distribution -->
    <div class="chart-card">
      <h3>銀行金額分佈 (Top 10)</h3>
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
          <span class="bar-value">{{ (bank.amount / 10000).toFixed(1) }}萬</span>
        </div>
      </div>
    </div>

    <!-- Hourly Distribution -->
    <div class="chart-card wide">
      <h3>24小時交易分佈</h3>
      <div class="hourly-chart">
        <div v-for="item in hourlyDistribution" :key="item.hour" class="hour-bar" :title="`${item.count}筆 / ${(item.amount / 10000).toFixed(1)}萬`">
          <div class="hour-tooltip">{{ item.count }}筆<br>{{ (item.amount / 10000).toFixed(1) }}萬</div>
          <div class="hour-fill" :style="{ height: item.percent + '%' }"></div>
          <span class="hour-label">{{ item.hour.split(':')[0] }}</span>
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

.chart-card.wide {
  grid-column: span 2;
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

/* Hourly Chart */
.hourly-chart {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 120px;
  gap: 4px;
}

.hour-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  position: relative;
}

.hour-tooltip {
  display: none;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: #fff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  text-align: center;
  z-index: 10;
  margin-bottom: 4px;
}

.hour-bar:hover .hour-tooltip {
  display: block;
}

.hour-fill {
  width: 100%;
  background: linear-gradient(180deg, #4a4a9e, #6a6abe);
  border-radius: 2px 2px 0 0;
  margin-top: auto;
  transition: height 0.3s;
  min-height: 2px;
}

.hour-label {
  font-size: 10px;
  color: #666;
  margin-top: 8px;
}

@media (max-width: 900px) {
  .charts-container {
    grid-template-columns: 1fr;
  }

  .chart-card.wide {
    grid-column: span 1;
  }
}
</style>
