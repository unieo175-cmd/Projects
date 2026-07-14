import * as XLSX from 'xlsx';
import { formatTime, formatAmount } from './formatters';

const buildDateRange = (weekRange) => {
  if (weekRange && weekRange.start) {
    return weekRange.start === weekRange.end ? weekRange.start : `${weekRange.start}_${weekRange.end}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// 汇出提现数据到 Excel（对应 PRD 4.13，共 5 张工作表）
export const exportWithdrawToExcel = (metrics, weekRange = null) => {
  const wb = XLSX.utils.book_new();

  // Tab 1: 全部-重要信息（含提现成功时间区段）
  const overviewSheet = [
    ['项目', '笔数/百分比', '金额'],
    ['提现成功金额', '', `${formatAmount(metrics.totalWithdrawAmount || 0)} 元`],
    ['提现申请笔数', metrics.withdrawSuccessTotalCount || 0, ''],
    ['提现成功笔数', `${metrics.totalWithdrawCount || 0} (${(metrics.withdrawSuccessRate || 0).toFixed(2)}%)`, ''],
    ['平均处理时间', formatTime(metrics.avgProcessingTime), ''],
    ['', '', ''],
    ['=== 提现成功时间区段 ===', '', ''],
    ['项目', '笔数', '占比', '金额'],
    ['提现申请笔数', metrics.withdrawSuccessTotalCount || 0, '', ''],
    ['2分钟内出款', metrics.withdrawWithin2MinCount || 0, `${(metrics.withdrawWithin2MinRatio || 0).toFixed(2)}%`, `${formatAmount(metrics.withdrawWithin2MinAmount || 0)} 元`],
    ['2-5分钟出款', metrics.withdrawWithin2to5MinCount || 0, `${(metrics.withdrawWithin2to5MinRatio || 0).toFixed(2)}%`, `${formatAmount(metrics.withdrawWithin2to5MinAmount || 0)} 元`],
    ['5-15分钟出款', metrics.withdrawWithin5to15MinCount || 0, `${(metrics.withdrawWithin5to15MinRatio || 0).toFixed(2)}%`, `${formatAmount(metrics.withdrawWithin5to15MinAmount || 0)} 元`],
    ['15-30分钟出款', metrics.withdrawWithin15to30MinCount || 0, `${(metrics.withdrawWithin15to30MinRatio || 0).toFixed(2)}%`, `${formatAmount(metrics.withdrawWithin15to30MinAmount || 0)} 元`],
    ['超过30分钟出款', metrics.withdrawOver30MinCount || 0, `${(metrics.withdrawOver30MinRatio || 0).toFixed(2)}%`, `${formatAmount(metrics.withdrawOver30MinAmount || 0)} 元`],
    ['平均处理时间-卡(Q)', formatTime(metrics.bankCardAvgTime), '', ''],
    ['平均处理时间-宝(R)', formatTime(metrics.alipayAvgTime), '', ''],
    ['提现成功笔数', metrics.totalWithdrawCount || 0, '', ''],
    ['提现失败笔数', metrics.withdrawFailedCount || 0, '', ''],
    ['平均处理时间', formatTime(metrics.avgProcessingTime), '', ''],
  ];

  // 各渠道-重要信息（银行卡 / 支付宝 / 微信）
  const channelSheet = (countKey, amountKey, matchRateKey, successRateKey, avgTimeKey) => [
    ['项目', '笔数', '金额'],
    ['提现申请', metrics[countKey] || 0, `${formatAmount(metrics[amountKey] || 0)} 元`],
    ['充值配对率', `${((metrics[matchRateKey] || 0) * 100).toFixed(2)}%`, ''],
    ['配对后成功率', `${((metrics[successRateKey] || 0) * 100).toFixed(2)}%`, ''],
    ['平均处理时间', formatTime(metrics[avgTimeKey]), ''],
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewSheet), '全部-重要信息');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(channelSheet(
    'bankCardWithdrawCount', 'bankCardWithdrawAmount',
    'bankCardMatchRate', 'bankCardSuccessAfterMatchRate', 'bankCardAvgTime'
  )), '银行卡-重要信息');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(channelSheet(
    'alipayWithdrawCount', 'alipayWithdrawAmount',
    'alipayMatchRate', 'alipaySuccessAfterMatchRate', 'alipayAvgTime'
  )), '支付宝-重要信息');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(channelSheet(
    'wechatWithdrawCount', 'wechatWithdrawAmount',
    'wechatMatchRate', 'wechatSuccessAfterMatchRate', 'wechatAvgTime'
  )), '微信-重要信息');

  XLSX.writeFile(wb, `提现分析报表_${buildDateRange(weekRange)}.xlsx`);
};

// 汇出比较报表到 Excel
export const exportCompareToExcel = (compareResult) => {
  if (!compareResult) return;

  const wb = XLSX.utils.book_new();
  const { record1, record2 } = compareResult;

  const formatDateRange = (range) => {
    if (!range) return '-';
    if (range.start === range.end) return range.start;
    return `${range.start} ~ ${range.end}`;
  };

  const getDiff = (val1, val2) => {
    const diff = (val2 || 0) - (val1 || 0);
    if (diff === 0) return '-';
    return diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString();
  };

  const getDiffPercent = (val1, val2) => {
    const diff = (val2 || 0) - (val1 || 0);
    if (diff === 0) return '-';
    return diff > 0 ? `+${diff.toFixed(2)}%` : `${diff.toFixed(2)}%`;
  };

  const overviewData = [
    ['数据比较报表', '', '', ''],
    ['', '', '', ''],
    ['', '数据 A', '数据 B', '差异'],
    ['日期范围', formatDateRange(record1.dateRange), formatDateRange(record2.dateRange), ''],
    ['', '', '', ''],
    ['=== 充值指标 ===', '', '', ''],
    ['总申请笔数', record1.deposit?.totalApplicationCount || 0, record2.deposit?.totalApplicationCount || 0, getDiff(record1.deposit?.totalApplicationCount, record2.deposit?.totalApplicationCount)],
    ['充值成功笔数', record1.deposit?.successfulCount || 0, record2.deposit?.successfulCount || 0, getDiff(record1.deposit?.successfulCount, record2.deposit?.successfulCount)],
    ['成功率', `${(record1.deposit?.overallSuccessRate || 0).toFixed(2)}%`, `${(record2.deposit?.overallSuccessRate || 0).toFixed(2)}%`, getDiffPercent(record1.deposit?.overallSuccessRate, record2.deposit?.overallSuccessRate)],
    ['总申请金额', record1.deposit?.totalApplicationAmount || 0, record2.deposit?.totalApplicationAmount || 0, getDiff(record1.deposit?.totalApplicationAmount, record2.deposit?.totalApplicationAmount)],
    ['平均处理时间(秒)', record1.deposit?.overallAvgTime || 0, record2.deposit?.overallAvgTime || 0, getDiff(record1.deposit?.overallAvgTime, record2.deposit?.overallAvgTime)],
    ['掉单笔数', record1.deposit?.overallDropOrderCount || 0, record2.deposit?.overallDropOrderCount || 0, getDiff(record1.deposit?.overallDropOrderCount, record2.deposit?.overallDropOrderCount)],
    ['', '', '', ''],
    ['银行卡申请笔数', record1.deposit?.jisuApplicationCount || 0, record2.deposit?.jisuApplicationCount || 0, getDiff(record1.deposit?.jisuApplicationCount, record2.deposit?.jisuApplicationCount)],
    ['银行卡订单成功', record1.deposit?.totalOrderSuccessCount || 0, record2.deposit?.totalOrderSuccessCount || 0, getDiff(record1.deposit?.totalOrderSuccessCount, record2.deposit?.totalOrderSuccessCount)],
    ['银行卡订单金额', record1.deposit?.totalOrderSuccessAmount || 0, record2.deposit?.totalOrderSuccessAmount || 0, getDiff(record1.deposit?.totalOrderSuccessAmount, record2.deposit?.totalOrderSuccessAmount)],
    ['', '', '', ''],
    ['支付宝申请笔数', record1.deposit?.alipayApplicationCount || 0, record2.deposit?.alipayApplicationCount || 0, getDiff(record1.deposit?.alipayApplicationCount, record2.deposit?.alipayApplicationCount)],
    ['支付宝订单成功', record1.deposit?.alipayTotalOrderSuccessCount || 0, record2.deposit?.alipayTotalOrderSuccessCount || 0, getDiff(record1.deposit?.alipayTotalOrderSuccessCount, record2.deposit?.alipayTotalOrderSuccessCount)],
    ['支付宝订单金额', record1.deposit?.alipayTotalOrderSuccessAmount || 0, record2.deposit?.alipayTotalOrderSuccessAmount || 0, getDiff(record1.deposit?.alipayTotalOrderSuccessAmount, record2.deposit?.alipayTotalOrderSuccessAmount)],
    ['', '', '', ''],
    ['微信申请笔数', record1.deposit?.wechatApplicationCount || 0, record2.deposit?.wechatApplicationCount || 0, getDiff(record1.deposit?.wechatApplicationCount, record2.deposit?.wechatApplicationCount)],
    ['微信订单成功', record1.deposit?.wechatTotalOrderSuccessCount || 0, record2.deposit?.wechatTotalOrderSuccessCount || 0, getDiff(record1.deposit?.wechatTotalOrderSuccessCount, record2.deposit?.wechatTotalOrderSuccessCount)],
    ['微信订单金额', record1.deposit?.wechatTotalOrderSuccessAmount || 0, record2.deposit?.wechatTotalOrderSuccessAmount || 0, getDiff(record1.deposit?.wechatTotalOrderSuccessAmount, record2.deposit?.wechatTotalOrderSuccessAmount)],
    ['', '', '', ''],
    ['=== 提现指标 ===', '', '', ''],
    ['总提现笔数', record1.withdraw?.totalWithdrawCount || 0, record2.withdraw?.totalWithdrawCount || 0, getDiff(record1.withdraw?.totalWithdrawCount, record2.withdraw?.totalWithdrawCount)],
    ['总提现金额', record1.withdraw?.totalWithdrawAmount || 0, record2.withdraw?.totalWithdrawAmount || 0, getDiff(record1.withdraw?.totalWithdrawAmount, record2.withdraw?.totalWithdrawAmount)],
    ['平均处理时间(秒)', record1.withdraw?.avgProcessingTime || 0, record2.withdraw?.avgProcessingTime || 0, getDiff(record1.withdraw?.avgProcessingTime, record2.withdraw?.avgProcessingTime)],
    ['', '', '', ''],
    ['银行卡提现笔数', record1.withdraw?.bankCardWithdrawCount || 0, record2.withdraw?.bankCardWithdrawCount || 0, getDiff(record1.withdraw?.bankCardWithdrawCount, record2.withdraw?.bankCardWithdrawCount)],
    ['银行卡提现金额', record1.withdraw?.bankCardWithdrawAmount || 0, record2.withdraw?.bankCardWithdrawAmount || 0, getDiff(record1.withdraw?.bankCardWithdrawAmount, record2.withdraw?.bankCardWithdrawAmount)],
    ['银行卡平均时间(秒)', record1.withdraw?.bankCardAvgTime || 0, record2.withdraw?.bankCardAvgTime || 0, getDiff(record1.withdraw?.bankCardAvgTime, record2.withdraw?.bankCardAvgTime)],
    ['', '', '', ''],
    ['支付宝提现笔数', record1.withdraw?.alipayWithdrawCount || 0, record2.withdraw?.alipayWithdrawCount || 0, getDiff(record1.withdraw?.alipayWithdrawCount, record2.withdraw?.alipayWithdrawCount)],
    ['支付宝提现金额', record1.withdraw?.alipayWithdrawAmount || 0, record2.withdraw?.alipayWithdrawAmount || 0, getDiff(record1.withdraw?.alipayWithdrawAmount, record2.withdraw?.alipayWithdrawAmount)],
    ['支付宝平均时间(秒)', record1.withdraw?.alipayAvgTime || 0, record2.withdraw?.alipayAvgTime || 0, getDiff(record1.withdraw?.alipayAvgTime, record2.withdraw?.alipayAvgTime)],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(overviewData);
  ws1['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws1, '比较总览');

  const range1 = record1.dateRange?.start || 'A';
  const range2 = record2.dateRange?.start || 'B';
  XLSX.writeFile(wb, `数据比较_${range1}_vs_${range2}.xlsx`);
};
