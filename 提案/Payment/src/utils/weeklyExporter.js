import * as XLSX from 'xlsx';

const buildDateRange = (weekRange) => {
  if (weekRange && weekRange.start) {
    return weekRange.start === weekRange.end ? weekRange.start : `${weekRange.start}_${weekRange.end}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// 汇出周报数据到 Excel
export const exportWeeklyToExcel = async (weeklyMetrics, analysisMetrics, weekRange, depositMetrics, withdrawMetrics, onProgress) => {
  const startTime = Date.now();
  const TIMEOUT_MS = 10 * 60 * 1000;

  const checkTimeout = () => {
    if (Date.now() - startTime > TIMEOUT_MS) throw new Error('导出超时，请减少数据量后重试');
  };

  const reportProgress = (step, total, message) => {
    if (onProgress) onProgress({ step, total, message, elapsed: Date.now() - startTime });
  };

  try {
    reportProgress(1, 5, '初始化...');
    await new Promise(resolve => setTimeout(resolve, 0));

    const wb = XLSX.utils.book_new();
    const m = weeklyMetrics || {};
    const dm = depositMetrics || {};
    const wm = withdrawMetrics || {};

    const safeNum = (val) => {
      if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '';
      return val;
    };

    const formatPercent = (val) => {
      if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return '';
      return (val * 100).toFixed(2) + '%';
    };

    const formatTimeHHMMSS = (seconds) => {
      if (seconds === null || seconds === undefined || isNaN(seconds) || !isFinite(seconds) || seconds === 0) return '';
      const h = Math.floor(seconds / 3600);
      const min = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const generateThirdPartyText = (configuredCards, thirdPartyByCard) => {
      if (!configuredCards || configuredCards.length === 0) return '';
      return configuredCards.map(card => {
        const data = thirdPartyByCard && thirdPartyByCard[card.cardNumber] ? thirdPartyByCard[card.cardNumber] : { count: 0, amount: 0 };
        return `${card.name}(${card.cardNumber})${safeNum(data.amount)}元${safeNum(data.count)}笔`;
      }).join('/');
    };

    let month = '';
    let date = '';
    if (weekRange && weekRange.start) {
      const startDate = new Date(weekRange.start);
      month = startDate.getMonth() + 1;
      date = startDate.getDate();
    }

    // 頁籤1: 汇总周报数据
    const summaryData = [
      ['', '充值申请', '极速充值等待最终无配对', '成功配对(配一般卡)', '成功配对(配极速)',
        '订单成功(加总笔数)', '订单成功(一般卡)', '订单成功(极速+一般提)',
        '无卡空单率', '充值订单成功(金额)', '银行卡（一般卡）（金额）', '极速+一般提(金额)',
        '提现平均时间(卡)', '提现平均时间(宝)', '骗分', '骗分成本占比', '极速提现返利'],
      ['日期当天',
        safeNum(m.depositApplicationCount || 0),
        safeNum(m.jsWaitingNoMatch || 0),
        safeNum(m.matchNormalCard || 0),
        safeNum(m.matchJS || 0),
        safeNum(m.orderSuccessTotal || 0),
        safeNum(m.orderSuccessNormalCard || 0),
        safeNum(m.orderSuccessJS || 0),
        formatPercent(m.emptyOrderRate || 0),
        safeNum(m.orderSuccessAmountTotal || 0),
        safeNum(m.orderSuccessAmountNormalCard || 0),
        safeNum(m.orderSuccessAmountJS || 0),
        formatTimeHHMMSS(m.withdrawAvgTimeBankCard || 0),
        formatTimeHHMMSS(m.withdrawAvgTimeAlipay || 0),
        safeNum(m.fraudAmount || 0),
        formatPercent(m.fraudCostRatio || 0),
        safeNum(m.jsWithdrawRebate || 0)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), '汇总周报数据');

    // 頁籤2: 明細數據
    const detailData = [
      // 充值申请
      ['项目', '笔数'],
      ['充值申请（合计）', safeNum(m.depositApplicationCount || 0)],
      ['  银行卡', safeNum(dm.jisuApplicationCount || 0)],
      ['  支付宝', safeNum(dm.alipayApplicationCount || 0)],
      [],
      ['极速充值等待最终无配对', safeNum(m.jsWaitingNoMatch || 0)],
      ['  银行卡', safeNum(m.bankCardJsWaitingNoMatch || 0)],
      ['  支付宝', safeNum(m.alipayJsWaitingNoMatch || 0)],
      [],
      ['成功配对(配一般卡)', safeNum(m.matchNormalCard || 0)],
      ['  银行卡成功配对一般卡', safeNum(m.matchNormalCardBankCard || 0)],
      ['  支付宝成功配对一般卡', safeNum(m.matchNormalCardAlipay || 0)],
      ['  一般宝', safeNum(m.matchNormalCardBao || 0)],
      [],
      ['成功配对(配极速)', safeNum(m.matchJS || 0)],
      ['  银行卡极速提', safeNum(m.matchJSBankCard || 0)],
      ['  支付宝极速提(卡)', safeNum(m.matchJSAlipayKa || 0)],
      ['  支付宝极速提(宝)', safeNum(m.matchJSAlipayBao || 0)],
      [],
      // 充值订单成功（笔数）
      ['项目', '笔数'],
      ['订单成功(加总笔数)', safeNum(m.orderSuccessTotal || 0)],
      ['  订单成功(一般卡)', safeNum(m.orderSuccessNormalCard || 0)],
      ['  订单成功(极速+一般提)', safeNum(m.orderSuccessJS || 0)],
      [],
      ['订单成功(一般卡)', safeNum(m.orderSuccessNormalCard || 0)],
      ['  银行卡（一般卡）', safeNum(m.orderSuccessNormalCardBankCard || 0)],
      ['  支付宝（一般卡）', safeNum(m.orderSuccessNormalCardAlipay || 0)],
      ['  支付宝（一般宝）', safeNum(m.orderSuccessNormalCardBao || 0)],
      [],
      ['订单成功(极速+一般提)', safeNum(m.orderSuccessJS || 0)],
      ['  银行卡极速提', safeNum(m.orderSuccessJSBankCard || 0)],
      ['  支付宝极速提(卡)', safeNum(m.orderSuccessJSAlipayKa || 0)],
      ['  支付宝极速提(宝)', safeNum(m.orderSuccessJSAlipayBao || 0)],
      [],
      ['无卡空单率', formatPercent(m.emptyOrderRate || 0)],
      [],
      // 充值订单成功（金额）
      ['项目', '金额（元）'],
      ['充值订单成功(加总金额)', safeNum(m.orderSuccessAmountTotal || 0)],
      ['  银行卡（一般卡）（金额）', safeNum(m.orderSuccessAmountNormalCard || 0)],
      ['  极速+一般提(金额)', safeNum(m.orderSuccessAmountJS || 0)],
      [],
      ['订单成功(一般卡)(金额)', safeNum(m.orderSuccessAmountNormalCard || 0)],
      ['  银行卡（一般卡）（金额）', safeNum(m.orderSuccessAmountNormalCardBankCard || 0)],
      ['  支付宝（一般卡）（金额）', safeNum(m.orderSuccessAmountNormalCardAlipay || 0)],
      ['  支付宝（一般宝）（金额）', safeNum(m.orderSuccessAmountNormalCardBao || 0)],
      [],
      ['极速+一般提(金额)', safeNum(m.orderSuccessAmountJS || 0)],
      ['  银行卡极速提(金额)', safeNum(m.orderSuccessAmountJSBankCard || 0)],
      ['  支付宝极速提(卡)(金额)', safeNum(m.orderSuccessAmountJSAlipayKa || 0)],
      ['  支付宝极速提(宝)(金额)', safeNum(m.orderSuccessAmountJSAlipayBao || 0)],
      [],
      // 提现平均时间/返利
      ['项目', '数值'],
      ['提现平均处理时间（卡）', formatTimeHHMMSS(m.withdrawAvgTimeBankCard || 0)],
      ['提现平均处理时间（宝）', formatTimeHHMMSS(m.withdrawAvgTimeAlipay || 0)],
      [],
      ['极速提现返利', safeNum(m.jsWithdrawRebate || 0)],
      [],
      // 骗分统计
      ['项目', '金额（元）'],
      ['骗分总计', safeNum(m.fraudAmount || 0)],
      ['  银行卡骗分没到账来找(人工)', safeNum(m.fraudBankCardManual || 0)],
      ['  银行卡骗分没到账来找(信评)', safeNum(m.fraudBankCardCredit || 0)],
      ['  支付宝骗分没到账来找(人工)', safeNum(m.fraudAlipayManual || 0)],
      ['  支付宝骗分没到账来找(信评)', safeNum(m.fraudAlipayCredit || 0)],
      [],
      ['骗分成本占比', formatPercent(m.fraudCostRatio || 0)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailData), '明细数据');

    checkTimeout();
    reportProgress(5, 5, '导出Excel文件...');
    await new Promise(resolve => setTimeout(resolve, 0));

    XLSX.writeFile(wb, `日周报数据汇总_${buildDateRange(weekRange)}.xlsx`);

    const elapsed = Date.now() - startTime;
    console.log(`导出完成，耗时: ${(elapsed / 1000).toFixed(2)}秒`);
    return { success: true, elapsed };

  } catch (error) {
    console.error('导出失败:', error);
    throw error;
  }
};

// 导出指标数据分析 Excel 范本
export const exportMetricsAnalysisTemplate = (weekRange = null) => {
  const wb = XLSX.utils.book_new();

  // 工作表1: 充值原始数据
  const depositHeaders = [
    'A-序号', 'B-商户名称', 'C-商户订单号', 'D-平台订单号', 'E-收款人姓名', 'F-收款银行',
    'G-收款卡号', 'H-申请日期', 'I-申请金额', 'J-银行卡流水号', 'K-银行回单码',
    'L-收款金额', 'M-收款金额', 'N-冻结金额', 'O-商户手续费', 'P-银行到账时间',
    'Q-请求日期', 'R-银行收款时间', 'S-银商确认到账时间', 'T-通知商户时间',
    'U-状态', 'V-userId', 'W-userIP', 'X-配对时间', 'Y-配对银行',
    'Z-配对卡号', 'AA-配对卡姓名', 'AB-配对到账金额', 'AC-配对ID', 'AD-配对商户订单号',
    'AE-配对平台订单号', 'AF-提现金额', 'AG-配对说明', 'AH-配对转账时间',
    'AI-极速提账号', 'AJ-卡剩余池建立时间', 'AK-备注', 'AL-信用评分',
    'AM-处理时间(秒)', 'AN-是否3分内', 'AO-是否自动到账', 'AP-收款金额'
  ];
  const depositData = [depositHeaders];
  depositData.push(['请在此行下方贴上充值原始数据（不含标题行）', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  const ws1 = XLSX.utils.aoa_to_sheet(depositData);
  ws1['!cols'] = depositHeaders.map(() => ({ wch: 15 }));
  XLSX.utils.book_append_sheet(wb, ws1, '充值原始数据');

  // 工作表2: 提现原始数据
  const withdrawHeaders = [
    'A-序号', 'B-流水号', 'C-商户名称', 'D-商户订单号', 'E-平台订单号',
    'F-申请出款金额', 'G-商户返点', 'H-实际转出金额', 'I-实际转出金额',
    'J-收款银行', 'K-收款卡号', 'L-收款人', 'M-收款地址',
    'N-剩余池ID', 'O-状态', 'P-商户收款状态', 'Q-通知商户时间',
    'R-userId', 'S-userIP', 'T-建立时间', 'U-POOL建单时间',
    'V-剩余池建立时间', 'W-转账ID', 'X-转出账号', 'Y-转出银行',
    'Z-转出账户名', 'AA-手续费', 'AB-转账时间', 'AC-说明'
  ];
  const withdrawData = [withdrawHeaders];
  withdrawData.push(['请在此行下方贴上提现原始数据（不含标题行）', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  const ws2 = XLSX.utils.aoa_to_sheet(withdrawData);
  ws2['!cols'] = withdrawHeaders.map(() => ({ wch: 15 }));
  XLSX.utils.book_append_sheet(wb, ws2, '提现原始数据');

  // 工作表3: 过滤后充值数据
  const filteredDepositHeaders = ['序号', '商户名称', '收款金额(M)', '处理时间(AM)', '是否3分内(AN)', '是否自动到账(AO)', '状态(U)'];
  const filteredDepositFormulas = [
    filteredDepositHeaders,
    ['（此表自动过滤 test/qa/线下 商户）', '', '', '', '', '', ''],
    ['=IFERROR(FILTER(\'充值原始数据\'!A:A, (ISERROR(SEARCH("test",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始数据\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始数据\'!B:B)))*(\'充值原始数据\'!A:A<>"")*(\'充值原始数据\'!A:A<>"A-序号")), "")',
     '=IFERROR(FILTER(\'充值原始数据\'!B:B, (ISERROR(SEARCH("test",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始数据\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始数据\'!B:B)))*(\'充值原始数据\'!A:A<>"")*(\'充值原始数据\'!A:A<>"A-序号")), "")',
     '=IFERROR(FILTER(\'充值原始数据\'!M:M, (ISERROR(SEARCH("test",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始数据\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始数据\'!B:B)))*(\'充值原始数据\'!A:A<>"")*(\'充值原始数据\'!A:A<>"A-序号")), "")',
     '=IFERROR(FILTER(\'充值原始数据\'!AM:AM, (ISERROR(SEARCH("test",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始数据\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始数据\'!B:B)))*(\'充值原始数据\'!A:A<>"")*(\'充值原始数据\'!A:A<>"A-序号")), "")',
     '=IFERROR(FILTER(\'充值原始数据\'!AN:AN, (ISERROR(SEARCH("test",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始数据\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始数据\'!B:B)))*(\'充值原始数据\'!A:A<>"")*(\'充值原始数据\'!A:A<>"A-序号")), "")',
     '=IFERROR(FILTER(\'充值原始数据\'!AO:AO, (ISERROR(SEARCH("test",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始数据\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始数据\'!B:B)))*(\'充值原始数据\'!A:A<>"")*(\'充值原始数据\'!A:A<>"A-序号")), "")',
     '=IFERROR(FILTER(\'充值原始数据\'!U:U, (ISERROR(SEARCH("test",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("qa",LOWER(\'充值原始数据\'!B:B))))*(ISERROR(SEARCH("线下",\'充值原始数据\'!B:B)))*(ISERROR(SEARCH("線下",\'充值原始数据\'!B:B)))*(\'充值原始数据\'!A:A<>"")*(\'充值原始数据\'!A:A<>"A-序号")), "")']
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(filteredDepositFormulas);
  ws3['!cols'] = filteredDepositHeaders.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws3, '过滤后充值');

  // 工作表4: 指标数据分析说明
  const analysisData = [
    ['指标数据分析', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['分类', '充值成功率', '充值3分内占比', '充值平均时间', '提现成功率', '提现2分内占比', '提现平均时间'],
    ['', '', '', '', '', '', ''],
    ['【充值公式说明】', '', '', '', '', '', ''],
    ['成功率 = 1 - 补单笔数/总充值笔数', '', '', '', '', '', ''],
    ['3分内占比 = 3分内笔数/自动到账笔数', '', '', '', '', '', ''],
    ['平均时间 = AVERAGEIFS(处理时间, 收款金额, ">0")', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['【提现公式说明】', '', '', '', '', '', ''],
    ['成功率 = 自动提现笔数/总提现申请笔数', '', '', '', '', '', ''],
    ['2分内占比 = 2分内笔数/自动提现笔数', '', '', '', '', '', ''],
    ['平均时间 = IF(V为空, Q-T, Q-V) 的平均值', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['【分类筛选条件】', '', '', '', '', '', ''],
    ['整体: 所有记录（排除test/qa/线下）', '', '', '', '', '', ''],
    ['支付宝: 商户名称包含「支付宝」', '', '', '', '', '', ''],
    ['微信: 商户名称包含「微信」', '', '', '', '', '', ''],
    ['金宝: 转出账号以 GB 开头（排除 GB-Dahaomen，不区分大小写）', '', '', '', '', '', ''],
    ['极速: 转出账号包含 auction 或 *****ion', '', '', '', '', '', ''],
    ['第三方: 非 AUCTION/GB 开头，或 GB-Dahaomen 开头，排除线下商户', '', '', '', '', '', ''],
    ['非正向信评: 信用评分栏位包含「非正向」', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['【注意事项】', '', '', '', '', '', ''],
    ['1. 贴上数据前请确保删除原始数据中的标题行', '', '', '', '', '', ''],
    ['2. 数据需要从系统导出的原始CSV复制', '', '', '', '', '', ''],
    ['3. 本范本会自动过滤 test/qa/线下 商户', '', '', '', '', '', '']
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(analysisData);
  ws4['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws4, '指标数据分析说明');

  // 工作表5: 计算结果
  const calcData = [
    ['指标数据分析 - 计算结果', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['分类', '充值成功率', '充值3分内占比', '充值平均时间(秒)', '提现成功率', '提现2分内占比', '提现平均时间(秒)'],
    ['整体',
     '=IFERROR(1-COUNTIFS(\'过滤后充值\'!G:G,"*补*",\'过滤后充值\'!C:C,">0")/COUNTIF(\'过滤后充值\'!C:C,">0"), 0)',
     '=IFERROR(COUNTIFS(\'过滤后充值\'!E:E,1,\'过滤后充值\'!C:C,">0")/COUNTIFS(\'过滤后充值\'!F:F,1,\'过滤后充值\'!C:C,">0"), 0)',
     '=IFERROR(AVERAGEIFS(\'过滤后充值\'!D:D,\'过滤后充值\'!C:C,">0",\'过滤后充值\'!D:D,">0"), 0)',
     '请贴上提现数据后手动计算', '请贴上提现数据后手动计算', '请贴上提现数据后手动计算'],
    ['支付宝', '=IFERROR(1-COUNTIFS(\'过滤后充值\'!G:G,"*补*",\'过滤后充值\'!C:C,">0",\'过滤后充值\'!B:B,"*支付*")/COUNTIFS(\'过滤后充值\'!C:C,">0",\'过滤后充值\'!B:B,"*支付*"), 0)', '', '', '', '', ''],
    ['微信', '=IFERROR(1-COUNTIFS(\'过滤后充值\'!G:G,"*补*",\'过滤后充值\'!C:C,">0",\'过滤后充值\'!B:B,"*微信*")/COUNTIFS(\'过滤后充值\'!C:C,">0",\'过滤后充值\'!B:B,"*微信*"), 0)', '', '', '', '', ''],
    ['金宝', '--', '--', '--', '', '', ''],
    ['极速', '--', '--', '--', '', '', ''],
    ['第三方', '--', '--', '--', '', '', ''],
    ['非正向信评', '', '', '', '--', '--', '--']
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(calcData);
  ws5['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws5, '计算结果');

  XLSX.writeFile(wb, `指标数据分析_${buildDateRange(weekRange)}.xlsx`);
};
