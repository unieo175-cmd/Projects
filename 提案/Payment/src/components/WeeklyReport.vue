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
  },
  showMetricsAnalysisValues: {
    type: Boolean,
    default: false  // 預設隱藏計算值欄位
  },
  showFormula: {
    type: Boolean,
    default: false
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

// 使用所有充值记录（不再按日期过滤）
const filteredDepositRecords = computed(() => {
  return props.depositRecords || [];
});

// 使用所有提现记录（不再按日期过滤）
const filteredWithdrawRecords = computed(() => {
  return props.withdrawRecords || [];
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
// 根據 CRITERIA.md 準則計算：
// - 整體數據範圍: 商戶只排除 test/qa（不排除線下、外部商戶等）
// - 充值成功率 = 到帳金額 > 0 的筆數 / 總申請筆數 × 100%
// - 3分内占比 = 處理時間 ≤ 180秒的筆數 / 充值成功筆數 × 100%
// - 平均处理时间 = 到帳金額 > 0 的處理時間平均
const analysisMetrics = computed(() => {
  // 使用按日期范围筛选后的数据
  const depositData = filteredDepositRecords.value;
  const dm = depositMetrics.value;
  const wm = withdrawMetrics.value;
  if (depositData.length === 0 || !dm) return null;

  // ===== 通用计算函数 =====
  // 依據 CRITERIA.md 準則計算
  // 充值成功率 = 到帳金額 > 0 的筆數 / 總申請筆數 × 100%
  // 3分内占比 = 處理時間 ≤ 180秒的筆數 / 充值成功筆數 × 100%
  // 平均处理时间 = 到帳金額 > 0 的處理時間平均
  const calculateCategoryMetrics = (successRecords, totalApplicationCount, avgTimeRecords = null) => {
    const successCount = successRecords.length;
    if (successCount === 0) return { successRate: 0, within3MinRate: 0, avgTime: 0 };

    // 充值成功率 = 到帳金額 > 0 的筆數 / 總申請筆數 × 100%
    const successRate = totalApplicationCount > 0 ? (successCount / totalApplicationCount) * 100 : 0;

    // 3分内占比 = 處理時間 ≤ 180秒的筆數 / 充值成功筆數 × 100%（準則：2分钟内≤120秒 + 2-3分钟121-180秒）
    const within3MinCount = successRecords.filter(r =>
      r.processingTime !== null && r.processingTime >= 0 && r.processingTime <= 180
    ).length;
    const within3MinRate = successCount > 0 ? (within3MinCount / successCount) * 100 : 0;

    // 平均处理时间 = 到帳金額 > 0 的處理時間平均
    const recordsForAvg = avgTimeRecords || successRecords;
    const recordsWithTime = recordsForAvg.filter(r =>
      r.processingTime !== null && r.processingTime >= 0
    );
    const avgTime = recordsWithTime.length > 0
      ? recordsWithTime.reduce((sum, r) => sum + r.processingTime, 0) / recordsWithTime.length
      : 0;

    return { successRate, within3MinRate, avgTime };
  };

  // ===== 1. 整体 =====
  // 依據 CRITERIA.md 準則 2.1: 商戶只排除 test/qa（不排除線下、外部商戶等）
  const isValidMerchant = (r) => {
    const merchant = r.merchant || '';
    const merchantLower = merchant.toLowerCase();
    const hasTest = merchantLower.includes('test');
    const hasQa = merchantLower.includes('qa');
    return !hasTest && !hasQa;
  };

  // 整體數據：商戶只排除 test/qa
  const overallRecords = depositData.filter(isValidMerchant);
  // 總申請筆數 = 商戶只排除 test/qa 的筆數加總
  const overallTotalCount = overallRecords.length;
  // 总充值成功（含掉单）= 到帳金額 > 0 的筆數
  const overallSuccessRecords = overallRecords.filter(r => r.receivedAmount > 0);

  const overallMetrics = calculateCategoryMetrics(overallSuccessRecords, overallTotalCount);

  // ===== 2. 支付宝 =====
  // 依據 CRITERIA.md 準則 4.1: 商戶包含「支付寶」或「支付宝」且不含「test/qa/線下」
  // 充值成功率 = 到帳金額 > 0 的筆數 / 總申請筆數 × 100%
  // 3分内占比 = 處理時間 ≤ 180秒的筆數 / 充值成功筆數 × 100%
  // 平均处理时间 = 到帳金額 > 0 的處理時間平均
  const alipayRecords = depositData.filter(r => {
    const merchant = r.merchant || '';
    const hasAlipay = merchant.includes('支付宝') || merchant.includes('支付寶');
    const merchantLower = merchant.toLowerCase();
    const hasTest = merchantLower.includes('test');
    const hasQa = merchantLower.includes('qa');
    const hasOffline = merchant.includes('線下') || merchant.includes('线下');
    return hasAlipay && !hasTest && !hasQa && !hasOffline;
  });

  // 支付寶總申請筆數
  const alipayAppCount = alipayRecords.length;
  // 支付寶充值成功（到帳金額 > 0）
  const alipaySuccessfulRecords = alipayRecords.filter(r => r.receivedAmount > 0);
  // 充值成功率 = 到帳金額 > 0 的筆數 / 總申請筆數 × 100%
  const alipaySuccessRate = alipayAppCount > 0 ? (alipaySuccessfulRecords.length / alipayAppCount) * 100 : 0;

  // 3分内占比 = 處理時間 ≤ 180秒的筆數 / 充值成功筆數 × 100%
  const alipayWithin3MinCount = alipaySuccessfulRecords.filter(r =>
    r.processingTime !== null && r.processingTime >= 0 && r.processingTime <= 180
  ).length;
  const alipayWithin3MinRate = alipaySuccessfulRecords.length > 0 ? (alipayWithin3MinCount / alipaySuccessfulRecords.length) * 100 : 0;

  // 平均处理时间 = 到帳金額 > 0 的處理時間平均
  const alipayRecordsWithTime = alipaySuccessfulRecords.filter(r =>
    r.processingTime !== null && r.processingTime >= 0
  );
  const alipayAvgTime = alipayRecordsWithTime.length > 0
    ? alipayRecordsWithTime.reduce((sum, r) => sum + r.processingTime, 0) / alipayRecordsWithTime.length
    : 0;

  // ===== 3. 微信 =====
  // 依據 CRITERIA.md 準則 5.1: 商戶包含「微信」且不含「test/qa/線下」
  // 充值成功率 = 到帳金額 > 0 的筆數 / 總申請筆數 × 100%
  // 3分内占比 = 處理時間 ≤ 180秒的筆數 / 充值成功筆數 × 100%
  // 平均处理时间 = 到帳金額 > 0 的處理時間平均
  const wechatRecords = depositData.filter(r => {
    const merchant = r.merchant || '';
    const hasWechat = merchant.includes('微信');
    const merchantLower = merchant.toLowerCase();
    const hasTest = merchantLower.includes('test');
    const hasQa = merchantLower.includes('qa');
    const hasOffline = merchant.includes('線下') || merchant.includes('线下');
    return hasWechat && !hasTest && !hasQa && !hasOffline;
  });

  // 微信總申請筆數
  const wechatAppCount = wechatRecords.length;
  // 微信充值成功（到帳金額 > 0）
  const wechatSuccessfulRecords = wechatRecords.filter(r => r.receivedAmount > 0);
  // 充值成功率 = 到帳金額 > 0 的筆數 / 總申請筆數 × 100%
  const wechatSuccessRate = wechatAppCount > 0 ? (wechatSuccessfulRecords.length / wechatAppCount) * 100 : 0;

  // 3分内占比 = 處理時間 ≤ 180秒的筆數 / 充值成功筆數 × 100%
  const wechatWithin3MinCount = wechatSuccessfulRecords.filter(r =>
    r.processingTime !== null && r.processingTime >= 0 && r.processingTime <= 180
  ).length;
  const wechatWithin3MinRate = wechatSuccessfulRecords.length > 0 ? (wechatWithin3MinCount / wechatSuccessfulRecords.length) * 100 : 0;

  // 平均处理时间 = 到帳金額 > 0 的處理時間平均
  const wechatRecordsWithTime = wechatSuccessfulRecords.filter(r =>
    r.processingTime !== null && r.processingTime >= 0
  );
  const wechatAvgTime = wechatRecordsWithTime.length > 0
    ? wechatRecordsWithTime.reduce((sum, r) => sum + r.processingTime, 0) / wechatRecordsWithTime.length
    : 0;

  const wechatMetrics = {
    successRate: wechatSuccessRate,
    within3MinRate: wechatWithin3MinRate,
    avgTime: wechatAvgTime
  };

  // 微信成功率调试
  console.log('=== 微信充值成功率计算（依據準則）===');
  console.log('微信總申請筆數:', wechatAppCount);
  console.log('微信充值成功(到帳金額>0):', wechatSuccessfulRecords.length);
  console.log('微信成功率:', wechatSuccessRate.toFixed(2) + '%');
  console.log('微信3分內筆數:', wechatWithin3MinCount);
  console.log('微信3分內占比:', wechatWithin3MinRate.toFixed(2) + '%');
  console.log('微信平均处理时间:', wechatAvgTime.toFixed(0), '秒');

  // ===== 4. 金宝 =====
  // 數據範圍: 到帳金額 > 0, 銀行卡代號 GB 開頭, 排除 GB-Dahaomen, 排除線下商戶
  // 充值成功率 = 到帳金額 > 0 的筆數 / 總申請筆數 × 100%
  const isOfflineMerchant = (merchant) => merchant && (merchant.includes('線下') || merchant.includes('线下'));

  // 金宝總申請：銀行卡代號 GB 開頭，排除 GB-Dahaomen，排除線下商戶
  const gbAllRecords = depositData.filter(r => {
    if (!r.bankCardCode) return false;
    if (isOfflineMerchant(r.merchant)) return false;
    const code = r.bankCardCode.toUpperCase();
    return code.startsWith('GB') && !code.startsWith('GB-DAHAOMEN');
  });
  // 金宝充值成功：到帳金額 > 0
  const gbSuccessRecords = gbAllRecords.filter(r => r.receivedAmount > 0);

  const gbMetrics = calculateCategoryMetrics(gbSuccessRecords, gbAllRecords.length);

  // ===== 5. 极速 =====
  // 數據範圍: 銀行卡代號 AUCTION 開頭, 排除線下商戶
  // 充值成功率 = 到帳金額 > 0 的筆數 / 總申請筆數 × 100%

  // 极速總申請：銀行卡代號 AUCTION 開頭，排除線下商戶
  const auctionAllRecords = depositData.filter(r => {
    if (!r.bankCardCode) return false;
    if (isOfflineMerchant(r.merchant)) return false;
    const code = r.bankCardCode.toUpperCase();
    return code.startsWith('AUCTION');
  });
  // 极速充值成功：到帳金額 > 0
  const auctionSuccessRecords = auctionAllRecords.filter(r => r.receivedAmount > 0);

  const auctionMetrics = calculateCategoryMetrics(auctionSuccessRecords, auctionAllRecords.length);

  // ===== 6. 第三方 =====
  // 數據範圍: 排除 AUCTION 和 GB 開頭, 但包含 GB-Dahaomen 開頭, 排除線下商戶
  // 充值成功率 = 到帳金額 > 0 的筆數 / 總申請筆數 × 100%

  // 第三方總申請
  const thirdPartyAllRecords = depositData.filter(r => {
    if (!r.bankCardCode) return false;
    if (isOfflineMerchant(r.merchant)) return false;
    const code = r.bankCardCode.toUpperCase();
    // 包含 GB-Dahaomen 开头
    if (code.startsWith('GB-DAHAOMEN')) return true;
    // 排除 AUCTION 和 GB 开头
    if (code.startsWith('AUCTION') || code.startsWith('GB')) return false;
    return true;
  });
  // 第三方充值成功：到帳金額 > 0
  const thirdPartySuccessRecords = thirdPartyAllRecords.filter(r => r.receivedAmount > 0);

  const thirdPartyMetrics = calculateCategoryMetrics(thirdPartySuccessRecords, thirdPartyAllRecords.length);

  // ===== 7. 非正向信评 =====
  // 數據範圍: 狀態以「信用」或「信评」開頭
  // 充值成功率 = 到帳金額 > 0 的筆數 / 總申請筆數 × 100%

  // 信評總申請：狀態以信用/信评開頭
  const creditAllRecords = depositData.filter(r => {
    const status = r.status || '';
    return status.startsWith('信用') || status.startsWith('信评') || status.startsWith('信評');
  });
  // 信評充值成功：到帳金額 > 0
  const creditSuccessRecords = creditAllRecords.filter(r => r.receivedAmount > 0);

  const creditMetrics = calculateCategoryMetrics(creditSuccessRecords, creditAllRecords.length);

  // ===== 提现数据计算 =====
  // 筛选日期范围内的提现记录
  const withdrawData = filteredWithdrawRecords.value;

  // ===== 提現計算（依據 CRITERIA.md 準則）=====
  // 提現成功條件：(說明=轉帳完成/转账完成/转帐完成 OR 提現狀態含提現完成) 且 實際轉出金額≠0
  // 提現失敗條件：說明≠轉帳完成 且 實際轉出金額=空白或0 且 提現狀態≠提現完成
  // 成功率 = 提現成功筆數 / 總申請筆數 × 100%
  // 2分内占比 = 處理時間 ≤ 120秒的筆數 / 提現成功筆數 × 100%
  // 平均处理时间 = 提現成功的處理時間平均
  const calculateWithdrawCategoryMetrics = (records, totalApplicationCount = null) => {
    if (records.length === 0) return { successRate: 0, within3MinRate: 0, avgTime: 0, successCount: 0, totalCount: 0 };

    // 提現成功判斷：
    // (說明=轉帳完成/转账完成/转帐完成 OR 提現狀態含提現完成/提现完成) 且 實際轉出金額≠0
    const successRecords = records.filter(r => {
      const transferStatus = r.transferStatus || '';
      const status = r.status || '';
      const actualAmount = r.actualAmount || 0;
      const isTransferComplete = transferStatus === '轉帳完成' || transferStatus === '转帐完成' || transferStatus === '转账完成';
      const isStatusComplete = status.includes('提現完成') || status.includes('提现完成');
      const hasActualAmount = actualAmount !== 0;
      return (isTransferComplete || isStatusComplete) && hasActualAmount;
    });
    const successCount = successRecords.length;

    // 總申請筆數：如果有傳入則使用，否則使用記錄數
    const totalCount = totalApplicationCount || records.length;

    // 成功率 = 提現成功筆數 / 總申請筆數 × 100%
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

    // 2分内占比 = 處理時間 ≤ 120秒的筆數 / 提現成功筆數 × 100%（依據 CRITERIA.md 6.5）
    const within2MinRecords = successRecords.filter(r =>
      r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0 && r.avgTimeSeconds < 120
    );
    const within3MinRate = successCount > 0 ? (within2MinRecords.length / successCount) * 100 : 0;

    // 平均处理时间 = 提現成功的處理時間平均
    const recordsWithTime = successRecords.filter(r =>
      r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0
    );
    const avgTime = recordsWithTime.length > 0
      ? recordsWithTime.reduce((sum, r) => sum + r.avgTimeSeconds, 0) / recordsWithTime.length
      : 0;

    return { successRate, within3MinRate, avgTime, successCount, totalCount };
  };

  // 整体提现：依據 CRITERIA.md 9.2.4 (銀行卡 + 支付寶 + 微信) + 線下
  // 銀行卡：有出款卡代號的記錄（payoutCardCode 不為空）
  // 支付寶：merchant 含「支付寶/支付宝」
  // 微信：merchant 含「微信」
  // 線下：merchant 含「线下/線下」
  const isWithdrawInCategory = (r) => {
    const merchant = r.merchant || '';
    const payoutCardCode = (r.payoutCardCode || '').trim();

    // 銀行卡：有出款卡代號（包含 GB, AUCTION, 或其他有效代號）
    const hasBankCard = payoutCardCode.length > 0;

    // 支付寶
    const hasAlipay = merchant.includes('支付宝') || merchant.includes('支付寶');

    // 微信
    const hasWechat = merchant.includes('微信');

    // 線下
    const hasOffline = merchant.includes('线下') || merchant.includes('線下');

    return hasBankCard || hasAlipay || hasWechat || hasOffline;
  };

  // 按商戶分類過濾
  const withdrawCategoryRecords = withdrawData.filter(isWithdrawInCategory);

  // 按訂單ID去重（同 csvParser.js）
  const uniqueWithdrawMap = {};
  withdrawCategoryRecords.forEach(r => {
    uniqueWithdrawMap[r.id] = r; // 保留最後一筆
  });
  const deduplicatedWithdrawRecords = Object.values(uniqueWithdrawMap);

  console.log(`日週報提現去重：過濾後 ${withdrawCategoryRecords.length} 筆 → 去重後 ${deduplicatedWithdrawRecords.length} 筆`);

  const withdrawTotalApplication = deduplicatedWithdrawRecords.length;
  const withdrawOverall = calculateWithdrawCategoryMetrics(deduplicatedWithdrawRecords, withdrawTotalApplication);

  // 詳細 debug：比較與 csvParser.js 的計算
  const debugSuccessRecords = deduplicatedWithdrawRecords.filter(r => {
    const transferStatus = r.transferStatus || '';
    const status = r.status || '';
    const actualAmount = r.actualAmount || 0;
    const isTransferComplete = transferStatus === '轉帳完成' || transferStatus === '转帐完成' || transferStatus === '转账完成';
    const isStatusComplete = status.includes('提現完成') || status.includes('提现完成');
    const hasActualAmount = actualAmount !== 0;
    return (isTransferComplete || isStatusComplete) && hasActualAmount;
  });
  const debugRecordsWithTime = debugSuccessRecords.filter(r =>
    r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0
  );
  const debugTimeSum = debugRecordsWithTime.reduce((sum, r) => sum + r.avgTimeSeconds, 0);
  const debugAvgTime = debugRecordsWithTime.length > 0 ? debugTimeSum / debugRecordsWithTime.length : 0;
  console.log('【指标数据分析-整體提現】', {
    '去重後記錄數': deduplicatedWithdrawRecords.length,
    '成功筆數': debugSuccessRecords.length,
    '有時間的筆數': debugRecordsWithTime.length,
    '時間總和': debugTimeSum.toFixed(2),
    '平均時間': debugAvgTime.toFixed(2) + '秒',
    '格式化': `${Math.floor(debugAvgTime / 60)}:${Math.floor(debugAvgTime % 60).toString().padStart(2, '0')}`
  });

  // 去重函數：按訂單ID去重
  const deduplicateByOrderId = (records) => {
    const uniqueMap = {};
    records.forEach(r => {
      uniqueMap[r.id] = r; // 保留最後一筆
    });
    return Object.values(uniqueMap);
  };

  // 支付宝提现：merchant (商戶) 包含 '支付宝/支付寶'，並去重
  const withdrawAlipayFiltered = withdrawData.filter(r => {
    const merchant = r.merchant || '';
    return merchant.includes('支付宝') || merchant.includes('支付寶');
  });
  const withdrawAlipayRecords = deduplicateByOrderId(withdrawAlipayFiltered);
  const withdrawAlipay = calculateWithdrawCategoryMetrics(withdrawAlipayRecords);

  // 微信提现：merchant (商戶) 包含 '微信'，並去重
  const withdrawWechatFiltered = withdrawData.filter(r => {
    const merchant = r.merchant || '';
    return merchant.includes('微信');
  });
  const withdrawWechatRecords = deduplicateByOrderId(withdrawWechatFiltered);
  const withdrawWechat = calculateWithdrawCategoryMetrics(withdrawWechatRecords);

  // 金宝提现：payoutCardCode 以 GB 开头（非 GB-Dahaomen），並去重
  const withdrawGBFiltered = withdrawData.filter(r => {
    const code = (r.payoutCardCode || '').toUpperCase();
    return code.startsWith('GB') && !code.startsWith('GB-DAHAOMEN');
  });
  const withdrawGBRecords = deduplicateByOrderId(withdrawGBFiltered);
  const withdrawGB = calculateWithdrawCategoryMetrics(withdrawGBRecords);

  // 极速提现（极速银行卡）：payoutCardCode 包含 AUCTION，並去重
  const withdrawAuctionFiltered = withdrawData.filter(r => {
    const code = (r.payoutCardCode || '').toUpperCase();
    return code.includes('AUCTION');
  });
  const withdrawAuctionRecords = deduplicateByOrderId(withdrawAuctionFiltered);
  const withdrawAuction = calculateWithdrawCategoryMetrics(withdrawAuctionRecords);

  // 第三方提现：payoutCardCode 不为空且不包含 AUCTION，並去重
  const withdrawThirdPartyFiltered = withdrawData.filter(r => {
    const code = (r.payoutCardCode || '').toUpperCase();
    // 有出款卡代号且不是 AUCTION 的都是第三方
    return code.length > 0 && !code.includes('AUCTION');
  });
  const withdrawThirdPartyRecords = deduplicateByOrderId(withdrawThirdPartyFiltered);
  const withdrawThirdParty = calculateWithdrawCategoryMetrics(withdrawThirdPartyRecords);

  // 调试信息
  console.log('=== 指标数据分析调试 ===');
  console.log('充值数据总数:', depositData.length);
  console.log('充值成功(receivedAmount>0):', overallSuccessRecords.length);
  console.log('充值总申请(排除test/qa):', overallTotalCount);
  console.log('提现数据总数:', withdrawData.length);
  console.log('提现 withdrawTotalApplication(去重後):', withdrawTotalApplication);
  console.log('整体充值:', overallMetrics);
  console.log('整体提现:', withdrawOverall);
  console.log('支付宝充值:', alipaySuccessfulRecords.length, '/', alipayAppCount);
  console.log(`支付宝提现(merchant判斷): 去重前 ${withdrawAlipayFiltered.length} 筆 → 去重後 ${withdrawAlipayRecords.length} 筆`);
  console.log(`微信提现(merchant判斷): 去重前 ${withdrawWechatFiltered.length} 筆 → 去重後 ${withdrawWechatRecords.length} 筆`);
  console.log(`极速提现: 去重前 ${withdrawAuctionFiltered.length} 筆 → 去重後 ${withdrawAuctionRecords.length} 筆`);
  console.log(`第三方提现: 去重前 ${withdrawThirdPartyFiltered.length} 筆 → 去重後 ${withdrawThirdPartyRecords.length} 筆`);
  console.log(`金宝提现: 去重前 ${withdrawGBFiltered.length} 筆 → 去重後 ${withdrawGBRecords.length} 筆`);

  const result = [
    { category: '整体', successRate: overallMetrics.successRate, within3MinRate: overallMetrics.within3MinRate, avgTime: overallMetrics.avgTime, withdrawSuccessRate: withdrawOverall.successRate, withdrawWithin3MinRate: withdrawOverall.within3MinRate, withdrawAvgTime: withdrawOverall.avgTime,
      debugDeposit: `${overallSuccessRecords.length} / ${overallTotalCount}`,
      debugWithdraw: `${withdrawOverall.successCount} / ${withdrawOverall.totalCount}` },
    { category: '支付宝', successRate: alipaySuccessRate, within3MinRate: alipayWithin3MinRate, avgTime: alipayAvgTime, withdrawSuccessRate: withdrawAlipay.successRate, withdrawWithin3MinRate: withdrawAlipay.within3MinRate, withdrawAvgTime: withdrawAlipay.avgTime,
      debugDeposit: `${alipaySuccessfulRecords.length} / ${alipayAppCount}`,
      debugWithdraw: `${withdrawAlipay.successCount} / ${withdrawAlipay.totalCount}` },
    { category: '微信', successRate: wechatMetrics.successRate, within3MinRate: wechatMetrics.within3MinRate, avgTime: wechatMetrics.avgTime, withdrawSuccessRate: withdrawWechat.successRate, withdrawWithin3MinRate: withdrawWechat.within3MinRate, withdrawAvgTime: withdrawWechat.avgTime,
      debugDeposit: `${wechatSuccessfulRecords.length} / ${wechatAppCount}`,
      debugWithdraw: `${withdrawWechat.successCount} / ${withdrawWechat.totalCount}` },
    { category: '金宝', successRate: gbMetrics.successRate, within3MinRate: gbMetrics.within3MinRate, avgTime: gbMetrics.avgTime, withdrawSuccessRate: withdrawGB.successRate, withdrawWithin3MinRate: withdrawGB.within3MinRate, withdrawAvgTime: withdrawGB.avgTime,
      debugDeposit: `${gbSuccessRecords.length} 筆`,
      debugWithdraw: `${withdrawGB.successCount} / ${withdrawGB.totalCount}` },
    { category: '极速', successRate: auctionMetrics.successRate, within3MinRate: auctionMetrics.within3MinRate, avgTime: auctionMetrics.avgTime, withdrawSuccessRate: withdrawAuction.successRate, withdrawWithin3MinRate: withdrawAuction.within3MinRate, withdrawAvgTime: withdrawAuction.avgTime,
      debugDeposit: `${auctionSuccessRecords.length} 筆`,
      debugWithdraw: `${withdrawAuction.successCount} / ${withdrawAuction.totalCount}` },
    { category: '第三方', successRate: thirdPartyMetrics.successRate, within3MinRate: thirdPartyMetrics.within3MinRate, avgTime: thirdPartyMetrics.avgTime, withdrawSuccessRate: withdrawThirdParty.successRate, withdrawWithin3MinRate: withdrawThirdParty.within3MinRate, withdrawAvgTime: withdrawThirdParty.avgTime,
      debugDeposit: `${thirdPartySuccessRecords.length} 筆`,
      debugWithdraw: `${withdrawThirdParty.successCount} / ${withdrawThirdParty.totalCount}` },
    { category: '非正向信评', successRate: creditMetrics.successRate, within3MinRate: creditMetrics.within3MinRate, avgTime: creditMetrics.avgTime, withdrawSuccessRate: null, withdrawWithin3MinRate: null, withdrawAvgTime: null,
      debugDeposit: `${creditSuccessRecords.length} 筆`,
      debugWithdraw: '--' }
  ];
  console.log('指标数据分析结果:', result);
  return result;
});

// 设置预设日期範圍 - 根据数据自动检测
const setDefaultDate = () => {
  // 从充值记录中获取最早和最晚日期
  let minDate = null;
  let maxDate = null;

  // 检查充值记录
  if (props.depositRecords && props.depositRecords.length > 0) {
    props.depositRecords.forEach(r => {
      if (r.requestTime) {
        const date = r.requestTime.substring(0, 10);
        if (!minDate || date < minDate) minDate = date;
        if (!maxDate || date > maxDate) maxDate = date;
      }
    });
  }

  // 检查提现记录
  if (props.withdrawRecords && props.withdrawRecords.length > 0) {
    props.withdrawRecords.forEach(r => {
      if (r.requestTime) {
        const date = r.requestTime.substring(0, 10);
        if (!minDate || date < minDate) minDate = date;
        if (!maxDate || date > maxDate) maxDate = date;
      }
    });
  }

  // 如果有检测到日期，使用检测到的范围
  if (minDate && maxDate) {
    startDate.value = minDate;
    endDate.value = maxDate;
    console.log('自动检测日期范围:', minDate, '~', maxDate);
  } else {
    // 如果没有数据，使用默认值
    startDate.value = '2026-01-01';
    endDate.value = '2026-01-07';
  }
};

// 监听数据变化，自动更新日期范围
watch(() => [props.depositRecords, props.withdrawRecords], () => {
  if ((props.depositRecords && props.depositRecords.length > 0) ||
      (props.withdrawRecords && props.withdrawRecords.length > 0)) {
    setDefaultDate();
  }
}, { immediate: true });

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
</script>

<template>
  <div class="weekly-report">
    <!-- 标题和操作区 -->
    <div class="date-selector">
      <div class="selector-header">
        <h2>日/周报数据汇总</h2>
      </div>
      <div class="selector-content">
        <div class="date-inputs">
          <div class="date-input-group">
            <label>开始日期</label>
            <input type="date" v-model="startDate" :max="today" />
          </div>
          <span class="date-separator">~</span>
          <div class="date-input-group">
            <label>结束日期</label>
            <input type="date" v-model="endDate" :max="today" />
          </div>
        </div>
        <div v-if="dateRangeError" class="date-range-error">{{ dateRangeError }}</div>
        <div v-if="calculationError" class="calculation-error">{{ calculationError }}</div>
        <div class="export-buttons">
          <button @click="handleExport" class="export-btn" v-if="weeklyMetrics" :disabled="isExporting">
            {{ isExporting ? exportProgress : '导出 Excel' }}
          </button>
          <button @click="handleExportText" class="export-btn text-btn" v-if="depositMetrics">导出纯文本</button>
        </div>
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
            <div v-if="showFormula" class="section-formula">
              銀行卡申請筆數 + 支付寶申請筆數
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
            <div v-if="showFormula" class="section-formula">
              銀行卡(建單成功等待無配對+取無卡06提示) + 支付寶(建單成功等待無配對+取無卡06提示)<br>
              建單成功等待無配對 = bankCardCode為空的記錄數<br>
              取無卡06提示 = 數據來源：極速06統計表，依據商戶名稱判斷渠道加總（暫帶0）
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
            <div v-if="showFormula" class="section-formula">
              銀行卡一般卡 + 支付寶一般卡 + 一般寶
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
            <div v-if="showFormula" class="section-formula">
              銀行卡極速提 + 支付寶極速提(卡) + 極速提(寶)
            </div>
          </div>

          <!-- 充值配对(配一般提) -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值配对(配一般提)</span>
              <span class="block-value">{{ weeklyMetrics.matchNormalWithdraw.toLocaleString() }}</span>
            </div>
            <div v-if="showFormula" class="block-details">
              <div class="detail-item">
                <span class="detail-label">说明</span>
                <span class="detail-value note">待定义</span>
              </div>
            </div>
            <div v-if="showFormula" class="section-formula">
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
            <div v-if="showFormula" class="section-formula">
              訂單成功(一般卡) + 訂單成功(Js+一般提)
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
            <div v-if="showFormula" class="section-formula">
              銀行卡訂單成功一般卡 + 支付寶訂單成功一般卡 + 一般寶
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
            <div v-if="showFormula" class="section-formula">
              銀行卡訂單成功極速提 + 支付寶訂單成功極速提(卡) + 極速提(寶)
            </div>
          </div>

          <!-- 充值卡在待审核 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值卡在待审核</span>
              <span class="block-value">{{ weeklyMetrics.pendingReview.toLocaleString() }}</span>
            </div>
            <div v-if="showFormula" class="block-details">
              <div class="detail-item">
                <span class="detail-label">说明</span>
                <span class="detail-value note">7/21起系统查核中笔数有列入</span>
              </div>
            </div>
            <div v-if="showFormula" class="section-formula">
              7/21起系统查核中笔数有列入
            </div>
          </div>

          <!-- 未充值 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">未充值</span>
              <span class="block-value">{{ weeklyMetrics.notDeposited.toLocaleString() }}</span>
            </div>
            <div v-if="showFormula" class="block-details">
              <div class="detail-item">
                <span class="detail-label">说明</span>
                <span class="detail-value note">7/21起不含等待无配对</span>
              </div>
            </div>
            <div v-if="showFormula" class="section-formula">
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
              <div v-if="showFormula" class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">JS充值等待最终无配对 / 充值申请</span>
              </div>
            </div>
            <div v-if="showFormula" class="section-formula">
              JS充值等待最終無配對 / 充值申請 × 100%
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
            <div v-if="showFormula" class="section-formula">
              配一般卡金額 + 配極速金額 + 其他(公式候補)
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
            <div v-if="showFormula" class="section-formula">
              銀行卡訂單成功一般卡金額 + 支付寶訂單成功一般卡金額 + 一般寶金額
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
            <div v-if="showFormula" class="section-formula">
              銀行卡訂單成功極速提金額 + 支付寶訂單成功極速提(卡)金額 + 極速提(寶)金額
            </div>
          </div>

          <!-- 充值订单成功(金额) 待补 -->
          <div class="jisu-block">
            <div class="block-header">
              <span class="block-title">充值订单成功(金额)</span>
              <span class="block-value">{{ formatAmount(weeklyMetrics.orderSuccessAmountOther) }} 元</span>
            </div>
            <div v-if="showFormula" class="block-details">
              <div class="detail-item">
                <span class="detail-label">说明</span>
                <span class="detail-value note">公式候补</span>
              </div>
            </div>
            <div v-if="showFormula" class="section-formula">
              公式候補
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
        <div v-if="showFormula" class="section-formula">
          <strong>计算公式说明：</strong><br>
          - 提现平均处理时间（卡）= 提現分析的銀行卡的平均處理時間<br>
          - 提现平均处理时间（宝）= 提現分析的支付寶的平均處理時間
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
            <div v-if="showFormula" class="block-details">
              <div v-if="showFormula" class="detail-item">
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
            <div v-if="showFormula" class="block-details">
              <div v-if="showFormula" class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">提现记录H栏(merchantRebate)加总</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          <strong>计算公式说明：</strong><br>
          - 數據來源：選單中的「騙分統計」（依篩選日期範圍加總）<br>
          - 骗分 = 银行卡骗分(人工+信评) + 支付宝骗分(人工+信评)<br>
          - 骗分成本占比 = 骗分 / 配极速充值订单成功(金额) × 100%<br>
          - JS提现返利 = 提現紀錄的商戶返利加總
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
              <div v-if="showFormula" class="detail-item">
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
              <div v-if="showFormula" class="detail-item">
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
              <div v-if="showFormula" class="detail-item">
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
              <div v-if="showFormula" class="detail-item">
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
              <div v-if="showFormula" class="detail-item">
                <span class="detail-label">计算公式</span>
                <span class="detail-value note">公式后补</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="showFormula" class="section-formula">
          <strong>計算公式說明：</strong><br>
          - 充值配对率 = (充值配對(配一般卡) + 充值配對(配JS) + 充值配對(配一般提)) / 充值申請 × 100%<br>
          - 充提配对率 = 公式待確認<br>
          - 配对后成功率 = (訂單成功(一般卡) + 訂單成功(Js+一般提)) / (充值配對(配一般卡) + 充值配對(配JS) + 充值配對(配一般提)) × 100%<br>
          - 未充空单率 = 未充值 / (充值配對(配JS) + 充值配對(配一般提)) × 100%<br>
          - 提现失败率 = 提現失敗筆數 / 總申請筆數 × 100%<br>
          <br>
          <strong>提現失敗條件：</strong>說明≠轉帳完成/转账完成 且 實際轉出金額=空白或0 且 提現狀態≠提現完成/提现完成（按訂單號去重）
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
                <th :colspan="showMetricsAnalysisValues ? 4 : 3" class="group-header deposit-header">充值数据</th>
                <th :colspan="showMetricsAnalysisValues ? 4 : 3" class="group-header withdraw-header">提现数据</th>
              </tr>
              <tr>
                <th class="sub-header deposit-sub">成功率</th>
                <th v-if="showMetricsAnalysisValues" class="sub-header deposit-sub">计算值</th>
                <th class="sub-header deposit-sub">3分内占比</th>
                <th class="sub-header deposit-sub">平均处理时间</th>
                <th class="sub-header withdraw-sub">成功率</th>
                <th v-if="showMetricsAnalysisValues" class="sub-header withdraw-sub">计算值</th>
                <th class="sub-header withdraw-sub">2分内占比</th>
                <th class="sub-header withdraw-sub">平均处理时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in analysisMetrics" :key="row.category">
                <td class="category-cell">{{ row.category }}</td>
                <td class="rate-cell">{{ row.successRate.toFixed(2) }}%</td>
                <td v-if="showMetricsAnalysisValues" class="debug-cell">{{ row.debugDeposit }}</td>
                <td class="rate-cell">{{ row.within3MinRate.toFixed(2) }}%</td>
                <td class="time-cell">{{ formatTime(row.avgTime) }}</td>
                <td class="withdraw-rate-cell">{{ row.withdrawSuccessRate === null ? '--' : row.withdrawSuccessRate.toFixed(2) + '%' }}</td>
                <td v-if="showMetricsAnalysisValues" class="debug-cell">{{ row.debugWithdraw }}</td>
                <td class="withdraw-rate-cell">{{ row.withdrawWithin3MinRate === null ? '--' : row.withdrawWithin3MinRate.toFixed(2) + '%' }}</td>
                <td class="withdraw-time-cell">{{ row.withdrawAvgTime === null ? '--' : formatTime(row.withdrawAvgTime) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="showFormula" class="section-formula">
          <strong>充值計算公式說明：</strong><br>
          - 整體數據範圍：商戶只排除 test/qa（不排除線下、外部商戶等）<br>
          - 支付寶數據範圍：商戶含「支付寶/支付宝」且排除 test/qa/線下<br>
          - 微信數據範圍：商戶含「微信」且排除 test/qa/線下<br>
          - 金寶數據範圍：銀行卡代號 GB 開頭（非 GB-Dahaomen），排除線下商戶<br>
          - 極速數據範圍：銀行卡代號 AUCTION 開頭，排除線下商戶<br>
          - 第三方數據範圍：銀行卡代號非 AUCTION/GB 開頭（含 GB-Dahaomen），排除線下商戶<br>
          - 充值成功率 = 到帳金額 > 0 的筆數 / 總申請筆數 × 100%<br>
          - 3分内占比 = 處理時間 ≤ 180秒的筆數 / 充值成功筆數 × 100%<br>
          - 平均處理時間 = 到帳金額 > 0 的處理時間平均<br>
          <br>
          <strong>提現計算公式說明：</strong><br>
          - 整體數據範圍：商戶分類（銀行卡+支付寶+微信+線下），按訂單號去重<br>
          - 支付寶數據範圍：商戶含「支付寶/支付宝」，按訂單號去重<br>
          - 微信數據範圍：商戶含「微信」，按訂單號去重<br>
          - 金寶數據範圍：出款卡代號 GB 開頭（非 GB-Dahaomen），按訂單號去重<br>
          - 極速數據範圍：出款卡代號含 AUCTION，按訂單號去重<br>
          - 第三方數據範圍：出款卡代號有值且不含 AUCTION，按訂單號去重<br>
          - 提現成功條件：說明=轉帳完成/转账完成 且 實際轉出金額≠0<br>
          - 成功率 = 提現成功筆數 / 總申請筆數 × 100%<br>
          - 2分内占比 = 處理時間 < 120秒的筆數 / 提現成功筆數 × 100%<br>
          - 平均處理時間 = 提現成功的處理時間平均
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

.selector-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.selector-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.date-range-info {
  font-size: 14px;
  color: #666;
  background: #f0f0f0;
  padding: 6px 12px;
  border-radius: 4px;
}

.selector-content {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.date-inputs {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.date-input-group label {
  font-size: 12px;
  color: #666;
}

.date-input-group input[type="date"] {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #333;
  font-size: 14px;
  outline: none;
  min-width: 140px;
}

.date-input-group input[type="date"]:focus {
  border-color: #4a4a9e;
  box-shadow: 0 0 0 2px rgba(74, 74, 158, 0.1);
}

.date-separator {
  color: #666;
  font-size: 16px;
  margin-top: 20px;
}

.date-range-error {
  color: #ff6b6b;
  font-size: 12px;
  background: #fff5f5;
  padding: 6px 12px;
  border-radius: 4px;
}

.export-buttons {
  display: flex;
  gap: 12px;
  margin-left: auto;
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
  color: #888;
  margin-top: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
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

.analysis-table .debug-cell {
  color: #999;
  font-size: 11px;
  font-family: monospace;
  background: #f9f9f9;
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
