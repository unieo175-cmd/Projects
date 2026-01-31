<script setup>
import { ref, computed, watch } from 'vue';
import { calculateMetrics, calculateWithdrawMetrics, formatTime, formatAmount, exportWeeklyToExcel, exportDepositToText } from '../utils/csvParser';

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

// 今日日期
const today = new Date().toISOString().split('T')[0];

// 日期选择（起讫时间）
const startDate = ref('');
const endDate = ref('');

// 日期范围错误信息
const dateRangeError = ref('');

// 导出状态
const isExporting = ref(false);
const exportProgress = ref('');

// 计算状态
const isCalculating = ref(false);
const calculationError = ref('');

// 日期范围
const weekRange = computed(() => {
  if (!startDate.value || !endDate.value) return { start: '', end: '', startDate: null, endDate: null };

  return {
    start: startDate.value,
    end: endDate.value,
    startDate: new Date(startDate.value),
    endDate: new Date(endDate.value)
  };
});

// 过滤选定周的充值记录
const filteredDepositRecords = computed(() => {
  if (!weekRange.value.start || !weekRange.value.end) return [];

  return props.depositRecords.filter(r => {
    if (!r.requestTime) return false;
    const recordDate = r.requestTime.substring(0, 10);
    return recordDate >= weekRange.value.start && recordDate <= weekRange.value.end;
  });
});

// 过滤选定周的提现记录
const filteredWithdrawRecords = computed(() => {
  if (!weekRange.value.start || !weekRange.value.end) return [];

  return props.withdrawRecords.filter(r => {
    if (!r.requestTime) return false;
    const recordDate = r.requestTime.substring(0, 10);
    return recordDate >= weekRange.value.start && recordDate <= weekRange.value.end;
  });
});

// 计算充值指标
const depositMetrics = computed(() => {
  if (filteredDepositRecords.value.length === 0) return null;
  try {
    calculationError.value = '';
    // 传入 dataDate 以正确计算 noCard06Count
    const dataDate = weekRange.value?.start || null;
    return calculateMetrics(filteredDepositRecords.value, null, dataDate);
  } catch (error) {
    console.error('充值指标计算错误:', error);
    calculationError.value = error.message || '计算超时，请减少数据量';
    return null;
  }
});

// 计算提现指标
const withdrawMetrics = computed(() => {
  if (filteredWithdrawRecords.value.length === 0) return null;
  try {
    return calculateWithdrawMetrics(filteredWithdrawRecords.value, depositMetrics.value);
  } catch (error) {
    console.error('提现指标计算错误:', error);
    calculationError.value = error.message || '计算超时，请减少数据量';
    return null;
  }
});

// 计算周报重要指标
const weeklyMetrics = computed(() => {
  if (!depositMetrics.value) return null;
  const dm = depositMetrics.value;

  // 充值申请笔数 = 银行卡 + 支付宝
  const depositApplicationCount = dm.jisuApplicationCount + dm.alipayApplicationCount;

  // JS充值等待最终无配对 = （银行卡的充值申请笔数中的极速提＋建单成功等待无配对＋取无卡06提示）＋（支付宝的充值申请笔数中的建单成功等待无配对＋取无卡06提示）
  const jsWaitingNoMatch = dm.jsWaitingNoMatch || 0;

  // 充值配对(配一般卡) = 银行卡的成功配对的一般卡 + 支付宝的成功配对的一般卡 + 一般宝
  const matchNormalCardBankCard = dm.normalMatchCount;  // 银行卡的成功配对的一般卡
  const matchNormalCardAlipay = dm.alipayNormalMatchCount;  // 支付宝的成功配对的一般卡
  const matchNormalCardBao = dm.alipayExpressCardAppCount;  // 一般宝
  const matchNormalCard = matchNormalCardBankCard + matchNormalCardAlipay + matchNormalCardBao;

  // 充值配对(配JS) = 银行卡极速提 + 支付宝极速提(卡) + 极速提(宝)
  const matchJSBankCard = dm.expressMatchCount;  // 银行卡极速提
  const matchJSAlipayKa = dm.alipayJisuTikaCount;  // 支付宝极速提(卡)
  const matchJSAlipayBao = dm.alipayJisuTibaoCount;  // 支付宝极速提(宝)
  const matchJS = matchJSBankCard + matchJSAlipayKa + matchJSAlipayBao;

  // 充值配对(配一般提) = 0
  const matchNormalWithdraw = 0;

  // 订单成功(一般卡) = 银行卡的订单成功一般卡 + 支付宝的订单成功一般卡 + 一般宝
  const orderSuccessNormalCardBankCard = dm.normalOrderSuccessCount;  // 银行卡的订单成功一般卡
  const orderSuccessNormalCardAlipay = dm.alipayNormalOrderSuccessCount;  // 支付宝的订单成功一般卡
  const orderSuccessNormalCardBao = dm.alipayBaoOrderSuccessCount;  // 一般宝
  const orderSuccessNormalCard = orderSuccessNormalCardBankCard + orderSuccessNormalCardAlipay + orderSuccessNormalCardBao;

  // 订单成功(Js+一般提) = 银行卡极速提 + 支付宝极速提(卡) + 极速提(宝)
  const orderSuccessJSBankCard = dm.expressOrderSuccessCount;  // 银行卡极速提
  const orderSuccessJSAlipayKa = dm.alipayJisuTikaOrderSuccessCount;  // 支付宝极速提(卡)
  const orderSuccessJSAlipayBao = dm.alipayJisuTibaoOrderSuccessCount;  // 支付宝极速提(宝)
  const orderSuccessJS = orderSuccessJSBankCard + orderSuccessJSAlipayKa + orderSuccessJSAlipayBao;

  // 订单成功(加总笔数)
  const orderSuccessTotal = orderSuccessNormalCard + orderSuccessJS;

  // ===== 充值订单成功(金额) =====
  // 配一般卡充值订单成功(金额) = 银行卡订单成功一般卡金額 + 支付宝订单成功一般卡金額 + 一般宝金額
  const orderSuccessAmountNormalCardBankCard = dm.normalOrderSuccessAmount || 0;
  const orderSuccessAmountNormalCardAlipay = dm.alipayNormalOrderSuccessAmount || 0;
  const orderSuccessAmountNormalCardBao = dm.alipayBaoOrderSuccessAmount || 0;
  const orderSuccessAmountNormalCard = orderSuccessAmountNormalCardBankCard + orderSuccessAmountNormalCardAlipay + orderSuccessAmountNormalCardBao;

  // 配极速充值订单成功(金额) = 银行卡订单成功极速提金額 + 支付宝订单成功极速提(卡)金額 + 极速提(宝)金額
  const orderSuccessAmountJSBankCard = dm.expressOrderSuccessAmount || 0;
  const orderSuccessAmountJSAlipayKa = dm.alipayJisuTikaOrderSuccessAmount || 0;
  const orderSuccessAmountJSAlipayBao = dm.alipayJisuTibaoOrderSuccessAmount || 0;
  const orderSuccessAmountJS = orderSuccessAmountJSBankCard + orderSuccessAmountJSAlipayKa + orderSuccessAmountJSAlipayBao;

  // 充值订单成功(金额) = 公式候补，先显示0
  const orderSuccessAmountOther = 0;

  // 充值订单成功(金额)总计
  const orderSuccessAmountTotal = orderSuccessAmountNormalCard + orderSuccessAmountJS + orderSuccessAmountOther;

  // 充值卡在待审核 = 0
  const pendingReview = 0;

  // 未充值 = 0
  const notDeposited = 0;

  // 无卡空单率 = JS充值等待最终无配对 / 充值申请
  const emptyOrderRate = depositApplicationCount > 0 ? jsWaitingNoMatch / depositApplicationCount : 0;

  // ===== 提现平均时间 =====
  const wm = withdrawMetrics.value || {};
  const withdrawAvgTimeBankCard = wm.bankCardAvgTime || 0;  // 提现平均时间（卡）
  const withdrawAvgTimeAlipay = wm.alipayAvgTime || 0;  // 提现平均时间（宝）

  // ===== 骗分 =====
  // 从 localStorage 读取骗分记录并按周范围加总
  let fraudBankCardManual = 0;  // 银行卡的骗分没到账来找的人工金额
  let fraudBankCardManualCount = 0;  // 银行卡的骗分没到账来找的人工笔数
  let fraudBankCardCredit = 0;  // 银行卡的信评金额
  let fraudBankCardCreditCount = 0;  // 银行卡的信评笔数
  let fraudBankCardFraudBlacklistCount = 0;  // 银行卡的骗分拉黑
  let fraudBankCardCardVerifyCount = 0;  // 银行卡的卡验及人验
  let fraudAlipayManual = 0;    // 支付宝的骗分没到账来找的人工金额
  let fraudAlipayManualCount = 0;  // 支付宝的骗分没到账来找的人工笔数
  let fraudAlipayCredit = 0;    // 支付宝的信评金额
  let fraudAlipayCreditCount = 0;  // 支付宝的信评笔数
  let fraudAlipayNoReceiptCount = 0;  // 支付宝的没上传回单重复出款充值上分
  let fraudAlipayFraudBlacklistCount = 0;  // 支付宝的骗分拉黑
  let fraudAlipayCardVerifyCount = 0;  // 支付宝的卡验及人验

  try {
    const stored = localStorage.getItem('fraudRecords');
    if (stored) {
      const records = JSON.parse(stored);
      if (Array.isArray(records)) {
        // 过滤符合周范围的记录
        const dateFrom = weekRange.value?.start || '';
        const dateTo = weekRange.value?.end || '';

        const filteredFraudRecords = records.filter(r => {
          if (!r.date) return false;
          if (dateFrom && r.date < dateFrom) return false;
          if (dateTo && r.date > dateTo) return false;
          return true;
        });

        // 加总所有符合条件的记录
        filteredFraudRecords.forEach(r => {
          // 银行卡
          fraudBankCardManual += parseFloat(r.bankCardManualAmount) || 0;
          fraudBankCardManualCount += parseInt(r.bankCardManualCount) || 0;
          fraudBankCardCredit += parseFloat(r.bankCardCreditAmount) || 0;
          fraudBankCardCreditCount += parseInt(r.bankCardCreditCount) || 0;
          fraudBankCardFraudBlacklistCount += parseInt(r.bankCardFraudBlacklistCount) || 0;
          fraudBankCardCardVerifyCount += parseInt(r.bankCardCardVerifyCount) || 0;
          // 支付宝
          fraudAlipayManual += parseFloat(r.alipayManualAmount) || 0;
          fraudAlipayManualCount += parseInt(r.alipayManualCount) || 0;
          fraudAlipayCredit += parseFloat(r.alipayCreditAmount) || 0;
          fraudAlipayCreditCount += parseInt(r.alipayCreditCount) || 0;
          fraudAlipayNoReceiptCount += parseInt(r.alipayNoReceiptCount) || 0;
          fraudAlipayFraudBlacklistCount += parseInt(r.alipayFraudBlacklistCount) || 0;
          fraudAlipayCardVerifyCount += parseInt(r.alipayCardVerifyCount) || 0;
        });
      }
    }
  } catch (e) {
    console.error('读取骗分记录失败:', e);
  }

  const fraudAmount = fraudBankCardManual + fraudBankCardCredit + fraudAlipayManual + fraudAlipayCredit;

  // 骗分成本占比 = 骗分 / 配极速充值订单成功(金额)
  const fraudCostRatio = orderSuccessAmountJS > 0 ? fraudAmount / orderSuccessAmountJS : 0;

  // JS提现返利 = 提现记录中的H栏(merchantRebate)加总金额
  const jsWithdrawRebate = filteredWithdrawRecords.value.reduce((sum, r) => sum + (r.merchantRebate || 0), 0);

  // ===== 配对率＆空单率 =====
  // 充值配对总数
  const totalMatch = matchNormalCard + matchJS + matchNormalWithdraw;

  // 充值配对率 = (充值配对(配一般卡) + 充值配对(配JS) + 充值配对(配一般提)) / 充值申请 * 100%
  const depositMatchRate = depositApplicationCount > 0 ? totalMatch / depositApplicationCount : 0;

  // 充提配对率 = 公式待确认，先设为0
  const depositWithdrawMatchRate = 0;

  // 配对后成功率 = (订单成功(一般卡) + 订单成功(Js+一般提)) / (充值配对(配一般卡) + 充值配对(配JS) + 充值配对(配一般提))
  const successAfterMatchRate = totalMatch > 0 ? orderSuccessTotal / totalMatch : 0;

  // 未充空单率 = 未充值 / (充值配对(配JS) + 充值配对(配一般提))
  const jsAndNormalWithdrawMatch = matchJS + matchNormalWithdraw;
  const notDepositedEmptyRate = jsAndNormalWithdrawMatch > 0 ? notDeposited / jsAndNormalWithdrawMatch : 0;

  // 提现失败率 = 提现失败笔数 / 总申请笔数
  // 总申请 = 时间区间加总 + 提现失败笔数（withdrawSuccessTotalCount 已包含）
  const withdrawFailedCount = wm.withdrawFailedCount || 0;
  const withdrawTotalApplication = wm.withdrawSuccessTotalCount || 0;
  const withdrawFailRate = withdrawTotalApplication > 0 ? withdrawFailedCount / withdrawTotalApplication : 0;

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
    // 提现平均时间
    withdrawAvgTimeBankCard,
    withdrawAvgTimeAlipay,
    // 骗分
    fraudAmount,
    fraudBankCardManual,
    fraudBankCardManualCount,
    fraudBankCardCredit,
    fraudBankCardCreditCount,
    fraudBankCardFraudBlacklistCount,
    fraudBankCardCardVerifyCount,
    fraudAlipayManual,
    fraudAlipayManualCount,
    fraudAlipayCredit,
    fraudAlipayCreditCount,
    fraudAlipayNoReceiptCount,
    fraudAlipayFraudBlacklistCount,
    fraudAlipayCardVerifyCount,
    fraudCostRatio,
    jsWithdrawRebate,
    // 配对率＆空单率
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

// ===== 指标数据分析 =====
// 根据 Excel 公式计算：
// - 总充值笔数 = AP > 0
// - 自动到账笔数 (P4/P5) = AP > 0 且 AO = 1
// - 补单笔数：
//   - 整体: AP > 0 且 状态含「补单」或「确认到帐」
//   - 分类: AP > 0 且 状态含「补单」(不包含「确认到帐」)
// - 3分钟内笔数 = AP > 0 且 AN = 1
// - 充值成功率 = 1 - 补单笔数 / 总充值笔数
// - 充值3分内占比 = 3分钟内笔数 / 自动到账笔数
// - 平均时间 = SUMIFS(AM, AP>0, AO=1, T<>0) / 自动到账笔数
const analysisMetrics = computed(() => {
  // 使用按日期范围筛选后的数据
  const depositData = filteredDepositRecords.value;
  const dm = depositMetrics.value;
  const wm = withdrawMetrics.value;
  if (depositData.length === 0 || !dm) return null;

  // ===== 通用计算函数 =====
  // 资料范围: 订单成功条件
  // 充值成功率 = 订单成功笔数 / 总申请笔数 * 100%
  // 3分内占比 = 处理时间 < 180秒的笔数 / 订单成功笔数 * 100%
  // 平均处理时间 = 到账金额>0 的平均处理时间（同充值分析页面）
  const calculateCategoryMetrics = (orderSuccessRecords, totalApplicationCount, avgTimeRecords = null) => {
    const successCount = orderSuccessRecords.length;
    if (successCount === 0) return { successRate: 0, within3MinRate: 0, avgTime: 0 };

    // 充值成功率 = 订单成功笔数 / 总申请笔数 * 100%
    const successRate = totalApplicationCount > 0 ? (successCount / totalApplicationCount) * 100 : 0;

    // 3分内占比 = 处理时间 < 180秒的笔数 / 订单成功笔数 * 100%
    const within3MinCount = orderSuccessRecords.filter(r =>
      r.processingTime !== null && r.processingTime >= 0 && r.processingTime < 180
    ).length;
    const within3MinRate = successCount > 0 ? (within3MinCount / successCount) * 100 : 0;

    // 平均处理时间 = 到账金额>0 的平均处理时间（如果提供了 avgTimeRecords，则使用它）
    const recordsForAvg = avgTimeRecords || orderSuccessRecords;
    const recordsWithTime = recordsForAvg.filter(r =>
      r.processingTime !== null && r.processingTime >= 0
    );
    const avgTime = recordsWithTime.length > 0
      ? recordsWithTime.reduce((sum, r) => sum + r.processingTime, 0) / recordsWithTime.length
      : 0;

    return { successRate, within3MinRate, avgTime };
  };

  // ===== 1. 整体 =====
  // 资料范围: 同充值分析的重要信息-总申请笔数的条件 (极速银行卡+支付宝+微信 成功配对笔数)
  // 使用 depositMetrics 的值
  const overallSuccessRecords = depositData.filter(r => r.receivedAmount > 0);

  const overallMetrics = calculateCategoryMetrics(overallSuccessRecords, dm.totalApplicationCount || overallSuccessRecords.length);

  // ===== 2. 支付宝 =====
  // 资料范围: 同充值分析的极速支付宝页面（同 csvParser.js alipayRecords）
  // 订单成功条件：同 csvParser.js 的 alipayNormalOrderSuccess + alipayBaoOrderSuccess + alipayJisuTikaOrderSuccess + alipayJisuTibaoOrderSuccess
  const alipayRecords = depositData.filter(r => {
    const merchant = r.merchant || '';
    const hasAlipay = merchant.includes('支付宝') || merchant.includes('支付寶');
    const merchantLower = merchant.toLowerCase();
    const hasTest = merchantLower.includes('test');
    const hasQa = merchantLower.includes('qa');
    const hasOffline = merchant.includes('線下') || merchant.includes('线下');
    return hasAlipay && !hasTest && !hasQa && !hasOffline;
  });

  // 支付宝订单成功条件（同 csvParser.js）：
  // - bankCardCode 有值
  // - normalizedStatus 有值
  // - normalizedStatus ≠ '未充值'
  // - normalizedStatus ≠ '图文复核(已超时)'
  // - normalizedStatus ≠ '审核中(已超时)'
  const alipayOrderSuccessRecords = alipayRecords.filter(r => {
    if (!r.bankCardCode) return false;
    if (!r.normalizedStatus) return false;
    if (r.normalizedStatus === '未充值') return false;
    if (r.normalizedStatus === '图文复核(已超时)') return false;
    if (r.normalizedStatus === '审核中(已超时)') return false;
    return true;
  });

  // 支付宝平均处理时间使用 receivedAmount > 0 的记录（同充值分析页面 alipayNoCreditDowngradeAvgTime）
  const alipayAvgTimeRecords = alipayRecords.filter(r => r.receivedAmount > 0);

  const alipayMetrics = calculateCategoryMetrics(alipayOrderSuccessRecords, dm.alipayApplicationCount || alipayRecords.length, alipayAvgTimeRecords);

  // ===== 3. 微信 =====
  // 资料范围: 同充值分析的微信页面（同 csvParser.js wechatRecords）
  const wechatRecords = depositData.filter(r => {
    const merchant = r.merchant || '';
    const hasWechat = merchant.includes('微信');
    const merchantLower = merchant.toLowerCase();
    const hasTest = merchantLower.includes('test');
    const hasQa = merchantLower.includes('qa');
    const hasOffline = merchant.includes('線下') || merchant.includes('线下');
    return hasWechat && !hasTest && !hasQa && !hasOffline;
  });

  // 微信订单成功条件（同 csvParser.js）：
  // - bankCardCode 有值
  // - receivedAmount > 0
  // - status 有值
  // - status 不含 '未充值'
  // - status 不含 '审核中(已超时)'
  const wechatOrderSuccessRecords = wechatRecords.filter(r => {
    if (!r.bankCardCode) return false;
    if (r.receivedAmount <= 0) return false;
    if (!r.status) return false;
    if (r.status.includes('未充值')) return false;
    if (r.status.includes('审核中(已超时)')) return false;
    return true;
  });

  // 微信平均处理时间条件（同 csvParser.js wechatNoCreditDowngradeAvgTime）：
  // - userLevel !== 0 && userLevel !== -1
  // - receivedAmount > 0
  const wechatAvgTimeRecords = wechatRecords.filter(r => {
    const userLevel = parseFloat(r.userLevel);
    return userLevel !== 0 && userLevel !== -1 && r.receivedAmount > 0;
  });

  const wechatMetrics = calculateCategoryMetrics(wechatOrderSuccessRecords, dm.wechatApplicationCount || wechatRecords.length, wechatAvgTimeRecords);

  // ===== 4. 金宝 =====
  // 资料范围: raw data, 到账金额 > 0, 银行卡代号 GB 开头, 排除 GB-Dahaomen, 排除线下商户
  const isOfflineMerchant = (merchant) => merchant && (merchant.includes('線下') || merchant.includes('线下'));
  const gbSuccessRecords = depositData.filter(r => {
    if (r.receivedAmount <= 0) return false;
    if (!r.bankCardCode) return false;
    if (isOfflineMerchant(r.merchant)) return false;
    const code = r.bankCardCode.toUpperCase();
    return code.startsWith('GB') && !code.startsWith('GB-DAHAOMEN');
  });

  const gbMetrics = calculateCategoryMetrics(gbSuccessRecords, gbSuccessRecords.length);

  // ===== 5. 极速 =====
  // 资料范围: raw data, 到账金额 > 0, 银行卡代号 AUCTION 开头, 排除线下商户
  const auctionSuccessRecords = depositData.filter(r => {
    if (r.receivedAmount <= 0) return false;
    if (!r.bankCardCode) return false;
    if (isOfflineMerchant(r.merchant)) return false;
    const code = r.bankCardCode.toUpperCase();
    return code.startsWith('AUCTION');
  });

  const auctionMetrics = calculateCategoryMetrics(auctionSuccessRecords, auctionSuccessRecords.length);

  // ===== 6. 第三方 =====
  // 资料范围: raw data, 到账金额 > 0, 排除 AUCTION 和 GB 开头, 但包含 GB-Dahaomen 开头, 排除线下商户
  const thirdPartySuccessRecords = depositData.filter(r => {
    if (r.receivedAmount <= 0) return false;
    if (!r.bankCardCode) return false;
    if (isOfflineMerchant(r.merchant)) return false;
    const code = r.bankCardCode.toUpperCase();
    // 包含 GB-Dahaomen 开头
    if (code.startsWith('GB-DAHAOMEN')) return true;
    // 排除 AUCTION 和 GB 开头
    if (code.startsWith('AUCTION') || code.startsWith('GB')) return false;
    return true;
  });

  const thirdPartyMetrics = calculateCategoryMetrics(thirdPartySuccessRecords, thirdPartySuccessRecords.length);

  // ===== 7. 非正向信评 =====
  // 资料范围: raw data, 到账金额 > 0, 状态以「信用」或「信评」开头
  const creditSuccessRecords = depositData.filter(r => {
    if (r.receivedAmount <= 0) return false;
    const status = r.status || '';
    return status.startsWith('信用') || status.startsWith('信评') || status.startsWith('信評');
  });

  const creditMetrics = calculateCategoryMetrics(creditSuccessRecords, creditSuccessRecords.length);

  // ===== 提现数据计算 =====
  // 筛选日期范围内的提现记录
  const withdrawData = filteredWithdrawRecords.value;

  // 计算提现类别指标（比照充值计算逻辑）
  // 成功率 = 提现成功笔数 / 总申请笔数 * 100%
  // 2分内占比 = 2分钟内的笔数 / 提现成功笔数 * 100%
  // 平均处理时间 = 提现成功笔数的平均处理时间
  const calculateWithdrawCategoryMetrics = (records, totalApplicationCount = null) => {
    if (records.length === 0) return { successRate: 0, within3MinRate: 0, avgTime: 0 };

    // 提现成功 = 转账状态为「轉帳完成」或「转帐完成」
    const successRecords = records.filter(r =>
      r.transferStatus === '轉帳完成' || r.transferStatus === '转帐完成'
    );
    const successCount = successRecords.length;

    // 总申请笔数：如果有传入则使用，否则使用记录数
    const totalCount = totalApplicationCount || records.length;

    // 成功率 = 成功笔数 / 总申请笔数 * 100%
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

    // 2分内占比 = 2分钟内的笔数 / 成功笔数 * 100%
    const within2MinRecords = successRecords.filter(r =>
      r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0 && r.avgTimeSeconds <= 120
    );
    const within3MinRate = successCount > 0 ? (within2MinRecords.length / successCount) * 100 : 0;

    // 平均处理时间 = 成功笔数的平均处理时间
    const recordsWithTime = successRecords.filter(r =>
      r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0
    );
    const avgTime = recordsWithTime.length > 0
      ? recordsWithTime.reduce((sum, r) => sum + r.avgTimeSeconds, 0) / recordsWithTime.length
      : 0;

    return { successRate, within3MinRate, avgTime };
  };

  // 整体提现：使用 wm.withdrawSuccessTotalCount 作为总申请笔数
  const withdrawTotalApplication = wm?.withdrawSuccessTotalCount || withdrawData.length;
  const withdrawOverall = calculateWithdrawCategoryMetrics(withdrawData, withdrawTotalApplication);

  // 支付宝提现：remark === '支付宝'
  const withdrawAlipayRecords = withdrawData.filter(r =>
    r.remark === '支付宝' && r.requestAmount > 0
  );
  const withdrawAlipay = calculateWithdrawCategoryMetrics(withdrawAlipayRecords);

  // 微信提现：remark === '微信'
  const withdrawWechatRecords = withdrawData.filter(r =>
    r.remark === '微信' && r.requestAmount > 0
  );
  const withdrawWechat = calculateWithdrawCategoryMetrics(withdrawWechatRecords);

  // 金宝提现：转出账号以 gb 开头
  const withdrawGBRecords = withdrawData.filter(r => {
    if (!r.payoutAccount) return false;
    const lower = r.payoutAccount.toLowerCase();
    return lower.startsWith('gb');
  });
  const withdrawGB = calculateWithdrawCategoryMetrics(withdrawGBRecords);

  // 极速提现（极速银行卡）：remark === '银行卡'
  // 平均时间计算：receivingBank !== '支付宝' && transferStatus === '轉帳完成'
  const withdrawAuctionRecords = withdrawData.filter(r =>
    r.remark === '银行卡' && r.requestAmount > 0
  );
  const withdrawAuction = calculateWithdrawCategoryMetrics(withdrawAuctionRecords);

  // 第三方提现：转出账号 非 gb, auction, *****ion
  const withdrawThirdPartyRecords = withdrawData.filter(r => {
    if (!r.payoutAccount) return false;
    const lower = r.payoutAccount.toLowerCase();
    if (lower.startsWith('gb')) return false;
    if (lower.includes('auction')) return false;
    if (r.payoutAccount.includes('*****ion')) return false;
    return true;
  });
  const withdrawThirdParty = calculateWithdrawCategoryMetrics(withdrawThirdPartyRecords);

  return [
    { category: '整体', successRate: overallMetrics.successRate, within3MinRate: overallMetrics.within3MinRate, avgTime: overallMetrics.avgTime, withdrawSuccessRate: withdrawOverall.successRate, withdrawWithin3MinRate: withdrawOverall.within3MinRate, withdrawAvgTime: withdrawOverall.avgTime },
    { category: '支付宝', successRate: alipayMetrics.successRate, within3MinRate: alipayMetrics.within3MinRate, avgTime: alipayMetrics.avgTime, withdrawSuccessRate: withdrawAlipay.successRate, withdrawWithin3MinRate: withdrawAlipay.within3MinRate, withdrawAvgTime: withdrawAlipay.avgTime },
    { category: '微信', successRate: wechatMetrics.successRate, within3MinRate: wechatMetrics.within3MinRate, avgTime: wechatMetrics.avgTime, withdrawSuccessRate: withdrawWechat.successRate, withdrawWithin3MinRate: withdrawWechat.within3MinRate, withdrawAvgTime: withdrawWechat.avgTime },
    { category: '金宝', successRate: gbMetrics.successRate, within3MinRate: gbMetrics.within3MinRate, avgTime: gbMetrics.avgTime, withdrawSuccessRate: withdrawGB.successRate, withdrawWithin3MinRate: withdrawGB.within3MinRate, withdrawAvgTime: withdrawGB.avgTime },
    { category: '极速', successRate: auctionMetrics.successRate, within3MinRate: auctionMetrics.within3MinRate, avgTime: auctionMetrics.avgTime, withdrawSuccessRate: withdrawAuction.successRate, withdrawWithin3MinRate: withdrawAuction.within3MinRate, withdrawAvgTime: withdrawAuction.avgTime },
    { category: '第三方', successRate: thirdPartyMetrics.successRate, within3MinRate: thirdPartyMetrics.within3MinRate, avgTime: thirdPartyMetrics.avgTime, withdrawSuccessRate: withdrawThirdParty.successRate, withdrawWithin3MinRate: withdrawThirdParty.within3MinRate, withdrawAvgTime: withdrawThirdParty.avgTime },
    { category: '非正向信评', successRate: creditMetrics.successRate, within3MinRate: creditMetrics.within3MinRate, avgTime: creditMetrics.avgTime, withdrawSuccessRate: null, withdrawWithin3MinRate: null, withdrawAvgTime: null }
  ];
});

// 设置预设日期範圍
const setDefaultDate = () => {
  startDate.value = '2026-01-01';
  endDate.value = '2026-01-07';
};

// 开始日期变更时的防呆
const onStartDateChange = () => {
  if (!startDate.value) return;

  // 开始日期不能超过今日
  if (startDate.value > today) {
    startDate.value = today;
    dateRangeError.value = '开始日期不能超过今日，已自动修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 如果结束日期早于开始日期，自动修正结束日期
  if (endDate.value && endDate.value < startDate.value) {
    endDate.value = startDate.value;
    dateRangeError.value = '结束日期已自动修正为开始日期';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 检查日期范围是否超过一个月
  if (startDate.value && endDate.value) {
    const start = new Date(startDate.value);
    const end = new Date(endDate.value);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    if (diffDays > 31) {
      const maxEnd = new Date(start);
      maxEnd.setDate(maxEnd.getDate() + 31);
      const maxEndStr = maxEnd.toISOString().split('T')[0];
      endDate.value = maxEndStr > today ? today : maxEndStr;
      dateRangeError.value = '日期范围最大一个月，已自动修正';
      setTimeout(() => { dateRangeError.value = ''; }, 2000);
    }
  }
};

// 结束日期变更时的防呆
const onEndDateChange = () => {
  if (!endDate.value) return;

  // 结束日期不能超过今日
  if (endDate.value > today) {
    endDate.value = today;
    dateRangeError.value = '结束日期不能超过今日，已自动修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 结束日期不能早于开始日期
  if (startDate.value && endDate.value < startDate.value) {
    endDate.value = startDate.value;
    dateRangeError.value = '结束日期不能早于开始日期，已自动修正';
    setTimeout(() => { dateRangeError.value = ''; }, 2000);
  }

  // 检查日期范围是否超过一个月
  if (startDate.value && endDate.value) {
    const start = new Date(startDate.value);
    const end = new Date(endDate.value);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    if (diffDays > 31) {
      const minStart = new Date(end);
      minStart.setDate(minStart.getDate() - 31);
      startDate.value = minStart.toISOString().split('T')[0];
      dateRangeError.value = '日期范围最大一个月，已自动修正';
      setTimeout(() => { dateRangeError.value = ''; }, 2000);
    }
  }
};

// 导出周报
const handleExport = async () => {
  if (!weeklyMetrics.value || isExporting.value) return;

  isExporting.value = true;
  exportProgress.value = '准备导出...';

  try {
    const onProgress = (progress) => {
      exportProgress.value = `${progress.message} (${progress.step}/${progress.total})`;
    };

    await exportWeeklyToExcel(
      weeklyMetrics.value,
      analysisMetrics.value,
      weekRange.value,
      depositMetrics.value,
      withdrawMetrics.value,
      onProgress
    );

    exportProgress.value = '导出完成！';
    setTimeout(() => {
      exportProgress.value = '';
    }, 2000);
  } catch (error) {
    console.error('导出失败:', error);
    exportProgress.value = error.message || '导出失败，请重试';
    setTimeout(() => {
      exportProgress.value = '';
    }, 3000);
  } finally {
    isExporting.value = false;
  }
};

// 导出充值纯文本报表
const handleExportText = () => {
  if (depositMetrics.value) {
    exportDepositToText(depositMetrics.value, weekRange.value, withdrawMetrics.value, weeklyMetrics.value);
  }
};

// 查询（数据已自动计算，此按钮用于视觉确认）
const handleQuery = () => {
  // 数据通过 computed 自动更新，无需额外操作
};

// 初始化
setDefaultDate();
</script>

<template>
  <div class="weekly-report">
    <!-- 日期选择器 -->
    <div class="date-selector">
      <div class="selector-header">
        <h2>日/周报数据汇总</h2>
      </div>
      <div class="selector-content">
        <div class="date-picker">
          <label>起始日期：</label>
          <input type="date" v-model="startDate" class="date-input" :max="today" @change="onStartDateChange" />
        </div>
        <div class="date-picker">
          <label>结束日期：</label>
          <input type="date" v-model="endDate" class="date-input" :max="today" @change="onEndDateChange" />
        </div>
        <div v-if="dateRangeError" class="date-error">{{ dateRangeError }}</div>
        <div v-if="calculationError" class="calculation-error">{{ calculationError }}</div>
        <button @click="handleQuery" class="query-btn">查询</button>
        <button @click="handleExport" class="export-btn" v-if="weeklyMetrics" :disabled="isExporting">
          {{ isExporting ? exportProgress : '导出 Excel' }}
        </button>
        <button @click="handleExportText" class="export-btn text-btn" v-if="depositMetrics">导出纯文本</button>
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
            <div class="section-formula">
              银行卡 + 支付宝
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
                <span class="detail-label">银行卡</span>
                <span class="detail-value">{{ (weeklyMetrics.bankCardJsWaitingNoMatch || 0).toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">支付宝</span>
                <span class="detail-value">{{ (weeklyMetrics.alipayJsWaitingNoMatch || 0).toLocaleString() }}</span>
              </div>
            </div>
            <div class="section-formula">
              银行卡(建单成功等待无配对+取无卡06提示) + 支付宝(建单成功等待无配对+取无卡06提示)<br>
              建单成功等待无配对 = bankCardCode為空的记录数<br>
              取无卡06提示 = 暂时硬编码（银行卡:2笔, 支付宝:0笔），后续需从06数据计算
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
            <div class="section-formula">
              银行卡一般卡 + 支付宝一般卡 + 一般宝
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
            <div class="section-formula">
              银行卡极速提 + 支付宝极速提(卡) + 极速提(宝)
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
            <div class="section-formula">
              待定义
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
            <div class="section-formula">
              订单成功(一般卡) + 订单成功(Js+一般提)
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
            <div class="section-formula">
              银行卡订单成功一般卡 + 支付宝订单成功一般卡 + 一般宝
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
            <div class="section-formula">
              银行卡订单成功极速提 + 支付宝订单成功极速提(卡) + 极速提(宝)
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
            <div class="section-formula">
              7/21起系统查核中笔数有列入
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
            <div class="section-formula">
              7/21起不含等待无配对
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
            <div class="section-formula">
              JS充值等待最终无配对 / 充值申请
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
            <div class="section-formula">
              配一般卡金额 + 配极速金额 + 其他(公式候补)
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
            <div class="section-formula">
              银行卡订单成功一般卡金額 + 支付宝订单成功一般卡金額 + 一般宝金額
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
            <div class="section-formula">
              银行卡订单成功极速提金額 + 支付宝订单成功极速提(卡)金額 + 极速提(宝)金額
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
            <div class="section-formula">
              公式候补
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 区块四：平均处理时间 ========== -->
      <div class="report-section" v-if="weeklyMetrics">
        <div class="section-header">
          <h3>平均处理时间</h3>
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
        </div>
        <div class="section-formula">
          <strong>计算公式说明（来自 汇总周报数据 D47/D48）：</strong><br>
          - 提现平均处理时间（卡）= AVERAGEIFS('raw data withdraw'!AF:AF, AC:AC, "银行卡", AD:AD, "转账完成")<br>
          &nbsp;&nbsp;即：银行卡提现记录中，转账完成的处理时间(AF栏)平均<br>
          - 提现平均处理时间（宝）= AVERAGEIFS('raw data withdraw'!AF:AF, AC:AC, "*支付宝*", AD:AD, "转账完成")<br>
          &nbsp;&nbsp;即：支付宝提现记录中，转账完成的处理时间(AF栏)平均<br>
          <br>
          <strong>AF栏公式：</strong>IF(AD="转账完成", Q-T 或 Q-V, "")<br>
          &nbsp;&nbsp;Q = 通知商户时间, T = 建立时间, V = 剩余池建立时间
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
        <div class="section-formula">
          <strong>计算公式说明（来自 总计 银行卡/支付宝 页签）：</strong><br>
          - 骗分 = 银行卡骗分(人工+信评) + 支付宝骗分(人工+信评)<br>
          &nbsp;&nbsp;银行卡信评：'总计 银行卡'!B25 元 / D25 笔<br>
          &nbsp;&nbsp;支付宝信评：'总计 支付宝'!B27 元 / D27 笔<br>
          - 骗分成本占比 = 骗分 / 配极速充值订单成功(金额) × 100%<br>
          - JS提现返利 = 'raw data withdraw'!H栏(商户返利)加总
        </div>
      </div>

      <!-- ========== 区块六：配对率＆空单率（暂时隐藏） ========== -->
      <div class="report-section" v-if="false">
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
        <div class="section-formula">
          <strong>计算公式说明（来自 总计 银行卡/支付宝 页签）：</strong><br>
          - 充值配对率 = 成功配对 / 充值申请<br>
          &nbsp;&nbsp;银行卡：'总计 银行卡'!B17 = B3/B2<br>
          &nbsp;&nbsp;支付宝：'总计 支付宝'!B19 = B3/B2<br>
          - 充提配对率 = 公式待确认<br>
          - 配对后成功率 = 订单成功 / 成功配对<br>
          &nbsp;&nbsp;银行卡：'总计 银行卡'!B18 = B6/B3<br>
          &nbsp;&nbsp;支付宝：'总计 支付宝'!B20 = B8/B3<br>
          - 未充空单率 = 未充值 / (充值配对(配JS) + 充值配对(配一般提)) × 100%<br>
          - 提现失败率 = 提现失败笔数 / 总申请<br>
          <br>
          <strong>提现成功率公式：</strong>= 1 - 提现失败率 = (总申请 - 提现失败笔数) / 总申请<br>
          - 提现失败笔数 = 按流水号去重后，每個流水號最终状态为失败的数量<br>
          - 总申请 = 时间区间加总 + 提现失败笔数
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
                <th rowspan="2" class="category-header">分类</th>
                <th colspan="3" class="group-header deposit-header">充值数据</th>
                <th colspan="3" class="group-header withdraw-header">提现数据</th>
              </tr>
              <tr>
                <th class="sub-header deposit-sub">成功率</th>
                <th class="sub-header deposit-sub">3分内占比</th>
                <th class="sub-header deposit-sub">平均处理时间</th>
                <th class="sub-header withdraw-sub">成功率</th>
                <th class="sub-header withdraw-sub">2分内占比</th>
                <th class="sub-header withdraw-sub">平均处理时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in analysisMetrics" :key="row.category">
                <td class="category-cell">{{ row.category }}</td>
                <td class="rate-cell">{{ row.successRate.toFixed(2) }}%</td>
                <td class="rate-cell">{{ row.within3MinRate.toFixed(2) }}%</td>
                <td class="time-cell">{{ formatTime(row.avgTime) }}</td>
                <td class="withdraw-rate-cell">{{ row.withdrawSuccessRate === null ? '--' : row.withdrawSuccessRate.toFixed(2) + '%' }}</td>
                <td class="withdraw-rate-cell">{{ row.withdrawWithin3MinRate === null ? '--' : row.withdrawWithin3MinRate.toFixed(2) + '%' }}</td>
                <td class="withdraw-time-cell">{{ row.withdrawAvgTime === null ? '--' : formatTime(row.withdrawAvgTime) }}</td>
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
  gap: 20px;
}

/* 日期選擇器 */
.date-selector {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.selector-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
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
  color: #666;
  font-size: 14px;
}

.date-input {
  padding: 10px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-size: 14px;
  outline: none;
}

.date-input:focus {
  border-color: #4a4a9e;
  box-shadow: 0 0 0 3px rgba(74, 74, 158, 0.1);
}

.date-error {
  color: #856404;
  font-size: 14px;
  padding: 8px 12px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
}

.calculation-error {
  color: #721c24;
  font-size: 14px;
  padding: 8px 12px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
  margin-top: 8px;
}

.export-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background: #5cb85c;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  margin-left: auto;
}

.export-btn:hover {
  background: #4cae4c;
}

.export-btn:disabled {
  background: #9e9e9e;
  cursor: not-allowed;
  opacity: 0.8;
}

.query-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background: #4a4a9e;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  margin-left: 10px;
}

.query-btn:hover {
  background: #3a3a8e;
}

.export-btn.text-btn {
  background: #ff9f0a;
  margin-left: 10px;
}

.export-btn.text-btn:hover {
  background: #e68a00;
}

/* 报表区块 */
.report-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.section-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.record-count {
  color: #666;
  font-size: 13px;
  background: #f5f5f5;
  padding: 6px 12px;
  border-radius: 6px;
}

/* 指标网格 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.metric-card {
  background: #f8f9fa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 14px;
}

.card-title {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.card-value {
  font-size: 18px;
  font-weight: 700;
  color: #333;
}

/* 渠道网格 */
.channel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.channel-card {
  background: #f8f9fa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 14px;
}

.channel-title {
  font-size: 14px;
  font-weight: 600;
  color: #4a4a9e;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e8e8e8;
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
  font-size: 13px;
  color: #666;
}

.stat-value {
  font-size: 13px;
  color: #333;
  font-family: monospace;
}

/* 重要指标网格 */
.important-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

/* 区块样式 (与 MetricsCards.vue 一致) */
.jisu-block {
  background: #f8f9fa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 14px;
}

.jisu-block.highlight-block {
  background: #e8f5e9;
  border: 1px solid #5cb85c;
}

/* 区块内容网格 */
.jisu-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e8e8e8;
}

.block-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.block-value {
  font-size: 16px;
  font-weight: 700;
  color: #4a4a9e;
}

.block-value.success {
  color: #5cb85c;
}

.block-value.warning {
  color: #f0ad4e;
}

.block-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 13px;
  color: #666;
}

.detail-value {
  font-size: 13px;
  color: #333;
  font-family: monospace;
}

.detail-value.note {
  color: #999;
  font-family: inherit;
  font-style: italic;
  font-size: 11px;
}

/* 无数据 */
.no-data {
  text-align: center;
  color: #999;
  font-size: 14px;
  padding: 40px 20px;
}

/* 区块底部公式说明 */
.section-formula {
  font-size: 12px;
  color: #666;
  padding: 16px 20px;
  background: #f8f9fa;
  border-top: 1px dashed #e0e0e0;
  line-height: 1.8;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.section-formula strong {
  color: #4a4a9e;
  font-weight: 600;
}

/* 绿色区块内的公式说明使用浅绿色背景 */
.jisu-block.highlight-block .section-formula {
  background: #e8f5e9;
  border-top: 1px dashed #a5d6a7;
  color: #555;
}

/* 指标数据分析表格 */
.analysis-table-container {
  overflow-x: auto;
}

.analysis-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border: 2px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.analysis-table thead {
  background: #5cb85c;
}

.analysis-table th {
  padding: 12px 16px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.analysis-table th:first-child {
  border-top-left-radius: 8px;
}

.analysis-table th:last-child {
  border-top-right-radius: 8px;
}

.analysis-table tbody tr {
  transition: background 0.2s;
}

.analysis-table tbody tr:hover {
  background: #fafafa;
}

.analysis-table tbody tr:nth-child(even) {
  background: #fafafa;
}

.analysis-table td {
  padding: 12px 16px;
  font-size: 13px;
  color: #333;
  border: 1px solid #e0e0e0;
  text-align: center;
}

.analysis-table .category-cell {
  color: #333;
  font-weight: 600;
  text-align: left;
  background: #f8f9fa;
}

.analysis-table .rate-cell {
  color: #5cb85c;
  font-family: monospace;
}

.analysis-table .time-cell {
  color: #4a4a9e;
  font-family: monospace;
}

.analysis-table .group-header {
  text-align: center;
  font-size: 14px;
  border: 2px solid rgba(255, 255, 255, 0.5);
}

.analysis-table .deposit-header {
  background: #5cb85c;
  border-left: 2px solid #5cb85c;
}

.analysis-table .withdraw-header {
  background: #4a4a9e;
  border-right: 2px solid #4a4a9e;
}

.analysis-table .withdraw-rate-cell {
  color: #4a4a9e;
  font-family: monospace;
}

.analysis-table .withdraw-time-cell {
  color: #7c4dff;
  font-family: monospace;
}

.analysis-table .category-header {
  background: #9e9e9e;
  vertical-align: middle;
  text-align: center;
}

.analysis-table .sub-header {
  font-size: 12px;
  font-weight: 600;
  background: #f5f5f5;
  color: #333;
}

.analysis-table .sub-header.deposit-sub {
  background: #e8f5e9;
  color: #2e7d32;
}

.analysis-table .sub-header.withdraw-sub {
  background: #e8eaf6;
  color: #3949ab;
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
    font-size: 12px;
  }
}
</style>
