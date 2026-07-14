import { AMOUNT_RANGES } from './constants';

// ===== 保留旧版函数作为备份 =====
export const calculateMetricsLegacy = (records, withdrawMetrics = null, dataDate = null) => {
  // ===== 全部-重要信息 =====
  // 数据范围：排除 test/qa，不排除线下
  // 分类逻辑：依商户名称判断
  const allRecords = records;

  // 銀行卡：极速充提3 且不含支付宝/微信
  const bankCardForTotal = records.filter(r => {
    const hasJiSu = r.merchant.includes('极速充提3');
    const hasAlipay = r.merchant.includes('支付宝') || r.merchant.includes('支付寶');
    const hasWechat = r.merchant.includes('微信');
    return hasJiSu && !hasAlipay && !hasWechat;
  });

  // 支付寶：包含支付宝/支付寶
  const alipayForTotal = records.filter(r => {
    const hasAlipay = r.merchant.includes('支付宝') || r.merchant.includes('支付寶');
    return hasAlipay;
  });

  // 微信：包含微信
  const wechatForTotal = records.filter(r => {
    const hasWechat = r.merchant.includes('微信');
    return hasWechat;
  });

  // 其他：不符合银行卡、支付宝、微信的记录
  const otherForTotal = records.filter(r => {
    const hasJiSu = r.merchant.includes('极速充提3');
    const hasAlipay = r.merchant.includes('支付宝') || r.merchant.includes('支付寶');
    const hasWechat = r.merchant.includes('微信');
    // 不符合任何已知类别的记录
    return !hasAlipay && !hasWechat && !hasJiSu;
  });

  // 充值成功笔数 = 银行卡+支付宝+微信+其他 且 到账金额 > 0 且 状态不含取消
  const allCategoryRecords = [...bankCardForTotal, ...alipayForTotal, ...wechatForTotal, ...otherForTotal];
  const successfulRecords = allCategoryRecords.filter(r => r.receivedAmount > 0 && !r.status.includes('取消'));
  const successfulCount = successfulRecords.length;

  // 无效申请 = 状态含取消，或到账金额=0且银行卡代号不为空（有配卡但未到账）
  const invalidApplicationRecords = allCategoryRecords.filter(r => r.status.includes('取消') || (r.receivedAmount === 0 && r.bankCardCode !== ''));
  const invalidApplicationCount = invalidApplicationRecords.length;

  // 总申请笔数 = 所有記錄數（商戶只排除 test/qa）
  const totalApplicationCount = allCategoryRecords.length;

  // 成功率 = 充值成功笔数 / 总申请笔数
  const overallSuccessRate = totalApplicationCount > 0 ? (successfulCount / totalApplicationCount) * 100 : 0;

  // 无效申请比例 = 无效申请 / 总申请笔数
  const invalidApplicationRatio = totalApplicationCount > 0 ? (invalidApplicationCount / totalApplicationCount) * 100 : 0;

  // 总申请金额 = 充值成功笔数的金额加总
  const totalApplicationAmount = successfulRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 平均时间 = AVERAGEIFS(AN:AN, M:M, ">0")
  // AN = processingTime, M = receivedAmount
  // 计算所有 receivedAmount > 0 且 processingTime 有值的记录平均时间
  const recordsWithAmountAndTime = records.filter(r =>
    r.receivedAmount > 0 &&
    r.processingTime !== null &&
    r.processingTime >= 0
  );
  const overallAvgTime = recordsWithAmountAndTime.length > 0
    ? recordsWithAmountAndTime.reduce((sum, r) => sum + r.processingTime, 0) / recordsWithAmountAndTime.length
    : 0;

  // 掉单笔数 = 充值成功 (AP > 0) 且状态包含「补」
  const dropOrderRecords = successfulRecords.filter(r =>
    r.status && (r.status.includes('補') || r.status.includes('补'))
  );
  const dropOrderCount = dropOrderRecords.length;
  const dropOrderRatio = successfulCount > 0 ? (dropOrderCount / successfulCount) * 100 : 0;

  // ===== 充值成功时间区段 =====
  // 使用成功配对记录（与重要讯息一致：银行卡+支付宝+微信 成功配对）
  // 总充值成功（含掉单）= 成功配对 且 AP>0
  const minuteAnalysisRecords = allCategoryRecords.filter(r => r.receivedAmount > 0);
  const minuteAnalysisTotalCount = minuteAnalysisRecords.length;
  const minuteAnalysisTotalAmount = minuteAnalysisRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 有处理时间的成功记录
  const minuteAnalysisWithTime = minuteAnalysisRecords.filter(r =>
    r.processingTime !== null && r.processingTime >= 0
  );

  // 2分鐘內 (≤ 120秒)
  const minuteWithin2Min = minuteAnalysisWithTime.filter(r => r.processingTime <= 120);
  const minuteWithin2MinAmount = minuteWithin2Min.reduce((sum, r) => sum + r.receivedAmount, 0);
  const minuteWithin2MinRatio = minuteAnalysisTotalCount > 0 ? (minuteWithin2Min.length / minuteAnalysisTotalCount) * 100 : 0;

  // 2-3分鐘 (120 < t ≤ 180秒)
  const minuteWithin2to3Min = minuteAnalysisWithTime.filter(r => r.processingTime > 120 && r.processingTime <= 180);
  const minuteWithin2to3MinAmount = minuteWithin2to3Min.reduce((sum, r) => sum + r.receivedAmount, 0);
  const minuteWithin2to3MinRatio = minuteAnalysisTotalCount > 0 ? (minuteWithin2to3Min.length / minuteAnalysisTotalCount) * 100 : 0;

  // 3-5分鐘 (180 < t ≤ 300秒)
  const minuteWithin3to5Min = minuteAnalysisWithTime.filter(r => r.processingTime > 180 && r.processingTime <= 300);
  const minuteWithin3to5MinAmount = minuteWithin3to5Min.reduce((sum, r) => sum + r.receivedAmount, 0);
  const minuteWithin3to5MinRatio = minuteAnalysisTotalCount > 0 ? (minuteWithin3to5Min.length / minuteAnalysisTotalCount) * 100 : 0;

  // 5-15分鐘 (300 < t ≤ 900秒)
  const minuteWithin5to15Min = minuteAnalysisWithTime.filter(r => r.processingTime > 300 && r.processingTime <= 900);
  const minuteWithin5to15MinAmount = minuteWithin5to15Min.reduce((sum, r) => sum + r.receivedAmount, 0);
  const minuteWithin5to15MinRatio = minuteAnalysisTotalCount > 0 ? (minuteWithin5to15Min.length / minuteAnalysisTotalCount) * 100 : 0;

  // 15-30分鐘 (900 < t ≤ 1800秒)
  const minuteWithin15to30Min = minuteAnalysisWithTime.filter(r => r.processingTime > 900 && r.processingTime <= 1800);
  const minuteWithin15to30MinAmount = minuteWithin15to30Min.reduce((sum, r) => sum + r.receivedAmount, 0);
  const minuteWithin15to30MinRatio = minuteAnalysisTotalCount > 0 ? (minuteWithin15to30Min.length / minuteAnalysisTotalCount) * 100 : 0;

  // 30分钟以上 (>= TIME(0,30,0))
  const minuteOver30Min = minuteAnalysisWithTime.filter(r => r.processingTime >= 1800);
  const minuteOver30MinAmount = minuteOver30Min.reduce((sum, r) => sum + r.receivedAmount, 0);
  const minuteOver30MinRatio = minuteAnalysisTotalCount > 0 ? (minuteOver30Min.length / minuteAnalysisTotalCount) * 100 : 0;

  // 无效申请 = 状态含取消，或到账金额=0且银行卡代号不为空（已成功配对但未到账）
  const minuteInvalidRecords = allCategoryRecords.filter(r => r.status.includes('取消') || (r.receivedAmount === 0 && r.bankCardCode !== ''));
  const minuteInvalidCount = minuteInvalidRecords.length;
  const minuteTotalForRatio = minuteAnalysisTotalCount + minuteInvalidCount;
  const minuteInvalidRatio = minuteTotalForRatio > 0 ? (minuteInvalidCount / minuteTotalForRatio) * 100 : 0;

  // 掉单 = 成功配对 且 AP>0 且状态有补单字眼（与重要讯息一致）
  const minuteDropRecords = minuteAnalysisRecords.filter(r =>
    r.status && (r.status.includes('補') || r.status.includes('补'))
  );
  const minuteDropCount = minuteDropRecords.length;
  const minuteDropRatio = minuteAnalysisTotalCount > 0 ? (minuteDropCount / minuteAnalysisTotalCount) * 100 : 0;

  // 平均时间 = 成功配对 且 AP>0 的平均时间
  const minuteAvgTime = minuteAnalysisWithTime.length > 0
    ? minuteAnalysisWithTime.reduce((sum, r) => sum + r.processingTime, 0) / minuteAnalysisWithTime.length
    : 0;

  // 旧指标（保留向下兼容）
  const validRecords = records.filter(r => !r.isInvalid);
  const invalidRecords = records.filter(r => r.isInvalid);

  // 计算各时间区间的笔数
  const validWithTime = validRecords.filter(r => r.processingTime !== null && r.processingTime >= 0);

  // 2分鐘內 (≤ 120秒)
  const within2Min = validWithTime.filter(r => r.processingTime <= 120);
  // 3-5分鐘 (120 < t ≤ 300秒)
  const within3to5Min = validWithTime.filter(r => r.processingTime > 120 && r.processingTime <= 300);
  // 5-15分鐘 (300 < t ≤ 900秒)
  const within5to15Min = validWithTime.filter(r => r.processingTime > 300 && r.processingTime <= 900);
  // 15-30分鐘 (900 < t ≤ 1800秒)
  const within15to30Min = validWithTime.filter(r => r.processingTime > 900 && r.processingTime <= 1800);
  // 30分鐘以上 (> 1800秒)
  const over30Min = validWithTime.filter(r => r.processingTime > 1800);

  // 计算平均时间 (不包含未充值的笔数)
  const avgTime = validWithTime.length > 0
    ? validWithTime.reduce((sum, r) => sum + r.processingTime, 0) / validWithTime.length
    : 0;

  // 中位数时间
  const sortedTimes = validWithTime.map(r => r.processingTime).sort((a, b) => a - b);
  const medianTime = sortedTimes.length > 0
    ? sortedTimes[Math.floor(sortedTimes.length / 2)]
    : 0;

  // 成功相关指标 (保留旧的)
  const successRecords = records.filter(r => r.isSuccess);
  const buDanRecords = records.filter(r => r.isBuDan && r.receivedAmount > 0);
  const totalAmount = records.filter(r => r.receivedAmount > 0).reduce((sum, r) => sum + r.receivedAmount, 0);

  const totalBase = totalApplicationCount + invalidRecords.length;

  // ===== 极速区域指标 =====
  // 资料范围：商户包含「极速充提3」且不包含支付宝、微信、test、qa、线下
  const jisuRecords = records.filter(r => {
    const hasJiSu = r.merchant.includes('极速充提3');
    const merchantLower = r.merchant.toLowerCase();
    const hasAlipay = r.merchant.includes('支付宝') || r.merchant.includes('支付寶');
    const hasWechat = r.merchant.includes('微信');
    const hasTest = merchantLower.includes('test');
    const hasQa = merchantLower.includes('qa');
    const hasOffline = r.merchant.includes('線下') || r.merchant.includes('线下');
    return hasJiSu && !hasAlipay && !hasWechat && !hasTest && !hasQa && !hasOffline;
  });

  // ===== 1. 充值申请笔数 =====
  // 一般卡：银行卡代号有值且不等于AUCTION_PAYMENT_CARD
  const normalCardForApp = jisuRecords.filter(r =>
    r.bankCardCode && r.bankCardCode !== 'AUCTION_PAYMENT_CARD'
  );
  // 极速：银行卡代号=AUCTION_PAYMENT_CARD
  const expressCardForApp = jisuRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD'
  );
  // 建单成功等待无配对：有商户名称但银行卡号为空
  const waitingForMatchRecords = jisuRecords.filter(r => !r.bankCardCode);
  const waitingForMatchCount = waitingForMatchRecords.length;
  const waitingForMatchAmount = waitingForMatchRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

  // 取无卡06提示：以 (userId + 日期) 去重
  const noCard06Set = new Set();
  waitingForMatchRecords.forEach(r => {
    const dateKey = (r.requestTime || '').split(' ')[0];
    if (r.userId && dateKey) {
      noCard06Set.add(`${r.userId}_${dateKey}`);
    }
  });
  const noCard06Count = noCard06Set.size;

  // 充值申请笔数 = 一般卡 + 极速提 + 建单成功等待无配对 + 取无卡06提示
  const jisuApplicationCount = normalCardForApp.length + expressCardForApp.length + waitingForMatchCount + noCard06Count;
  const normalCardAppAmount = normalCardForApp.reduce((sum, r) => sum + (r.amount || 0), 0);
  const expressCardAppAmount = expressCardForApp.reduce((sum, r) => sum + (r.amount || 0), 0);
  const jisuApplicationAmount = normalCardAppAmount + expressCardAppAmount + waitingForMatchAmount;

  // ===== 2. 成功配对笔数/金额 =====
  // 一般卡：银行卡代号有值且不等于AUCTION_PAYMENT_CARD，计算笔数和充值金额(amount)总和
  const normalMatchCount = normalCardForApp.length;
  const normalMatchAmount = normalCardForApp.reduce((sum, r) => sum + r.amount, 0);
  // 极速：银行卡代号=AUCTION_PAYMENT_CARD，计算笔数和充值金额(amount)总和
  const expressMatchCount = expressCardForApp.length;
  const expressMatchAmount = expressCardForApp.reduce((sum, r) => sum + r.amount, 0);
  // 总计
  const totalMatchCount = normalMatchCount + expressMatchCount;
  const totalMatchAmount = normalMatchAmount + expressMatchAmount;

  // ===== 3. 订单成功笔数/金额 =====
  // 一般卡：银行卡代号有值且不是AUCTION_PAYMENT_CARD，正规化状态不等于「未充值」「审核中(已超时)」
  const normalOrderSuccess = jisuRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const normalOrderSuccessCount = normalOrderSuccess.length;
  const normalOrderSuccessAmount = normalOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);


  // 极速提：银行卡代号=AUCTION_PAYMENT_CARD，到账金额>0，normalizedStatus有值且≠未充值/图文复核(已超时)/审核中(已超时)
  const expressOrderSuccess = jisuRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const expressOrderSuccessCount = expressOrderSuccess.length;
  const expressOrderSuccessAmount = expressOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 信评上分：到账金额不为0且状态包含「信用」
  const creditScoreSuccess = jisuRecords.filter(r =>
    r.receivedAmount > 0 && r.status && r.status.includes('信用')
  );
  const creditScoreSuccessCount = creditScoreSuccess.length;
  const creditScoreSuccessAmount = creditScoreSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 信评上分平均时间（通知时间-建立时间）
  const creditScoreWithTime = creditScoreSuccess.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const creditScoreAvgTime = creditScoreWithTime.length > 0
    ? creditScoreWithTime.reduce((sum, r) => sum + r.processingTime, 0) / creditScoreWithTime.length
    : 0;

  // 订单成功总计
  const totalOrderSuccessCount = normalOrderSuccessCount + expressOrderSuccessCount;
  const totalOrderSuccessAmount = normalOrderSuccessAmount + expressOrderSuccessAmount;

  // ===== 4. 没信评降等配卡 =====
  // 条件：银行卡代号不等于AUCTION_PAYMENT_CARD，到账金额不为0，用户等级不为0和-1
  const noCreditDowngradeRecords = jisuRecords.filter(r =>
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount !== 0 &&
    parseFloat(r.userLevel) !== 0 &&
    parseFloat(r.userLevel) !== -1
  );

  // 依据充值金额区间计算笔数
  const amountRanges = AMOUNT_RANGES;
  const noCreditDowngradeByAmount = {};
  amountRanges.forEach(amt => {
    noCreditDowngradeByAmount[amt] = noCreditDowngradeRecords.filter(r => Math.round(r.amount) === amt).length;
  });

  // 没信评降等配卡 - 平均时间
  // 条件：排除支付宝和微信商户，到账金额>0
  const noCreditDowngradeForAvgTime = jisuRecords.filter(r =>
    r.receivedAmount > 0 &&
    r.processingTime !== null &&
    r.processingTime >= 0
  );
  const noCreditDowngradeAvgTime = noCreditDowngradeForAvgTime.length > 0
    ? noCreditDowngradeForAvgTime.reduce((sum, r) => sum + r.processingTime, 0) / noCreditDowngradeForAvgTime.length
    : 0;
  // 其他金额
  const knownAmounts = new Set(amountRanges);
  noCreditDowngradeByAmount['other'] = noCreditDowngradeRecords.filter(r => !knownAmounts.has(Math.round(r.amount))).length;

  const noCreditDowngradeTotal = noCreditDowngradeRecords.length;

  // ===== 5. c2c =====
  // 数据范围：排除支付宝、微信、qa、test、线下（jisuRecords已处理）

  // 标题：银行卡代号=AUCTION_PAYMENT_CARD，到账金额>0，状态包含「用户确认到帐」
  const c2cRecords = jisuRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status && (r.status.includes('用户确认到帐') || r.status.includes('用戶確認到帳'))
  );
  const c2cCount = c2cRecords.length;
  const c2cAmount = c2cRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 1. 点确认：状态包含「用户确认到帐」且到账金额>0
  const c2cConfirmRecords = jisuRecords.filter(r =>
    r.receivedAmount > 0 &&
    r.status && (r.status.includes('用户确认到帐') || r.status.includes('用戶確認到帳'))
  );
  const c2cConfirmCount = c2cConfirmRecords.length;

  // 2. 点确认的平均处理时间
  const c2cConfirmWithTime = c2cConfirmRecords.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const c2cConfirmAvgTime = c2cConfirmWithTime.length > 0
    ? c2cConfirmWithTime.reduce((sum, r) => sum + r.processingTime, 0) / c2cConfirmWithTime.length
    : 0;

  // 3. 人工审核:通过：bankCardCode包含AUCTION, 状态包含「金額補單/金额补单」且到账金额>0，处理时间<=11分钟
  const c2cManualAuditRecords = jisuRecords.filter(r =>
    r.bankCardCode && r.bankCardCode.includes('AUCTION') &&
    r.receivedAmount > 0 &&
    r.status && (r.status.includes('金額補單') || r.status.includes('金额补单')) &&
    r.processingTime !== null &&
    r.processingTime >= 0 &&
    r.processingTime <= 660 // 11分钟 = 660秒
  );
  const c2cManualAuditCount = c2cManualAuditRecords.length;

  // 4. 审核-成功平均时间：人工审核通过的平均处理时间
  const c2cAuditSuccessAvgTime = c2cManualAuditRecords.length > 0
    ? c2cManualAuditRecords.reduce((sum, r) => sum + r.processingTime, 0) / c2cManualAuditRecords.length
    : 0;

  // 5. 超过11min补件后才成功
  // Note: 此处使用 jisuRecords (银行卡)，支付宝的 c2c 计算在 alipayRecords 部分
  // Part 1: bankCardCode包含AUCTION, receivedAmount>0, status包含金額補單, 处理时间 > 11分钟
  const c2cOver11MinBuDanCount = jisuRecords.filter(r =>
    r.bankCardCode && r.bankCardCode.includes('AUCTION') &&
    r.receivedAmount > 0 &&
    r.status && (r.status.includes('金額補單') || r.status.includes('金额补单')) &&
    r.processingTime !== null &&
    r.processingTime > 660 // > 11分钟
  ).length;

  // Part 2: bankCardCode=AUCTION_PAYMENT_CARD, receivedAmount>0, 状态含「商户确认到帐」
  const c2cMerchantConfirmCount = jisuRecords.filter(r =>
    r.bankCardCode && r.bankCardCode.includes('AUCTION_PAYMENT_CARD') &&
    r.receivedAmount > 0 &&
    r.status && (r.status.includes('商户确认到帐') || r.status.includes('商戶確認到帳'))
  ).length;
  const c2cOver11MinSuccessCount = c2cOver11MinBuDanCount + c2cMerchantConfirmCount;

  // ===== 三方代收（銀行卡）=====
  // 三方代收判断函数
  const isThirdPartyDahaomen = (code) => code && (code.toLowerCase().startsWith('gb-dahaomen') || code.toLowerCase().startsWith('dahaomen'));
  const isThirdPartyHuitong = (code) => code && code.toLowerCase().startsWith('htc2c');
  const isThirdPartyDoudou = (code) => code && code.toLowerCase().startsWith('ddf');
  const isThirdPartyUC = (code) => code && code.toLowerCase().startsWith('uc1020');
  // GB-DahaomenJFB 归类到「其他」，不再作为已知三方
  const isKnownThirdParty = (code) => isThirdPartyHuitong(code) || isThirdPartyDoudou(code) || isThirdPartyUC(code);
  // 排除线下充值商户（繁体「线下」+ 简体「线下」）
  const isOfflineMerchant = (merchant) => merchant && (merchant.includes('線下') || merchant.includes('线下'));

  // 条件：bankCardCode 非 gb/auction 开头（不区分大小写），或是特定三方代收代码
  // 充值成功：receivedAmount > 0，排除线下充值商户
  const thirdPartyRecords = jisuRecords.filter(r => {
    if (!r.bankCardCode || r.receivedAmount <= 0) return false;
    if (isOfflineMerchant(r.merchant)) return false;
    const code = r.bankCardCode.toLowerCase();
    // 已知三方代收要保留（包含 Dahaomen，雖然它歸類到其他）
    if (isKnownThirdParty(r.bankCardCode) || isThirdPartyDahaomen(r.bankCardCode)) return true;
    if (code.startsWith('gb') || code.startsWith('auction')) return false;
    return true;
  });
  const thirdPartyCount = thirdPartyRecords.length;
  const thirdPartyAmount = thirdPartyRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 各三方代收明細
  // GB-DahaomenJFB = GB-Dahaomen 开头 + Dahaomen 开头，排除线下充值商户
  const thirdPartyDahaomenRecords = jisuRecords.filter(r =>
    isThirdPartyDahaomen(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const thirdPartyDahaomenCount = thirdPartyDahaomenRecords.length;
  const thirdPartyDahaomenAmount = thirdPartyDahaomenRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 汇通 = HTc2c 开头，排除线下充值商户
  const thirdPartyHuitongRecords = jisuRecords.filter(r =>
    isThirdPartyHuitong(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const thirdPartyHuitongCount = thirdPartyHuitongRecords.length;
  const thirdPartyHuitongAmount = thirdPartyHuitongRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 豆豆 = DDF 开头，排除线下充值商户
  const thirdPartyDoudouRecords = jisuRecords.filter(r =>
    isThirdPartyDoudou(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const thirdPartyDoudouCount = thirdPartyDoudouRecords.length;
  const thirdPartyDoudouAmount = thirdPartyDoudouRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // UC聚合 = uc1020 开头（不区分大小写），排除线下充值商户
  const thirdPartyUCRecords = jisuRecords.filter(r =>
    isThirdPartyUC(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const thirdPartyUCCount = thirdPartyUCRecords.length;
  const thirdPartyUCAmount = thirdPartyUCRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 其他三方 = 非已知三方代收的其他三方卡号（包含 Dahaomen），排除线下充值商户
  // 三方卡号定义：排除 auction 开头、排除 gb 开头，但包含 Dahaomen（归类到其他）
  const thirdPartyOtherRecords = jisuRecords.filter(r => {
    if (!r.bankCardCode || r.receivedAmount <= 0) return false;
    if (isOfflineMerchant(r.merchant)) return false;
    // 排除已知的三種三方代收（汇通、豆豆、UC）
    if (isKnownThirdParty(r.bankCardCode)) return false;
    // Dahaomen 歸類到其他
    if (isThirdPartyDahaomen(r.bankCardCode)) return true;
    const code = r.bankCardCode.toLowerCase();
    // 排除 auction 和 gb 开头
    if (code.startsWith('auction') || code.startsWith('gb')) return false;
    return true;
  });
  const thirdPartyOtherCount = thirdPartyOtherRecords.length;
  const thirdPartyOtherAmount = thirdPartyOtherRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // ===== 支付宝商户数据 =====
  // 数据范围：排除 test/qa/线下
  const alipayRecords = records.filter(r => {
    const hasAlipay = r.merchant.includes('支付宝') || r.merchant.includes('支付寶');
    const merchantLower = r.merchant.toLowerCase();
    const hasTest = merchantLower.includes('test');
    const hasQa = merchantLower.includes('qa');
    const hasOffline = r.merchant.includes('線下') || r.merchant.includes('线下');
    return hasAlipay && !hasTest && !hasQa && !hasOffline;
  });

  // 支付宝 - 充值申请笔数（支援簡繁體）
  // 一般卡：银行卡代号有值、不等于AUCTION_PAYMENT_CARD、银行名称不为支付宝/支付宝(企)/微信支付
  const alipayNormalCardForApp = alipayRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' && r.bankName !== '支付寶' &&
    r.bankName !== '支付宝(企)' && r.bankName !== '支付寶(企)' &&
    r.bankName !== '微信支付'
  );
  // 一般宝：银行卡代号有值且不等于AUCTION_PAYMENT_CARD、银行名称为支付宝/支付宝(企)/微信支付
  const alipayExpressCardForApp = alipayRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付寶' || r.bankName === '支付宝(企)' || r.bankName === '支付寶(企)' || r.bankName === '微信支付')
  );
  const alipayExpressCardAppCount = alipayExpressCardForApp.length;

  // 极速提卡：银行卡代号=AUCTION_PAYMENT_CARD、银行名称不为支付宝/支付宝(企)/微信支付
  const alipayJisuTikaForApp = alipayRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' && r.bankName !== '支付寶' &&
    r.bankName !== '支付宝(企)' && r.bankName !== '支付寶(企)' &&
    r.bankName !== '微信支付'
  );
  const alipayJisuTikaCount = alipayJisuTikaForApp.length;

  // 极速提宝：银行卡代号=AUCTION_PAYMENT_CARD、银行名称为支付宝/支付宝(企)/微信支付
  const alipayJisuTibaoForApp = alipayRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付寶' || r.bankName === '支付宝(企)' || r.bankName === '支付寶(企)' || r.bankName === '微信支付')
  );
  const alipayJisuTibaoCount = alipayJisuTibaoForApp.length;

  const alipayApplicationCount = alipayNormalCardForApp.length + alipayExpressCardAppCount + alipayJisuTikaCount + alipayJisuTibaoCount;

  // 支付宝 - 建单成功等待无配对：有商户名称但银行卡号为空
  const alipayWaitingForMatchCount = alipayRecords.filter(r => !r.bankCardCode).length;

  // 支付宝 - 成功配对
  const alipayNormalMatchCount = alipayNormalCardForApp.length;
  const alipayNormalMatchAmount = alipayNormalCardForApp.reduce((sum, r) => sum + r.amount, 0);
  // 一般宝金额
  const alipayExpressBaoMatchAmount = alipayExpressCardForApp.reduce((sum, r) => sum + r.amount, 0);
  // 极速提(卡)金额
  const alipayJisuTikaMatchAmount = alipayJisuTikaForApp.reduce((sum, r) => sum + r.amount, 0);
  // 极速提(宝)金额
  const alipayJisuTibaoMatchAmount = alipayJisuTibaoForApp.reduce((sum, r) => sum + r.amount, 0);
  // 成功配对总计 = 一般卡 + 一般宝 + 极速提(卡) + 极速提(宝)
  const alipayTotalMatchCount = alipayNormalMatchCount + alipayExpressCardAppCount + alipayJisuTikaCount + alipayJisuTibaoCount;
  const alipayTotalMatchAmount = alipayNormalMatchAmount + alipayExpressBaoMatchAmount + alipayJisuTikaMatchAmount + alipayJisuTibaoMatchAmount;

  // 支付宝 - 订单成功（使用 normalizedStatus，与 Excel AO 列一致）（支援簡繁體）
  // 一般卡：bankCardCode有值且≠AUCTION_PAYMENT_CARD, bankName不为支付宝/支付宝(企)/微信支付, normalizedStatus有值且≠未充值/图文复核(已超时)/审核中(已超时)
  const alipayNormalOrderSuccess = alipayRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' && r.bankName !== '支付寶' &&
    r.bankName !== '支付宝(企)' && r.bankName !== '支付寶(企)' &&
    r.bankName !== '微信支付' &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const alipayNormalOrderSuccessCount = alipayNormalOrderSuccess.length;
  const alipayNormalOrderSuccessAmount = alipayNormalOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 一般宝：bankCardCode有值且≠AUCTION_PAYMENT_CARD, bankName为支付宝/支付宝(企)/微信支付, normalizedStatus有值且≠未充值/图文复核(已超时)/审核中(已超时)
  const alipayBaoOrderSuccess = alipayRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付寶' || r.bankName === '支付宝(企)' || r.bankName === '支付寶(企)' || r.bankName === '微信支付') &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const alipayBaoOrderSuccessCount = alipayBaoOrderSuccess.length;
  const alipayBaoOrderSuccessAmount = alipayBaoOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 极速提(卡)：bankCardCode=AUCTION_PAYMENT_CARD, bankName不为支付宝/支付宝(企)/微信支付, 到账金额>0, normalizedStatus有值且≠未充值/图文复核(已超时)/审核中(已超时)
  const alipayJisuTikaOrderSuccess = alipayRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' && r.bankName !== '支付寶' &&
    r.bankName !== '支付宝(企)' && r.bankName !== '支付寶(企)' &&
    r.bankName !== '微信支付' &&
    r.receivedAmount > 0 &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const alipayJisuTikaOrderSuccessCount = alipayJisuTikaOrderSuccess.length;
  const alipayJisuTikaOrderSuccessAmount = alipayJisuTikaOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 极速提(宝)：bankCardCode=AUCTION_PAYMENT_CARD, bankName为支付宝/支付宝(企)/微信支付, 到账金额>0, normalizedStatus有值且≠未充值/图文复核(已超时)/审核中(已超时)
  const alipayJisuTibaoOrderSuccess = alipayRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付寶' || r.bankName === '支付宝(企)' || r.bankName === '支付寶(企)' || r.bankName === '微信支付') &&
    r.receivedAmount > 0 &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const alipayJisuTibaoOrderSuccessCount = alipayJisuTibaoOrderSuccess.length;
  const alipayJisuTibaoOrderSuccessAmount = alipayJisuTibaoOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 支付寶 - 信評上分：status包含「信用評分上分」
  const alipayCreditScoreSuccess = alipayRecords.filter(r =>
    r.status && r.status.includes('信用評分上分')
  );
  const alipayCreditScoreSuccessCount = alipayCreditScoreSuccess.length;
  const alipayCreditScoreSuccessAmount = alipayCreditScoreSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);
  const alipayCreditScoreWithTime = alipayCreditScoreSuccess.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const alipayCreditScoreAvgTime = alipayCreditScoreWithTime.length > 0
    ? alipayCreditScoreWithTime.reduce((sum, r) => sum + r.processingTime, 0) / alipayCreditScoreWithTime.length
    : 0;

  // 其中信评不含图文复核：bankCardCode=AUCTION_PAYMENT_CARD, receivedAmount>0, status包含「信用評分上分」但≠「信用評分上分(圖文覆核)」
  const alipayCreditNoTuwen = alipayRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status &&
    r.status.includes('信用評分上分') &&
    r.status !== '信用評分上分(圖文覆核)'
  );
  const alipayCreditNoTuwenCount = alipayCreditNoTuwen.length;
  const alipayCreditNoTuwenWithTime = alipayCreditNoTuwen.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const alipayCreditNoTuwenAvgTime = alipayCreditNoTuwenWithTime.length > 0
    ? alipayCreditNoTuwenWithTime.reduce((sum, r) => sum + r.processingTime, 0) / alipayCreditNoTuwenWithTime.length
    : 0;

  // 订单成功总计
  const alipayTotalOrderSuccessCount = alipayNormalOrderSuccessCount + alipayBaoOrderSuccessCount + alipayJisuTikaOrderSuccessCount + alipayJisuTibaoOrderSuccessCount;
  const alipayTotalOrderSuccessAmount = alipayNormalOrderSuccessAmount + alipayBaoOrderSuccessAmount + alipayJisuTikaOrderSuccessAmount + alipayJisuTibaoOrderSuccessAmount;

  // 支付寶 - 没信评降等配卡：bankCardCode≠AUCTION_PAYMENT_CARD, receivedAmount≠0, userLevel≠0且≠-1
  const alipayNoCreditDowngradeRecords = alipayRecords.filter(r =>
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount !== 0 &&
    parseFloat(r.userLevel) !== 0 &&
    parseFloat(r.userLevel) !== -1
  );
  const alipayNoCreditDowngradeTotal = alipayNoCreditDowngradeRecords.length;

  // 支付宝 - 没信评降等配卡 依据金额区间计算笔数
  const alipayNoCreditDowngradeByAmount = {};
  amountRanges.forEach(amt => {
    alipayNoCreditDowngradeByAmount[amt] = alipayNoCreditDowngradeRecords.filter(r => Math.round(r.amount) === amt).length;
  });
  // 其他金额
  alipayNoCreditDowngradeByAmount['other'] = alipayNoCreditDowngradeRecords.filter(r => !amountRanges.includes(Math.round(r.amount))).length;

  // 支付宝 - 平均时间：receivedAmount > 0
  const alipayNoCreditDowngradeForAvgTime = alipayRecords.filter(r =>
    r.receivedAmount > 0 &&
    r.processingTime !== null &&
    r.processingTime >= 0
  );
  const alipayNoCreditDowngradeAvgTime = alipayNoCreditDowngradeForAvgTime.length > 0
    ? alipayNoCreditDowngradeForAvgTime.reduce((sum, r) => sum + r.processingTime, 0) / alipayNoCreditDowngradeForAvgTime.length
    : 0;

  // ===== 支付寶 c2c =====
  // 标题：银行卡代号=AUCTION_PAYMENT_CARD，到账金额>0，状态包含「用户确认到帐」
  const alipayC2cRecords = alipayRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount > 0 &&
    r.status && (r.status.includes('用户确认到帐') || r.status.includes('用戶確認到帳'))
  );
  const alipayC2cCount = alipayC2cRecords.length;
  const alipayC2cAmount = alipayC2cRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 1. 点确认：状态包含「用户确认到帐」且到账金额>0
  const alipayC2cConfirmRecords = alipayRecords.filter(r =>
    r.receivedAmount > 0 &&
    r.status && (r.status.includes('用户确认到帐') || r.status.includes('用戶確認到帳'))
  );
  const alipayC2cConfirmCount = alipayC2cConfirmRecords.length;

  // 2. 点确认的平均处理时间
  const alipayC2cConfirmWithTime = alipayC2cConfirmRecords.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const alipayC2cConfirmAvgTime = alipayC2cConfirmWithTime.length > 0
    ? alipayC2cConfirmWithTime.reduce((sum, r) => sum + r.processingTime, 0) / alipayC2cConfirmWithTime.length
    : 0;

  // 3. 人工审核:通过：bankCardCode包含AUCTION，到账金额>0，状态包含「金額補單/金额补单」，处理时间<=11分钟
  const alipayC2cManualAuditRecords = alipayRecords.filter(r =>
    r.bankCardCode && r.bankCardCode.includes('AUCTION') &&
    r.receivedAmount > 0 &&
    r.status && (r.status.includes('金額補單') || r.status.includes('金额补单')) &&
    r.processingTime !== null &&
    r.processingTime > 0 &&
    r.processingTime <= 660
  );
  const alipayC2cManualAuditCount = alipayC2cManualAuditRecords.length;

  // 4. 审核-成功平均时间
  const alipayC2cAuditSuccessAvgTime = alipayC2cManualAuditRecords.length > 0
    ? alipayC2cManualAuditRecords.reduce((sum, r) => sum + r.processingTime, 0) / alipayC2cManualAuditRecords.length
    : 0;

  // 5. 超过11min补件后才成功
  // Part 1: bankCardCode包含AUCTION, receivedAmount>0, status包含金額補單/金额补单, processingTime>11分钟
  const alipayC2cOver11MinBuDanCount = alipayRecords.filter(r =>
    r.bankCardCode && r.bankCardCode.includes('AUCTION') &&
    r.receivedAmount > 0 &&
    r.status && (r.status.includes('金額補單') || r.status.includes('金额补单')) &&
    r.processingTime !== null &&
    r.processingTime > 660
  ).length;

  // Part 2: bankCardCode包含AUCTION_PAYMENT_CARD, receivedAmount>0, status包含商户确认到帐
  const alipayC2cMerchantConfirmCount = alipayRecords.filter(r =>
    r.bankCardCode && r.bankCardCode.includes('AUCTION_PAYMENT_CARD') &&
    r.receivedAmount > 0 &&
    r.status && (r.status.includes('商户确认到帐') || r.status.includes('商戶確認到帳'))
  ).length;

  const alipayC2cOver11MinSuccessCount = alipayC2cOver11MinBuDanCount + alipayC2cMerchantConfirmCount;

  // ===== 支付宝 - 三方代收（一般卡订单成功）=====
  // 条件：bankCardCode 非 gb/auction 开头（不区分大小写），或是特定三方代收代码
  // 充值成功：receivedAmount > 0，排除线下充值商户
  const alipayThirdPartyRecords = alipayRecords.filter(r => {
    if (!r.bankCardCode || r.receivedAmount <= 0) return false;
    if (isOfflineMerchant(r.merchant)) return false;
    const code = r.bankCardCode.toLowerCase();
    // 已知三方代收要保留（包含 Dahaomen，雖然它歸類到其他）
    if (isKnownThirdParty(r.bankCardCode) || isThirdPartyDahaomen(r.bankCardCode)) return true;
    if (code.startsWith('gb') || code.startsWith('auction')) return false;
    return true;
  });
  const alipayThirdPartyCount = alipayThirdPartyRecords.length;
  const alipayThirdPartyAmount = alipayThirdPartyRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 各三方代收明細
  // GB-DahaomenJFB = GB-Dahaomen 开头 + Dahaomen 开头，排除线下充值商户
  const alipayThirdPartyDahaomenRecords = alipayRecords.filter(r =>
    isThirdPartyDahaomen(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const alipayThirdPartyDahaomenCount = alipayThirdPartyDahaomenRecords.length;
  const alipayThirdPartyDahaomenAmount = alipayThirdPartyDahaomenRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 汇通 = HTc2c 开头，排除线下充值商户
  const alipayThirdPartyHuitongRecords = alipayRecords.filter(r =>
    isThirdPartyHuitong(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const alipayThirdPartyHuitongCount = alipayThirdPartyHuitongRecords.length;
  const alipayThirdPartyHuitongAmount = alipayThirdPartyHuitongRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 豆豆 = DDF 开头，排除线下充值商户
  const alipayThirdPartyDoudouRecords = alipayRecords.filter(r =>
    isThirdPartyDoudou(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const alipayThirdPartyDoudouCount = alipayThirdPartyDoudouRecords.length;
  const alipayThirdPartyDoudouAmount = alipayThirdPartyDoudouRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // UC聚合 = uc1020 开头（不区分大小写），排除线下充值商户
  const alipayThirdPartyUCRecords = alipayRecords.filter(r =>
    isThirdPartyUC(r.bankCardCode) && r.receivedAmount > 0 && !isOfflineMerchant(r.merchant)
  );
  const alipayThirdPartyUCCount = alipayThirdPartyUCRecords.length;
  const alipayThirdPartyUCAmount = alipayThirdPartyUCRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 支付宝 - 其他三方（包含 Dahaomen），排除线下充值商户
  const alipayThirdPartyOtherRecords = alipayRecords.filter(r => {
    if (!r.bankCardCode || r.receivedAmount <= 0) return false;
    if (isOfflineMerchant(r.merchant)) return false;
    // 排除已知的三種三方代收（汇通、豆豆、UC）
    if (isKnownThirdParty(r.bankCardCode)) return false;
    // Dahaomen 歸類到其他
    if (isThirdPartyDahaomen(r.bankCardCode)) return true;
    const code = r.bankCardCode.toLowerCase();
    // 排除 auction 和 gb 开头
    if (code.startsWith('auction') || code.startsWith('gb')) return false;
    return true;
  });
  const alipayThirdPartyOtherCount = alipayThirdPartyOtherRecords.length;
  const alipayThirdPartyOtherAmount = alipayThirdPartyOtherRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // ===== 支付寶 - 宝转卡渠道，配支付宝提现 =====（支援簡繁體）
  // 申请：merchant包含"转卡", bankCardCode=AUCTION_PAYMENT_CARD, bankName=支付宝/支付寶
  const alipayBaoZhuanKaRecords = alipayRecords.filter(r =>
    r.merchant && (r.merchant.includes('转卡') || r.merchant.includes('轉卡')) &&
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付寶')
  );
  const alipayBaoZhuanKaCount = alipayBaoZhuanKaRecords.length;
  const alipayBaoZhuanKaAmount = alipayBaoZhuanKaRecords.reduce((sum, r) => sum + r.amount, 0);

  // 成功：merchant包含"转卡", bankCardCode=AUCTION_PAYMENT_CARD, bankName=支付宝/支付寶, receivedAmount<>0
  const alipayBaoZhuanKaSuccessRecords = alipayRecords.filter(r =>
    r.merchant && (r.merchant.includes('转卡') || r.merchant.includes('轉卡')) &&
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付寶') &&
    r.receivedAmount !== 0
  );
  const alipayBaoZhuanKaSuccessCount = alipayBaoZhuanKaSuccessRecords.length;
  const alipayBaoZhuanKaSuccessAmount = alipayBaoZhuanKaSuccessRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // ===== 支付寶 - 宝转宝渠道，配银行卡提现 =====（支援簡繁體）
  // 申请：merchant包含"支付宝/支付寶", bankCardCode=AUCTION_PAYMENT_CARD, bankName≠支付宝/支付寶
  const alipayBaoZhuanBaoRecords = alipayRecords.filter(r =>
    r.merchant && (r.merchant.includes('支付宝') || r.merchant.includes('支付寶')) &&
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' && r.bankName !== '支付寶'
  );
  const alipayBaoZhuanBaoCount = alipayBaoZhuanBaoRecords.length;
  const alipayBaoZhuanBaoAmount = alipayBaoZhuanBaoRecords.reduce((sum, r) => sum + r.amount, 0);

  // 成功：merchant包含"支付宝/支付寶", bankCardCode=AUCTION_PAYMENT_CARD, bankName≠支付宝/支付寶, receivedAmount<>0
  const alipayBaoZhuanBaoSuccessRecords = alipayRecords.filter(r =>
    r.merchant && (r.merchant.includes('支付宝') || r.merchant.includes('支付寶')) &&
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' && r.bankName !== '支付寶' &&
    r.receivedAmount !== 0
  );
  const alipayBaoZhuanBaoSuccessCount = alipayBaoZhuanBaoSuccessRecords.length;
  const alipayBaoZhuanBaoSuccessAmount = alipayBaoZhuanBaoSuccessRecords.reduce((sum, r) => sum + r.receivedAmount, 0);

  // ===== 支付寶 - 整体 配对成功/提现申请 =====
  // 分子：银行卡订单成功极速提金额 + 支付宝订单成功极速提(卡)金额 + 支付宝订单成功极速提(宝)金额
  const alipayOverallMatchNumerator =
    expressOrderSuccessAmount +
    alipayJisuTikaOrderSuccessAmount +
    alipayJisuTibaoOrderSuccessAmount;

  // 分母：支付宝提现申请金额 + 银行卡提现申请金额（来自提现分析）
  // 如果有提现数据，使用提现数据；否则使用充值数据中的宝转卡/宝转宝
  const withdrawBankCardAmount = withdrawMetrics?.bankCardWithdrawAmount || 0;
  const withdrawAlipayAmount = withdrawMetrics?.alipayWithdrawAmount || 0;
  const alipayOverallMatchDenominator = withdrawAlipayAmount + withdrawBankCardAmount;

  // 整体 配对成功/提现申请 百分比
  const alipayOverallMatchRate = alipayOverallMatchDenominator > 0
    ? (alipayOverallMatchNumerator / alipayOverallMatchDenominator) * 100
    : 0;

  // ===== 微信商户数据 =====
  // 数据范围：排除 test/qa/线下
  const wechatRecords = records.filter(r => {
    const hasWechat = r.merchant.includes('微信');
    const merchantLower = r.merchant.toLowerCase();
    const hasTest = merchantLower.includes('test');
    const hasQa = merchantLower.includes('qa');
    const hasOffline = r.merchant.includes('線下') || r.merchant.includes('线下');
    return hasWechat && !hasTest && !hasQa && !hasOffline;
  });

  // 微信 - 充值申请笔数（比照支付宝逻辑，4个分类）
  // 一般卡：银行卡代号有值、不等于AUCTION_PAYMENT_CARD、银行名称不为支付宝/支付宝(企)/微信支付（支援簡繁體）
  const wechatNormalCardForApp = wechatRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' && r.bankName !== '支付寶' &&
    r.bankName !== '支付宝(企)' && r.bankName !== '支付寶(企)' &&
    r.bankName !== '微信支付'
  );
  // 一般宝：银行卡代号有值且不等于AUCTION_PAYMENT_CARD、银行名称为支付宝/支付宝(企)/微信支付（支援簡繁體）
  const wechatExpressBaoForApp = wechatRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付寶' || r.bankName === '支付宝(企)' || r.bankName === '支付寶(企)' || r.bankName === '微信支付')
  );
  // 极速提(卡)：银行卡代号=AUCTION_PAYMENT_CARD、银行名称不为支付宝/支付宝(企)/微信支付（支援簡繁體）
  const wechatJisuTikaForApp = wechatRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' && r.bankName !== '支付寶' &&
    r.bankName !== '支付宝(企)' && r.bankName !== '支付寶(企)' &&
    r.bankName !== '微信支付'
  );
  // 极速提(宝)：银行卡代号=AUCTION_PAYMENT_CARD、银行名称为支付宝/支付宝(企)/微信支付（支援簡繁體）
  const wechatJisuTibaoForApp = wechatRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付寶' || r.bankName === '支付宝(企)' || r.bankName === '支付寶(企)' || r.bankName === '微信支付')
  );
  // 建单成功等待无配对：银行卡代号为空
  const wechatWaitingForMatchCount = wechatRecords.filter(r => !r.bankCardCode).length;

  const wechatApplicationCount = wechatNormalCardForApp.length + wechatExpressBaoForApp.length + wechatJisuTikaForApp.length + wechatJisuTibaoForApp.length;

  // 微信 - 成功配对（4个分类）
  const wechatNormalMatchCount = wechatNormalCardForApp.length;
  const wechatNormalMatchAmount = wechatNormalCardForApp.reduce((sum, r) => sum + r.amount, 0);
  const wechatExpressBaoMatchCount = wechatExpressBaoForApp.length;
  const wechatExpressBaoMatchAmount = wechatExpressBaoForApp.reduce((sum, r) => sum + r.amount, 0);
  const wechatJisuTikaMatchCount = wechatJisuTikaForApp.length;
  const wechatJisuTikaMatchAmount = wechatJisuTikaForApp.reduce((sum, r) => sum + r.amount, 0);
  const wechatJisuTibaoMatchCount = wechatJisuTibaoForApp.length;
  const wechatJisuTibaoMatchAmount = wechatJisuTibaoForApp.reduce((sum, r) => sum + r.amount, 0);
  const wechatTotalMatchCount = wechatNormalMatchCount + wechatExpressBaoMatchCount + wechatJisuTikaMatchCount + wechatJisuTibaoMatchCount;
  const wechatTotalMatchAmount = wechatNormalMatchAmount + wechatExpressBaoMatchAmount + wechatJisuTikaMatchAmount + wechatJisuTibaoMatchAmount;

  // 微信 - 订单成功（4个分类，比照支付宝）（支援簡繁體）
  // 一般卡
  const wechatNormalOrderSuccess = wechatRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' && r.bankName !== '支付寶' &&
    r.bankName !== '支付宝(企)' && r.bankName !== '支付寶(企)' &&
    r.bankName !== '微信支付' &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const wechatNormalOrderSuccessCount = wechatNormalOrderSuccess.length;
  const wechatNormalOrderSuccessAmount = wechatNormalOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 一般宝
  const wechatBaoOrderSuccess = wechatRecords.filter(r =>
    r.bankCardCode &&
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付寶' || r.bankName === '支付宝(企)' || r.bankName === '支付寶(企)' || r.bankName === '微信支付') &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const wechatBaoOrderSuccessCount = wechatBaoOrderSuccess.length;
  const wechatBaoOrderSuccessAmount = wechatBaoOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 极速提(卡)：到账金额>0, normalizedStatus有值且≠未充值/图文复核(已超时)/审核中(已超时)
  const wechatJisuTikaOrderSuccess = wechatRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    r.bankName !== '支付宝' && r.bankName !== '支付寶' &&
    r.bankName !== '支付宝(企)' && r.bankName !== '支付寶(企)' &&
    r.bankName !== '微信支付' &&
    r.receivedAmount > 0 &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const wechatJisuTikaOrderSuccessCount = wechatJisuTikaOrderSuccess.length;
  const wechatJisuTikaOrderSuccessAmount = wechatJisuTikaOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  // 极速提(宝)：到账金额>0, normalizedStatus有值且≠未充值/图文复核(已超时)/审核中(已超时)
  const wechatJisuTibaoOrderSuccess = wechatRecords.filter(r =>
    r.bankCardCode === 'AUCTION_PAYMENT_CARD' &&
    (r.bankName === '支付宝' || r.bankName === '支付寶' || r.bankName === '支付宝(企)' || r.bankName === '支付寶(企)' || r.bankName === '微信支付') &&
    r.receivedAmount > 0 &&
    r.normalizedStatus &&
    r.normalizedStatus !== '未充值' &&
    r.normalizedStatus !== '图文复核(已超时)' &&
    r.normalizedStatus !== '审核中(已超时)'
  );
  const wechatJisuTibaoOrderSuccessCount = wechatJisuTibaoOrderSuccess.length;
  const wechatJisuTibaoOrderSuccessAmount = wechatJisuTibaoOrderSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);

  const wechatTotalOrderSuccessCount = wechatNormalOrderSuccessCount + wechatBaoOrderSuccessCount + wechatJisuTikaOrderSuccessCount + wechatJisuTibaoOrderSuccessCount;
  const wechatTotalOrderSuccessAmount = wechatNormalOrderSuccessAmount + wechatBaoOrderSuccessAmount + wechatJisuTikaOrderSuccessAmount + wechatJisuTibaoOrderSuccessAmount;

  // 微信 - 信評上分
  const wechatCreditScoreSuccess = wechatRecords.filter(r =>
    r.receivedAmount > 0 && r.status && r.status.includes('信用')
  );
  const wechatCreditScoreSuccessCount = wechatCreditScoreSuccess.length;
  const wechatCreditScoreSuccessAmount = wechatCreditScoreSuccess.reduce((sum, r) => sum + r.receivedAmount, 0);
  const wechatCreditScoreWithTime = wechatCreditScoreSuccess.filter(r => r.processingTime !== null && r.processingTime >= 0);
  const wechatCreditScoreAvgTime = wechatCreditScoreWithTime.length > 0
    ? wechatCreditScoreWithTime.reduce((sum, r) => sum + r.processingTime, 0) / wechatCreditScoreWithTime.length
    : 0;

  // 微信 - 没信评降等配卡
  const wechatNoCreditDowngradeRecords = wechatRecords.filter(r =>
    r.bankCardCode !== 'AUCTION_PAYMENT_CARD' &&
    r.receivedAmount !== 0 &&
    parseFloat(r.userLevel) !== 0 &&
    parseFloat(r.userLevel) !== -1
  );
  const wechatNoCreditDowngradeTotal = wechatNoCreditDowngradeRecords.length;

  // 微信 - 没信评降等配卡 依据金额区间计算笔数
  const wechatNoCreditDowngradeByAmount = {};
  amountRanges.forEach(amt => {
    wechatNoCreditDowngradeByAmount[amt] = wechatNoCreditDowngradeRecords.filter(r => Math.round(r.amount) === amt).length;
  });
  // 其他金额
  wechatNoCreditDowngradeByAmount['other'] = wechatNoCreditDowngradeRecords.filter(r => !amountRanges.includes(Math.round(r.amount))).length;

  // 微信 - 平均时间（依據 CRITERIA 5.4：到帳金額>0 且 用戶等級≠0 且≠-1）
  const wechatNoCreditDowngradeForAvgTime = wechatRecords.filter(r => {
    const userLevel = parseFloat(r.userLevel) || 0;
    return r.receivedAmount > 0 &&
      userLevel !== 0 &&
      userLevel !== -1 &&
      r.processingTime !== null &&
      r.processingTime >= 0;
  });

  const wechatNoCreditDowngradeAvgTime = wechatNoCreditDowngradeForAvgTime.length > 0
    ? wechatNoCreditDowngradeForAvgTime.reduce((sum, r) => sum + r.processingTime, 0) / wechatNoCreditDowngradeForAvgTime.length
    : 0;

  // ===== 6. 商业平台 =====
  // 數據範圍：商戶以「外部商戶」開頭（依據 CRITERIA.md 3.9）
  const isCommercialPlatformMerchant = (merchant) => {
    if (!merchant) return false;
    return merchant.startsWith('外部商戶') || merchant.startsWith('外部商户');
  };

  // 收集商業平台商戶
  const commercialPlatformMap = new Map();
  records.forEach(r => {
    if (isCommercialPlatformMerchant(r.merchant)) {
      const merchantName = r.merchant;
      if (!commercialPlatformMap.has(merchantName)) {
        commercialPlatformMap.set(merchantName, {
          name: merchantName,
          applicationCount: 0,
          applicationAmount: 0,
          successCount: 0,
          successAmount: 0
        });
      }
      const data = commercialPlatformMap.get(merchantName);
      data.applicationCount++;
      data.applicationAmount += r.amount || 0;
      // 充值成功：狀態不含「未充值」且到帳金額>0
      const isUnpaid = r.status && r.status.includes('未充值');
      if (!isUnpaid && r.receivedAmount > 0) {
        data.successCount++;
        data.successAmount += r.receivedAmount || 0;
      }
    }
  });

  // 轉換為陣列並按申請筆數排序（降序）
  const commercialPlatformMerchants = Array.from(commercialPlatformMap.values())
    .sort((a, b) => b.applicationCount - a.applicationCount);

  // 計算商業平台總計
  const commercialPlatformTotalAppCount = commercialPlatformMerchants.reduce((sum, m) => sum + m.applicationCount, 0);
  const commercialPlatformTotalAppAmount = commercialPlatformMerchants.reduce((sum, m) => sum + m.applicationAmount, 0);
  const commercialPlatformTotalSuccessCount = commercialPlatformMerchants.reduce((sum, m) => sum + m.successCount, 0);
  const commercialPlatformTotalSuccessAmount = commercialPlatformMerchants.reduce((sum, m) => sum + m.successAmount, 0);

  // ===== JS充值等待最终无配对 =====
  // 公式：（銀行卡的建单成功等待无配对＋取无卡06提示）＋（支付寶的建单成功等待无配对＋取无卡06提示）
  // 建单成功等待无配对 = bankCardCode 为空的记录数
  // 取无卡06提示 = 暂带0（后续需调整，待提供06数据）

  // 銀行卡部分
  // 建单成功等待无配对：bankCardCode 为空
  const bankCardWaitingNoMatch = jisuRecords.filter(r => !r.bankCardCode || r.bankCardCode === '').length;
  // 取无卡06提示：暂带0（后续需从06数据计算）
  const bankCard06NoMatch = 0;
  const bankCardJsWaitingNoMatch = bankCardWaitingNoMatch + bankCard06NoMatch;

  // 支付寶部分
  // 建单成功等待无配对：bankCardCode 为空
  const alipayWaitingNoMatch = alipayRecords.filter(r => !r.bankCardCode || r.bankCardCode === '').length;
  // 取无卡06提示：暂带0（后续需从06数据计算）
  const alipay06NoMatch = 0;
  const alipayJsWaitingNoMatch = alipayWaitingNoMatch + alipay06NoMatch;

  // 总计
  const jsWaitingNoMatch = bankCardJsWaitingNoMatch + alipayJsWaitingNoMatch;

  // Debug: 輸出 JS充值等待最终无配对 計算詳情
  console.log('【JS充值等待最终无配对】', {
    '銀行卡建單無配對': bankCardWaitingNoMatch,
    '銀行卡06提示': bankCard06NoMatch,
    '銀行卡小計': bankCardJsWaitingNoMatch,
    '支付寶建單無配對': alipayWaitingNoMatch,
    '支付寶06提示': alipay06NoMatch,
    '支付寶小計': alipayJsWaitingNoMatch,
    '總計': jsWaitingNoMatch,
    'jisuRecords數量': jisuRecords.length,
    'alipayRecords數量': alipayRecords.length
  });

  return {
    // 全部-重要信息指标
    totalApplicationCount,
    successfulCount,
    overallSuccessRate,
    totalApplicationAmount,
    overallAvgTime,
    overallDropOrderCount: dropOrderCount,
    overallDropOrderRatio: dropOrderRatio,
    invalidApplicationCount,
    invalidApplicationRatio,

    // 充值分钟分析
    minuteAnalysisTotalCount,
    minuteAnalysisTotalAmount,
    minuteWithin2MinCount: minuteWithin2Min.length,
    minuteWithin2MinAmount,
    minuteWithin2MinRatio,
    minuteWithin2to3MinCount: minuteWithin2to3Min.length,
    minuteWithin2to3MinAmount,
    minuteWithin2to3MinRatio,
    minuteWithin3to5MinCount: minuteWithin3to5Min.length,
    minuteWithin3to5MinAmount,
    minuteWithin3to5MinRatio,
    minuteWithin5to15MinCount: minuteWithin5to15Min.length,
    minuteWithin5to15MinAmount,
    minuteWithin5to15MinRatio,
    minuteWithin15to30MinCount: minuteWithin15to30Min.length,
    minuteWithin15to30MinAmount,
    minuteWithin15to30MinRatio,
    minuteOver30MinCount: minuteOver30Min.length,
    minuteOver30MinAmount,
    minuteOver30MinRatio,
    minuteInvalidCount,
    minuteInvalidRatio,
    minuteDropCount,
    minuteDropRatio,
    minuteAvgTime,

    // 时间分布指标
    within2MinCount: within2Min.length,
    within2MinRatio: totalApplicationCount > 0 ? (within2Min.length / totalApplicationCount) * 100 : 0,
    within3to5MinCount: within3to5Min.length,
    within3to5MinRatio: totalApplicationCount > 0 ? (within3to5Min.length / totalApplicationCount) * 100 : 0,
    within5to15MinCount: within5to15Min.length,
    within5to15MinRatio: totalApplicationCount > 0 ? (within5to15Min.length / totalApplicationCount) * 100 : 0,
    within15to30MinCount: within15to30Min.length,
    within15to30MinRatio: totalApplicationCount > 0 ? (within15to30Min.length / totalApplicationCount) * 100 : 0,
    over30MinCount: over30Min.length,
    over30MinRatio: totalApplicationCount > 0 ? (over30Min.length / totalApplicationCount) * 100 : 0,
    invalidCount: invalidRecords.length,
    invalidRatio: totalBase > 0 ? (invalidRecords.length / totalBase) * 100 : 0,
    avgTimeSeconds: avgTime,
    medianTimeSeconds: medianTime,

    // 极速区域指标
    // 1. 充值申请
    jisuApplicationCount,
    jisuApplicationAmount,
    normalCardAppCount: normalCardForApp.length,
    normalCardAppAmount,
    expressCardAppCount: expressCardForApp.length,
    expressCardAppAmount,
    waitingForMatchCount,
    waitingForMatchAmount,
    noCard06Count,
    // 2. 成功配对
    normalMatchCount,
    normalMatchAmount,
    expressMatchCount,
    expressMatchAmount,
    totalMatchCount,
    totalMatchAmount,
    // 3. 订单成功
    normalOrderSuccessCount,
    normalOrderSuccessAmount,
    expressOrderSuccessCount,
    expressOrderSuccessAmount,
    creditScoreSuccessCount,
    creditScoreSuccessAmount,
    creditScoreAvgTime,
    totalOrderSuccessCount,
    totalOrderSuccessAmount,
    // 4. 没信评降等配卡
    noCreditDowngradeTotal,
    noCreditDowngradeByAmount,
    noCreditDowngradeAvgTime,
    // 5. c2c
    c2cCount,
    c2cAmount,
    c2cConfirmCount,
    c2cConfirmAvgTime,
    c2cManualAuditCount,
    c2cAuditSuccessAvgTime,
    c2cOver11MinSuccessCount,
    // 6. 三方代收（銀行卡）
    thirdPartyCount,
    thirdPartyAmount,
    thirdPartyDahaomenCount,
    thirdPartyDahaomenAmount,
    thirdPartyHuitongCount,
    thirdPartyHuitongAmount,
    thirdPartyDoudouCount,
    thirdPartyDoudouAmount,
    thirdPartyUCCount,
    thirdPartyUCAmount,
    thirdPartyOtherCount,
    thirdPartyOtherAmount,
    // 支付宝商户
    alipayApplicationCount,
    alipayNormalCardAppCount: alipayNormalCardForApp.length,
    alipayExpressCardAppCount,
    alipayJisuTikaCount,
    alipayWaitingForMatchCount,
    alipayJisuTibaoCount,
    alipayNormalMatchCount,
    alipayNormalMatchAmount,
    alipayExpressBaoMatchAmount,
    alipayJisuTikaMatchAmount,
    alipayJisuTibaoMatchAmount,
    alipayTotalMatchCount,
    alipayTotalMatchAmount,
    alipayNormalOrderSuccessCount,
    alipayNormalOrderSuccessAmount,
    alipayBaoOrderSuccessCount,
    alipayBaoOrderSuccessAmount,
    alipayJisuTikaOrderSuccessCount,
    alipayJisuTikaOrderSuccessAmount,
    alipayJisuTibaoOrderSuccessCount,
    alipayJisuTibaoOrderSuccessAmount,
    alipayCreditScoreSuccessCount,
    alipayCreditScoreSuccessAmount,
    alipayCreditScoreAvgTime,
    alipayCreditNoTuwenCount,
    alipayCreditNoTuwenAvgTime,
    alipayTotalOrderSuccessCount,
    alipayTotalOrderSuccessAmount,
    alipayNoCreditDowngradeTotal,
    alipayNoCreditDowngradeByAmount,
    alipayNoCreditDowngradeAvgTime,
    // 支付寶 c2c
    alipayC2cCount,
    alipayC2cAmount,
    alipayC2cConfirmCount,
    alipayC2cConfirmAvgTime,
    alipayC2cManualAuditCount,
    alipayC2cAuditSuccessAvgTime,
    alipayC2cOver11MinSuccessCount,
    // 支付寶 - 三方代收
    alipayThirdPartyCount,
    alipayThirdPartyAmount,
    alipayThirdPartyDahaomenCount,
    alipayThirdPartyDahaomenAmount,
    alipayThirdPartyHuitongCount,
    alipayThirdPartyHuitongAmount,
    alipayThirdPartyDoudouCount,
    alipayThirdPartyDoudouAmount,
    alipayThirdPartyUCCount,
    alipayThirdPartyUCAmount,
    alipayThirdPartyOtherCount,
    alipayThirdPartyOtherAmount,
    // 支付寶 - 宝转卡/宝转宝
    alipayBaoZhuanKaCount,
    alipayBaoZhuanKaAmount,
    alipayBaoZhuanKaSuccessCount,
    alipayBaoZhuanKaSuccessAmount,
    alipayBaoZhuanBaoCount,
    alipayBaoZhuanBaoAmount,
    alipayBaoZhuanBaoSuccessCount,
    alipayBaoZhuanBaoSuccessAmount,
    alipayOverallMatchRate,
    // 微信商户（比照支付宝4个分类）
    wechatApplicationCount,
    wechatNormalCardAppCount: wechatNormalCardForApp.length,
    wechatExpressBaoAppCount: wechatExpressBaoForApp.length,
    wechatJisuTikaCount: wechatJisuTikaForApp.length,
    wechatJisuTibaoCount: wechatJisuTibaoForApp.length,
    wechatWaitingForMatchCount,
    // 成功配对
    wechatNormalMatchCount,
    wechatNormalMatchAmount,
    wechatExpressBaoMatchCount,
    wechatExpressBaoMatchAmount,
    wechatJisuTikaMatchCount,
    wechatJisuTikaMatchAmount,
    wechatJisuTibaoMatchCount,
    wechatJisuTibaoMatchAmount,
    wechatTotalMatchCount,
    wechatTotalMatchAmount,
    // 订单成功
    wechatNormalOrderSuccessCount,
    wechatNormalOrderSuccessAmount,
    wechatBaoOrderSuccessCount,
    wechatBaoOrderSuccessAmount,
    wechatJisuTikaOrderSuccessCount,
    wechatJisuTikaOrderSuccessAmount,
    wechatJisuTibaoOrderSuccessCount,
    wechatJisuTibaoOrderSuccessAmount,
    wechatCreditScoreSuccessCount,
    wechatCreditScoreSuccessAmount,
    wechatCreditScoreAvgTime,
    wechatTotalOrderSuccessCount,
    wechatTotalOrderSuccessAmount,
    wechatNoCreditDowngradeTotal,
    wechatNoCreditDowngradeByAmount,
    wechatNoCreditDowngradeAvgTime,

    // 6. 商业平台 - CNX交易所 + 外部商戶_500彩
    commercialPlatformMerchants,
    commercialPlatformTotalAppCount,
    commercialPlatformTotalAppAmount,
    commercialPlatformTotalSuccessCount,
    commercialPlatformTotalSuccessAmount,

    // 旧指标 (保留兼容)
    totalAmount,
    totalCount: records.filter(r => r.receivedAmount > 0).length,
    autoSuccessCount: successRecords.length,
    dropOrderCount: buDanRecords.length,
    dropOrderRatio: totalApplicationCount > 0 ? (buDanRecords.length / totalApplicationCount) * 100 : 0,
    successRate: totalBase > 0 ? (successRecords.length / totalBase) * 100 : 0,

    // JS充值等待最终无配对
    jsWaitingNoMatch,
    bankCardJsWaitingNoMatch,
    alipayJsWaitingNoMatch
  };
};
