export const calculateWithdrawMetrics = (records, depositMetrics = null) => {
  const startTime = performance.now();
  const TIMEOUT_MS = 180000; // 180秒超时

  // ===== 依據 CRITERIA 6.1：商戶分類過濾 (銀行卡 + 支付寶 + 微信) + 線下 =====
  const isInCategory = (r) => {
    const merchant = r.merchant || '';
    const merchantLower = merchant.toLowerCase();

    // 先排除 test/qa
    if (merchantLower.includes('test') || merchantLower.includes('qa')) {
      return false;
    }

    const hasJiSu = merchant.includes('极速充提3');
    const hasAlipay = merchant.includes('支付宝') || merchant.includes('支付寶');
    const hasWechat = merchant.includes('微信');
    const hasOffline = merchant.includes('线下') || merchant.includes('線下');

    // 銀行卡：商戶含「极速充提3」且不含支付寶/微信
    const isInBankCard = hasJiSu && !hasAlipay && !hasWechat;
    // 支付寶：商戶含「支付宝/支付寶」
    const isInAlipay = hasAlipay;
    // 微信：商戶含「微信」
    const isInWechat = hasWechat;
    // 線下：商戶含「线下/線下」且不含支付寶/微信/极速充提3
    const isInOffline = hasOffline && !hasAlipay && !hasWechat && !hasJiSu;

    return isInBankCard || isInAlipay || isInWechat || isInOffline;
  };

  const filteredRecords = records.filter(isInCategory);
  console.log(`提現商戶分類過濾（CRITERIA 6.1）：原始 ${records.length} 筆 → 過濾後 ${filteredRecords.length} 筆`);

  // 調試：如果過濾後為空，顯示前5筆記錄的商戶名稱
  if (filteredRecords.length === 0 && records.length > 0) {
    console.log('【警告】所有記錄都被商戶過濾排除！前5筆商戶名稱：');
    for (let i = 0; i < Math.min(5, records.length); i++) {
      console.log(`  [${i}] merchant="${records[i].merchant}"`);
    }
    console.log('提示：商戶需包含「极速充提3」「支付宝」「支付寶」「微信」「线下」「線下」之一');
  }

  // ===== 单次遍历处理去重和分类 =====
  const uniqueWithdrawRecords = {};
  const len = filteredRecords.length;

  // 累加器
  let autoWithdrawTimeSum = 0, autoWithdrawTimeCount = 0;
  let bankCardWithdrawCount = 0, bankCardWithdrawAmount = 0;
  let bankCardAvgTimeSum = 0, bankCardAvgTimeCount = 0;
  let alipayWithdrawCount = 0, alipayWithdrawAmount = 0;
  let alipayAvgTimeSum = 0, alipayAvgTimeCount = 0;
  let wechatWithdrawCount = 0, wechatWithdrawAmount = 0;
  let wechatAvgTimeSum = 0, wechatAvgTimeCount = 0;

  // 去重前失败计数（调试用）
  let beforeDedupeFailedCount = 0;
  // 實際轉出金額=0或空白的筆數
  let actualAmountZeroOrEmptyCount = 0;

  // 第一次遍历：去重 + 计算渠道指标
  for (let i = 0; i < len; i++) {
    const r = filteredRecords[i];

    // 去重保留最后一笔
    uniqueWithdrawRecords[r.id] = r;

    // 计算去重前的失败笔数（调试用）
    const transferStatusCheck = r.transferStatus || '';
    const actualAmountCheck = r.actualAmount || 0;
    const statusCheck = r.status || '';
    const isTransferNotCompleteCheck = transferStatusCheck !== '轉帳完成' && transferStatusCheck !== '转帐完成' && transferStatusCheck !== '转账完成';
    const isActualAmountEmptyCheck = actualAmountCheck === 0 || actualAmountCheck === '' || actualAmountCheck === null || actualAmountCheck === undefined;
    const isStatusNotCompleteCheck = !statusCheck.includes('提現完成') && !statusCheck.includes('提现完成');
    if (isTransferNotCompleteCheck && isActualAmountEmptyCheck && isStatusNotCompleteCheck) {
      beforeDedupeFailedCount++;
    }

    // 統計實際轉出金額=0或空白的筆數
    if (isActualAmountEmptyCheck) {
      actualAmountZeroOrEmptyCount++;
    }

    // 平均处理时间：轉帳成功 + 實際轉出金額 ≠ 0
    const transferStatusField = r.transferStatus || '';
    const isTransferSuccessForAvg = transferStatusField === '轉帳完成' || transferStatusField === '转帐完成' || transferStatusField === '转账完成';
    const isStatusSuccessForAvg = (r.status || '').includes('提現完成') || (r.status || '').includes('提现完成');
    const actualAmountForAvg = r.actualAmount || 0;
    if ((isTransferSuccessForAvg || isStatusSuccessForAvg) && actualAmountForAvg !== 0 && r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0) {
      autoWithdrawTimeSum += r.avgTimeSeconds;
      autoWithdrawTimeCount++;
    }

    // 首次调试：输出第一条符合条件的记录详情
    if (i === 0 && r.isAutoWithdraw !== undefined) {
      console.log('提现第一条记录 isAutoWithdraw:', r.isAutoWithdraw, 'avgTimeSeconds:', r.avgTimeSeconds);
    }

    // 渠道判斷：優先使用 remark（已根據收款銀行 > 出款商戶優先順序計算）
    const channelRemark = r.remark || '';
    const isBankCardChannel = channelRemark === '银行卡';
    const isAlipayChannel = channelRemark === '支付宝';
    const isWechatChannel = channelRemark === '微信';

    // 银行卡渠道：remark=银行卡，申請金額 > 0
    if (isBankCardChannel && r.requestAmount > 0) {
      bankCardWithdrawCount++;
      bankCardWithdrawAmount += r.payoutAmount || 0;
    }

    // 银行卡平均时间：remark=银行卡 且 轉帳完成（僅限轉帳完成，不含提現完成）
    const isTransferComplete = transferStatusField === '轉帳完成' || transferStatusField === '转账完成' || transferStatusField === '转帐完成';
    const isSuccessForChannelAvg = isTransferComplete || isStatusSuccessForAvg;
    if (isBankCardChannel && isSuccessForChannelAvg && r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0) {
      bankCardAvgTimeSum += r.avgTimeSeconds;
      bankCardAvgTimeCount++;
    }

    // 支付宝渠道：remark=支付宝，申請金額 > 0
    if (isAlipayChannel && r.requestAmount > 0) {
      alipayWithdrawCount++;
      alipayWithdrawAmount += r.payoutAmount || 0;
    }

    // 支付宝平均时间：remark=支付宝 且 轉帳完成/提現完成
    if (isAlipayChannel && isSuccessForChannelAvg && r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0) {
      alipayAvgTimeSum += r.avgTimeSeconds;
      alipayAvgTimeCount++;
    }

    // 微信渠道：remark=微信，申請金額 > 0
    if (isWechatChannel && r.requestAmount > 0) {
      wechatWithdrawCount++;
      wechatWithdrawAmount += r.payoutAmount || 0;
    }

    // 微信平均时间：remark=微信 且 轉帳完成/提現完成
    if (isWechatChannel && isSuccessForChannelAvg && r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0) {
      wechatAvgTimeSum += r.avgTimeSeconds;
      wechatAvgTimeCount++;
    }
  }

  // 输出去重前后的失败笔数对比
  console.log(`【提現失敗統計】去重前: ${beforeDedupeFailedCount} 筆, 總記錄數: ${len} 筆`);
  console.log(`【實際轉出金額統計】實際轉出金額=0或空白: ${actualAmountZeroOrEmptyCount} 筆`);

  // 第二次遍历：去重后的记录处理成功/失败和时间区段
  const deduplicatedRecords = Object.values(uniqueWithdrawRecords);
  const uniqueOrderCount = deduplicatedRecords.length;

  let withdrawFailedCount = 0;
  let totalWithdrawCount = 0, totalWithdrawAmount = 0;

  // 去重後的渠道統計（用於對比）
  let bankCardWithdrawCountDeduped = 0, bankCardWithdrawAmountDeduped = 0;
  let alipayWithdrawCountDeduped = 0, alipayWithdrawAmountDeduped = 0;
  let wechatWithdrawCountDeduped = 0, wechatWithdrawAmountDeduped = 0;

  // 去重後的渠道平均時間（修正：在去重後計算，使用正確的成功條件）
  let bankCardAvgTimeSumDeduped = 0, bankCardAvgTimeCountDeduped = 0;
  let alipayAvgTimeSumDeduped = 0, alipayAvgTimeCountDeduped = 0;
  let wechatAvgTimeSumDeduped = 0, wechatAvgTimeCountDeduped = 0;
  // 全部渠道平均時間（去重後）
  let overallAvgTimeSumDeduped = 0, overallAvgTimeCountDeduped = 0;

  // 调试：统计 status 字段的不同值
  const statusCounts = {};
  let withdrawWithin2MinCount = 0, withdrawWithin2MinAmount = 0;
  let withdrawWithin2to5MinCount = 0, withdrawWithin2to5MinAmount = 0;
  let withdrawWithin5to15MinCount = 0, withdrawWithin5to15MinAmount = 0;
  let withdrawWithin15to30MinCount = 0, withdrawWithin15to30MinAmount = 0;
  let withdrawOver30MinCount = 0, withdrawOver30MinAmount = 0;

  for (let i = 0; i < deduplicatedRecords.length; i++) {
    const r = deduplicatedRecords[i];
    const transferStatus = r.transferStatus || '';
    const status = r.status || '';
    const actualAmount = r.actualAmount || 0;

    // 調試：輸出前3筆記錄的關鍵字段
    if (i < 3) {
      console.log(`【提現記錄 #${i}】transferStatus="${transferStatus}", status="${status}", actualAmount=${actualAmount}, merchant="${r.merchant}"`);
    }

    // 调试：统计 status 值
    const statusKey = status || '(空)';
    statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;

    // 判断提现是否成功：
    // (說明=轉帳完成/转账完成/转帐完成 OR 提現狀態含提現完成/提现完成) AND 實際轉出金額 ≠ 0
    const isTransferStatusValid = transferStatus === '轉帳完成' || transferStatus === '转帐完成' || transferStatus === '转账完成';
    const isStatusSuccess = status.includes('提現完成') || status.includes('提现完成');
    const hasActualAmount = actualAmount !== 0;
    const isWithdrawSuccess = (isTransferStatusValid || isStatusSuccess) && hasActualAmount;

    // 提现失败（依據 CRITERIA.md 6.3）：
    // 說明≠轉帳完成 且 實際轉出金額=空白或0 且 提現狀態≠提現完成
    const isTransferNotComplete = !isTransferStatusValid && !isStatusSuccess;
    const isActualAmountEmpty = actualAmount === 0 || actualAmount === '' || actualAmount === null || actualAmount === undefined;
    const isWithdrawFailed = isTransferNotComplete && isActualAmountEmpty;
    if (isWithdrawFailed) {
      withdrawFailedCount++;
    }

    // 提现成功
    if (isWithdrawSuccess) {
      totalWithdrawCount++;
      totalWithdrawAmount += actualAmount;

      // 时间区段
      const seconds = r.avgTimeSeconds !== null ? Math.round(r.avgTimeSeconds) : null;
      if (seconds !== null && seconds >= 0) {
        if (seconds < 120) {
          withdrawWithin2MinCount++;
          withdrawWithin2MinAmount += actualAmount;
        } else if (seconds < 300) {
          withdrawWithin2to5MinCount++;
          withdrawWithin2to5MinAmount += actualAmount;
        } else if (seconds < 900) {
          withdrawWithin5to15MinCount++;
          withdrawWithin5to15MinAmount += actualAmount;
        } else if (seconds < 1800) {
          withdrawWithin15to30MinCount++;
          withdrawWithin15to30MinAmount += actualAmount;
        } else {
          withdrawOver30MinCount++;
          withdrawOver30MinAmount += actualAmount;
        }
      }
    }

    // 去重後的渠道統計：使用 remark（收款銀行優先 > 出款商戶）
    const channelRemarkDeduped = r.remark || '';
    const isBankCardChannelDeduped = channelRemarkDeduped === '银行卡';
    const isAlipayChannelDeduped = channelRemarkDeduped === '支付宝';
    const isWechatChannelDeduped = channelRemarkDeduped === '微信';

    if (isBankCardChannelDeduped && r.requestAmount > 0) {
      bankCardWithdrawCountDeduped++;
      bankCardWithdrawAmountDeduped += r.payoutAmount || 0;
    }
    if (isAlipayChannelDeduped && r.requestAmount > 0) {
      alipayWithdrawCountDeduped++;
      alipayWithdrawAmountDeduped += r.payoutAmount || 0;
    }
    if (isWechatChannelDeduped && r.requestAmount > 0) {
      wechatWithdrawCountDeduped++;
      wechatWithdrawAmountDeduped += r.payoutAmount || 0;
    }

    // 渠道平均時間（去重後，僅限轉帳完成，不含提現完成）
    if ((isTransferStatusValid || isStatusSuccess) && hasActualAmount && r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0) {
      // 全部渠道
      overallAvgTimeSumDeduped += r.avgTimeSeconds;
      overallAvgTimeCountDeduped++;
      // 銀行卡渠道
      if (isBankCardChannelDeduped) {
        bankCardAvgTimeSumDeduped += r.avgTimeSeconds;
        bankCardAvgTimeCountDeduped++;
      }
      // 支付寶渠道
      if (isAlipayChannelDeduped) {
        alipayAvgTimeSumDeduped += r.avgTimeSeconds;
        alipayAvgTimeCountDeduped++;
      }
      // 微信渠道
      if (isWechatChannelDeduped) {
        wechatAvgTimeSumDeduped += r.avgTimeSeconds;
        wechatAvgTimeCountDeduped++;
      }
    }
  }

  // 輸出去重前後渠道統計對比
  console.log(`【渠道去重對比】銀行卡 - 去重前: ${bankCardWithdrawCount}筆/${bankCardWithdrawAmount}元, 去重後: ${bankCardWithdrawCountDeduped}筆/${bankCardWithdrawAmountDeduped}元`);
  console.log(`【渠道去重對比】支付寶 - 去重前: ${alipayWithdrawCount}筆/${alipayWithdrawAmount}元, 去重後: ${alipayWithdrawCountDeduped}筆/${alipayWithdrawAmountDeduped}元`);
  console.log(`【渠道去重對比】微信 - 去重前: ${wechatWithdrawCount}筆/${wechatWithdrawAmount}元, 去重後: ${wechatWithdrawCountDeduped}筆/${wechatWithdrawAmountDeduped}元`);

  // 计算衍生指标
  // 总提现申请笔数 = 提現成功筆數 + 提現失敗筆數（依據 CRITERIA.md 6.4）
  const withdrawSuccessTotalCount = totalWithdrawCount + withdrawFailedCount;
  const withdrawSuccessTotalAmount = totalWithdrawAmount;
  const totalBase = withdrawSuccessTotalCount || 1;

  const withdrawWithin2MinRatio = (withdrawWithin2MinCount / totalBase) * 100;
  const withdrawWithin2to5MinRatio = (withdrawWithin2to5MinCount / totalBase) * 100;
  const withdrawWithin5to15MinRatio = (withdrawWithin5to15MinCount / totalBase) * 100;
  const withdrawWithin15to30MinRatio = (withdrawWithin15to30MinCount / totalBase) * 100;
  const withdrawOver30MinRatio = (withdrawOver30MinCount / totalBase) * 100;

  const withdrawSuccessRate = withdrawSuccessTotalCount > 0 ? (totalWithdrawCount / withdrawSuccessTotalCount) * 100 : 0;
  // 平均處理時間（使用去重後的數據，符合準則：轉帳完成 且 實際轉出金額≠0）
  const avgProcessingTime = overallAvgTimeCountDeduped > 0 ? overallAvgTimeSumDeduped / overallAvgTimeCountDeduped : 0;

  // 调试：输出平均处理时间计算详情（對比去重前後）
  console.log('【提現分析-整體提現】', {
    '去重後記錄數': uniqueOrderCount,
    '成功筆數': totalWithdrawCount,
    '有時間的筆數': overallAvgTimeCountDeduped,
    '時間總和': overallAvgTimeSumDeduped.toFixed(2),
    '平均時間': avgProcessingTime.toFixed(2) + '秒',
    '格式化': `${Math.floor(avgProcessingTime / 60)}:${Math.floor(avgProcessingTime % 60).toString().padStart(2, '0')}`
  });

  // 平均时间（使用去重後的數據，符合準則：轉帳完成 且 實際轉出金額≠0）
  const bankCardAvgTime = bankCardAvgTimeCountDeduped > 0 ? bankCardAvgTimeSumDeduped / bankCardAvgTimeCountDeduped : 0;
  const alipayAvgTime = alipayAvgTimeCountDeduped > 0 ? alipayAvgTimeSumDeduped / alipayAvgTimeCountDeduped : 0;
  const wechatAvgTime = wechatAvgTimeCountDeduped > 0 ? wechatAvgTimeSumDeduped / wechatAvgTimeCountDeduped : 0;

  // 調試：輸出去重前後平均時間對比
  console.log('【渠道平均時間對比】銀行卡 - 去重前:', bankCardAvgTimeCount > 0 ? (bankCardAvgTimeSum / bankCardAvgTimeCount).toFixed(2) + '秒' : 'N/A',
    '去重後:', bankCardAvgTimeCountDeduped > 0 ? (bankCardAvgTimeSumDeduped / bankCardAvgTimeCountDeduped).toFixed(2) + '秒' : 'N/A');
  console.log('【渠道平均時間對比】支付寶 - 去重前:', alipayAvgTimeCount > 0 ? (alipayAvgTimeSum / alipayAvgTimeCount).toFixed(2) + '秒' : 'N/A',
    '去重後:', alipayAvgTimeCountDeduped > 0 ? (alipayAvgTimeSumDeduped / alipayAvgTimeCountDeduped).toFixed(2) + '秒' : 'N/A');
  console.log('【渠道平均時間對比】微信 - 去重前:', wechatAvgTimeCount > 0 ? (wechatAvgTimeSum / wechatAvgTimeCount).toFixed(2) + '秒' : 'N/A',
    '去重後:', wechatAvgTimeCountDeduped > 0 ? (wechatAvgTimeSumDeduped / wechatAvgTimeCountDeduped).toFixed(2) + '秒' : 'N/A');

  // 配对率
  let bankCardMatchRate = 0;
  if (depositMetrics && depositMetrics.jisuApplicationCount > 0) {
    bankCardMatchRate = depositMetrics.totalMatchCount / depositMetrics.jisuApplicationCount;
  }
  let bankCardSuccessAfterMatchRate = 0;
  if (depositMetrics && depositMetrics.totalMatchCount > 0) {
    bankCardSuccessAfterMatchRate = depositMetrics.totalOrderSuccessCount / depositMetrics.totalMatchCount;
  }
  let alipayMatchRate = 0;
  if (depositMetrics && depositMetrics.alipayApplicationCount > 0) {
    alipayMatchRate = depositMetrics.alipayTotalMatchCount / depositMetrics.alipayApplicationCount;
  }
  let alipaySuccessAfterMatchRate = 0;
  if (depositMetrics && depositMetrics.alipayTotalMatchCount > 0) {
    alipaySuccessAfterMatchRate = depositMetrics.alipayTotalOrderSuccessCount / depositMetrics.alipayTotalMatchCount;
  }
  let wechatMatchRate = 0;
  if (depositMetrics && depositMetrics.wechatApplicationCount > 0) {
    wechatMatchRate = depositMetrics.wechatTotalMatchCount / depositMetrics.wechatApplicationCount;
  }
  let wechatSuccessAfterMatchRate = 0;
  if (depositMetrics && depositMetrics.wechatTotalMatchCount > 0) {
    wechatSuccessAfterMatchRate = depositMetrics.wechatTotalOrderSuccessCount / depositMetrics.wechatTotalMatchCount;
  }

  const elapsed = performance.now() - startTime;
  // 调试：输出 status 统计
  console.log('提现 status 字段统计:', JSON.stringify(statusCounts));
  console.log('提现成功笔数:', totalWithdrawCount, '失败笔数:', withdrawFailedCount, '总申请:', totalWithdrawCount + withdrawFailedCount);
  console.log(`calculateWithdrawMetrics 完成，耗时: ${elapsed.toFixed(2)}ms，处理 ${len} 条记录`);

  return {
    totalWithdrawCount,
    totalWithdrawAmount,
    avgProcessingTime,
    totalRecords: uniqueOrderCount,
    // 提現成功時間區段
    withdrawSuccessTotalCount,
    withdrawSuccessTotalAmount,
    withdrawWithin2MinCount,
    withdrawWithin2MinAmount,
    withdrawWithin2to5MinCount,
    withdrawWithin2to5MinAmount,
    withdrawWithin5to15MinCount,
    withdrawWithin5to15MinAmount,
    withdrawWithin15to30MinCount,
    withdrawWithin15to30MinAmount,
    withdrawOver30MinCount,
    withdrawOver30MinAmount,
    // 百分比
    withdrawWithin2MinRatio,
    withdrawWithin2to5MinRatio,
    withdrawWithin5to15MinRatio,
    withdrawWithin15to30MinRatio,
    withdrawOver30MinRatio,
    // 新增指標
    withdrawSuccessRate,
    withdrawFailedCount,
    // 銀行卡（使用去重後數據）
    bankCardWithdrawCount: bankCardWithdrawCountDeduped,
    bankCardWithdrawAmount: bankCardWithdrawAmountDeduped,
    bankCardAvgTime,
    bankCardMatchRate,
    bankCardSuccessAfterMatchRate,
    bankCardDepositMatchCount: depositMetrics?.totalMatchCount || 0,
    bankCardDepositMatchAmount: depositMetrics?.totalMatchAmount || 0,
    bankCardDepositAppCount: depositMetrics?.jisuApplicationCount || 0,
    bankCardDepositAppAmount: depositMetrics?.jisuApplicationAmount || 0,
    bankCardDepositSuccessCount: depositMetrics?.totalOrderSuccessCount || 0,
    bankCardDepositSuccessAmount: depositMetrics?.totalOrderSuccessAmount || 0,
    // 支付寶（使用去重後數據）
    alipayWithdrawCount: alipayWithdrawCountDeduped,
    alipayWithdrawAmount: alipayWithdrawAmountDeduped,
    alipayAvgTime,
    alipayMatchRate,
    alipaySuccessAfterMatchRate,
    alipayDepositMatchCount: depositMetrics?.alipayTotalMatchCount || 0,
    alipayDepositMatchAmount: depositMetrics?.alipayTotalMatchAmount || 0,
    alipayDepositAppCount: depositMetrics?.alipayApplicationCount || 0,
    alipayDepositAppAmount: depositMetrics?.alipayApplicationAmount || 0,
    alipayDepositSuccessCount: depositMetrics?.alipayTotalOrderSuccessCount || 0,
    alipayDepositSuccessAmount: depositMetrics?.alipayTotalOrderSuccessAmount || 0,
    // 微信（使用去重後數據）
    wechatWithdrawCount: wechatWithdrawCountDeduped,
    wechatWithdrawAmount: wechatWithdrawAmountDeduped,
    wechatAvgTime,
    wechatMatchRate,
    wechatSuccessAfterMatchRate,
    wechatDepositMatchCount: depositMetrics?.wechatTotalMatchCount || 0,
    wechatDepositMatchAmount: depositMetrics?.wechatTotalMatchAmount || 0,
    wechatDepositAppCount: depositMetrics?.wechatApplicationCount || 0,
    wechatDepositAppAmount: depositMetrics?.wechatApplicationAmount || 0,
    wechatDepositSuccessCount: depositMetrics?.wechatTotalOrderSuccessCount || 0,
    wechatDepositSuccessAmount: depositMetrics?.wechatTotalOrderSuccessAmount || 0
  };
};
