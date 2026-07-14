import * as XLSX from 'xlsx';
import { AMOUNT_RANGES } from './constants';
import { formatTime, formatTimeMinutes, formatAmount } from './formatters';

// 從 localStorage 讀取騙分數據（充值 export 共用）
const loadFraudData = () => {
  try {
    const stored = localStorage.getItem('fraudRecords');
    if (!stored) return null;
    const records = JSON.parse(stored);
    if (!Array.isArray(records)) return null;
    const r = {
      bankCard: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, noReceiptCount: 0, fraudBlacklistCount: 0, cardVerifyCount: 0 },
      alipay: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, noReceiptCount: 0, fraudBlacklistCount: 0, cardVerifyCount: 0 },
      wechat: { manualCount: 0, manualAmount: 0, creditCount: 0, creditAmount: 0, noReceiptCount: 0 },
    };
    records.forEach(rec => {
      r.bankCard.manualCount += parseFloat(rec.bankCardManualCount) || 0;
      r.bankCard.manualAmount += parseFloat(rec.bankCardManualAmount) || 0;
      r.bankCard.creditCount += parseFloat(rec.bankCardCreditCount) || 0;
      r.bankCard.creditAmount += parseFloat(rec.bankCardCreditAmount) || 0;
      r.bankCard.noReceiptCount += parseFloat(rec.bankCardNoReceiptCount) || 0;
      r.bankCard.fraudBlacklistCount += parseFloat(rec.bankCardFraudBlacklistCount) || 0;
      r.bankCard.cardVerifyCount += parseFloat(rec.bankCardCardVerifyCount) || 0;
      r.alipay.manualCount += parseFloat(rec.alipayManualCount) || 0;
      r.alipay.manualAmount += parseFloat(rec.alipayManualAmount) || 0;
      r.alipay.creditCount += parseFloat(rec.alipayCreditCount) || 0;
      r.alipay.creditAmount += parseFloat(rec.alipayCreditAmount) || 0;
      r.alipay.noReceiptCount += parseFloat(rec.alipayNoReceiptCount) || 0;
      r.alipay.fraudBlacklistCount += parseFloat(rec.alipayFraudBlacklistCount) || 0;
      r.alipay.cardVerifyCount += parseFloat(rec.alipayCardVerifyCount) || 0;
      r.wechat.manualCount += parseFloat(rec.wechatManualCount) || 0;
      r.wechat.manualAmount += parseFloat(rec.wechatManualAmount) || 0;
      r.wechat.creditCount += parseFloat(rec.wechatCreditCount) || 0;
      r.wechat.creditAmount += parseFloat(rec.wechatCreditAmount) || 0;
      r.wechat.noReceiptCount += parseFloat(rec.wechatNoReceiptCount) || 0;
    });
    return r;
  } catch { return null; }
};

const buildDateRange = (weekRange) => {
  if (weekRange && weekRange.start) {
    return weekRange.start === weekRange.end ? weekRange.start : `${weekRange.start}_${weekRange.end}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// 汇出充值数据到 Excel
export const exportDepositToExcel = (metrics, filteredRecords, weekRange = null) => {
  const wb = XLSX.utils.book_new();

  // 工作表1: 总览
  const overviewData = [
    ['=== 重要信息 ===', '', ''],
    ['项目', '数值', '说明'],
    ['总申请笔数', metrics.totalApplicationCount || 0, '银行卡+支付宝+微信 成功配对'],
    ['总充值成功（含掉单）', metrics.successfulCount || 0, '笔'],
    ['成功率', `${(metrics.overallSuccessRate || 0).toFixed(2)}%`, ''],
    ['总充值金额', metrics.minuteAnalysisTotalAmount || 0, '元'],
    ['', '', ''],
    ['=== 充值成功时间区段 ===', '', ''],
    ['项目', '笔数/百分比', '金额'],
    ['总充值成功（含掉单）', metrics.minuteAnalysisTotalCount || 0, `${formatAmount(metrics.minuteAnalysisTotalAmount || 0)} 元`],
    ['2分钟内', `${metrics.minuteWithin2MinCount || 0} (${(metrics.minuteWithin2MinRatio || 0).toFixed(2)}%)`, `${formatAmount(metrics.minuteWithin2MinAmount || 0)} 元`],
    ['2-3分钟', `${metrics.minuteWithin2to3MinCount || 0} (${(metrics.minuteWithin2to3MinRatio || 0).toFixed(2)}%)`, `${formatAmount(metrics.minuteWithin2to3MinAmount || 0)} 元`],
    ['3-5分钟', `${metrics.minuteWithin3to5MinCount || 0} (${(metrics.minuteWithin3to5MinRatio || 0).toFixed(2)}%)`, `${formatAmount(metrics.minuteWithin3to5MinAmount || 0)} 元`],
    ['5-15分钟', `${metrics.minuteWithin5to15MinCount || 0} (${(metrics.minuteWithin5to15MinRatio || 0).toFixed(2)}%)`, `${formatAmount(metrics.minuteWithin5to15MinAmount || 0)} 元`],
    ['15-30分钟', `${metrics.minuteWithin15to30MinCount || 0} (${(metrics.minuteWithin15to30MinRatio || 0).toFixed(2)}%)`, `${formatAmount(metrics.minuteWithin15to30MinAmount || 0)} 元`],
    ['30分钟以上', `${metrics.minuteOver30MinCount || 0} (${(metrics.minuteOver30MinRatio || 0).toFixed(2)}%)`, `${formatAmount(metrics.minuteOver30MinAmount || 0)} 元`],
    ['未成功申请', metrics.minuteInvalidCount || 0, `${(metrics.minuteInvalidRatio || 0).toFixed(2)}%`],
    ['掉单笔数', metrics.minuteDropCount || 0, `${(metrics.minuteDropRatio || 0).toFixed(2)}%`],
    ['平均处理时间', formatTime(metrics.minuteAvgTime), ''],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewData), '总览');

  const amountRanges = AMOUNT_RANGES;
  const noCreditByAmount = metrics.noCreditDowngradeByAmount || {};
  const fraudData = loadFraudData();

  // 工作表2: 银行卡渠道
  const bankCardChannel = [
    ['项目', '笔数', '金额'],
    ['充值申请笔数', metrics.jisuApplicationCount || 0, `${formatAmount(metrics.totalMatchAmount || 0)} 元`],
    ['  成功配对', metrics.totalMatchCount || 0, `${formatAmount(metrics.totalMatchAmount || 0)} 元`],
    ['    一般卡', metrics.normalMatchCount || 0, `${formatAmount(metrics.normalMatchAmount || 0)} 元`],
    ['    极速提', metrics.expressMatchCount || 0, `${formatAmount(metrics.expressMatchAmount || 0)} 元`],
    ['  建单成功等待无配对', metrics.waitingForMatchCount || 0, ''],
    ['  取无卡06提示', metrics.noCard06Count || 0, ''],
    ['  无效申请', metrics.jisuInvalidApplicationCount || 0, ''],
    ['', '', ''],
    ['订单成功', metrics.totalOrderSuccessCount || 0, `${formatAmount(metrics.totalOrderSuccessAmount || 0)} 元`],
    ['  一般卡', metrics.normalOrderSuccessCount || 0, `${formatAmount(metrics.normalOrderSuccessAmount || 0)} 元`],
    ['  极速提', metrics.expressOrderSuccessCount || 0, `${formatAmount(metrics.expressOrderSuccessAmount || 0)} 元`],
    ['  信评上分', metrics.creditScoreSuccessCount || 0, `${formatAmount(metrics.creditScoreSuccessAmount || 0)} 元 / ${formatTime(metrics.creditScoreAvgTime)}`],
    ['  平均处理时间', formatTime(metrics.noCreditDowngradeAvgTime), ''],
    ['', '', ''],
    ['没信评降等配卡', metrics.noCreditDowngradeTotal || 0, ''],
    ...amountRanges.map(amt => [`  ${amt.toLocaleString()}元`, noCreditByAmount[amt] || 0, '']),
    [`  其他`, noCreditByAmount['other'] || 0, ''],
    ['', '', ''],
    ['c2c', metrics.c2cCount || 0, `${formatAmount(metrics.c2cAmount || 0)} 元`],
    ['  点确认（用户确认到账）', metrics.c2cConfirmCount || 0, ''],
    ['  点确认（用户确认到账）-平均处理时间', formatTimeMinutes(metrics.c2cConfirmAvgTime), ''],
    ['  人工审核:通过', metrics.c2cManualAuditCount || 0, ''],
    ['  审核-成功平均处理时间', formatTimeMinutes(metrics.c2cAuditSuccessAvgTime), ''],
    ['  用户较久补材料后成功', metrics.c2cOver11MinSuccessCount || 0, ''],
    ['', '', ''],
    ['三方代收（一般卡订单成功）', metrics.thirdPartyCount || 0, `${formatAmount(metrics.thirdPartyAmount || 0)} 元`],
    ...((metrics.configuredThirdPartyCards || []).map(card => {
      const data = metrics.thirdPartyByCard && metrics.thirdPartyByCard[card.cardNumber] ? metrics.thirdPartyByCard[card.cardNumber] : { count: 0, amount: 0 };
      return [`  ${card.name}(${card.cardNumber})`, data.count || 0, `${formatAmount(data.amount || 0)} 元`];
    })),
    ['', '', ''],
    ['骗分没到帐来找', '', ''],
    ['  人工', fraudData?.bankCard.manualCount || 0, `${formatAmount(fraudData?.bankCard.manualAmount || 0)} 元`],
    ['  信评', fraudData?.bankCard.creditCount || 0, `${formatAmount(fraudData?.bankCard.creditAmount || 0)} 元`],
    ['  没上传回单重复出款充值上分', fraudData?.bankCard.noReceiptCount || 0, ''],
    ['  骗分拉黑', fraudData?.bankCard.fraudBlacklistCount || 0, ''],
    ['  卡验及人验', fraudData?.bankCard.cardVerifyCount || 0, ''],
    ['', '', ''],
    ['商业平台', '', ''],
    ['  外部充值成功', metrics.commercialPlatformTotalSuccessCount || 0, `${formatAmount(metrics.commercialPlatformTotalSuccessAmount || 0)} 元`],
    ['  外部充值總申請', metrics.commercialPlatformTotalAppCount || 0, `${formatAmount(metrics.commercialPlatformTotalAppAmount || 0)} 元`],
    ...((metrics.commercialPlatformMerchants || []).length > 0
      ? (metrics.commercialPlatformMerchants || []).flatMap(m => [
          [`  ${m.name}`, '', ''],
          [`    充值申请`, m.applicationCount || 0, `${formatAmount(m.applicationAmount || 0)} 元`],
          [`    充值成功笔数`, m.successCount || 0, `${formatAmount(m.successAmount || 0)} 元`],
        ])
      : [['  外部商户', '', ''], ['    充值申请', 0, '0 元'], ['    充值成功笔数', 0, '0 元']]
    ),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bankCardChannel), '银行卡渠道');

  // 工作表3: 支付宝渠道
  const alipayNoCreditByAmount = metrics.alipayNoCreditDowngradeByAmount || {};
  const alipayChannel = [
    ['项目', '笔数', '金额'],
    ['充值申请笔数', metrics.alipayApplicationCount || 0, `${formatAmount(metrics.alipayTotalMatchAmount || 0)} 元`],
    ['  成功配对', metrics.alipayTotalMatchCount || 0, `${formatAmount(metrics.alipayTotalMatchAmount || 0)} 元`],
    ['    一般卡', metrics.alipayNormalMatchCount || 0, `${formatAmount(metrics.alipayNormalMatchAmount || 0)} 元`],
    ['    一般宝', metrics.alipayExpressCardAppCount || 0, `${formatAmount(metrics.alipayExpressBaoMatchAmount || 0)} 元`],
    ['    极速提(卡)', metrics.alipayJisuTikaCount || 0, `${formatAmount(metrics.alipayJisuTikaMatchAmount || 0)} 元`],
    ['    极速提(宝)', metrics.alipayJisuTibaoCount || 0, `${formatAmount(metrics.alipayJisuTibaoMatchAmount || 0)} 元`],
    ['  建单成功等待无配对', metrics.alipayWaitingForMatchCount || 0, ''],
    ['  取无卡06提示', 0, ''],
    ['  无效申请', metrics.alipayInvalidApplicationCount || 0, ''],
    ['', '', ''],
    ['订单成功', metrics.alipayTotalOrderSuccessCount || 0, `${formatAmount(metrics.alipayTotalOrderSuccessAmount || 0)} 元`, ''],
    ['  一般卡', metrics.alipayNormalOrderSuccessCount || 0, `${formatAmount(metrics.alipayNormalOrderSuccessAmount || 0)} 元`, metrics.alipayNormalMatchCount > 0 ? `${((metrics.alipayNormalOrderSuccessCount || 0) / metrics.alipayNormalMatchCount * 100).toFixed(2)}%` : '0.00%'],
    ['  一般宝', metrics.alipayBaoOrderSuccessCount || 0, `${formatAmount(metrics.alipayBaoOrderSuccessAmount || 0)} 元`, metrics.alipayExpressCardAppCount > 0 ? `${((metrics.alipayBaoOrderSuccessCount || 0) / metrics.alipayExpressCardAppCount * 100).toFixed(2)}%` : '0.00%'],
    ['  极速提(卡)', metrics.alipayJisuTikaOrderSuccessCount || 0, `${formatAmount(metrics.alipayJisuTikaOrderSuccessAmount || 0)} 元`, metrics.alipayJisuTikaCount > 0 ? `${((metrics.alipayJisuTikaOrderSuccessCount || 0) / metrics.alipayJisuTikaCount * 100).toFixed(2)}%` : '0.00%'],
    ['  极速提(宝)', metrics.alipayJisuTibaoOrderSuccessCount || 0, `${formatAmount(metrics.alipayJisuTibaoOrderSuccessAmount || 0)} 元`, metrics.alipayJisuTibaoCount > 0 ? `${((metrics.alipayJisuTibaoOrderSuccessCount || 0) / metrics.alipayJisuTibaoCount * 100).toFixed(2)}%` : '0.00%'],
    ['  信评上分', metrics.alipayCreditScoreSuccessCount || 0, `${formatAmount(metrics.alipayCreditScoreSuccessAmount || 0)} 元 / ${formatTime(metrics.alipayCreditScoreAvgTime)}`],
    ['    其中信评不含图文复核', metrics.alipayCreditNoTuwenCount || 0, formatTime(metrics.alipayCreditNoTuwenAvgTime)],
    ['  平均处理时间', formatTime(metrics.alipayNoCreditDowngradeAvgTime), ''],
    ['', '', ''],
    ['没信评降等配卡', metrics.alipayNoCreditDowngradeTotal || 0, ''],
    ...amountRanges.map(amt => [`  ${amt.toLocaleString()}元`, alipayNoCreditByAmount[amt] || 0, '']),
    [`  其他`, alipayNoCreditByAmount['other'] || 0, ''],
    ['', '', ''],
    ['c2c', metrics.alipayC2cCount || 0, `${formatAmount(metrics.alipayC2cAmount || 0)} 元`],
    ['  点确认（用户确认到账）', metrics.alipayC2cConfirmCount || 0, ''],
    ['  点确认（用户确认到账）-平均处理时间', formatTimeMinutes(metrics.alipayC2cConfirmAvgTime), ''],
    ['  人工审核:通过', metrics.alipayC2cManualAuditCount || 0, ''],
    ['  审核-成功平均处理时间', formatTimeMinutes(metrics.alipayC2cAuditSuccessAvgTime), ''],
    ['  用户较久补材料后成功', metrics.alipayC2cOver11MinSuccessCount || 0, ''],
    ['', '', ''],
    ['三方代收（一般卡订单成功）', metrics.alipayThirdPartyCount || 0, `${formatAmount(metrics.alipayThirdPartyAmount || 0)} 元`],
    ...((metrics.configuredThirdPartyCards || []).map(card => {
      const data = metrics.alipayThirdPartyByCard && metrics.alipayThirdPartyByCard[card.cardNumber] ? metrics.alipayThirdPartyByCard[card.cardNumber] : { count: 0, amount: 0 };
      return [`  ${card.name}(${card.cardNumber})`, data.count || 0, `${formatAmount(data.amount || 0)} 元`];
    })),
    ['', '', ''],
    ['骗分没到帐来找', '', ''],
    ['  人工', fraudData?.alipay.manualCount || 0, `${formatAmount(fraudData?.alipay.manualAmount || 0)} 元`],
    ['  信评', fraudData?.alipay.creditCount || 0, `${formatAmount(fraudData?.alipay.creditAmount || 0)} 元`],
    ['  没上传回单重复出款充值上分', fraudData?.alipay.noReceiptCount || 0, ''],
    ['  骗分拉黑', fraudData?.alipay.fraudBlacklistCount || 0, ''],
    ['  卡验及人验', fraudData?.alipay.cardVerifyCount || 0, ''],
    ['', '', ''],
    ['宝转卡渠道，配支付宝提现', '', ''],
    ['  申请', metrics.alipayBaoZhuanKaCount || 0, `${formatAmount(metrics.alipayBaoZhuanKaAmount || 0)} 元`],
    ['  成功', metrics.alipayBaoZhuanKaSuccessCount || 0, `${formatAmount(metrics.alipayBaoZhuanKaSuccessAmount || 0)} 元`],
    ['宝转宝渠道，配银行卡提现', '', ''],
    ['  申请', metrics.alipayBaoZhuanBaoCount || 0, `${formatAmount(metrics.alipayBaoZhuanBaoAmount || 0)} 元`],
    ['  成功', metrics.alipayBaoZhuanBaoSuccessCount || 0, `${formatAmount(metrics.alipayBaoZhuanBaoSuccessAmount || 0)} 元`],
    ['整体 配对成功/提现申请', `${(metrics.alipayOverallMatchRate || 0).toFixed(2)}%`, ''],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(alipayChannel), '支付宝渠道');

  // 工作表4: 微信渠道
  const wechatNoCreditByAmount = metrics.wechatNoCreditDowngradeByAmount || {};
  const wechatChannel = [
    ['项目', '笔数', '金额'],
    ['充值申请笔数', metrics.wechatApplicationCount || 0, `${formatAmount(metrics.wechatTotalMatchAmount || 0)} 元`],
    ['  成功配对', metrics.wechatTotalMatchCount || 0, `${formatAmount(metrics.wechatTotalMatchAmount || 0)} 元`],
    ['    一般卡', metrics.wechatNormalMatchCount || 0, `${formatAmount(metrics.wechatNormalMatchAmount || 0)} 元`],
    ['    一般微', metrics.wechatExpressBaoMatchCount || 0, `${formatAmount(metrics.wechatExpressBaoMatchAmount || 0)} 元`],
    ['    极速提(卡)', metrics.wechatJisuTikaMatchCount || 0, `${formatAmount(metrics.wechatJisuTikaMatchAmount || 0)} 元`],
    ['    极速提(微)', metrics.wechatJisuTibaoMatchCount || 0, `${formatAmount(metrics.wechatJisuTibaoMatchAmount || 0)} 元`],
    ['  建单成功等待无配对', metrics.wechatWaitingForMatchCount || 0, ''],
    ['  取无卡06提示', 0, ''],
    ['  无效申请', metrics.wechatInvalidApplicationCount || 0, ''],
    ['', '', ''],
    ['订单成功', metrics.wechatTotalOrderSuccessCount || 0, `${formatAmount(metrics.wechatTotalOrderSuccessAmount || 0)} 元`],
    ['  一般卡', metrics.wechatNormalOrderSuccessCount || 0, `${formatAmount(metrics.wechatNormalOrderSuccessAmount || 0)} 元`],
    ['  一般微', metrics.wechatBaoOrderSuccessCount || 0, `${formatAmount(metrics.wechatBaoOrderSuccessAmount || 0)} 元`],
    ['  极速提(卡)', metrics.wechatJisuTikaOrderSuccessCount || 0, `${formatAmount(metrics.wechatJisuTikaOrderSuccessAmount || 0)} 元`],
    ['  极速提(微)', metrics.wechatJisuTibaoOrderSuccessCount || 0, `${formatAmount(metrics.wechatJisuTibaoOrderSuccessAmount || 0)} 元`],
    ['  信评上分', metrics.wechatCreditScoreSuccessCount || 0, `${formatAmount(metrics.wechatCreditScoreSuccessAmount || 0)} 元`],
    ['    其中信评不含图文复核', 0, '00:00:00'],
    ['  平均处理时间', formatTime(metrics.wechatNoCreditDowngradeAvgTime), ''],
    ['', '', ''],
    ['没信评降等配卡', metrics.wechatNoCreditDowngradeTotal || 0, ''],
    ...amountRanges.map(amt => [`  ${amt.toLocaleString()}元`, wechatNoCreditByAmount[amt] || 0, '']),
    [`  其他`, wechatNoCreditByAmount['other'] || 0, ''],
    ['', '', ''],
    ['c2c', metrics.wechatC2cCount || 0, `${formatAmount(metrics.wechatC2cAmount || 0)} 元`],
    ['', '', ''],
    ['三方代收（一般卡订单成功）', metrics.wechatThirdPartyCount || 0, `${formatAmount(metrics.wechatThirdPartyAmount || 0)} 元`],
    ...((metrics.configuredThirdPartyCards || []).map(card => {
      const data = metrics.wechatThirdPartyByCard && metrics.wechatThirdPartyByCard[card.cardNumber] ? metrics.wechatThirdPartyByCard[card.cardNumber] : { count: 0, amount: 0 };
      return [`  ${card.name}(${card.cardNumber})`, data.count || 0, `${formatAmount(data.amount || 0)} 元`];
    })),
    ['', '', ''],
    ['骗分没到帐来找', '', ''],
    ['  人工', fraudData?.wechat.manualCount || 0, `${formatAmount(fraudData?.wechat.manualAmount || 0)} 元`],
    ['  信评', fraudData?.wechat.creditCount || 0, `${formatAmount(fraudData?.wechat.creditAmount || 0)} 元`],
    ['  没上传回单重复出款充值上分', fraudData?.wechat.noReceiptCount || 0, ''],
    ['  骗分拉黑', 0, ''],
    ['  卡验及人验', 0, ''],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wechatChannel), '微信渠道');

  XLSX.writeFile(wb, `充值分析报表_${buildDateRange(weekRange)}.xlsx`);
};

// 汇出充值数据为纯文字
export const exportDepositToText = (metrics, weekRange, withdrawMetrics = null, weeklyMetrics = null) => {
  const m = metrics || {};
  const wm = withdrawMetrics || {};
  const wkm = weeklyMetrics || {};

  const safeNum = (val, defaultVal = 0) => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return defaultVal;
    return val;
  };

  const getAmountCount = (obj, amt) => {
    if (!obj || typeof obj !== 'object') return 0;
    return safeNum(obj[amt], 0);
  };

  const formatTimeText = (seconds) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '';
    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const generateThirdPartyText = (configuredCards, thirdPartyByCard) => {
    if (!configuredCards || configuredCards.length === 0) return '';
    return configuredCards.map(card => {
      const data = thirdPartyByCard && thirdPartyByCard[card.cardNumber] ? thirdPartyByCard[card.cardNumber] : { count: 0, amount: 0 };
      return `${card.name}(${card.cardNumber})${safeNum(data.amount)}元${safeNum(data.count)}笔`;
    }).join('/');
  };

  const formatPercent = (val) => {
    if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '';
    return Math.round(val * 100) + '%';
  };

  let dateRangeText = '';
  if (weekRange && weekRange.start) {
    const startDate = new Date(weekRange.start);
    const startMonth = startDate.getMonth() + 1;
    const startDay = startDate.getDate();
    if (weekRange.end && weekRange.end !== weekRange.start) {
      const endDate = new Date(weekRange.end);
      dateRangeText = `${startMonth}/${startDay}-${endDate.getMonth() + 1}/${endDate.getDate()}`;
    } else {
      dateRangeText = `${startMonth}/${startDay}`;
    }
  }

  const bankCardMatchRate = m.jisuApplicationCount > 0 ? m.totalMatchCount / m.jisuApplicationCount : 0;
  const bankCardSuccessAfterMatchRate = m.totalMatchCount > 0 ? m.totalOrderSuccessCount / m.totalMatchCount : 0;
  const alipayMatchRate = m.alipayApplicationCount > 0 ? m.alipayTotalMatchCount / m.alipayApplicationCount : 0;
  const alipaySuccessAfterMatchRate = m.alipayTotalMatchCount > 0 ? m.alipayTotalOrderSuccessCount / m.alipayTotalMatchCount : 0;

  const bankCardText = `极速数据_${dateRangeText}
充值申请${safeNum(m.jisuApplicationCount || 0)}笔(${safeNum(m.normalCardAppCount || 0)}一般卡/${safeNum(m.expressCardAppCount || 0)}极速提/${safeNum(m.waitingForMatchCount || 0)}建单成功等待无配对/${safeNum(m.noCard06Count || 0)}取无卡06提示/${safeNum(m.jisuInvalidApplicationCount || 0)}无效申请)
成功配对${safeNum(m.totalMatchCount)}笔/${safeNum(m.totalMatchAmount)}元
-一般卡${safeNum(m.normalMatchCount)}笔/${safeNum(m.normalMatchAmount)}元
-极速提${safeNum(m.expressMatchCount)}笔/${safeNum(m.expressMatchAmount)}元
订单成功${safeNum(m.totalOrderSuccessCount)}笔/${safeNum(m.totalOrderSuccessAmount)}元
-一般卡${safeNum(m.normalOrderSuccessCount)}笔/${safeNum(m.normalOrderSuccessAmount)}元(${generateThirdPartyText(m.configuredThirdPartyCards, m.thirdPartyByCard)})
-极速提${safeNum(m.expressOrderSuccessCount)}笔/${safeNum(m.expressOrderSuccessAmount)}元
(信评上分${safeNum(m.creditScoreSuccessCount)}笔${formatTimeText(m.creditScoreAvgTime)}/其中信评不含图文复核${safeNum(m.creditScoreNoImageCount)}笔${formatTimeText(m.creditScoreNoImageAvgTime)})

#.没信评降等配卡-100/${getAmountCount(m.noCreditDowngradeByAmount, 100)}笔200/${getAmountCount(m.noCreditDowngradeByAmount, 200)}笔300/${getAmountCount(m.noCreditDowngradeByAmount, 300)}笔500/${getAmountCount(m.noCreditDowngradeByAmount, 500)}笔1000/${getAmountCount(m.noCreditDowngradeByAmount, 1000)}笔1500/${getAmountCount(m.noCreditDowngradeByAmount, 1500)}笔2000/${getAmountCount(m.noCreditDowngradeByAmount, 2000)}笔3000/${getAmountCount(m.noCreditDowngradeByAmount, 3000)}笔5000/${getAmountCount(m.noCreditDowngradeByAmount, 5000)}笔6000/${getAmountCount(m.noCreditDowngradeByAmount, 6000)}笔7000/${getAmountCount(m.noCreditDowngradeByAmount, 7000)}笔8000/${getAmountCount(m.noCreditDowngradeByAmount, 8000)}笔9000/${getAmountCount(m.noCreditDowngradeByAmount, 9000)}笔10000/${getAmountCount(m.noCreditDowngradeByAmount, 10000)}笔15000/${getAmountCount(m.noCreditDowngradeByAmount, 15000)}笔20000/${getAmountCount(m.noCreditDowngradeByAmount, 20000)}笔30000/${getAmountCount(m.noCreditDowngradeByAmount, 30000)}笔=${safeNum(m.noCreditDowngradeTotal)}
^空单_
平均时间${formatTimeText(m.noCreditDowngradeAvgTime)}

提现申请${safeNum(wm.bankCardWithdrawCount)}笔(极速)/${safeNum(wm.bankCardWithdrawAmount)}元
充值配对率${formatPercent(bankCardMatchRate)}(成功配对${safeNum(m.totalMatchCount)}笔/充值申请${safeNum(m.jisuApplicationCount)}笔)
配对后成功率${formatPercent(bankCardSuccessAfterMatchRate)}(充值成功${safeNum(m.totalOrderSuccessCount)}笔/成功配对${safeNum(m.totalMatchCount)}笔)
平均时间${formatTimeText(wm.bankCardAvgTime)}

c2c${safeNum(m.c2cCount)}笔点确认平均${formatTimeText(m.c2cConfirmAvgTime)}、人工审核:通过${safeNum(m.c2cManualAuditCount)}笔审核-成功平均${formatTimeText(m.c2cAuditSuccessAvgTime)}、${safeNum(m.c2cOver11MinSuccessCount)}笔用户较久补材料后成功、骗分拉黑${safeNum(wkm.fraudBankCardFraudBlacklistCount)}+卡验及人验${safeNum(wkm.fraudBankCardCardVerifyCount)}笔

骗分没到账来找
人工${safeNum(wkm.fraudBankCardManual, '')}元/${safeNum(wkm.fraudBankCardManualCount, '')}笔
信评${safeNum(wkm.fraudBankCardCredit)}元/${safeNum(wkm.fraudBankCardCreditCount)}笔
没上传回单重复出款充值上分${safeNum(wkm.fraudBankCardNoReceiptCount)}笔`;

  const alipayText = `极速数据_${dateRangeText}【支付宝】
充值申请${safeNum(m.alipayApplicationCount)}笔(${safeNum(m.alipayNormalCardAppCount)}一般卡/${safeNum(m.alipayExpressCardAppCount)}一般宝/${safeNum(m.alipayJisuTikaCount)}极速提卡/${safeNum(m.alipayJisuTibaoCount)}极速提宝/${safeNum(m.alipayWaitingForMatchCount)}建单成功等待无配对/${safeNum(m.alipayNoCard06Count)}取无卡06提示/${safeNum(m.alipayInvalidApplicationCount || 0)}无效申请)
成功配对${safeNum(m.alipayTotalMatchCount)}笔/${safeNum(m.alipayTotalMatchAmount)}元
-一般卡${safeNum(m.alipayNormalMatchCount)}笔/${safeNum(m.alipayNormalMatchAmount)}元
-一般宝${safeNum(m.alipayExpressCardAppCount)}笔/${safeNum(m.alipayExpressBaoMatchAmount)}元
-极速提(卡)${safeNum(m.alipayJisuTikaCount)}笔/${safeNum(m.alipayJisuTikaMatchAmount)}元
-极速提(宝)${safeNum(m.alipayJisuTibaoCount)}笔/${safeNum(m.alipayJisuTibaoMatchAmount)}元
订单成功${safeNum(m.alipayTotalOrderSuccessCount)}笔/${safeNum(m.alipayTotalOrderSuccessAmount)}元
-一般卡${safeNum(m.alipayNormalOrderSuccessCount)}笔/${safeNum(m.alipayNormalOrderSuccessAmount)}元(${generateThirdPartyText(m.configuredThirdPartyCards, m.alipayThirdPartyByCard)})(${formatPercent(m.alipayNormalMatchCount > 0 ? (m.alipayNormalOrderSuccessCount || 0) / m.alipayNormalMatchCount : 0)})
-一般宝${safeNum(m.alipayBaoOrderSuccessCount)}笔/${safeNum(m.alipayBaoOrderSuccessAmount)}元(${formatPercent(m.alipayExpressCardAppCount > 0 ? (m.alipayBaoOrderSuccessCount || 0) / m.alipayExpressCardAppCount : 0)})
-极速提(卡)${safeNum(m.alipayJisuTikaOrderSuccessCount)}笔/${safeNum(m.alipayJisuTikaOrderSuccessAmount)}元(${formatPercent(m.alipayJisuTikaCount > 0 ? (m.alipayJisuTikaOrderSuccessCount || 0) / m.alipayJisuTikaCount : 0)})
-极速提(宝)${safeNum(m.alipayJisuTibaoOrderSuccessCount)}笔/${safeNum(m.alipayJisuTibaoOrderSuccessAmount)}元(${formatPercent(m.alipayJisuTibaoCount > 0 ? (m.alipayJisuTibaoOrderSuccessCount || 0) / m.alipayJisuTibaoCount : 0)})
(信评上分${safeNum(m.alipayCreditScoreSuccessCount)}笔${formatTimeText(m.alipayCreditScoreAvgTime)}/其中信评不含图文复核${safeNum(m.alipayCreditNoTuwenCount)}笔${formatTimeText(m.alipayCreditNoTuwenAvgTime)})

#.没信评降等配卡-100/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 100)}笔200/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 200)}笔300/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 300)}笔500/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 500)}笔1000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 1000)}笔1500/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 1500)}笔2000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 2000)}笔3000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 3000)}笔5000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 5000)}笔6000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 6000)}笔7000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 7000)}笔8000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 8000)}笔9000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 9000)}笔10000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 10000)}笔15000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 15000)}笔20000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 20000)}笔30000/${getAmountCount(m.alipayNoCreditDowngradeByAmount, 30000)}笔=${safeNum(m.alipayNoCreditDowngradeTotal)}
平均时间${formatTimeText(m.alipayNoCreditDowngradeAvgTime)}

提现申请${safeNum(wm.alipayWithdrawCount)}笔(极速)/${safeNum(wm.alipayWithdrawAmount)}元
充值配对率${formatPercent(alipayMatchRate)}(成功配对${safeNum(m.alipayTotalMatchCount)}笔/充值申请${safeNum(m.alipayApplicationCount)}笔)
配对后成功率${formatPercent(alipaySuccessAfterMatchRate)}(充值成功${safeNum(m.alipayTotalOrderSuccessCount)}笔/成功配对${safeNum(m.alipayTotalMatchCount)}笔)
平均时间${formatTimeText(wm.alipayAvgTime)}

c2c${safeNum(m.alipayC2cCount)}筆点确认平均${formatTimeText(m.alipayC2cConfirmAvgTime)}、人工审核:通过${safeNum(m.alipayC2cManualAuditCount)}笔审核-成功平均${formatTimeText(m.alipayC2cAuditSuccessAvgTime)}、${safeNum(m.alipayC2cOver11MinSuccessCount)}笔用户较久补材料后成功、骗分拉黑${safeNum(wkm.fraudAlipayFraudBlacklistCount)}+卡验及人验${safeNum(wkm.fraudAlipayCardVerifyCount)}笔

骗分没到账来找
人工${safeNum(wkm.fraudAlipayManual, '')}元/${safeNum(wkm.fraudAlipayManualCount, '')}笔
信评${safeNum(wkm.fraudAlipayCredit)}元/${safeNum(wkm.fraudAlipayCreditCount)}笔
没上传回单重复出款充值上分${safeNum(wkm.fraudAlipayNoReceiptCount)}笔
微信充成功${safeNum(m.wechatTotalOrderSuccessAmount)}元/${safeNum(m.wechatTotalOrderSuccessCount)}笔${formatTimeText(m.wechatCreditScoreAvgTime)},提现${safeNum(wm.wechatWithdrawAmount)}元
宝转卡渠道，配支付宝提现申请${safeNum(m.alipayBaoZhuanKaAmount)}元/${safeNum(m.alipayBaoZhuanKaCount)}笔,成功${safeNum(m.alipayBaoZhuanKaSuccessAmount)}元/${safeNum(m.alipayBaoZhuanKaSuccessCount)}笔
宝转宝渠道，配银行卡提现申请${safeNum(m.alipayBaoZhuanBaoAmount)}元/${safeNum(m.alipayBaoZhuanBaoCount)}笔,成功${safeNum(m.alipayBaoZhuanBaoSuccessAmount)}元/${safeNum(m.alipayBaoZhuanBaoSuccessCount)}笔
整体配对成功$/提现申请$${(() => {
  const numerator = safeNum(m.expressOrderSuccessAmount) + safeNum(m.alipayJisuTikaOrderSuccessAmount) + safeNum(m.alipayJisuTibaoOrderSuccessAmount);
  const denominator = safeNum(wm.bankCardWithdrawAmount) + safeNum(wm.alipayWithdrawAmount);
  return denominator > 0 ? formatPercent(numerator / denominator) : '0%';
})()}`;

  const fullText = bankCardText + '\n\n' + alipayText;
  const blob = new Blob(['﻿' + fullText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `日周报数据汇总_${buildDateRange(weekRange)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
