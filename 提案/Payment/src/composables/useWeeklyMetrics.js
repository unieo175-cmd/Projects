import { computed } from 'vue';

export function useWeeklyMetrics(depositMetrics, withdrawMetrics, weekRange, filteredWithdrawRecords) {
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

    // 充值订单成功(金额)总计
    const orderSuccessAmountTotal = orderSuccessAmountNormalCard + orderSuccessAmountJS;

    // 未充值 = 0（保留作為「无卡空单率」公式分子，UI 已移除卡片）
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
    const totalMatch = matchNormalCard + matchJS;

    // 充值配对率 = (充值配对(配一般卡) + 充值配对(配JS)) / 充值申请 * 100%
    const depositMatchRate = depositApplicationCount > 0 ? totalMatch / depositApplicationCount : 0;

    // 充提配对率 = 公式待确认，先设为0
    const depositWithdrawMatchRate = 0;

    // 配对后成功率 = (订单成功(一般卡) + 订单成功(Js+一般提)) / (充值配对(配一般卡) + 充值配对(配JS))
    const successAfterMatchRate = totalMatch > 0 ? orderSuccessTotal / totalMatch : 0;

    // 未充空单率 = 未充值 / 充值配对(配JS)
    const notDepositedEmptyRate = matchJS > 0 ? notDeposited / matchJS : 0;

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
      notDeposited,
      emptyOrderRate
    };
  });

  return { weeklyMetrics };
}

export function useAnalysisMetrics(filteredDepositRecords, depositMetrics, withdrawMetrics, filteredWithdrawRecords) {
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

    // 金宝提现：payoutAccount（轉出帳號）以 GB 开头（非 GB-Dahaomen），並去重
    const withdrawGBFiltered = withdrawData.filter(r => {
      const code = (r.payoutAccount || '').toUpperCase();
      return code.startsWith('GB') && !code.startsWith('GB-DAHAOMEN');
    });
    const withdrawGBRecords = deduplicateByOrderId(withdrawGBFiltered);
    const withdrawGB = calculateWithdrawCategoryMetrics(withdrawGBRecords);

    // 极速提现（极速银行卡）：payoutAccount（轉出帳號）包含 AUCTION，並去重
    const withdrawAuctionFiltered = withdrawData.filter(r => {
      const code = (r.payoutAccount || '').toUpperCase();
      return code.includes('AUCTION');
    });
    const withdrawAuctionRecords = deduplicateByOrderId(withdrawAuctionFiltered);
    const withdrawAuction = calculateWithdrawCategoryMetrics(withdrawAuctionRecords);

    // 第三方提现：payoutAccount（轉出帳號）不为空且不包含 AUCTION，且排除 GB 開頭（GB-Dahaomen 除外），並去重
    const withdrawThirdPartyFiltered = withdrawData.filter(r => {
      const code = (r.payoutAccount || '').toUpperCase();
      // 有轉出帳號且不是 AUCTION，且不是金寶（GB開頭但非GB-Dahaomen）
      return code.length > 0 && !code.includes('AUCTION') && (!code.startsWith('GB') || code.startsWith('GB-DAHAOMEN'));
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

  return { analysisMetrics };
}
