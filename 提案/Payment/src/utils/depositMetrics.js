import { AUCTION_CARD, AMOUNT_RANGES } from './constants';

// ===== 优化版计算函数 - 使用单次遍历 =====
export const calculateMetrics = (records, withdrawMetrics = null, dataDate = null) => {
  const startTime = performance.now();
  const TIMEOUT_MS = 180000; // 180秒超时

  // 超时检查函数
  const checkTimeout = () => {
    if (performance.now() - startTime > TIMEOUT_MS) {
      throw new Error('计算超时，请减少数据量后重试');
    }
  };

  // ===== 预定义常量和帮助函数 =====
  const amountRanges = AMOUNT_RANGES;
  const amountRangesSet = new Set(amountRanges);

  // 读取三方代收配置（从 localStorage）
  let configuredThirdPartyCards = [];
  try {
    const saved = localStorage.getItem('thirdPartyBankCards');
    if (saved) {
      configuredThirdPartyCards = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load thirdPartyBankCards from localStorage:', e);
  }

  // 三方代收判断函数 - 检查是否匹配配置的卡代号
  const matchConfiguredCard = (code) => {
    if (!code) return null;
    const codeLower = code.toLowerCase();
    for (const card of configuredThirdPartyCards) {
      if (codeLower.startsWith(card.cardNumber.toLowerCase())) {
        return card;
      }
    }
    return null;
  };

  // 判断是否为配置的三方代收
  const isConfiguredThirdParty = (code) => matchConfiguredCard(code) !== null;

  // 旧的三方代收判断函数（作为后备）
  const isThirdPartyDahaomen = (code) => code && (code.toLowerCase().startsWith('gb-dahaomen') || code.toLowerCase().startsWith('dahaomen'));
  const isThirdPartyHuitong = (code) => code && code.toLowerCase().startsWith('htc2c');
  const isThirdPartyDoudou = (code) => code && code.toLowerCase().startsWith('ddf');
  const isThirdPartyUC = (code) => code && code.toLowerCase().startsWith('uc1020');
  const isKnownThirdParty = (code) => isThirdPartyHuitong(code) || isThirdPartyDoudou(code) || isThirdPartyUC(code);

  // ===== 初始化累加器 =====
  // 全局指标
  let successfulCount = 0, successfulAmount = 0;
  let invalidApplicationCount = 0;
  let dropOrderCount = 0;
  let recordsWithAmountAndTimeSum = 0, recordsWithAmountAndTimeCount = 0;

  // 分钟分析
  let minuteAnalysisTotalCount = 0, minuteAnalysisTotalAmount = 0;
  let minuteWithin2MinCount = 0, minuteWithin2MinAmount = 0;
  let minuteWithin2to3MinCount = 0, minuteWithin2to3MinAmount = 0;
  let minuteWithin3to5MinCount = 0, minuteWithin3to5MinAmount = 0;
  let minuteWithin5to15MinCount = 0, minuteWithin5to15MinAmount = 0;
  let minuteWithin15to30MinCount = 0, minuteWithin15to30MinAmount = 0;
  let minuteOver30MinCount = 0, minuteOver30MinAmount = 0;
  let minuteInvalidCount = 0, minuteDropCount = 0;
  let minuteAnalysisTimeSum = 0, minuteAnalysisTimeCount = 0;

  // 旧时间分布
  let within2MinCount = 0, within3to5MinCount = 0, within5to15MinCount = 0, within15to30MinCount = 0, over30MinCount = 0;
  let validRecordsCount = 0, invalidRecordsCount = 0;
  let validWithTimeSum = 0, validWithTimeCount = 0;
  const sortedTimesArray = [];

  // 极速区域（银行卡）
  let normalCardAppCount = 0, expressCardAppCount = 0, baoCardAppCount = 0, waitingForMatchCount = 0, jisuInvalidApplicationCount = 0;
  let normalCardAppAmount = 0, expressCardAppAmount = 0, baoCardAppAmount = 0, waitingForMatchAmount = 0, jisuInvalidApplicationAmount = 0;
  let normalMatchAmount = 0, expressMatchAmount = 0, baoMatchAmount = 0;
  const noCard06Set = new Set(); // 取无卡06提示：以 (userId + 日期) 去重
  let normalOrderSuccessCount = 0, normalOrderSuccessAmount = 0;
  let expressOrderSuccessCount = 0, expressOrderSuccessAmount = 0;
  let baoOrderSuccessCount = 0, baoOrderSuccessAmount = 0;
  let creditScoreSuccessCount = 0, creditScoreSuccessAmount = 0, creditScoreTimeSum = 0, creditScoreTimeCount = 0;
  let creditScoreNoImageCount = 0, creditScoreNoImageTimeSum = 0, creditScoreNoImageTimeCount = 0;
  const noCreditDowngradeByAmount = {};
  amountRanges.forEach(amt => { noCreditDowngradeByAmount[amt] = 0; });
  noCreditDowngradeByAmount['other'] = 0;
  let noCreditDowngradeTotal = 0;
  let noCreditDowngradeTimeSum = 0, noCreditDowngradeTimeCount = 0;

  // c2c (银行卡)
  let c2cCount = 0, c2cAmount = 0, c2cConfirmCount = 0, c2cConfirmTimeSum = 0, c2cConfirmTimeCount = 0;
  let c2cManualAuditCount = 0, c2cAuditTimeSum = 0;
  let c2cOver11MinSuccessCount = 0, c2cFraudBlacklistCount = 0, c2cCardVerifyCount = 0;

  // 三方代收（银行卡）- 动态存储
  let thirdPartyCount = 0, thirdPartyAmount = 0;
  let thirdPartyOtherCount = 0, thirdPartyOtherAmount = 0;
  // 动态三方代收统计（按配置的卡代号）
  const thirdPartyByCard = {};
  configuredThirdPartyCards.forEach(card => {
    thirdPartyByCard[card.cardNumber] = { count: 0, amount: 0, name: card.name };
  });

  // 旧的固定变量（保留兼容）
  let thirdPartyDahaomenCount = 0, thirdPartyDahaomenAmount = 0;
  let thirdPartyHuitongCount = 0, thirdPartyHuitongAmount = 0;
  let thirdPartyDoudouCount = 0, thirdPartyDoudouAmount = 0;
  let thirdPartyUCCount = 0, thirdPartyUCAmount = 0;

  // 全局三方代收 (所有商户，不限于极速充提3或支付宝)
  let globalThirdPartyCount = 0, globalThirdPartyAmount = 0;
  let globalThirdPartyOtherCount = 0, globalThirdPartyOtherAmount = 0;
  // 动态全局三方代收统计
  const globalThirdPartyByCard = {};
  configuredThirdPartyCards.forEach(card => {
    globalThirdPartyByCard[card.cardNumber] = { count: 0, amount: 0, name: card.name };
  });

  // 旧的固定变量（保留兼容）
  let globalThirdPartyHuitongCount = 0, globalThirdPartyHuitongAmount = 0;
  let globalThirdPartyDoudouCount = 0, globalThirdPartyDoudouAmount = 0;
  let globalThirdPartyUCCount = 0, globalThirdPartyUCAmount = 0;

  // 24小時交易分布
  const hourlyDistribution = new Array(24).fill(null).map(() => ({ count: 0, amount: 0 }));
  // 按日期+小時的時間序列（用於多日圖表）
  const hourlySeries = {};

  // 支付宝
  let alipayNormalCardAppCount = 0, alipayExpressCardAppCount = 0, alipayJisuTikaCount = 0, alipayJisuTibaoCount = 0;
  let alipayWaitingForMatchCount = 0, alipayInvalidApplicationCount = 0;
  let alipayWaitingForMatchAmount = 0;
  let alipayNormalMatchAmount = 0, alipayExpressBaoMatchAmount = 0, alipayJisuTikaMatchAmount = 0, alipayJisuTibaoMatchAmount = 0;
  let alipayNormalOrderSuccessCount = 0, alipayNormalOrderSuccessAmount = 0;
  let alipayBaoOrderSuccessCount = 0, alipayBaoOrderSuccessAmount = 0;
  let alipayJisuTikaOrderSuccessCount = 0, alipayJisuTikaOrderSuccessAmount = 0;
  let alipayJisuTibaoOrderSuccessCount = 0, alipayJisuTibaoOrderSuccessAmount = 0;
  let alipayCreditScoreSuccessCount = 0, alipayCreditScoreSuccessAmount = 0, alipayCreditScoreTimeSum = 0, alipayCreditScoreTimeCount = 0;
  let alipayCreditNoTuwenCount = 0, alipayCreditNoTuwenTimeSum = 0, alipayCreditNoTuwenTimeCount = 0;
  const alipayNoCreditDowngradeByAmount = {};
  amountRanges.forEach(amt => { alipayNoCreditDowngradeByAmount[amt] = 0; });
  alipayNoCreditDowngradeByAmount['other'] = 0;
  let alipayNoCreditDowngradeTotal = 0;
  let alipayNoCreditDowngradeTimeSum = 0, alipayNoCreditDowngradeTimeCount = 0;

  // 支付宝 c2c
  let alipayC2cCount = 0, alipayC2cAmount = 0, alipayC2cConfirmCount = 0, alipayC2cConfirmTimeSum = 0, alipayC2cConfirmTimeCount = 0;
  let alipayC2cManualAuditCount = 0, alipayC2cAuditTimeSum = 0;
  let alipayC2cOver11MinSuccessCount = 0, alipayC2cFraudBlacklistCount = 0, alipayC2cCardVerifyCount = 0;

  // 支付宝三方代收 - 动态存储
  let alipayThirdPartyCount = 0, alipayThirdPartyAmount = 0;
  let alipayThirdPartyOtherCount = 0, alipayThirdPartyOtherAmount = 0;
  // 动态支付宝三方代收统计
  const alipayThirdPartyByCard = {};
  configuredThirdPartyCards.forEach(card => {
    alipayThirdPartyByCard[card.cardNumber] = { count: 0, amount: 0, name: card.name };
  });
  // 旧的固定变量（保留兼容）
  let alipayThirdPartyDahaomenCount = 0, alipayThirdPartyDahaomenAmount = 0;
  let alipayThirdPartyHuitongCount = 0, alipayThirdPartyHuitongAmount = 0;
  let alipayThirdPartyDoudouCount = 0, alipayThirdPartyDoudouAmount = 0;
  let alipayThirdPartyUCCount = 0, alipayThirdPartyUCAmount = 0;

  // 支付宝宝转卡/宝转宝
  let alipayBaoZhuanKaCount = 0, alipayBaoZhuanKaAmount = 0, alipayBaoZhuanKaSuccessCount = 0, alipayBaoZhuanKaSuccessAmount = 0;
  let alipayBaoZhuanBaoCount = 0, alipayBaoZhuanBaoAmount = 0, alipayBaoZhuanBaoSuccessCount = 0, alipayBaoZhuanBaoSuccessAmount = 0;

  // 微信
  let wechatNormalCardAppCount = 0, wechatExpressBaoAppCount = 0, wechatJisuTikaAppCount = 0, wechatJisuTibaoAppCount = 0;
  let wechatWaitingForMatchCount = 0, wechatInvalidApplicationCount = 0;
  let wechatWaitingForMatchAmount = 0;
  let wechatNormalMatchAmount = 0, wechatExpressBaoMatchAmount = 0, wechatJisuTikaMatchAmount = 0, wechatJisuTibaoMatchAmount = 0;
  let wechatNormalOrderSuccessCount = 0, wechatNormalOrderSuccessAmount = 0;
  let wechatBaoOrderSuccessCount = 0, wechatBaoOrderSuccessAmount = 0;
  let wechatJisuTikaOrderSuccessCount = 0, wechatJisuTikaOrderSuccessAmount = 0;
  let wechatJisuTibaoOrderSuccessCount = 0, wechatJisuTibaoOrderSuccessAmount = 0;
  let wechatCreditScoreSuccessCount = 0, wechatCreditScoreSuccessAmount = 0, wechatCreditScoreTimeSum = 0, wechatCreditScoreTimeCount = 0;
  const wechatNoCreditDowngradeByAmount = {};
  amountRanges.forEach(amt => { wechatNoCreditDowngradeByAmount[amt] = 0; });
  wechatNoCreditDowngradeByAmount['other'] = 0;
  let wechatNoCreditDowngradeTotal = 0;
  let wechatNoCreditDowngradeTimeSum = 0, wechatNoCreditDowngradeTimeCount = 0;

  // 微信 c2c
  let wechatC2cCount = 0, wechatC2cAmount = 0, wechatUserConfirmCount = 0, wechatC2cConfirmTimeSum = 0, wechatC2cConfirmTimeCount = 0;
  let wechatManualAuditPassCount = 0, wechatC2cAuditTimeSum = 0;
  let wechatOver11minCount = 0;

  // 微信三方代收 - 动态存储
  let wechatThirdPartyCount = 0, wechatThirdPartyAmount = 0;
  let wechatThirdPartyOtherCount = 0, wechatThirdPartyOtherAmount = 0;
  // 动态微信三方代收统计
  const wechatThirdPartyByCard = {};
  configuredThirdPartyCards.forEach(card => {
    wechatThirdPartyByCard[card.cardNumber] = { count: 0, amount: 0, name: card.name };
  });

  // JS等待无配对
  let bankCardWaitingNoMatch = 0, alipayWaitingNoMatch = 0;

  // 微信平均时间正则
  const wechatValidStatusPattern = /信用評分上分|金额补单|金額補單|银商确认到账|銀商確認到帳|回單驗證上分|用户确认到帐|用戶確認到帳|已充值\(短信\)|已充值\(微信短信\)|已充值|回單隨機信評上分|信用評分上分\(圖文覆核\)|明细补单|明細補單/;

  // ===== 单次遍历所有记录 =====
  const len = records.length;
  for (let i = 0; i < len; i++) {
    // 每10000条检查一次超时
    if (i % 10000 === 0) checkTimeout();

    const r = records[i];
    const merchant = r.merchant || '';
    const merchantLower = merchant.toLowerCase();
    const bankCardCode = r.bankCardCode || '';
    const bankName = r.bankName || '';
    const status = r.status || '';
    const normalizedStatus = r.normalizedStatus || '';
    const receivedAmount = r.receivedAmount || 0;
    const amount = r.amount || 0;
    const processingTime = r.processingTime;
    const hasValidTime = processingTime !== null && processingTime >= 0;
    const userLevel = parseFloat(r.userLevel) || 0;

    // 商户类型判断（预计算）
    const hasJiSu = merchant.includes('极速充提3');
    const hasAlipay = merchant.includes('支付宝') || merchant.includes('支付寶');
    const hasWechat = merchant.includes('微信');
    const hasTest = merchantLower.includes('test');
    const hasQa = merchantLower.includes('qa');
    const hasOffline = merchant.includes('線下') || merchant.includes('线下');

    // 银行名称判断（支援簡繁體）
    const isBaoBank = bankName === '支付宝' || bankName === '支付宝(企)' ||
                      bankName === '支付寶' || bankName === '支付寶(企)' ||
                      bankName === '微信支付';
    const isAuctionCard = bankCardCode === AUCTION_CARD;

    // 状态判断
    const hasBuDan = status.includes('補') || status.includes('补');
    const hasCredit = status.includes('信用');
    const hasUserConfirm = status.includes('用户确认到帐') || status.includes('用戶確認到帳');
    const hasBuDanStatus = status.includes('金額補單') || status.includes('金额补单');
    const hasMerchantConfirm = status.includes('商户确认到帐') || status.includes('商戶確認到帳');
    const isNotCharged = normalizedStatus === '未充值';
    const isTimeout = normalizedStatus === '审核中(已超时)' || normalizedStatus === '图文复核(已超时)';

    // ===== 全局指标 =====
    // 分类记录
    const isInOffline  = hasOffline;
    const isInAlipay   = hasAlipay && !hasOffline;
    const isInWechat   = hasWechat && !hasOffline;
    const isInBankCard = !hasAlipay && !hasWechat && !hasOffline;
    const isInCategory = isInBankCard || isInAlipay || isInWechat || isInOffline;

    // 「全部」分頁：計入所有商戶（只排除 test/qa，已在 CSV 解析時排除）
    // 取消訂單優先判斷為無效申請（即使到帳金額>0）
    if (status.includes('取消')) {
      invalidApplicationCount++;
      minuteInvalidCount++;
    } else if (receivedAmount > 0) {
      successfulCount++;
      successfulAmount += receivedAmount;
      if (hasBuDan) dropOrderCount++;

      // 24小時交易分布（使用建立時間）
      if (r.requestTime) {
        const hourMatch = r.requestTime.match(/(\d{2}):\d{2}:\d{2}/);
        if (hourMatch) {
          const hour = parseInt(hourMatch[1]);
          hourlyDistribution[hour].count++;
          hourlyDistribution[hour].amount += receivedAmount;
          // 時間序列：按日期+小時記錄
          const dateKey = r.requestTime.split(' ')[0];
          const seriesKey = `${dateKey}_${hourMatch[1]}`;
          if (!hourlySeries[seriesKey]) hourlySeries[seriesKey] = { count: 0, amount: 0 };
          hourlySeries[seriesKey].count++;
          hourlySeries[seriesKey].amount += receivedAmount;
        }
      }

      // 分钟分析（全部分頁）
      minuteAnalysisTotalCount++;
      minuteAnalysisTotalAmount += receivedAmount;
      if (hasValidTime) {
        minuteAnalysisTimeSum += processingTime;
        minuteAnalysisTimeCount++;
        // 時間區段：2分鐘內(≤120)、2-3分鐘(120<t≤180)、3-5分鐘(180<t≤300)、5-15分鐘(300<t≤900)、15-30分鐘(900<t≤1800)、30分鐘以上(>1800)
        if (processingTime <= 120) { minuteWithin2MinCount++; minuteWithin2MinAmount += receivedAmount; }
        else if (processingTime <= 180) { minuteWithin2to3MinCount++; minuteWithin2to3MinAmount += receivedAmount; }
        else if (processingTime <= 300) { minuteWithin3to5MinCount++; minuteWithin3to5MinAmount += receivedAmount; }
        else if (processingTime <= 900) { minuteWithin5to15MinCount++; minuteWithin5to15MinAmount += receivedAmount; }
        else if (processingTime <= 1800) { minuteWithin15to30MinCount++; minuteWithin15to30MinAmount += receivedAmount; }
        else { minuteOver30MinCount++; minuteOver30MinAmount += receivedAmount; }
      }
      if (hasBuDan) minuteDropCount++;
    } else if (!receivedAmount) {
      invalidApplicationCount++;
      minuteInvalidCount++;
    }

    // 平均时间（全局）
    if (receivedAmount > 0 && hasValidTime) {
      recordsWithAmountAndTimeSum += processingTime;
      recordsWithAmountAndTimeCount++;
    }

    // ===== 全局三方代收计数 (所有商户) =====
    // 不受 isJisuRecord/isAlipayRecord 条件限制，只根据银行卡代号判断
    if (bankCardCode && receivedAmount > 0 && !hasOffline && !hasTest && !hasQa) {
      const codeLower = bankCardCode.toLowerCase();
      if (isThirdPartyHuitong(bankCardCode)) {
        globalThirdPartyCount++; globalThirdPartyAmount += receivedAmount;
        globalThirdPartyHuitongCount++; globalThirdPartyHuitongAmount += receivedAmount;
      } else if (isThirdPartyDoudou(bankCardCode)) {
        globalThirdPartyCount++; globalThirdPartyAmount += receivedAmount;
        globalThirdPartyDoudouCount++; globalThirdPartyDoudouAmount += receivedAmount;
      } else if (isThirdPartyUC(bankCardCode)) {
        globalThirdPartyCount++; globalThirdPartyAmount += receivedAmount;
        globalThirdPartyUCCount++; globalThirdPartyUCAmount += receivedAmount;
      } else if (isThirdPartyDahaomen(bankCardCode)) {
        globalThirdPartyCount++; globalThirdPartyAmount += receivedAmount;
        globalThirdPartyOtherCount++; globalThirdPartyOtherAmount += receivedAmount;
      } else if (!codeLower.startsWith('gb') && !codeLower.startsWith('auction')) {
        globalThirdPartyCount++; globalThirdPartyAmount += receivedAmount;
        globalThirdPartyOtherCount++; globalThirdPartyOtherAmount += receivedAmount;
      }
    }

    // 旧版时间分布
    if (!r.isInvalid) {
      validRecordsCount++;
      if (hasValidTime) {
        validWithTimeSum += processingTime;
        validWithTimeCount++;
        sortedTimesArray.push(processingTime);
        // 時間區段：≤120、120<t≤300、300<t≤900、900<t≤1800、>1800
        if (processingTime <= 120) within2MinCount++;
        else if (processingTime <= 300) within3to5MinCount++;
        else if (processingTime <= 900) within5to15MinCount++;
        else if (processingTime <= 1800) within15to30MinCount++;
        else over30MinCount++;
      }
    } else {
      invalidRecordsCount++;
    }

    // ===== 极速区域（银行卡）处理 =====
    const isJisuRecord = hasJiSu && !hasAlipay && !hasWechat && !hasTest && !hasQa && !hasOffline;
    if (isJisuRecord) {
      // 充值申请分类
      const receivingMerchant = r.receivingMerchant || '';
      if (bankCardCode) {
        if (isAuctionCard) {
          expressCardAppCount++;
          expressCardAppAmount += amount;
          expressMatchAmount += amount;
        } else if (!isBaoBank) {
          normalCardAppCount++;
          normalCardAppAmount += amount;
          normalMatchAmount += amount;
        } else {
          baoCardAppCount++;
          baoCardAppAmount += amount;
          baoMatchAmount += amount;
        }
        // 无效申请：未充值且商戶號為空，但銀行卡有值
        if (isNotCharged && !receivingMerchant) {
          jisuInvalidApplicationCount++;
          jisuInvalidApplicationAmount += amount;
        }
      } else {
        // 建单成功等待无配对：未充值且銀行卡為空
        if (isNotCharged) {
          waitingForMatchCount++;
          waitingForMatchAmount += amount;
          bankCardWaitingNoMatch++;
          // 取无卡06提示：以 (userId + 日期) 去重
          const dateKey = (r.requestTime || '').split(' ')[0];
          if (r.userId && dateKey) {
            noCard06Set.add(`${r.userId}_${dateKey}`);
          }
        }
      }

      // 订单成功
      if (bankCardCode && !isAuctionCard && !isBaoBank && !isNotCharged && normalizedStatus !== '审核中(已超时)') {
        normalOrderSuccessCount++;
        normalOrderSuccessAmount += receivedAmount;
      }
      if (bankCardCode && !isAuctionCard && isBaoBank && receivedAmount > 0 && !isNotCharged && normalizedStatus !== '审核中(已超时)') {
        baoOrderSuccessCount++;
        baoOrderSuccessAmount += receivedAmount;
      }
      if (isAuctionCard && receivedAmount > 0 && normalizedStatus && !isNotCharged && normalizedStatus !== '审核中(已超时)') {
        expressOrderSuccessCount++;
        expressOrderSuccessAmount += receivedAmount;
      }

      // 信评上分
      if (isAuctionCard && receivedAmount > 0 && hasCredit) {
        creditScoreSuccessCount++;
        creditScoreSuccessAmount += receivedAmount;
        if (hasValidTime) {
          creditScoreTimeSum += processingTime;
          creditScoreTimeCount++;
        }
      }
      // 信评不含图文复核
      if (isAuctionCard && receivedAmount > 0 && hasCredit && status !== '信用評分上分(圖文覆核)') {
        creditScoreNoImageCount++;
        if (hasValidTime) {
          creditScoreNoImageTimeSum += processingTime;
          creditScoreNoImageTimeCount++;
        }
      }

      // 没信评降等配卡
      if (!isAuctionCard && receivedAmount !== 0 && userLevel !== 0 && userLevel !== -1) {
        noCreditDowngradeTotal++;
        const roundedAmt = Math.round(amount);
        if (amountRangesSet.has(roundedAmt)) {
          noCreditDowngradeByAmount[roundedAmt]++;
        } else {
          noCreditDowngradeByAmount['other']++;
        }
      }
      // 没信评平均时间
      if (receivedAmount > 0 && hasValidTime) {
        noCreditDowngradeTimeSum += processingTime;
        noCreditDowngradeTimeCount++;
      }

    }

    // ===== 银行卡 c2c（數據範圍：極速模式，商戶不含支付寶/微信/test/qa/線下）=====
    const isBankCardC2cRecord = hasJiSu && !hasAlipay && !hasWechat && !hasTest && !hasQa && !hasOffline;
    if (isBankCardC2cRecord) {
      if (isAuctionCard && receivedAmount > 0 && hasUserConfirm) {
        c2cCount++;
        c2cAmount += receivedAmount;
      }
      if (receivedAmount > 0 && hasUserConfirm) {
        c2cConfirmCount++;
        if (hasValidTime) {
          c2cConfirmTimeSum += processingTime;
          c2cConfirmTimeCount++;
        }
      }
      // 人工审核
      if (bankCardCode && bankCardCode.includes('AUCTION') && receivedAmount > 0 && hasBuDanStatus && hasValidTime && processingTime <= 660) {
        c2cManualAuditCount++;
        c2cAuditTimeSum += processingTime;
      }
      // 超过11min补件后成功
      if (bankCardCode && bankCardCode.includes('AUCTION') && receivedAmount > 0 && hasBuDanStatus && hasValidTime && processingTime > 660) {
        c2cOver11MinSuccessCount++;
      }
    }

    // ===== 银行卡三方代收（独立计算，只匹配配置的卡代号）=====
    // 条件：極速模式、非支付宝、非微信、非test/qa/线下，到账金额>0，匹配配置的三方代收卡代号
    const isBankCardThirdPartyRecord = hasJiSu && !hasAlipay && !hasWechat && !hasTest && !hasQa && !hasOffline;
    if (isBankCardThirdPartyRecord && bankCardCode && receivedAmount > 0) {
      // 检查是否匹配配置的三方代收卡代号
      const matchedCard = matchConfiguredCard(bankCardCode);

      if (matchedCard) {
        // 匹配到配置的卡代号 - 计入银行卡三方代收总计
        thirdPartyCount++; thirdPartyAmount += receivedAmount;
        thirdPartyByCard[matchedCard.cardNumber].count++;
        thirdPartyByCard[matchedCard.cardNumber].amount += receivedAmount;
      }
    }

    // ===== 支付宝商户处理 =====
    const isAlipayRecord = hasAlipay && !hasTest && !hasQa && !hasOffline;
    if (isAlipayRecord) {
      // 充值申请分类
      if (isNotCharged && !bankCardCode) {
        alipayWaitingForMatchCount++;
        alipayWaitingForMatchAmount += amount;
        alipayWaitingNoMatch++;
      } else if (isAuctionCard) {
        if (isBaoBank) {
          alipayJisuTibaoCount++;
          alipayJisuTibaoMatchAmount += amount;
        } else {
          alipayJisuTikaCount++;
          alipayJisuTikaMatchAmount += amount;
        }
      } else {
        if (isBaoBank) {
          alipayExpressCardAppCount++;
          alipayExpressBaoMatchAmount += amount;
        } else {
          alipayNormalCardAppCount++;
          alipayNormalMatchAmount += amount;
        }
      }

      // 无效申请：未充值且商戶號為空，但銀行卡有值
      const alipayReceivingMerchant = r.receivingMerchant || '';
      if (isNotCharged && !alipayReceivingMerchant && bankCardCode) {
        alipayInvalidApplicationCount++;
      }

      // 订单成功
      const isValidStatus = normalizedStatus && !isNotCharged && !isTimeout;
      if (bankCardCode && !isAuctionCard && !isBaoBank && isValidStatus) {
        alipayNormalOrderSuccessCount++;
        alipayNormalOrderSuccessAmount += receivedAmount;
      }
      if (bankCardCode && !isAuctionCard && isBaoBank && isValidStatus) {
        alipayBaoOrderSuccessCount++;
        alipayBaoOrderSuccessAmount += receivedAmount;
      }
      if (isAuctionCard && !isBaoBank && isValidStatus) {
        alipayJisuTikaOrderSuccessCount++;
        alipayJisuTikaOrderSuccessAmount += receivedAmount;
      }
      if (isAuctionCard && isBaoBank && isValidStatus) {
        alipayJisuTibaoOrderSuccessCount++;
        alipayJisuTibaoOrderSuccessAmount += receivedAmount;
      }

      // 信评上分
      if (status.includes('信用評分上分')) {
        alipayCreditScoreSuccessCount++;
        alipayCreditScoreSuccessAmount += receivedAmount;
        if (hasValidTime) {
          alipayCreditScoreTimeSum += processingTime;
          alipayCreditScoreTimeCount++;
        }
      }
      // 信评不含图文复核
      if (isAuctionCard && receivedAmount > 0 && status.includes('信用評分上分') && status !== '信用評分上分(圖文覆核)') {
        alipayCreditNoTuwenCount++;
        if (hasValidTime) {
          alipayCreditNoTuwenTimeSum += processingTime;
          alipayCreditNoTuwenTimeCount++;
        }
      }

      // 没信评降等配卡
      if (!isAuctionCard && receivedAmount !== 0 && userLevel !== 0 && userLevel !== -1) {
        alipayNoCreditDowngradeTotal++;
        const roundedAmt = Math.round(amount);
        if (amountRangesSet.has(roundedAmt)) {
          alipayNoCreditDowngradeByAmount[roundedAmt]++;
        } else {
          alipayNoCreditDowngradeByAmount['other']++;
        }
      }
      if (receivedAmount > 0 && hasValidTime) {
        alipayNoCreditDowngradeTimeSum += processingTime;
        alipayNoCreditDowngradeTimeCount++;
      }

      // 支付宝 c2c
      if (isAuctionCard && receivedAmount > 0 && hasUserConfirm) {
        alipayC2cCount++;
        alipayC2cAmount += receivedAmount;
      }
      if (receivedAmount > 0 && hasUserConfirm) {
        alipayC2cConfirmCount++;
        if (hasValidTime) {
          alipayC2cConfirmTimeSum += processingTime;
          alipayC2cConfirmTimeCount++;
        }
      }
      if (bankCardCode && bankCardCode.includes('AUCTION') && receivedAmount > 0 && hasBuDanStatus && hasValidTime && processingTime > 0 && processingTime <= 660) {
        alipayC2cManualAuditCount++;
        alipayC2cAuditTimeSum += processingTime;
      }
      if (bankCardCode && bankCardCode.includes('AUCTION') && receivedAmount > 0 && hasBuDanStatus && hasValidTime && processingTime > 660) {
        alipayC2cOver11MinSuccessCount++;
      }
      if (bankCardCode && bankCardCode.includes('AUCTION_PAYMENT_CARD') && receivedAmount > 0 && hasMerchantConfirm) {
        alipayC2cOver11MinSuccessCount++;
      }

      // 支付宝三方代收（只匹配配置的卡代号，已在 isAlipayRecord 排除線下）
      if (bankCardCode && receivedAmount > 0) {
        const matchedCard = matchConfiguredCard(bankCardCode);
        if (matchedCard) {
          alipayThirdPartyCount++; alipayThirdPartyAmount += receivedAmount;
          alipayThirdPartyByCard[matchedCard.cardNumber].count++;
          alipayThirdPartyByCard[matchedCard.cardNumber].amount += receivedAmount;
        }
      }

      // 宝转卡/宝转宝（支援簡繁體）
      if ((merchant.includes('转卡') || merchant.includes('轉卡')) && isAuctionCard && (bankName === '支付宝' || bankName === '支付寶')) {
        alipayBaoZhuanKaCount++;
        alipayBaoZhuanKaAmount += amount;
        if (receivedAmount !== 0) {
          alipayBaoZhuanKaSuccessCount++;
          alipayBaoZhuanKaSuccessAmount += receivedAmount;
        }
      }
      if ((merchant.includes('支付宝') || merchant.includes('支付寶')) && isAuctionCard && bankName !== '支付宝' && bankName !== '支付寶') {
        alipayBaoZhuanBaoCount++;
        alipayBaoZhuanBaoAmount += amount;
        if (receivedAmount !== 0) {
          alipayBaoZhuanBaoSuccessCount++;
          alipayBaoZhuanBaoSuccessAmount += receivedAmount;
        }
      }
    }

    // ===== 微信商户处理 =====
    const isWechatRecord = hasWechat && !hasTest && !hasQa && !hasOffline;
    if (isWechatRecord) {
      // 充值申请分类
      if (isNotCharged && !bankCardCode) {
        wechatWaitingForMatchCount++;
        wechatWaitingForMatchAmount += amount;
      } else if (isAuctionCard) {
        if (isBaoBank) {
          wechatJisuTibaoAppCount++;
          wechatJisuTibaoMatchAmount += amount;
        } else {
          wechatJisuTikaAppCount++;
          wechatJisuTikaMatchAmount += amount;
        }
      } else {
        if (isBaoBank) {
          wechatExpressBaoAppCount++;
          wechatExpressBaoMatchAmount += amount;
        } else {
          wechatNormalCardAppCount++;
          wechatNormalMatchAmount += amount;
        }
      }

      // 无效申请：未充值且商戶號為空，但銀行卡有值
      const wechatReceivingMerchant = r.receivingMerchant || '';
      if (isNotCharged && !wechatReceivingMerchant && bankCardCode) {
        wechatInvalidApplicationCount++;
      }

      // 订单成功
      const isValidStatus = normalizedStatus && !isNotCharged && !isTimeout;
      if (bankCardCode && !isAuctionCard && !isBaoBank && isValidStatus) {
        wechatNormalOrderSuccessCount++;
        wechatNormalOrderSuccessAmount += receivedAmount;
      }
      if (bankCardCode && !isAuctionCard && isBaoBank && isValidStatus) {
        wechatBaoOrderSuccessCount++;
        wechatBaoOrderSuccessAmount += receivedAmount;
      }
      if (isAuctionCard && !isBaoBank && isValidStatus) {
        wechatJisuTikaOrderSuccessCount++;
        wechatJisuTikaOrderSuccessAmount += receivedAmount;
      }
      if (isAuctionCard && isBaoBank && isValidStatus) {
        wechatJisuTibaoOrderSuccessCount++;
        wechatJisuTibaoOrderSuccessAmount += receivedAmount;
      }

      // 微信信评上分
      if (receivedAmount > 0 && hasCredit) {
        wechatCreditScoreSuccessCount++;
        wechatCreditScoreSuccessAmount += receivedAmount;
        if (hasValidTime) {
          wechatCreditScoreTimeSum += processingTime;
          wechatCreditScoreTimeCount++;
        }
      }

      // 微信没信评降等配卡
      if (!isAuctionCard && receivedAmount !== 0 && userLevel !== 0 && userLevel !== -1) {
        wechatNoCreditDowngradeTotal++;
        const roundedAmt = Math.round(amount);
        if (amountRangesSet.has(roundedAmt)) {
          wechatNoCreditDowngradeByAmount[roundedAmt]++;
        } else {
          wechatNoCreditDowngradeByAmount['other']++;
        }
      }
      // 微信平均时间（依據 CRITERIA 5.4：到帳金額>0 且 用戶等級≠0 且≠-1）
      if (receivedAmount > 0 && userLevel !== 0 && userLevel !== -1 && hasValidTime) {
        wechatNoCreditDowngradeTimeSum += processingTime;
        wechatNoCreditDowngradeTimeCount++;
      }

      // 微信 c2c
      if (isAuctionCard && receivedAmount > 0 && hasUserConfirm) {
        wechatC2cCount++;
        wechatC2cAmount += receivedAmount;
      }
      if (receivedAmount > 0 && hasUserConfirm) {
        wechatUserConfirmCount++;
        if (hasValidTime) {
          wechatC2cConfirmTimeSum += processingTime;
          wechatC2cConfirmTimeCount++;
        }
      }
      if (bankCardCode && bankCardCode.includes('AUCTION') && receivedAmount > 0 && hasBuDanStatus && hasValidTime && processingTime > 0 && processingTime <= 660) {
        wechatManualAuditPassCount++;
        wechatC2cAuditTimeSum += processingTime;
      }
      if (bankCardCode && bankCardCode.includes('AUCTION') && receivedAmount > 0 && hasBuDanStatus && hasValidTime && processingTime > 660) {
        wechatOver11minCount++;
      }
      if (bankCardCode && bankCardCode.includes('AUCTION_PAYMENT_CARD') && receivedAmount > 0 && hasMerchantConfirm) {
        wechatOver11minCount++;
      }

      // 微信三方代收（只匹配配置的卡代号）
      if (bankCardCode && receivedAmount > 0 && !hasOffline) {
        const matchedCard = matchConfiguredCard(bankCardCode);

        if (matchedCard) {
          // 匹配到配置的卡代号
          wechatThirdPartyCount++; wechatThirdPartyAmount += receivedAmount;
          wechatThirdPartyByCard[matchedCard.cardNumber].count++;
          wechatThirdPartyByCard[matchedCard.cardNumber].amount += receivedAmount;
        }
      }
    }
  }

  // ===== 计算衍生指标 =====
  checkTimeout();

  // 取无卡06提示：以 (userId + 日期) 去重的建单成功等待无配对笔数
  const noCard06Count = noCard06Set.size;
  const jisuApplicationCount = normalCardAppCount + baoCardAppCount + expressCardAppCount + waitingForMatchCount + noCard06Count + jisuInvalidApplicationCount;
  const jisuApplicationAmount = normalCardAppAmount + baoCardAppAmount + expressCardAppAmount + waitingForMatchAmount + jisuInvalidApplicationAmount;
  const totalMatchCount = normalCardAppCount + baoCardAppCount + expressCardAppCount;
  const totalMatchAmount = normalMatchAmount + baoMatchAmount + expressMatchAmount;
  const totalOrderSuccessCount = normalOrderSuccessCount + baoOrderSuccessCount + expressOrderSuccessCount;
  const totalOrderSuccessAmount = normalOrderSuccessAmount + baoOrderSuccessAmount + expressOrderSuccessAmount;
  // 总申请笔数 = 所有記錄數（商戶只排除 test/qa，已在 CSV 解析時排除）
  const totalApplicationCount = len;

  // 支付宝合计
  // 注意：noCard06Count 是銀行卡渠道專屬（noCard06Set 只在 isJisuRecord 下加入），不應計入此處
  const alipayApplicationCount = alipayNormalCardAppCount + alipayExpressCardAppCount + alipayJisuTikaCount + alipayJisuTibaoCount + alipayWaitingForMatchCount + alipayInvalidApplicationCount;
  const alipayTotalMatchCount = alipayNormalCardAppCount + alipayExpressCardAppCount + alipayJisuTikaCount + alipayJisuTibaoCount;
  const alipayTotalMatchAmount = alipayNormalMatchAmount + alipayExpressBaoMatchAmount + alipayJisuTikaMatchAmount + alipayJisuTibaoMatchAmount;
  const alipayApplicationAmount = alipayTotalMatchAmount + alipayWaitingForMatchAmount;
  const alipayTotalOrderSuccessCount = alipayNormalOrderSuccessCount + alipayBaoOrderSuccessCount + alipayJisuTikaOrderSuccessCount + alipayJisuTibaoOrderSuccessCount;
  const alipayTotalOrderSuccessAmount = alipayNormalOrderSuccessAmount + alipayBaoOrderSuccessAmount + alipayJisuTikaOrderSuccessAmount + alipayJisuTibaoOrderSuccessAmount;

  // 微信合计
  // 注意：noCard06Count 是銀行卡渠道專屬，不應計入此處
  const wechatApplicationCount = wechatNormalCardAppCount + wechatExpressBaoAppCount + wechatJisuTikaAppCount + wechatJisuTibaoAppCount + wechatWaitingForMatchCount + wechatInvalidApplicationCount;
  const wechatTotalMatchCount = wechatNormalCardAppCount + wechatExpressBaoAppCount + wechatJisuTikaAppCount + wechatJisuTibaoAppCount;
  const wechatTotalMatchAmount = wechatNormalMatchAmount + wechatExpressBaoMatchAmount + wechatJisuTikaMatchAmount + wechatJisuTibaoMatchAmount;
  const wechatApplicationAmount = wechatTotalMatchAmount + wechatWaitingForMatchAmount;
  const wechatTotalOrderSuccessCount = wechatNormalOrderSuccessCount + wechatBaoOrderSuccessCount + wechatJisuTikaOrderSuccessCount + wechatJisuTibaoOrderSuccessCount;
  const wechatTotalOrderSuccessAmount = wechatNormalOrderSuccessAmount + wechatBaoOrderSuccessAmount + wechatJisuTikaOrderSuccessAmount + wechatJisuTibaoOrderSuccessAmount;

  // ===== JS充值等待最终无配对 =====
  // 公式：（銀行卡的建单成功等待无配对＋取无卡06提示）＋（支付寶的建单成功等待无配对＋取无卡06提示）
  // 建单成功等待无配对 = bankCardCode 为空的记录数
  // 取无卡06提示 = 暂带0（后续需调整，待提供06数据）
  const bankCard06NoMatch = 0; // 暂带0（后续需从06数据计算）
  const bankCardJsWaitingNoMatch = bankCardWaitingNoMatch + bankCard06NoMatch;
  const alipay06NoMatch = 0; // 暂带0（后续需从06数据计算）
  const alipayJsWaitingNoMatch = alipayWaitingNoMatch + alipay06NoMatch;
  const jsWaitingNoMatch = bankCardJsWaitingNoMatch + alipayJsWaitingNoMatch;

  // Debug: 輸出 JS充值等待最终无配对 計算詳情
  console.log('【calculateMetrics - JS充值等待最终无配对】', {
    '銀行卡建單無配對': bankCardWaitingNoMatch,
    '銀行卡06提示': bankCard06NoMatch,
    '銀行卡小計': bankCardJsWaitingNoMatch,
    '支付寶建單無配對': alipayWaitingNoMatch,
    '支付寶06提示': alipay06NoMatch,
    '支付寶小計': alipayJsWaitingNoMatch,
    '總計': jsWaitingNoMatch
  });

  // ===== 6. 商业平台 =====
  // 數據範圍：商戶以「外部商戶」開頭（依據 CRITERIA.md 3.9）
  const isCommercialPlatformMerchant = (merchant) => {
    if (!merchant) return false;
    return merchant.startsWith('外部商戶') || merchant.startsWith('外部商户');
  };

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

  const commercialPlatformMerchants = Array.from(commercialPlatformMap.values())
    .sort((a, b) => b.applicationCount - a.applicationCount);
  const commercialPlatformTotalAppCount = commercialPlatformMerchants.reduce((sum, m) => sum + m.applicationCount, 0);
  const commercialPlatformTotalAppAmount = commercialPlatformMerchants.reduce((sum, m) => sum + m.applicationAmount, 0);
  const commercialPlatformTotalSuccessCount = commercialPlatformMerchants.reduce((sum, m) => sum + m.successCount, 0);
  const commercialPlatformTotalSuccessAmount = commercialPlatformMerchants.reduce((sum, m) => sum + m.successAmount, 0);

  // 支付寶 商業平台
  let alipayCommercialPlatformTotalAppCount = 0;
  let alipayCommercialPlatformTotalAppAmount = 0;
  let alipayCommercialPlatformTotalSuccessCount = 0;
  let alipayCommercialPlatformTotalSuccessAmount = 0;

  records.forEach(r => {
    const m = r.merchant || '';
    const mLower = m.toLowerCase();
    if (!isCommercialPlatformMerchant(m)) return;
    const mHasAlipay = m.includes('支付宝') || m.includes('支付寶');
    const mHasWechat = m.includes('微信');
    if (!mHasAlipay || mHasWechat || mLower.includes('test') || mLower.includes('qa') ||
        m.includes('線下') || m.includes('线下')) return;
    alipayCommercialPlatformTotalAppCount++;
    alipayCommercialPlatformTotalAppAmount += r.amount || 0;
    const isUnpaid = r.status && r.status.includes('未充值');
    if (!isUnpaid && (r.receivedAmount || 0) > 0) {
      alipayCommercialPlatformTotalSuccessCount++;
      alipayCommercialPlatformTotalSuccessAmount += r.receivedAmount || 0;
    }
  });

  // 微信 商業平台
  let wechatCommercialPlatformTotalAppCount = 0;
  let wechatCommercialPlatformTotalAppAmount = 0;
  let wechatCommercialPlatformTotalSuccessCount = 0;
  let wechatCommercialPlatformTotalSuccessAmount = 0;

  records.forEach(r => {
    const m = r.merchant || '';
    const mLower = m.toLowerCase();
    if (!isCommercialPlatformMerchant(m)) return;
    const mHasWechat = m.includes('微信');
    if (!mHasWechat || mLower.includes('test') || mLower.includes('qa') ||
        m.includes('線下') || m.includes('线下')) return;
    wechatCommercialPlatformTotalAppCount++;
    wechatCommercialPlatformTotalAppAmount += r.amount || 0;
    const isUnpaid = r.status && r.status.includes('未充值');
    if (!isUnpaid && (r.receivedAmount || 0) > 0) {
      wechatCommercialPlatformTotalSuccessCount++;
      wechatCommercialPlatformTotalSuccessAmount += r.receivedAmount || 0;
    }
  });

  // 整体配对成功率
  const withdrawBankCardAmount = withdrawMetrics?.bankCardWithdrawAmount || 0;
  const withdrawAlipayAmount = withdrawMetrics?.alipayWithdrawAmount || 0;
  const alipayOverallMatchDenominator = withdrawAlipayAmount + withdrawBankCardAmount;
  const alipayOverallMatchNumerator = expressOrderSuccessAmount + alipayJisuTikaOrderSuccessAmount + alipayJisuTibaoOrderSuccessAmount;
  const alipayOverallMatchRate = alipayOverallMatchDenominator > 0 ? (alipayOverallMatchNumerator / alipayOverallMatchDenominator) * 100 : 0;

  // 中位数计算
  sortedTimesArray.sort((a, b) => a - b);
  const medianTime = sortedTimesArray.length > 0 ? sortedTimesArray[Math.floor(sortedTimesArray.length / 2)] : 0;

  const elapsed = performance.now() - startTime;
  console.log(`calculateMetrics 完成，耗时: ${elapsed.toFixed(2)}ms，处理 ${records.length} 条记录`);

  return {
    // 全部-重要信息指标
    totalApplicationCount,
    successfulCount,
    overallSuccessRate: totalApplicationCount > 0 ? (successfulCount / totalApplicationCount) * 100 : 0,
    totalApplicationAmount: successfulAmount,
    overallAvgTime: recordsWithAmountAndTimeCount > 0 ? recordsWithAmountAndTimeSum / recordsWithAmountAndTimeCount : 0,
    overallDropOrderCount: dropOrderCount,
    overallDropOrderRatio: successfulCount > 0 ? (dropOrderCount / successfulCount) * 100 : 0,
    invalidApplicationCount,
    invalidApplicationRatio: totalApplicationCount > 0 ? (invalidApplicationCount / totalApplicationCount) * 100 : 0,

    // 充值分钟分析
    minuteAnalysisTotalCount,
    minuteAnalysisTotalAmount,
    minuteWithin2MinCount,
    minuteWithin2MinAmount,
    minuteWithin2MinRatio: minuteAnalysisTotalCount > 0 ? (minuteWithin2MinCount / minuteAnalysisTotalCount) * 100 : 0,
    minuteWithin2to3MinCount,
    minuteWithin2to3MinAmount,
    minuteWithin2to3MinRatio: minuteAnalysisTotalCount > 0 ? (minuteWithin2to3MinCount / minuteAnalysisTotalCount) * 100 : 0,
    minuteWithin3to5MinCount,
    minuteWithin3to5MinAmount,
    minuteWithin3to5MinRatio: minuteAnalysisTotalCount > 0 ? (minuteWithin3to5MinCount / minuteAnalysisTotalCount) * 100 : 0,
    minuteWithin5to15MinCount,
    minuteWithin5to15MinAmount,
    minuteWithin5to15MinRatio: minuteAnalysisTotalCount > 0 ? (minuteWithin5to15MinCount / minuteAnalysisTotalCount) * 100 : 0,
    minuteWithin15to30MinCount,
    minuteWithin15to30MinAmount,
    minuteWithin15to30MinRatio: minuteAnalysisTotalCount > 0 ? (minuteWithin15to30MinCount / minuteAnalysisTotalCount) * 100 : 0,
    minuteOver30MinCount,
    minuteOver30MinAmount,
    minuteOver30MinRatio: minuteAnalysisTotalCount > 0 ? (minuteOver30MinCount / minuteAnalysisTotalCount) * 100 : 0,
    minuteInvalidCount,
    minuteInvalidRatio: (minuteAnalysisTotalCount + minuteInvalidCount) > 0 ? (minuteInvalidCount / (minuteAnalysisTotalCount + minuteInvalidCount)) * 100 : 0,
    minuteDropCount,
    minuteDropRatio: minuteAnalysisTotalCount > 0 ? (minuteDropCount / minuteAnalysisTotalCount) * 100 : 0,
    minuteAvgTime: minuteAnalysisTimeCount > 0 ? minuteAnalysisTimeSum / minuteAnalysisTimeCount : 0,

    // 24小時交易分布
    hourlyDistribution: hourlyDistribution.map((data, hour) => {
      const maxCount = Math.max(...hourlyDistribution.map(h => h.count)) || 1;
      return {
        hour: `${hour.toString().padStart(2, '0')}:00`,
        count: data.count,
        amount: data.amount,
        percent: (data.count / maxCount * 100)
      };
    }),
    // 時間序列（按日期+小時，用於多日圖表）
    hourlySeries: Object.entries(hourlySeries)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        const [date, hourStr] = key.split('_');
        return { date, hour: parseInt(hourStr), count: data.count, amount: data.amount };
      }),

    // 时间分布指标
    within2MinCount,
    within2MinRatio: totalApplicationCount > 0 ? (within2MinCount / totalApplicationCount) * 100 : 0,
    within3to5MinCount,
    within3to5MinRatio: totalApplicationCount > 0 ? (within3to5MinCount / totalApplicationCount) * 100 : 0,
    within5to15MinCount,
    within5to15MinRatio: totalApplicationCount > 0 ? (within5to15MinCount / totalApplicationCount) * 100 : 0,
    within15to30MinCount,
    within15to30MinRatio: totalApplicationCount > 0 ? (within15to30MinCount / totalApplicationCount) * 100 : 0,
    over30MinCount,
    over30MinRatio: totalApplicationCount > 0 ? (over30MinCount / totalApplicationCount) * 100 : 0,
    invalidCount: invalidRecordsCount,
    invalidRatio: (totalApplicationCount + invalidRecordsCount) > 0 ? (invalidRecordsCount / (totalApplicationCount + invalidRecordsCount)) * 100 : 0,
    avgTimeSeconds: validWithTimeCount > 0 ? validWithTimeSum / validWithTimeCount : 0,
    medianTimeSeconds: medianTime,

    // 极速区域指标
    jisuApplicationCount,
    jisuApplicationAmount,
    normalCardAppCount,
    normalCardAppAmount,
    baoCardAppCount,
    baoCardAppAmount,
    expressCardAppCount,
    expressCardAppAmount,
    waitingForMatchCount,
    waitingForMatchAmount,
    noCard06Count,
    jisuInvalidApplicationCount,
    jisuInvalidApplicationAmount,
    normalMatchCount: normalCardAppCount,
    normalMatchAmount,
    baoMatchCount: baoCardAppCount,
    baoMatchAmount,
    expressMatchCount: expressCardAppCount,
    expressMatchAmount,
    totalMatchCount,
    totalMatchAmount,
    normalOrderSuccessCount,
    normalOrderSuccessAmount,
    baoOrderSuccessCount,
    baoOrderSuccessAmount,
    expressOrderSuccessCount,
    expressOrderSuccessAmount,
    creditScoreSuccessCount,
    creditScoreSuccessAmount,
    creditScoreAvgTime: creditScoreTimeCount > 0 ? creditScoreTimeSum / creditScoreTimeCount : 0,
    creditScoreNoImageCount,
    creditScoreNoImageAvgTime: creditScoreNoImageTimeCount > 0 ? creditScoreNoImageTimeSum / creditScoreNoImageTimeCount : 0,
    totalOrderSuccessCount,
    totalOrderSuccessAmount,
    noCreditDowngradeTotal,
    noCreditDowngradeByAmount,
    noCreditDowngradeAvgTime: noCreditDowngradeTimeCount > 0 ? noCreditDowngradeTimeSum / noCreditDowngradeTimeCount : 0,

    // c2c
    c2cCount,
    c2cAmount,
    c2cConfirmCount,
    c2cConfirmAvgTime: c2cConfirmTimeCount > 0 ? c2cConfirmTimeSum / c2cConfirmTimeCount : 0,
    c2cManualAuditCount,
    c2cAuditSuccessAvgTime: c2cManualAuditCount > 0 ? c2cAuditTimeSum / c2cManualAuditCount : 0,
    c2cOver11MinSuccessCount,
    c2cFraudBlacklistCount,
    c2cCardVerifyCount,

    // 三方代收
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
    // 动态三方代收统计（按配置卡代号）
    thirdPartyByCard,
    configuredThirdPartyCards,

    // 全局三方代收 (所有商户)
    globalThirdPartyCount,
    globalThirdPartyAmount,
    globalThirdPartyHuitongCount,
    globalThirdPartyHuitongAmount,
    globalThirdPartyDoudouCount,
    globalThirdPartyDoudouAmount,
    globalThirdPartyUCCount,
    globalThirdPartyUCAmount,
    globalThirdPartyOtherCount,
    globalThirdPartyOtherAmount,

    // 支付宝商户
    alipayApplicationCount,
    alipayApplicationAmount,
    alipayNormalCardAppCount,
    alipayExpressCardAppCount,
    alipayJisuTikaCount,
    alipayJisuTibaoCount,
    alipayWaitingForMatchCount,
    alipayNormalMatchCount: alipayNormalCardAppCount,
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
    alipayCreditScoreAvgTime: alipayCreditScoreTimeCount > 0 ? alipayCreditScoreTimeSum / alipayCreditScoreTimeCount : 0,
    alipayCreditNoTuwenCount,
    alipayCreditNoTuwenAvgTime: alipayCreditNoTuwenTimeCount > 0 ? alipayCreditNoTuwenTimeSum / alipayCreditNoTuwenTimeCount : 0,
    alipayTotalOrderSuccessCount,
    alipayTotalOrderSuccessAmount,
    alipayNoCreditDowngradeTotal,
    alipayNoCreditDowngradeByAmount,
    alipayNoCreditDowngradeAvgTime: alipayNoCreditDowngradeTimeCount > 0 ? alipayNoCreditDowngradeTimeSum / alipayNoCreditDowngradeTimeCount : 0,
    alipayNoCard06Count: 0,
    alipayInvalidApplicationCount,

    // 支付宝 c2c
    alipayC2cCount,
    alipayC2cAmount,
    alipayC2cConfirmCount,
    alipayC2cConfirmAvgTime: alipayC2cConfirmTimeCount > 0 ? alipayC2cConfirmTimeSum / alipayC2cConfirmTimeCount : 0,
    alipayC2cManualAuditCount,
    alipayC2cAuditSuccessAvgTime: alipayC2cManualAuditCount > 0 ? alipayC2cAuditTimeSum / alipayC2cManualAuditCount : 0,
    alipayC2cOver11MinSuccessCount,
    alipayC2cFraudBlacklistCount,
    alipayC2cCardVerifyCount,

    // 支付宝三方代收
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
    // 动态支付宝三方代收统计
    alipayThirdPartyByCard,
    alipayThirdPartyOtherAmount,

    // 支付宝宝转卡/宝转宝
    alipayBaoZhuanKaCount,
    alipayBaoZhuanKaAmount,
    alipayBaoZhuanKaSuccessCount,
    alipayBaoZhuanKaSuccessAmount,
    alipayBaoZhuanBaoCount,
    alipayBaoZhuanBaoAmount,
    alipayBaoZhuanBaoSuccessCount,
    alipayBaoZhuanBaoSuccessAmount,
    alipayOverallMatchRate,

    // 微信商户
    wechatApplicationCount,
    wechatApplicationAmount,
    wechatNormalCardAppCount,
    wechatExpressBaoAppCount,
    wechatJisuTikaAppCount,
    wechatJisuTibaoAppCount,
    wechatWaitingForMatchCount,
    wechatInvalidApplicationCount,
    wechatNormalMatchCount: wechatNormalCardAppCount,
    wechatNormalMatchAmount,
    wechatExpressBaoMatchCount: wechatExpressBaoAppCount,
    wechatExpressBaoMatchAmount,
    wechatJisuTikaMatchCount: wechatJisuTikaAppCount,
    wechatJisuTikaMatchAmount,
    wechatJisuTibaoMatchCount: wechatJisuTibaoAppCount,
    wechatJisuTibaoMatchAmount,
    wechatTotalMatchCount,
    wechatTotalMatchAmount,
    wechatNormalOrderSuccessCount,
    wechatNormalOrderSuccessAmount,
    wechatBaoOrderSuccessCount,
    wechatBaoOrderSuccessAmount,
    wechatJisuTikaOrderSuccessCount,
    wechatJisuTikaOrderSuccessAmount,
    wechatJisuTibaoOrderSuccessCount,
    wechatJisuTibaoOrderSuccessAmount,
    wechatTotalOrderSuccessCount,
    wechatTotalOrderSuccessAmount,
    wechatCreditScoreSuccessCount,
    wechatCreditScoreSuccessAmount,
    wechatCreditScoreAvgTime: wechatCreditScoreTimeCount > 0 ? wechatCreditScoreTimeSum / wechatCreditScoreTimeCount : 0,
    wechatNoCreditDowngradeTotal,
    wechatNoCreditDowngradeByAmount,
    wechatNoCreditDowngradeAvgTime: wechatNoCreditDowngradeTimeCount > 0 ? wechatNoCreditDowngradeTimeSum / wechatNoCreditDowngradeTimeCount : 0,
    wechatNoCard06Count: 0,

    // 微信 c2c
    wechatC2cCount,
    wechatC2cAmount,
    wechatUserConfirmCount,
    wechatC2cConfirmAvgTime: wechatC2cConfirmTimeCount > 0 ? wechatC2cConfirmTimeSum / wechatC2cConfirmTimeCount : 0,
    wechatManualAuditPassCount,
    wechatC2cAuditSuccessAvgTime: wechatManualAuditPassCount > 0 ? wechatC2cAuditTimeSum / wechatManualAuditPassCount : 0,
    wechatOver11minCount,

    // 微信三方代收
    wechatThirdPartyCount,
    wechatThirdPartyAmount,
    wechatThirdPartyOtherCount,
    wechatThirdPartyOtherAmount,
    wechatThirdPartyByCard,

    // 6. 商业平台 - CNX交易所 + 外部商戶_500彩
    commercialPlatformMerchants,
    commercialPlatformTotalAppCount,
    commercialPlatformTotalAppAmount,
    commercialPlatformTotalSuccessCount,
    commercialPlatformTotalSuccessAmount,
    // 支付寶 商業平台
    alipayCommercialPlatformTotalAppCount,
    alipayCommercialPlatformTotalAppAmount,
    alipayCommercialPlatformTotalSuccessCount,
    alipayCommercialPlatformTotalSuccessAmount,
    // 微信 商業平台
    wechatCommercialPlatformTotalAppCount,
    wechatCommercialPlatformTotalAppAmount,
    wechatCommercialPlatformTotalSuccessCount,
    wechatCommercialPlatformTotalSuccessAmount,

    // JS等待无配对
    jsWaitingNoMatch,
    bankCardJsWaitingNoMatch,
    alipayJsWaitingNoMatch,
  };
};
