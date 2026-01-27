<script setup>
import { ref, computed, watch } from 'vue';
import { calculateMetrics, calculateWithdrawMetrics, formatTime, formatAmount, exportWeeklyToExcel } from '../utils/csvParser';

const props = defineProps({
  depositRecords: {
    type: Array,
    default: () => []
  },
  withdrawRecords: {
    type: Array,
    default: () => []
  }
});

// 日期選擇（起訖時間）
const startDate = ref('');
const endDate = ref('');

// 日期範圍
const weekRange = computed(() => {
  if (!startDate.value || !endDate.value) return { start: '', end: '', startDate: null, endDate: null };

  return {
    start: startDate.value,
    end: endDate.value,
    startDate: new Date(startDate.value),
    endDate: new Date(endDate.value)
  };
});

// 過濾選定週的充值記錄
const filteredDepositRecords = computed(() => {
  if (!weekRange.value.start || !weekRange.value.end) return [];

  return props.depositRecords.filter(r => {
    if (!r.requestTime) return false;
    const recordDate = r.requestTime.substring(0, 10);
    return recordDate >= weekRange.value.start && recordDate <= weekRange.value.end;
  });
});

// 過濾選定週的提現記錄
const filteredWithdrawRecords = computed(() => {
  if (!weekRange.value.start || !weekRange.value.end) return [];

  return props.withdrawRecords.filter(r => {
    if (!r.requestTime) return false;
    const recordDate = r.requestTime.substring(0, 10);
    return recordDate >= weekRange.value.start && recordDate <= weekRange.value.end;
  });
});

// 計算充值指標
const depositMetrics = computed(() => {
  if (filteredDepositRecords.value.length === 0) return null;
  return calculateMetrics(filteredDepositRecords.value);
});

// 計算提現指標
const withdrawMetrics = computed(() => {
  if (filteredWithdrawRecords.value.length === 0) return null;
  return calculateWithdrawMetrics(filteredWithdrawRecords.value, depositMetrics.value);
});

// 計算週報重要指標
const weeklyMetrics = computed(() => {
  if (!depositMetrics.value) return null;
  const dm = depositMetrics.value;

  // 充值申請筆數 = 銀行卡 + 支付寶
  const depositApplicationCount = dm.jisuApplicationCount + dm.alipayApplicationCount;

  // JS充值等待最终无配对 = （銀行卡的充值申請筆數中的極速提＋建单成功等待无配对＋取无卡06提示）＋（支付寶的充值申請筆數中的建单成功等待无配对＋取无卡06提示）
  const jsWaitingNoMatch = dm.jsWaitingNoMatch || 0;

  // 充值配对(配一般卡) = 銀行卡的成功配對的一般卡 + 支付寶的成功配對的一般卡 + 一般寶
  const matchNormalCardBankCard = dm.normalMatchCount;  // 銀行卡的成功配對的一般卡
  const matchNormalCardAlipay = dm.alipayNormalMatchCount;  // 支付寶的成功配對的一般卡
  const matchNormalCardBao = dm.alipayExpressCardAppCount;  // 一般寶
  const matchNormalCard = matchNormalCardBankCard + matchNormalCardAlipay + matchNormalCardBao;

  // 充值配对(配JS) = 銀行卡極速提 + 支付寶極速提(卡) + 极速提(宝)
  const matchJSBankCard = dm.expressMatchCount;  // 銀行卡極速提
  const matchJSAlipayKa = dm.alipayJisuTikaCount;  // 支付寶極速提(卡)
  const matchJSAlipayBao = dm.alipayJisuTibaoCount;  // 支付寶极速提(宝)
  const matchJS = matchJSBankCard + matchJSAlipayKa + matchJSAlipayBao;

  // 充值配对(配一般提) = 0
  const matchNormalWithdraw = 0;

  // 订单成功(一般卡) = 銀行卡的订单成功一般卡 + 支付寶的订单成功一般卡 + 一般宝
  const orderSuccessNormalCardBankCard = dm.normalOrderSuccessCount;  // 銀行卡的订单成功一般卡
  const orderSuccessNormalCardAlipay = dm.alipayNormalOrderSuccessCount;  // 支付寶的订单成功一般卡
  const orderSuccessNormalCardBao = dm.alipayBaoOrderSuccessCount;  // 一般宝
  const orderSuccessNormalCard = orderSuccessNormalCardBankCard + orderSuccessNormalCardAlipay + orderSuccessNormalCardBao;

  // 订单成功(Js+一般提) = 銀行卡極速提 + 支付寶極速提(卡) + 极速提(宝)
  const orderSuccessJSBankCard = dm.expressOrderSuccessCount;  // 銀行卡極速提
  const orderSuccessJSAlipayKa = dm.alipayJisuTikaOrderSuccessCount;  // 支付寶極速提(卡)
  const orderSuccessJSAlipayBao = dm.alipayJisuTibaoOrderSuccessCount;  // 支付寶极速提(宝)
  const orderSuccessJS = orderSuccessJSBankCard + orderSuccessJSAlipayKa + orderSuccessJSAlipayBao;

  // 订单成功(加总笔数)
  const orderSuccessTotal = orderSuccessNormalCard + orderSuccessJS;

  // ===== 充值订单成功(金额) =====
  // 配一般卡充值订单成功(金额) = 銀行卡訂單成功一般卡金額 + 支付寶訂單成功一般卡金額 + 一般寶金額
  const orderSuccessAmountNormalCardBankCard = dm.normalOrderSuccessAmount || 0;
  const orderSuccessAmountNormalCardAlipay = dm.alipayNormalOrderSuccessAmount || 0;
  const orderSuccessAmountNormalCardBao = dm.alipayBaoOrderSuccessAmount || 0;
  const orderSuccessAmountNormalCard = orderSuccessAmountNormalCardBankCard + orderSuccessAmountNormalCardAlipay + orderSuccessAmountNormalCardBao;

  // 配极速充值订单成功(金额) = 銀行卡訂單成功極速提金額 + 支付寶訂單成功極速提(卡)金額 + 极速提(宝)金額
  const orderSuccessAmountJSBankCard = dm.expressOrderSuccessAmount || 0;
  const orderSuccessAmountJSAlipayKa = dm.alipayJisuTikaOrderSuccessAmount || 0;
  const orderSuccessAmountJSAlipayBao = dm.alipayJisuTibaoOrderSuccessAmount || 0;
  const orderSuccessAmountJS = orderSuccessAmountJSBankCard + orderSuccessAmountJSAlipayKa + orderSuccessAmountJSAlipayBao;

  // 充值订单成功(金额) = 公式候補，先顯示0
  const orderSuccessAmountOther = 0;

  // 充值订单成功(金额)總計
  const orderSuccessAmountTotal = orderSuccessAmountNormalCard + orderSuccessAmountJS + orderSuccessAmountOther;

  // 充值卡在待审核 = 0
  const pendingReview = 0;

  // 未充值 = 0
  const notDeposited = 0;

  // 无卡空单率 = JS充值等待最终无配对 / 充值申請
  const emptyOrderRate = depositApplicationCount > 0 ? jsWaitingNoMatch / depositApplicationCount : 0;

  // ===== 提現平均時間 =====
  const wm = withdrawMetrics.value || {};
  const withdrawAvgTimeBankCard = wm.bankCardAvgTime || 0;  // 提現平均時間（卡）
  const withdrawAvgTimeAlipay = wm.alipayAvgTime || 0;  // 提現平均時間（寶）

  // ===== 騙分 =====
  // 骗分 = 銀行卡的骗分没到账来找的人工 + 銀行卡的信评金額 + 支付寶的骗分没到账来找的人工 + 支付寶的信评金額
  // 目前數據中沒有這些欄位，先設為0（待定義計算條件）
  const fraudBankCardManual = 0;  // 銀行卡的骗分没到账来找的人工
  const fraudBankCardCredit = 0;  // 銀行卡的信评金額
  const fraudAlipayManual = 0;    // 支付寶的骗分没到账来找的人工
  const fraudAlipayCredit = 0;    // 支付寶的信评金額
  const fraudAmount = fraudBankCardManual + fraudBankCardCredit + fraudAlipayManual + fraudAlipayCredit;

  // 骗分成本占比 = 騙分 / 配极速充值订单成功(金额)
  const fraudCostRatio = orderSuccessAmountJS > 0 ? fraudAmount / orderSuccessAmountJS : 0;

  // JS提现返利 = 提現紀錄中的H欄(merchantRebate)加總金額
  const jsWithdrawRebate = filteredWithdrawRecords.value.reduce((sum, r) => sum + (r.merchantRebate || 0), 0);

  // ===== 配對率＆空單率 =====
  // 充值配对總數
  const totalMatch = matchNormalCard + matchJS + matchNormalWithdraw;

  // 充值配对率 = (充值配对(配一般卡) + 充值配对(配JS) + 充值配对(配一般提)) / 充值申請 * 100%
  const depositMatchRate = depositApplicationCount > 0 ? totalMatch / depositApplicationCount : 0;

  // 充提配对率 = 公式待確認，先設為0
  const depositWithdrawMatchRate = 0;

  // 配对后成功率 = (订单成功(一般卡) + 订单成功(Js+一般提)) / (充值配对(配一般卡) + 充值配对(配JS) + 充值配对(配一般提))
  const successAfterMatchRate = totalMatch > 0 ? orderSuccessTotal / totalMatch : 0;

  // 未充空单率 = 未充值 / (充值配对(配JS) + 充值配对(配一般提))
  const jsAndNormalWithdrawMatch = matchJS + matchNormalWithdraw;
  const notDepositedEmptyRate = jsAndNormalWithdrawMatch > 0 ? notDeposited / jsAndNormalWithdrawMatch : 0;

  // 提现失败率 = 公式後補，先顯示0%
  const withdrawFailRate = 0;

  return {
    depositApplicationCount,
    jsWaitingNoMatch,
    bankCardJsWaitingNoMatch: dm.bankCardJsWaitingNoMatch || 0,
    alipayJsWaitingNoMatch: dm.alipayJsWaitingNoMatch || 0,
    // 配一般卡
    matchNormalCard,
    matchNormalCardBankCard,
    matchNormalCardAlipay,
    matchNormalCardBao,
    // 配JS
    matchJS,
    matchJSBankCard,
    matchJSAlipayKa,
    matchJSAlipayBao,
    // 其他
    matchNormalWithdraw,
    orderSuccessTotal,
    // 订单成功(一般卡)
    orderSuccessNormalCard,
    orderSuccessNormalCardBankCard,
    orderSuccessNormalCardAlipay,
    orderSuccessNormalCardBao,
    // 订单成功(Js+一般提)
    orderSuccessJS,
    orderSuccessJSBankCard,
    orderSuccessJSAlipayKa,
    orderSuccessJSAlipayBao,
    // 充值订单成功(金额)
    orderSuccessAmountTotal,
    orderSuccessAmountNormalCard,
    orderSuccessAmountNormalCardBankCard,
    orderSuccessAmountNormalCardAlipay,
    orderSuccessAmountNormalCardBao,
    orderSuccessAmountJS,
    orderSuccessAmountJSBankCard,
    orderSuccessAmountJSAlipayKa,
    orderSuccessAmountJSAlipayBao,
    orderSuccessAmountOther,
    // 提現平均時間
    withdrawAvgTimeBankCard,
    withdrawAvgTimeAlipay,
    // 騙分
    fraudAmount,
    fraudBankCardManual,
    fraudBankCardCredit,
    fraudAlipayManual,
    fraudAlipayCredit,
    fraudCostRatio,
    jsWithdrawRebate,
    // 配對率＆空單率
    totalMatch,
    depositMatchRate,
    depositWithdrawMatchRate,
    successAfterMatchRate,
    notDepositedEmptyRate,
    withdrawFailRate,
    // 其他
    pendingReview,
    notDeposited,
    emptyOrderRate
  };
});

// ===== 指標數據分析 =====
// 根據 Excel 公式計算：
// - 總充值筆數 = AP > 0
// - 自動到帳筆數 (P4/P5) = AP > 0 且 AO = 1
// - 補單筆數：
//   - 整體: AP > 0 且 狀態含「補單」或「确认到帐」
//   - 分類: AP > 0 且 狀態含「補單」(不包含「确认到帐」)
// - 3分鐘內筆數 = AP > 0 且 AN = 1
// - 充值成功率 = 1 - 補單筆數 / 總充值筆數
// - 充值3分內占比 = 3分鐘內筆數 / 自動到帳筆數
// - 平均時間 = SUMIFS(AM, AP>0, AO=1, T<>0) / 自動到帳筆數
const analysisMetrics = computed(() => {
  // 使用全部數據，不按週過濾
  const depositData = props.depositRecords;
  if (depositData.length === 0) return null;

  // 計算各分類的指標 (根據 Excel 公式)
  // isOverall: 是否為整體，整體的補單公式包含「确认到帐」，分類則只有「補單」
  const calculateCategoryMetrics = (allRecords, isOverall = false) => {
    if (allRecords.length === 0) return { successRate: 0, within3MinRate: 0, avgTime: 0 };

    // 總充值筆數 = AP > 0
    const totalDeposit = allRecords.filter(r => r.receivedAmount > 0);
    const totalDepositCount = totalDeposit.length;
    if (totalDepositCount === 0) return { successRate: 0, within3MinRate: 0, avgTime: 0 };

    // 自動到帳筆數 (P4/P5) = AP > 0 且 AO = 1
    const autoDepositRecords = totalDeposit.filter(r => r.isAutoDeposit);
    const p4 = autoDepositRecords.length;

    // 補單筆數
    // - 整體: AP > 0 且 狀態含「補單」或「补单」或「确认到帐」或「確認到帳」
    // - 分類: AP > 0 且 狀態含「補單」或「补单」(不包含「确认到帐」)
    let buDanCount;
    if (isOverall) {
      buDanCount = totalDeposit.filter(r =>
        r.status.includes('補單') || r.status.includes('补单') ||
        r.status.includes('确认到帐') || r.status.includes('確認到帳')
      ).length;
    } else {
      buDanCount = totalDeposit.filter(r =>
        r.status.includes('補單') || r.status.includes('补单')
      ).length;
    }

    // 3分鐘內筆數 = AP > 0 且 AN = 1 (不要求 AO = 1)
    const within3MinCount = totalDeposit.filter(r => r.isWithin3Min).length;

    // 充值成功率 = 1 - 補單筆數 / 總充值筆數
    const successRate = 1 - (buDanCount / totalDepositCount);

    // 充值3分內占比 = 3分鐘內筆數 / 自動到帳筆數
    const within3MinRate = p4 > 0 ? within3MinCount / p4 : 0;

    // 平均時間 = SUMIFS(AM, AP>0, AO=1, T<>0) / P4
    const recordsWithTime = autoDepositRecords.filter(r =>
      r.processingTime !== null &&
      r.processingTime >= 0 &&
      r.notifyMerchantTime &&
      !r.notifyMerchantTime.includes('0000-00-00')
    );
    const totalTime = recordsWithTime.reduce((sum, r) => sum + r.processingTime, 0);
    const avgTime = p4 > 0 ? totalTime / p4 : 0;

    return { successRate, within3MinRate, avgTime };
  };

  // 1. 整體 (isOverall = true, 補單公式包含「确认到帐」)
  const overallMetrics = calculateCategoryMetrics(depositData, true);

  // 2. 支付寶 (isOverall = false, 補單公式只有「補單」)
  const alipayAll = depositData.filter(r =>
    r.merchant && (r.merchant.includes('支付宝') || r.merchant.includes('支付寶'))
  );
  const alipayMetrics = calculateCategoryMetrics(alipayAll, false);

  // 3. 微信 (isOverall = false, 補單公式只有「補單」)
  const wechatAll = depositData.filter(r =>
    r.merchant && r.merchant.includes('微信')
  );
  const wechatMetrics = calculateCategoryMetrics(wechatAll, false);

  // 4. 金寶 (特殊計算：3分鐘內筆數 和 P4 使用不同篩選條件)
  // P4/總充值/補單：bankCardCode 包含 GB，排除 GB-DahaomenJFB2025
  // 3分鐘內筆數：bankCardCode 包含 GB（不排除 GB-DahaomenJFB2025）
  const gbAllForP4 = depositData.filter(r =>
    r.bankCardCode &&
    r.bankCardCode.includes('GB') &&
    !r.bankCardCode.includes('GB-DahaomenJFB2025')
  );
  const gbAllForWithin3Min = depositData.filter(r =>
    r.bankCardCode &&
    r.bankCardCode.includes('GB')
  );
  // 手動計算金寶指標
  const gbTotalDeposit = gbAllForP4.filter(r => r.receivedAmount > 0);
  const gbTotalDepositCount = gbTotalDeposit.length;
  const gbAutoDepositRecords = gbTotalDeposit.filter(r => r.isAutoDeposit);
  const gbP4 = gbAutoDepositRecords.length;
  const gbBuDanCount = gbTotalDeposit.filter(r =>
    r.status.includes('補單') || r.status.includes('补单')
  ).length;
  // 3分鐘內筆數 使用包含所有 GB 的數據
  const gbWithin3MinCount = gbAllForWithin3Min.filter(r => r.receivedAmount > 0 && r.isWithin3Min).length;
  const gbSuccessRate = gbTotalDepositCount > 0 ? 1 - (gbBuDanCount / gbTotalDepositCount) : 0;
  const gbWithin3MinRate = gbP4 > 0 ? gbWithin3MinCount / gbP4 : 0;
  // 平均時間 使用包含所有 GB 的數據 (不排除 GB-DahaomenJFB2025)
  const gbRecordsWithTime = gbAllForWithin3Min.filter(r =>
    r.receivedAmount > 0 &&
    r.isAutoDeposit &&
    r.processingTime !== null &&
    r.processingTime >= 0 &&
    r.notifyMerchantTime &&
    !r.notifyMerchantTime.includes('0000-00-00')
  );
  const gbTotalTime = gbRecordsWithTime.reduce((sum, r) => sum + r.processingTime, 0);
  const gbAvgTime = gbP4 > 0 ? gbTotalTime / gbP4 : 0;
  const gbMetrics = { successRate: gbSuccessRate, within3MinRate: gbWithin3MinRate, avgTime: gbAvgTime };

  // 5. 極速 (特殊計算：3分鐘內筆數 和 P8 使用不同篩選條件)
  // P8/總充值/補單：bankCardCode 包含 AUCTION，排除 GB-DahaomenJFB2025
  // 3分鐘內筆數：bankCardCode 包含 AUCTION（不排除 GB-DahaomenJFB2025）
  const auctionAllForP8 = depositData.filter(r =>
    r.bankCardCode &&
    r.bankCardCode.includes('AUCTION') &&
    !r.bankCardCode.includes('GB-DahaomenJFB2025')
  );
  const auctionAllForWithin3Min = depositData.filter(r =>
    r.bankCardCode &&
    r.bankCardCode.includes('AUCTION')
  );
  // 手動計算極速指標
  const auctionTotalDeposit = auctionAllForP8.filter(r => r.receivedAmount > 0);
  const auctionTotalDepositCount = auctionTotalDeposit.length;
  const auctionAutoDepositRecords = auctionTotalDeposit.filter(r => r.isAutoDeposit);
  const auctionP8 = auctionAutoDepositRecords.length;
  const auctionBuDanCount = auctionTotalDeposit.filter(r =>
    r.status.includes('補單') || r.status.includes('补单')
  ).length;
  // 3分鐘內筆數 使用包含所有 AUCTION 的數據
  const auctionWithin3MinCount = auctionAllForWithin3Min.filter(r => r.receivedAmount > 0 && r.isWithin3Min).length;
  const auctionSuccessRate = auctionTotalDepositCount > 0 ? 1 - (auctionBuDanCount / auctionTotalDepositCount) : 0;
  const auctionWithin3MinRate = auctionP8 > 0 ? auctionWithin3MinCount / auctionP8 : 0;
  const auctionRecordsWithTime = auctionAutoDepositRecords.filter(r =>
    r.processingTime !== null &&
    r.processingTime >= 0 &&
    r.notifyMerchantTime &&
    !r.notifyMerchantTime.includes('0000-00-00')
  );
  const auctionTotalTime = auctionRecordsWithTime.reduce((sum, r) => sum + r.processingTime, 0);
  const auctionAvgTime = auctionP8 > 0 ? auctionTotalTime / auctionP8 : 0;
  const auctionMetrics = { successRate: auctionSuccessRate, within3MinRate: auctionWithin3MinRate, avgTime: auctionAvgTime };

  // 6. 第三方 (不包含GB且不包含AUCTION，或者等於GB-DahaomenJFB2025)
  const thirdPartyAll = depositData.filter(r =>
    r.bankCardCode && (
      // 條件1: 不包含 GB 且 不包含 AUCTION
      (!r.bankCardCode.includes('GB') && !r.bankCardCode.includes('AUCTION')) ||
      // 條件2: 等於 GB-DahaomenJFB2025
      r.bankCardCode === 'GB-DahaomenJFB2025'
    )
  );
  const thirdPartyMetrics = calculateCategoryMetrics(thirdPartyAll, false);

  // 7. 非正向信评 (status包含信用評分或信評上分)
  // 3分鐘內筆數需要 AO = 1 AND AN = 1
  const creditAll = depositData.filter(r =>
    r.status && (r.status.includes('信用評分') || r.status.includes('信評上分') ||
                 r.status.includes('信用评分') || r.status.includes('信评上分'))
  );
  // 手動計算非正向信评指標
  const creditTotalDeposit = creditAll.filter(r => r.receivedAmount > 0);
  const creditTotalDepositCount = creditTotalDeposit.length;
  const creditAutoDepositRecords = creditTotalDeposit.filter(r => r.isAutoDeposit);
  const creditP10 = creditAutoDepositRecords.length;
  const creditBuDanCount = creditTotalDeposit.filter(r =>
    r.status.includes('補單') || r.status.includes('补单')
  ).length;
  // 3分鐘內筆數 = AP > 0 AND AO = 1 AND AN = 1
  const creditWithin3MinCount = creditAutoDepositRecords.filter(r => r.isWithin3Min).length;
  const creditSuccessRate = creditTotalDepositCount > 0 ? 1 - (creditBuDanCount / creditTotalDepositCount) : 0;
  const creditWithin3MinRate = creditP10 > 0 ? creditWithin3MinCount / creditP10 : 0;
  const creditRecordsWithTime = creditAutoDepositRecords.filter(r =>
    r.processingTime !== null &&
    r.processingTime >= 0 &&
    r.notifyMerchantTime &&
    !r.notifyMerchantTime.includes('0000-00-00')
  );
  const creditTotalTime = creditRecordsWithTime.reduce((sum, r) => sum + r.processingTime, 0);
  const creditAvgTime = creditP10 > 0 ? creditTotalTime / creditP10 : 0;
  const creditMetrics = { successRate: creditSuccessRate, within3MinRate: creditWithin3MinRate, avgTime: creditAvgTime };

  return [
    { category: '整體', successRate: overallMetrics.successRate, within3MinRate: overallMetrics.within3MinRate, avgTime: overallMetrics.avgTime },
    { category: '支付寶', successRate: alipayMetrics.successRate, within3MinRate: alipayMetrics.within3MinRate, avgTime: alipayMetrics.avgTime },
    { category: '微信', successRate: wechatMetrics.successRate, within3MinRate: wechatMetrics.within3MinRate, avgTime: wechatMetrics.avgTime },
    { category: '金寶', successRate: gbMetrics.successRate, within3MinRate: gbMetrics.within3MinRate, avgTime: gbMetrics.avgTime },
    { category: '極速', successRate: auctionMetrics.successRate, within3MinRate: auctionMetrics.within3MinRate, avgTime: auctionMetrics.avgTime },
    { category: '第三方', successRate: thirdPartyMetrics.successRate, within3MinRate: thirdPartyMetrics.within3MinRate, avgTime: thirdPartyMetrics.avgTime },
    { category: '非正向信评', successRate: creditMetrics.successRate, within3MinRate: creditMetrics.within3MinRate, avgTime: creditMetrics.avgTime }
  ];
});

// 设置预设日期範圍
const setDefaultDate = () => {
  startDate.value = '2026-01-01';
  endDate.value = '2026-01-07';
};

// 匯出週報
const handleExport = () => {
  if (weeklyMetrics.value) {
    exportWeeklyToExcel(weeklyMetrics.value, analysisMetrics.value, weekRange.value);
  }
};

// 初始化
setDefaultDate();
</script>

<template>
  <div class="weekly-report">
    <!-- 日期选择器 -->
    <div class="date-selector">
      <div class="selector-header">
        <h2>周报数据汇总</h2>
      </div>
      <div class="selector-content">
        <div class="date-picker">
          <label>起始日期：</label>
          <input type="date" v-model="startDate" class="date-input" />
        </div>
        <div class="date-picker">
          <label>結束日期：</label>
          <input type="date" v-model="endDate" class="date-input" />
        </div>
        <button @click="handleExport" class="export-btn" v-if="weeklyMetrics">匯出 Excel</button>
      </div>
    </div>

    <!-- 数据汇总 -->
    <template v-if="weekRange.start">
      <!-- ========== 区块一：充值申请 ========== -->
      <div class="report-section" v-if="weeklyMetrics">
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
          </div>

          <!-- JS充值等待最终无配对 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">JS充值等待最终无配对</span>
              <span class="block-value">{{ weeklyMetrics.jsWaitingNoMatch.toLocaleString() }}</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">銀行卡</span>
                <span class="detail-value">{{ (weeklyMetrics.bankCardJsWaitingNoMatch || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">支付寶</span>
                <span class="detail-value">{{ (weeklyMetrics.alipayJsWaitingNoMatch || 0).toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <!-- 充值配对(配一般卡) -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值配对(配一般卡)</span>
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
          </div>

          <!-- 充值配对(配JS) -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值配对(配JS)</span>
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
          </div>

          <!-- 充值配对(配一般提) -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值配对(配一般提)</span>
              <span class="block-value">{{ weeklyMetrics.matchNormalWithdraw.toLocaleString() }}</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">说明</span>
                <span class="detail-value note">待定义</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 区块二：订单成功 ========== -->
      <div class="report-section" v-if="weeklyMetrics">
        <div class="section-header">
          <h3>订单成功</h3>
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
                <span class="detail-label">一般卡</span>
                <span class="detail-value">{{ weeklyMetrics.orderSuccessNormalCard.toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Js+一般提</span>
                <span class="detail-value">{{ weeklyMetrics.orderSuccessJS.toLocaleString() }}</span>
              </div>
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
                <span class="detail-label">银行卡订单成功一般卡</span>
                <span class="detail-value">{{ weeklyMetrics.orderSuccessNormalCardBankCard.toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">支付宝订单成功一般卡</span>
                <span class="detail-value">{{ weeklyMetrics.orderSuccessNormalCardAlipay.toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">一般宝</span>
                <span class="detail-value">{{ weeklyMetrics.orderSuccessNormalCardBao.toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <!-- 订单成功(Js+一般提) -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">订单成功(Js+一般提)</span>
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
          </div>

          <!-- 充值卡在待审核 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值卡在待审核</span>
              <span class="block-value">{{ weeklyMetrics.pendingReview.toLocaleString() }}</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">说明</span>
                <span class="detail-value note">7/21起系统查核中笔数有列入</span>
              </div>
            </div>
          </div>

          <!-- 未充值 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">未充值</span>
              <span class="block-value">{{ weeklyMetrics.notDeposited.toLocaleString() }}</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">说明</span>
                <span class="detail-value note">7/21起不含等待无配对</span>
              </div>
            </div>
          </div>

          <!-- 无卡空单率 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">无卡空单率</span>
              <span class="block-value warning">{{ (weeklyMetrics.emptyOrderRate * 100).toFixed(2) }}%</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">JS充值等待最终无配对 / 充值申请</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 区块三：充值订单成功(金额) ========== -->
      <div class="report-section" v-if="weeklyMetrics">
        <div class="section-header">
          <h3>充值订单成功(金额)</h3>
        </div>
        <div class="jisu-content">
          <!-- 充值订单成功(金额) 总计 -->
          <div class="jisu-block highlight-block">
            <div class="block-header">
              <span class="block-title">充值订单成功(金额)</span>
              <span class="block-value success">{{ formatAmount(weeklyMetrics.orderSuccessAmountTotal) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">配一般卡充值订单成功(金额)</span>
                <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountNormalCard) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">配极速充值订单成功(金额)</span>
                <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountJS) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">充值订单成功(金额)</span>
                <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountOther) }} 元</span>
              </div>
            </div>
          </div>

          <!-- 配一般卡充值订单成功(金额) -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">配一般卡充值订单成功(金额)</span>
              <span class="block-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountNormalCard) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">银行卡订单成功一般卡</span>
                <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountNormalCardBankCard) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">支付宝订单成功一般卡</span>
                <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountNormalCardAlipay) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">一般宝</span>
                <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountNormalCardBao) }} 元</span>
              </div>
            </div>
          </div>

          <!-- 配极速充值订单成功(金额) -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">配极速充值订单成功(金额)</span>
              <span class="block-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountJS) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">银行卡订单成功极速提</span>
                <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountJSBankCard) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">支付宝订单成功极速提(卡)</span>
                <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountJSAlipayKa) }} 元</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">极速提(宝)</span>
                <span class="detail-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountJSAlipayBao) }} 元</span>
              </div>
            </div>
          </div>

          <!-- 充值订单成功(金额) 待补 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值订单成功(金额)</span>
              <span class="block-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountOther) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">说明</span>
                <span class="detail-value note">公式候补</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 区块四：平均时间 ========== -->
      <div class="report-section" v-if="weeklyMetrics">
        <div class="section-header">
          <h3>平均时间</h3>
        </div>
        <div class="jisu-content">
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">提现平均时间</span>
              <span class="block-value"></span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">提现平均时间（卡）</span>
                <span class="detail-value">{{ formatTime(weeklyMetrics.withdrawAvgTimeBankCard) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">提现平均时间（宝）</span>
                <span class="detail-value">{{ formatTime(weeklyMetrics.withdrawAvgTimeAlipay) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 区块五：骗分 ========== -->
      <div class="report-section" v-if="weeklyMetrics">
        <div class="section-header">
          <h3>骗分</h3>
        </div>
        <div class="jisu-content">
          <!-- 骗分 总计 -->
          <div class="jisu-block highlight-block">
            <div class="block-header">
              <span class="block-title">骗分</span>
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
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">骗分 / 配极速充值订单成功(金额)</span>
              </div>
            </div>
          </div>

          <!-- JS提现返利 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">JS提现返利</span>
              <span class="block-value">{{ formatAmount(weeklyMetrics.jsWithdrawRebate) }} 元</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">提现记录H栏(merchantRebate)加总</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 区块六：配对率＆空单率 ========== -->
      <div class="report-section" v-if="weeklyMetrics">
        <div class="section-header">
          <h3>配对率＆空单率</h3>
        </div>
        <div class="jisu-content">
          <!-- 充值配对率 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值配对率</span>
              <span class="block-value">{{ (weeklyMetrics.depositMatchRate * 100).toFixed(2) }}%</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">充值配对总数</span>
                <span class="detail-value">{{ weeklyMetrics.totalMatch.toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">充值申请</span>
                <span class="detail-value">{{ weeklyMetrics.depositApplicationCount.toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">(配一般卡+配JS+配一般提) / 充值申请</span>
              </div>
            </div>
          </div>

          <!-- 充提配对率 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充提配对率</span>
              <span class="block-value">{{ (weeklyMetrics.depositWithdrawMatchRate * 100).toFixed(2) }}%</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">公式待确认</span>
              </div>
            </div>
          </div>

          <!-- 配对后成功率 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">配对后成功率</span>
              <span class="block-value success">{{ (weeklyMetrics.successAfterMatchRate * 100).toFixed(2) }}%</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">订单成功总数</span>
                <span class="detail-value">{{ weeklyMetrics.orderSuccessTotal.toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">充值配对总数</span>
                <span class="detail-value">{{ weeklyMetrics.totalMatch.toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">(一般卡+Js+一般提) / 充值配对总数</span>
              </div>
            </div>
          </div>

          <!-- 未充空单率 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">未充空单率</span>
              <span class="block-value warning">{{ (weeklyMetrics.notDepositedEmptyRate * 100).toFixed(2) }}%</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">未充值</span>
                <span class="detail-value">{{ weeklyMetrics.notDeposited.toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">未充值 / (配JS+配一般提)</span>
              </div>
            </div>
          </div>

          <!-- 提现失败率 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">提现失败率</span>
              <span class="block-value warning">{{ (weeklyMetrics.withdrawFailRate * 100).toFixed(2) }}%</span>
            </div>
            <div class="block-details">
              <div class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">公式后补</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="no-data" v-if="!weeklyMetrics">
        此周无数据
      </div>

      <!-- ========== 区块七：指标数据分析 ========== -->
      <div class="report-section" v-if="analysisMetrics">
        <div class="section-header">
          <h3>指标数据分析</h3>
        </div>
        <div class="analysis-table-container">
          <table class="analysis-table">
            <thead>
              <tr>
                <th>分类</th>
                <th>充值成功率</th>
                <th>充值3分内占比</th>
                <th>平均时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in analysisMetrics" :key="row.category">
                <td class="category-cell">{{ row.category }}</td>
                <td class="rate-cell">{{ (row.successRate * 100).toFixed(2) }}%</td>
                <td class="rate-cell">{{ (row.within3MinRate * 100).toFixed(2) }}%</td>
                <td class="time-cell">{{ formatTime(row.avgTime) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.weekly-report {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 日期選擇器 */
.date-selector {
  background: #1c1c1e;
  border-radius: 16px;
  padding: 20px;
}

.selector-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 16px;
}

.selector-content {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.date-picker {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-picker label {
  color: #8e8e93;
  font-size: 14px;
}

.date-input {
  padding: 10px 16px;
  border: 1px solid #3a3a3c;
  border-radius: 10px;
  background: #2c2c2e;
  color: #fff;
  font-size: 14px;
  outline: none;
}

.date-input:focus {
  border-color: #0a84ff;
}

.export-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 10px;
  background: #30d158;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  margin-left: auto;
}

.export-btn:hover {
  background: #28b94c;
}

/* 報表區塊 */
.report-section {
  background: #1c1c1e;
  border-radius: 16px;
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.record-count {
  color: #8e8e93;
  font-size: 14px;
  background: #2c2c2e;
  padding: 6px 12px;
  border-radius: 8px;
}

/* 指標網格 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.metric-card {
  background: #2c2c2e;
  border-radius: 12px;
  padding: 16px;
}

.card-title {
  font-size: 13px;
  color: #8e8e93;
  margin-bottom: 8px;
}

.card-value {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

/* 渠道網格 */
.channel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.channel-card {
  background: #2c2c2e;
  border-radius: 12px;
  padding: 16px;
}

.channel-title {
  font-size: 16px;
  font-weight: 600;
  color: #0a84ff;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #3a3a3c;
}

.channel-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  font-size: 14px;
  color: #8e8e93;
}

.stat-value {
  font-size: 14px;
  color: #fff;
  font-family: monospace;
}

/* 重要指標網格 */
.important-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

/* 區塊樣式 (與 MetricsCards.vue 一致) */
.jisu-block {
  background: #2c2c2e;
  border-radius: 12px;
  padding: 16px;
}

.jisu-block.highlight-block {
  background: #1a3a5c;
  border: 1px solid #0a84ff;
}

/* 區塊內容網格 */
.jisu-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #3a3a3c;
}

.block-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.block-value {
  font-size: 18px;
  font-weight: 700;
  color: #0a84ff;
}

.block-value.success {
  color: #30d158;
}

.block-value.warning {
  color: #ff9f0a;
}

.block-details {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 13px;
  color: #8e8e93;
}

.detail-value {
  font-size: 13px;
  color: #fff;
  font-family: monospace;
}

.detail-value.note {
  color: #6e6e73;
  font-family: inherit;
  font-style: italic;
  font-size: 12px;
}

/* 無數據 */
.no-data {
  text-align: center;
  color: #8e8e93;
  font-size: 14px;
  padding: 40px 20px;
}

/* 指標數據分析表格 */
.analysis-table-container {
  overflow-x: auto;
}

.analysis-table {
  width: 100%;
  border-collapse: collapse;
  background: #2c2c2e;
  border-radius: 12px;
  overflow: hidden;
}

.analysis-table thead {
  background: #3a3a3c;
}

.analysis-table th {
  padding: 14px 16px;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  border-bottom: 1px solid #4a4a4c;
}

.analysis-table th:first-child {
  border-top-left-radius: 12px;
}

.analysis-table th:last-child {
  border-top-right-radius: 12px;
}

.analysis-table tbody tr {
  transition: background 0.2s;
}

.analysis-table tbody tr:hover {
  background: #3a3a3c;
}

.analysis-table tbody tr:not(:last-child) {
  border-bottom: 1px solid #3a3a3c;
}

.analysis-table td {
  padding: 14px 16px;
  font-size: 14px;
}

.analysis-table .category-cell {
  color: #fff;
  font-weight: 500;
}

.analysis-table .rate-cell {
  color: #30d158;
  font-family: monospace;
}

.analysis-table .time-cell {
  color: #0a84ff;
  font-family: monospace;
}

@media (max-width: 768px) {
  .selector-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .jisu-content {
    grid-template-columns: 1fr;
  }

  .channel-grid {
    grid-template-columns: 1fr;
  }

  .important-metrics-grid {
    grid-template-columns: 1fr;
  }

  .analysis-table th,
  .analysis-table td {
    padding: 10px 12px;
    font-size: 13px;
  }
}
</style>
