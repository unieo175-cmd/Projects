import { computed } from 'vue'

export function usePmMetrics(depositRecords, withdrawRecords) {
  // 提現去重（PRD 4.12）：轉帳完成優先，否則保留最後一筆
  const deduplicateWithdraw = (records) => {
    const map = {}
    records.forEach(r => {
      const existing = map[r.id]
      if (!existing) {
        map[r.id] = r
      } else {
        const existingComplete = ['轉帳完成', '转帐完成', '转账完成'].includes(existing.transferStatus || '')
        const newComplete = ['轉帳完成', '转帐完成', '转账完成'].includes(r.transferStatus || '')
        if (newComplete && !existingComplete) map[r.id] = r
        else if (!existingComplete) map[r.id] = r
      }
    })
    return Object.values(map)
  }

  const pmAnalysisMetrics = computed(() => {
    const depositData = depositRecords.value
    const withdrawData = withdrawRecords.value

    if (depositData.length === 0) return null

    // ===== PM專用：通用計算函數 =====
    const calculateCategoryMetrics = (orderSuccessRecords, totalApplicationCount, avgTimeRecords = null) => {
      const successCount = orderSuccessRecords.length
      if (successCount === 0) return { successRate: 0, within3MinRate: 0, avgTime: 0 }

      // 成功率 = 訂單成功筆數 / 總申請筆數 * 100%
      const successRate = totalApplicationCount > 0 ? (successCount / totalApplicationCount) * 100 : 0

      // 3分內佔比 = 處理時間 < 180秒的筆數 / 訂單成功筆數 * 100%
      const within3MinCount = orderSuccessRecords.filter(r =>
        r.processingTime !== null && r.processingTime >= 0 && r.processingTime < 180
      ).length
      const within3MinRate = successCount > 0 ? (within3MinCount / successCount) * 100 : 0

      // 平均處理時間
      const recordsForAvg = avgTimeRecords || orderSuccessRecords
      const recordsWithTime = recordsForAvg.filter(r =>
        r.processingTime !== null && r.processingTime >= 0
      )
      const avgTime = recordsWithTime.length > 0
        ? recordsWithTime.reduce((sum, r) => sum + r.processingTime, 0) / recordsWithTime.length
        : 0

      return { successRate, within3MinRate, avgTime }
    }

    // ===== PM專用：提現計算函數 =====
    const calculateWithdrawCategoryMetrics = (records, totalApplicationCount = null) => {
      if (records.length === 0) return { successRate: 0, within3MinRate: 0, avgTime: 0, successCount: 0, totalCount: 0 }

      // 成功提現：轉帳成功 且 實際轉出金額不等於0
      const successRecords = records.filter(r => {
        const transferStatus = r.transferStatus || ''
        const status = r.status || ''
        const isTransferSuccess = transferStatus === '轉帳完成' || transferStatus === '转帐完成' || transferStatus === '转账完成' ||
               status.includes('提現完成') || status.includes('提现完成')
        const actualAmount = r.actualAmount || r.payoutAmount || 0
        return isTransferSuccess && actualAmount !== 0
      })
      const successCount = successRecords.length
      const totalCount = totalApplicationCount || records.length

      const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0

      const within2MinRecords = successRecords.filter(r =>
        r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0 && r.avgTimeSeconds <= 120
      )
      const within3MinRate = successCount > 0 ? (within2MinRecords.length / successCount) * 100 : 0

      const recordsWithTime = successRecords.filter(r =>
        r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0
      )
      const avgTime = recordsWithTime.length > 0
        ? recordsWithTime.reduce((sum, r) => sum + r.avgTimeSeconds, 0) / recordsWithTime.length
        : 0

      return { successRate, within3MinRate, avgTime, successCount, totalCount }
    }

    // ===== PM專用：判斷是否排除 =====
    const isExcludedMerchant = (merchant) => {
      if (!merchant) return false
      const merchantLower = merchant.toLowerCase()
      const hasOffline = merchant.includes('線下') || merchant.includes('线下')
      const hasTest = merchantLower.includes('test')
      const hasQa = merchantLower.includes('qa')
      return hasOffline || hasTest || hasQa
    }

    // 判斷是否線下商戶（供其他分類使用）
    const isOfflineMerchant = (merchant) => merchant && (merchant.includes('線下') || merchant.includes('线下'))

    // ===== 1. 整體 (PM專用計算) =====
    // 範圍：商戶排除包含「線下」、「test」、「qa」的商戶名稱
    const overallRecords = depositData.filter(r => !isExcludedMerchant(r.merchant))

    // 自動到帳：狀態不包含「補單」，且到帳金額 > 0
    const overallAutoDepositRecords = overallRecords.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      const isManual = status.includes('補單') || status.includes('补单')
      return !isManual
    })

    // 補單筆數：狀態包含「補單」或「商戶確認到帳」，且到帳金額 > 0
    const overallManualRecords = overallRecords.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      const isManual = status.includes('補單') || status.includes('补单')
      const isMerchantConfirm = status.includes('商戶確認到帳') || status.includes('商户确认到账')
      return isManual || isMerchantConfirm
    })

    // 總充值筆數 = 自動到帳 + 補單
    const overallTotalCount = overallAutoDepositRecords.length + overallManualRecords.length
    const overallAutoCount = overallAutoDepositRecords.length

    // 成功率 = 自動到帳筆數 / 總充值筆數
    const overallSuccessRate = overallTotalCount > 0 ? (overallAutoCount / overallTotalCount) * 100 : 0

    // 3分佔比：自動到帳筆數中，處理時間 <= 180秒的筆數 / 自動到帳筆數
    const overallWithin3MinRecords = overallAutoDepositRecords.filter(r =>
      r.processingTime !== null && r.processingTime >= 0 && r.processingTime <= 180
    )
    const overallWithin3MinRate = overallAutoCount > 0 ? (overallWithin3MinRecords.length / overallAutoCount) * 100 : 0

    // 平均處理時間：自動到帳筆數的平均時間
    const overallRecordsWithTime = overallAutoDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0)
    const overallAvgTime = overallRecordsWithTime.length > 0
      ? overallRecordsWithTime.reduce((sum, r) => sum + r.processingTime, 0) / overallRecordsWithTime.length
      : 0

    // ===== 2. 支付寶 (PM專用計算) =====
    // 範圍：商戶包含「支付宝」或「支付寶」（簡繁體），排除線下/test/qa
    const alipayRecords = depositData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      const merchant = r.merchant || ''
      return merchant.includes('支付宝') || merchant.includes('支付寶')
    })

    // 自動到帳：狀態不包含「補單」，且到帳金額 > 0
    const alipayAutoDepositRecords = alipayRecords.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      const isManual = status.includes('補單') || status.includes('补单')
      return !isManual
    })

    // 補單筆數：狀態包含「補單」或「商戶確認到帳」，且到帳金額 > 0
    const alipayManualRecords = alipayRecords.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      const isManual = status.includes('補單') || status.includes('补单')
      const isMerchantConfirm = status.includes('商戶確認到帳') || status.includes('商户确认到账')
      return isManual || isMerchantConfirm
    })

    const alipayTotalCount = alipayAutoDepositRecords.length + alipayManualRecords.length
    const alipayAutoCount = alipayAutoDepositRecords.length
    const alipaySuccessRate = alipayTotalCount > 0 ? (alipayAutoCount / alipayTotalCount) * 100 : 0
    const alipayWithin3MinRecords = alipayAutoDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0 && r.processingTime <= 180)
    const alipayWithin3MinRate = alipayAutoCount > 0 ? (alipayWithin3MinRecords.length / alipayAutoCount) * 100 : 0
    const alipayRecordsWithTime = alipayAutoDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0)
    const alipayAvgTime = alipayRecordsWithTime.length > 0 ? alipayRecordsWithTime.reduce((sum, r) => sum + r.processingTime, 0) / alipayRecordsWithTime.length : 0

    // ===== 3. 微信 (PM專用計算) =====
    // 範圍：商戶包含「微信」，排除線下/test/qa
    const wechatRecords = depositData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      const merchant = r.merchant || ''
      return merchant.includes('微信')
    })

    // 自動到帳：狀態不包含「補單」，且到帳金額 > 0
    const wechatAutoDepositRecords = wechatRecords.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      const isManual = status.includes('補單') || status.includes('补单')
      return !isManual
    })

    // 補單筆數：狀態包含「補單」或「商戶確認到帳」，且到帳金額 > 0
    const wechatManualRecords = wechatRecords.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      const isManual = status.includes('補單') || status.includes('补单')
      const isMerchantConfirm = status.includes('商戶確認到帳') || status.includes('商户确认到账')
      return isManual || isMerchantConfirm
    })

    const wechatTotalCount = wechatAutoDepositRecords.length + wechatManualRecords.length
    const wechatAutoCount = wechatAutoDepositRecords.length
    const wechatSuccessRate = wechatTotalCount > 0 ? (wechatAutoCount / wechatTotalCount) * 100 : 0
    const wechatWithin3MinRecords = wechatAutoDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0 && r.processingTime <= 180)
    const wechatWithin3MinRate = wechatAutoCount > 0 ? (wechatWithin3MinRecords.length / wechatAutoCount) * 100 : 0
    const wechatRecordsWithTime = wechatAutoDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0)
    const wechatAvgTime = wechatRecordsWithTime.length > 0 ? wechatRecordsWithTime.reduce((sum, r) => sum + r.processingTime, 0) / wechatRecordsWithTime.length : 0

    // ===== 4. 金寶 (PM專用計算) =====
    // 範圍：1.商戶排除線下/test/qa 2.銀行卡代號GB開頭但排除GB-Dahaomen
    const gbRecords = depositData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      if (!r.bankCardCode) return false
      const code = r.bankCardCode.toUpperCase()
      return code.startsWith('GB') && !code.startsWith('GB-DAHAOMEN')
    })

    // 自動到帳：狀態不包含「補單」，且到帳金額 > 0
    const gbAutoDepositRecords = gbRecords.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      const isManual = status.includes('補單') || status.includes('补单')
      return !isManual
    })

    // 補單：狀態包含「補單」或「商戶確認到帳」，且到帳金額 > 0
    const gbManualRecords = gbRecords.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      const isManual = status.includes('補單') || status.includes('补单')
      const isMerchantConfirm = status.includes('商戶確認到帳') || status.includes('商户确认到账')
      return isManual || isMerchantConfirm
    })

    const gbTotalCount = gbAutoDepositRecords.length + gbManualRecords.length
    const gbAutoCount = gbAutoDepositRecords.length
    const gbSuccessRate = gbTotalCount > 0 ? (gbAutoCount / gbTotalCount) * 100 : 0
    const gbWithin3MinRecords = gbAutoDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0 && r.processingTime <= 180)
    const gbWithin3MinRate = gbAutoCount > 0 ? (gbWithin3MinRecords.length / gbAutoCount) * 100 : 0
    const gbRecordsWithTime = gbAutoDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0)
    const gbAvgTime = gbRecordsWithTime.length > 0 ? gbRecordsWithTime.reduce((sum, r) => sum + r.processingTime, 0) / gbRecordsWithTime.length : 0

    // ===== 5. 極速 (PM專用計算) =====
    // 範圍：1.商戶排除線下/test/qa 2.銀行卡代號AUCTION開頭
    const auctionRecords = depositData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      if (!r.bankCardCode) return false
      const code = r.bankCardCode.toUpperCase()
      return code.startsWith('AUCTION')
    })

    // 自動到帳：狀態不包含「補單」，且到帳金額 > 0
    const auctionAutoDepositRecords = auctionRecords.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      const isManual = status.includes('補單') || status.includes('补单')
      return !isManual
    })

    // 補單：狀態包含「補單」或「商戶確認到帳」，且到帳金額 > 0
    const auctionManualRecords = auctionRecords.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      const isManual = status.includes('補單') || status.includes('补单')
      const isMerchantConfirm = status.includes('商戶確認到帳') || status.includes('商户确认到账')
      return isManual || isMerchantConfirm
    })

    const auctionTotalCount = auctionAutoDepositRecords.length + auctionManualRecords.length
    const auctionAutoCount = auctionAutoDepositRecords.length
    const auctionSuccessRate = auctionTotalCount > 0 ? (auctionAutoCount / auctionTotalCount) * 100 : 0
    const auctionWithin3MinRecords = auctionAutoDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0 && r.processingTime <= 180)
    const auctionWithin3MinRate = auctionAutoCount > 0 ? (auctionWithin3MinRecords.length / auctionAutoCount) * 100 : 0
    const auctionRecordsWithTime = auctionAutoDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0)
    const auctionAvgTime = auctionRecordsWithTime.length > 0 ? auctionRecordsWithTime.reduce((sum, r) => sum + r.processingTime, 0) / auctionRecordsWithTime.length : 0

    // ===== 6. 三方 (PM專用計算) =====
    // 範圍：1.商戶排除線下/test/qa 2.非GB/AUCTION開頭，或GB-DAHAOMEN
    const thirdPartyRecords = depositData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      if (!r.bankCardCode) return false
      const code = r.bankCardCode.toUpperCase()
      // GB-DAHAOMEN 屬於三方
      if (code.startsWith('GB-DAHAOMEN')) return true
      // 非GB/AUCTION開頭
      if (code.startsWith('GB') || code.startsWith('AUCTION')) return false
      return true
    })

    // 自動到帳：狀態不包含「補單」，且到帳金額 > 0
    const thirdPartyAutoDepositRecords = thirdPartyRecords.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      const isManual = status.includes('補單') || status.includes('补单')
      return !isManual
    })

    // 補單：狀態包含「補單」或「商戶確認到帳」，且到帳金額 > 0
    const thirdPartyManualRecords = thirdPartyRecords.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      const isManual = status.includes('補單') || status.includes('补单')
      const isMerchantConfirm = status.includes('商戶確認到帳') || status.includes('商户确认到账')
      return isManual || isMerchantConfirm
    })

    const thirdPartyTotalCount = thirdPartyAutoDepositRecords.length + thirdPartyManualRecords.length
    const thirdPartyAutoCount = thirdPartyAutoDepositRecords.length
    const thirdPartySuccessRate = thirdPartyTotalCount > 0 ? (thirdPartyAutoCount / thirdPartyTotalCount) * 100 : 0
    const thirdPartyWithin3MinRecords = thirdPartyAutoDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0 && r.processingTime <= 180)
    const thirdPartyWithin3MinRate = thirdPartyAutoCount > 0 ? (thirdPartyWithin3MinRecords.length / thirdPartyAutoCount) * 100 : 0
    const thirdPartyRecordsWithTime = thirdPartyAutoDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0)
    const thirdPartyAvgTime = thirdPartyRecordsWithTime.length > 0 ? thirdPartyRecordsWithTime.reduce((sum, r) => sum + r.processingTime, 0) / thirdPartyRecordsWithTime.length : 0

    // ===== 7. 非正向信評 (PM專用計算) =====
    // 範圍：1.商戶排除線下/test/qa 2.狀態包含"信用"或"信評"開頭
    const creditRecords = depositData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      const status = r.status || ''
      return status.startsWith('信用') || status.startsWith('信评') || status.startsWith('信評')
    })

    // 自動到帳：狀態不包含「補單」，且到帳金額 > 0
    const creditAutoDepositRecords = creditRecords.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      const isManual = status.includes('補單') || status.includes('补单')
      return !isManual
    })

    // 補單：狀態包含「補單」或「商戶確認到帳」，且到帳金額 > 0
    const creditManualRecords = creditRecords.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      const isManual = status.includes('補單') || status.includes('补单')
      const isMerchantConfirm = status.includes('商戶確認到帳') || status.includes('商户确认到账')
      return isManual || isMerchantConfirm
    })

    const creditTotalCount = creditAutoDepositRecords.length + creditManualRecords.length
    const creditAutoCount = creditAutoDepositRecords.length
    const creditSuccessRate = creditTotalCount > 0 ? (creditAutoCount / creditTotalCount) * 100 : 0
    const creditWithin3MinRecords = creditAutoDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0 && r.processingTime <= 180)
    const creditWithin3MinRate = creditAutoCount > 0 ? (creditWithin3MinRecords.length / creditAutoCount) * 100 : 0
    const creditRecordsWithTime = creditAutoDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0)
    const creditAvgTime = creditRecordsWithTime.length > 0 ? creditRecordsWithTime.reduce((sum, r) => sum + r.processingTime, 0) / creditRecordsWithTime.length : 0

    // ===== 提現計算（各分類均去重）=====
    const withdrawOverall = calculateWithdrawCategoryMetrics(
      deduplicateWithdraw(withdrawData.filter(r => !isExcludedMerchant(r.merchant)))
    )

    const withdrawAlipay = calculateWithdrawCategoryMetrics(
      deduplicateWithdraw(withdrawData.filter(r => {
        if (isExcludedMerchant(r.merchant)) return false
        const bank = r.receivingBank || ''
        return bank.includes('支付宝') || bank.includes('支付寶')
      }))
    )

    const withdrawWechat = calculateWithdrawCategoryMetrics(
      deduplicateWithdraw(withdrawData.filter(r => {
        if (isExcludedMerchant(r.merchant)) return false
        return (r.receivingBank || '').includes('微信')
      }))
    )

    const withdrawGB = calculateWithdrawCategoryMetrics(
      deduplicateWithdraw(withdrawData.filter(r => {
        if (isExcludedMerchant(r.merchant)) return false
        const code = (r.payoutCardCode || '').toUpperCase()
        return code.startsWith('GB') && !code.startsWith('GB-DAHAOMEN')
      }))
    )

    const withdrawAuction = calculateWithdrawCategoryMetrics(
      deduplicateWithdraw(withdrawData.filter(r => {
        if (isExcludedMerchant(r.merchant)) return false
        return (r.payoutCardCode || '').toUpperCase().includes('AUCTION')
      }))
    )

    const withdrawThirdParty = calculateWithdrawCategoryMetrics(
      deduplicateWithdraw(withdrawData.filter(r => {
        if (isExcludedMerchant(r.merchant)) return false
        const code = (r.payoutCardCode || '').toUpperCase()
        if (!code) return false
        if (code.startsWith('GB-DAHAOMEN')) return true
        if (code.startsWith('GB') || code.startsWith('AUCTION')) return false
        return true
      }))
    )

    // 返回結果
    return [
      { category: '整體', successRate: overallSuccessRate, within3MinRate: overallWithin3MinRate, avgTime: overallAvgTime, withdrawSuccessRate: withdrawOverall.successRate, withdrawWithin3MinRate: withdrawOverall.within3MinRate, withdrawAvgTime: withdrawOverall.avgTime },
      { category: '支付寶', successRate: alipaySuccessRate, within3MinRate: alipayWithin3MinRate, avgTime: alipayAvgTime, withdrawSuccessRate: withdrawAlipay.successRate, withdrawWithin3MinRate: withdrawAlipay.within3MinRate, withdrawAvgTime: withdrawAlipay.avgTime },
      { category: '微信', successRate: wechatSuccessRate, within3MinRate: wechatWithin3MinRate, avgTime: wechatAvgTime, withdrawSuccessRate: withdrawWechat.successRate, withdrawWithin3MinRate: withdrawWechat.within3MinRate, withdrawAvgTime: withdrawWechat.avgTime },
      { category: '金寶', successRate: gbSuccessRate, within3MinRate: gbWithin3MinRate, avgTime: gbAvgTime, withdrawSuccessRate: withdrawGB.successRate, withdrawWithin3MinRate: withdrawGB.within3MinRate, withdrawAvgTime: withdrawGB.avgTime },
      { category: '極速', successRate: auctionSuccessRate, within3MinRate: auctionWithin3MinRate, avgTime: auctionAvgTime, withdrawSuccessRate: withdrawAuction.successRate, withdrawWithin3MinRate: withdrawAuction.within3MinRate, withdrawAvgTime: withdrawAuction.avgTime },
      { category: '三方', successRate: thirdPartySuccessRate, within3MinRate: thirdPartyWithin3MinRate, avgTime: thirdPartyAvgTime, withdrawSuccessRate: withdrawThirdParty.successRate, withdrawWithin3MinRate: withdrawThirdParty.within3MinRate, withdrawAvgTime: withdrawThirdParty.avgTime },
      { category: '非正向信評', successRate: creditSuccessRate, within3MinRate: creditWithin3MinRate, avgTime: creditAvgTime, withdrawSuccessRate: null, withdrawWithin3MinRate: null, withdrawAvgTime: null }
    ]
  })

  // ===== PM 專用筆數計算 =====
  const pmCountMetrics = computed(() => {
    const depositData = depositRecords.value
    const withdrawData = withdrawRecords.value

    if (depositData.length === 0) return null

    // 判斷是否排除的商戶
    const isExcludedMerchant = (merchant) => {
      if (!merchant) return false
      const merchantLower = merchant.toLowerCase()
      const hasOffline = merchant.includes('線下') || merchant.includes('线下')
      const hasTest = merchantLower.includes('test')
      const hasQa = merchantLower.includes('qa')
      return hasOffline || hasTest || hasQa
    }

    // 計算單一分類的筆數指標
    const calculateCountMetrics = (records, successRecords, withdrawRecords = null) => {
      // 自動到帳：狀態不包含「補單」，且到帳金額 > 0
      const autoDepositRecords = records.filter(r => {
        if (r.receivedAmount <= 0) return false
        const status = r.status || ''
        const isManual = status.includes('補單') || status.includes('补单')
        return !isManual
      })

      // 補單筆數：狀態包含「補單」或「商戶確認到帳」，且到帳金額 > 0
      const manualRecords = records.filter(r => {
        if (r.receivedAmount <= 0) return false
        const status = r.status || ''
        const isManual = status.includes('補單') || status.includes('补单')
        const isMerchantConfirm = status.includes('商戶確認到帳') || status.includes('商户确认到账')
        return isManual || isMerchantConfirm
      })

      const autoDepositCount = autoDepositRecords.length
      const manualCount = manualRecords.length
      const totalDepositCount = autoDepositCount + manualCount

      // 無效申請筆數：狀態包含「未充值」，且到帳金額等於0
      const invalidRecords = records.filter(r => {
        if (r.receivedAmount !== 0) return false
        const status = r.status || ''
        return status.includes('未充值') || status.includes('未充值')
      })
      const invalidCount = invalidRecords.length

      // 自動到帳時長：自動到帳的筆數的「通知時間-建立時間」的平均時間
      const autoWithTime = autoDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0)
      const autoDepositTime = autoWithTime.length > 0
        ? autoWithTime.reduce((sum, r) => sum + r.processingTime, 0) / autoWithTime.length
        : 0

      // 平均充值時長：（自動到帳 + 補單）的「通知時間-建立時間」的平均時間
      const allDepositRecords = [...autoDepositRecords, ...manualRecords]
      const allWithTime = allDepositRecords.filter(r => r.processingTime !== null && r.processingTime >= 0)
      const avgDepositTime = allWithTime.length > 0
        ? allWithTime.reduce((sum, r) => sum + r.processingTime, 0) / allWithTime.length
        : 0

      // 提現計算
      let totalWithdrawCount = null
      let autoWithdrawCount = null
      let autoWithdrawTime = null
      let avgWithdrawTime = null

      if (withdrawRecords !== null) {
        // 成功提現：轉帳成功 且 實際轉出金額不等於0
        const successWithdraw = withdrawRecords.filter(r => {
          const transferStatus = r.transferStatus || ''
          const status = r.status || ''
          const isTransferSuccess = transferStatus === '轉帳完成' || transferStatus === '转帐完成' || transferStatus === '转账完成' ||
                 status.includes('提現完成') || status.includes('提现完成')
          const actualAmount = r.actualAmount || r.payoutAmount || 0
          return isTransferSuccess && actualAmount !== 0
        })
        totalWithdrawCount = withdrawRecords.length
        autoWithdrawCount = successWithdraw.length

        const withdrawWithTime = successWithdraw.filter(r => r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0)
        autoWithdrawTime = withdrawWithTime.length > 0
          ? withdrawWithTime.reduce((sum, r) => sum + r.avgTimeSeconds, 0) / withdrawWithTime.length
          : 0
        avgWithdrawTime = autoWithdrawTime
      }

      return {
        totalDepositCount,
        manualCount,
        invalidCount,
        autoDepositCount,
        autoDepositTime,
        avgDepositTime,
        totalWithdrawCount,
        autoWithdrawCount,
        autoWithdrawTime,
        avgWithdrawTime
      }
    }

    // ===== 整體 =====
    const overallRecords = depositData.filter(r => !isExcludedMerchant(r.merchant))
    const overallSuccessRecords = overallRecords.filter(r => r.receivedAmount > 0)
    const overallWithdrawRecords = deduplicateWithdraw(withdrawData.filter(r => !isExcludedMerchant(r.merchant)))
    const overallCount = calculateCountMetrics(overallRecords, overallSuccessRecords, overallWithdrawRecords)

    // ===== 支付寶 =====
    const alipayRecords = depositData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      const merchant = r.merchant || ''
      return merchant.includes('支付宝') || merchant.includes('支付寶')
    })
    const alipaySuccessRecords = alipayRecords.filter(r => r.receivedAmount > 0)
    const alipayWithdrawRecords = deduplicateWithdraw(withdrawData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      const bank = r.receivingBank || ''
      return bank.includes('支付宝') || bank.includes('支付寶')
    }))
    const alipayCount = calculateCountMetrics(alipayRecords, alipaySuccessRecords, alipayWithdrawRecords)

    // ===== 微信 =====
    const wechatRecords = depositData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      const merchant = r.merchant || ''
      return merchant.includes('微信')
    })
    const wechatSuccessRecords = wechatRecords.filter(r => r.receivedAmount > 0)
    const wechatWithdrawRecords = deduplicateWithdraw(withdrawData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      return (r.receivingBank || '').includes('微信')
    }))
    const wechatCount = calculateCountMetrics(wechatRecords, wechatSuccessRecords, wechatWithdrawRecords)

    // ===== 金寶 =====
    const gbRecords = depositData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      if (!r.bankCardCode) return false
      const code = r.bankCardCode.toUpperCase()
      return code.startsWith('GB') && !code.startsWith('GB-DAHAOMEN')
    })
    const gbSuccessRecords = gbRecords.filter(r => r.receivedAmount > 0)
    const gbWithdrawRecords = deduplicateWithdraw(withdrawData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      const code = (r.payoutCardCode || '').toUpperCase()
      return code.startsWith('GB') && !code.startsWith('GB-DAHAOMEN')
    }))
    const gbCount = calculateCountMetrics(gbRecords, gbSuccessRecords, gbWithdrawRecords)

    // ===== 極速 =====
    const auctionRecords = depositData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      if (!r.bankCardCode) return false
      const code = r.bankCardCode.toUpperCase()
      return code.startsWith('AUCTION')
    })
    const auctionSuccessRecords = auctionRecords.filter(r => r.receivedAmount > 0)
    const auctionWithdrawRecords = deduplicateWithdraw(withdrawData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      return (r.payoutCardCode || '').toUpperCase().includes('AUCTION')
    }))
    const auctionCount = calculateCountMetrics(auctionRecords, auctionSuccessRecords, auctionWithdrawRecords)

    // ===== 三方 =====
    const thirdPartyRecords = depositData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      if (!r.bankCardCode) return false
      const code = r.bankCardCode.toUpperCase()
      if (code.startsWith('GB-DAHAOMEN')) return true
      if (code.startsWith('GB') || code.startsWith('AUCTION')) return false
      return true
    })
    const thirdPartySuccessRecords = thirdPartyRecords.filter(r => r.receivedAmount > 0)
    const thirdPartyWithdrawRecords = deduplicateWithdraw(withdrawData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      const code = (r.payoutCardCode || '').toUpperCase()
      if (!code) return false
      if (code.startsWith('GB-DAHAOMEN')) return true
      if (code.startsWith('GB') || code.startsWith('AUCTION')) return false
      return true
    }))
    const thirdPartyCount = calculateCountMetrics(thirdPartyRecords, thirdPartySuccessRecords, thirdPartyWithdrawRecords)

    // ===== 非正向信評 =====
    const creditRecords = depositData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      const status = r.status || ''
      return status.startsWith('信用') || status.startsWith('信评') || status.startsWith('信評')
    })
    const creditSuccessRecords = creditRecords.filter(r => r.receivedAmount > 0)
    const creditCount = calculateCountMetrics(creditRecords, creditSuccessRecords, null)

    return [
      { category: '整體', ...overallCount },
      { category: '支付寶', ...alipayCount },
      { category: '微信', ...wechatCount },
      { category: '金寶', ...gbCount },
      { category: '極速', ...auctionCount },
      { category: '三方', ...thirdPartyCount },
      { category: '非正向信評', ...creditCount }
    ]
  })

  // ===== 充值分析（整合商戶分類 + 補單類型）=====
  const combinedDepositAnalysis = computed(() => {
    const depositData = depositRecords.value

    if (depositData.length === 0) return null

    // 判斷是否排除的商戶（線下、test、qa）
    const isExcludedMerchant = (merchant) => {
      if (!merchant) return false
      const merchantLower = merchant.toLowerCase()
      return merchant.includes('線下') || merchant.includes('线下') ||
             merchantLower.includes('test') || merchantLower.includes('qa')
    }

    // 篩選：到帳金額不為0，且排除線下/test/qa商戶
    const validRecords = depositData.filter(r =>
      r.receivedAmount !== 0 && !isExcludedMerchant(r.merchant)
    )

    if (validRecords.length === 0) return null

    // 判斷商戶類型
    const getMerchantType = (merchant) => {
      if (!merchant) return '銀行卡'
      if (merchant.includes('支付宝') || merchant.includes('支付寶')) return '支付寶'
      if (merchant.includes('微信')) return '微信'
      return '銀行卡'
    }

    // 清理狀態文字（去除 <br> 標籤）
    const cleanStatus = (status) => {
      if (!status) return '未知狀態'
      return status.replace(/<br\s*\/?>/gi, ' ').trim()
    }

    // 取前4個字作為補單分類
    const getManualType = (status) => {
      const cleanedStatus = cleanStatus(status)
      return cleanedStatus.substring(0, 4) || '其他'
    }

    // 判斷是否為補單
    const isManualOrder = (status) => {
      if (!status) return false
      return status.includes('補單') || status.includes('补单') ||
             status.includes('商戶確認到帳') || status.includes('商户确认到账')
    }

    // ===== 商戶分類統計 =====
    const merchantGroups = {
      '支付寶': { count: 0, totalAmount: 0, totalTime: 0, timeCount: 0 },
      '微信': { count: 0, totalAmount: 0, totalTime: 0, timeCount: 0 },
      '銀行卡': { count: 0, totalAmount: 0, totalTime: 0, timeCount: 0 }
    }

    validRecords.forEach(record => {
      const type = getMerchantType(record.merchant)
      merchantGroups[type].count++
      merchantGroups[type].totalAmount += (record.receivedAmount || 0)
      if (record.processingTime !== null && record.processingTime >= 0) {
        merchantGroups[type].totalTime += record.processingTime
        merchantGroups[type].timeCount++
      }
    })

    // ===== 補單類型統計 =====
    const manualGroups = {}
    validRecords.filter(r => r.receivedAmount > 0 && isManualOrder(r.status)).forEach(record => {
      const type = getManualType(record.status)
      if (!manualGroups[type]) {
        manualGroups[type] = { count: 0, totalAmount: 0, totalTime: 0, timeCount: 0 }
      }
      manualGroups[type].count++
      manualGroups[type].totalAmount += (record.receivedAmount || 0)
      if (record.processingTime !== null && record.processingTime >= 0) {
        manualGroups[type].totalTime += record.processingTime
        manualGroups[type].timeCount++
      }
    })

    // 計算總計
    const totalCount = validRecords.length
    const totalAmount = validRecords.reduce((sum, r) => sum + (r.receivedAmount || 0), 0)
    const allTimeRecords = validRecords.filter(r => r.processingTime !== null && r.processingTime >= 0)
    const totalAvgTime = allTimeRecords.length > 0
      ? allTimeRecords.reduce((sum, r) => sum + r.processingTime, 0) / allTimeRecords.length
      : 0

    // 組合結果
    const result = []

    // 商戶分類
    const merchantOrder = ['支付寶', '微信', '銀行卡']
    merchantOrder.forEach(type => {
      const data = merchantGroups[type]
      result.push({
        category: type,
        count: data.count,
        countPercent: totalCount > 0 ? (data.count / totalCount) * 100 : 0,
        totalAmount: data.totalAmount,
        amountPercent: totalAmount > 0 ? (data.totalAmount / totalAmount) * 100 : 0,
        avgTime: data.timeCount > 0 ? data.totalTime / data.timeCount : 0,
        isTotal: false,
        isGroupHeader: false,
        isSubItem: false
      })
    })

    // 補單類型（依筆數排序）
    const manualTypes = Object.entries(manualGroups)
      .sort((a, b) => b[1].count - a[1].count)

    if (manualTypes.length > 0) {
      manualTypes.forEach(([type, data]) => {
        result.push({
          category: `┗ ${type}`,
          count: data.count,
          countPercent: totalCount > 0 ? (data.count / totalCount) * 100 : 0,
          totalAmount: data.totalAmount,
          amountPercent: totalAmount > 0 ? (data.totalAmount / totalAmount) * 100 : 0,
          avgTime: data.timeCount > 0 ? data.totalTime / data.timeCount : 0,
          isTotal: false,
          isGroupHeader: false,
          isSubItem: true
        })
      })
    }

    // 總計
    result.push({
      category: '總計',
      count: totalCount,
      countPercent: 100,
      totalAmount: totalAmount,
      amountPercent: 100,
      avgTime: totalAvgTime,
      isTotal: true,
      isGroupHeader: false,
      isSubItem: false
    })

    return result
  })

  // ===== 充值分析（依商戶分類：支付寶、微信、銀行卡）- 保留備用 =====
  const depositStatusAnalysis = computed(() => {
    const depositData = depositRecords.value

    if (depositData.length === 0) return null

    // 判斷是否排除的商戶（線下、test、qa）
    const isExcludedMerchant = (merchant) => {
      if (!merchant) return false
      const merchantLower = merchant.toLowerCase()
      return merchant.includes('線下') || merchant.includes('线下') ||
             merchantLower.includes('test') || merchantLower.includes('qa')
    }

    // 篩選：到帳金額不為0，且排除線下/test/qa商戶
    const validRecords = depositData.filter(r =>
      r.receivedAmount !== 0 && !isExcludedMerchant(r.merchant)
    )

    if (validRecords.length === 0) return null

    // 判斷商戶類型
    const getMerchantType = (merchant) => {
      if (!merchant) return '銀行卡'
      if (merchant.includes('支付宝') || merchant.includes('支付寶')) return '支付寶'
      if (merchant.includes('微信')) return '微信'
      return '銀行卡'
    }

    // 依商戶類型分組
    const merchantGroups = {
      '支付寶': { count: 0, totalAmount: 0, totalTime: 0, timeCount: 0 },
      '微信': { count: 0, totalAmount: 0, totalTime: 0, timeCount: 0 },
      '銀行卡': { count: 0, totalAmount: 0, totalTime: 0, timeCount: 0 }
    }

    validRecords.forEach(record => {
      const type = getMerchantType(record.merchant)
      merchantGroups[type].count++
      merchantGroups[type].totalAmount += (record.receivedAmount || 0)
      if (record.processingTime !== null && record.processingTime >= 0) {
        merchantGroups[type].totalTime += record.processingTime
        merchantGroups[type].timeCount++
      }
    })

    // 計算總計
    const totalCount = validRecords.length
    const totalAmount = validRecords.reduce((sum, r) => sum + (r.receivedAmount || 0), 0)

    // 轉換為陣列（固定順序：支付寶、微信、銀行卡）
    const order = ['支付寶', '微信', '銀行卡']
    const result = order.map(type => {
      const data = merchantGroups[type]
      return {
        status: type,
        count: data.count,
        countPercent: totalCount > 0 ? (data.count / totalCount) * 100 : 0,
        totalAmount: data.totalAmount,
        amountPercent: totalAmount > 0 ? (data.totalAmount / totalAmount) * 100 : 0,
        avgTime: data.timeCount > 0 ? data.totalTime / data.timeCount : 0,
        isTotal: false
      }
    })

    // 計算總計的平均時間
    const allTimeRecords = validRecords.filter(r => r.processingTime !== null && r.processingTime >= 0)
    const totalAvgTime = allTimeRecords.length > 0
      ? allTimeRecords.reduce((sum, r) => sum + r.processingTime, 0) / allTimeRecords.length
      : 0

    // 加入總計列
    result.push({
      status: '總計',
      count: totalCount,
      countPercent: 100,
      totalAmount: totalAmount,
      amountPercent: 100,
      avgTime: totalAvgTime,
      isTotal: true
    })

    return result
  })

  // ===== 補單類型分析 =====
  const manualOrderAnalysis = computed(() => {
    const depositData = depositRecords.value

    if (depositData.length === 0) return null

    // 篩選：到帳金額 > 0 且狀態包含「補單」或「商戶確認到帳」
    const manualRecords = depositData.filter(r => {
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      return status.includes('補單') || status.includes('补单') ||
             status.includes('商戶確認到帳') || status.includes('商户确认到账')
    })

    if (manualRecords.length === 0) return null

    // 清理狀態文字（去除 <br> 標籤）
    const cleanStatus = (status) => {
      if (!status) return '未知狀態'
      return status.replace(/<br\s*\/?>/gi, ' ').trim()
    }

    // 取前4個字作為分類
    const getManualType = (status) => {
      const cleanedStatus = cleanStatus(status)
      return cleanedStatus.substring(0, 4) || '其他'
    }

    // 依類型分組（前4字相同歸為同類）
    const typeGroups = {}
    manualRecords.forEach(record => {
      const type = getManualType(record.status)
      const cleanedStatus = cleanStatus(record.status)

      if (!typeGroups[type]) {
        typeGroups[type] = {
          totalCount: 0,
          totalAmount: 0,
          statusDetails: {}
        }
      }

      typeGroups[type].totalCount++
      typeGroups[type].totalAmount += (record.receivedAmount || 0)

      // 記錄各狀態明細
      if (!typeGroups[type].statusDetails[cleanedStatus]) {
        typeGroups[type].statusDetails[cleanedStatus] = { count: 0, amount: 0 }
      }
      typeGroups[type].statusDetails[cleanedStatus].count++
      typeGroups[type].statusDetails[cleanedStatus].amount += (record.receivedAmount || 0)
    })

    // 轉換為陣列格式，依筆數降序排列
    const result = Object.entries(typeGroups)
      .map(([type, data]) => {
        const details = Object.entries(data.statusDetails)
          .map(([status, info]) => ({
            status,
            count: info.count,
            amount: info.amount
          }))
          .sort((a, b) => b.count - a.count)

        return {
          type,
          totalCount: data.totalCount,
          totalAmount: data.totalAmount,
          details
        }
      })
      .sort((a, b) => b.totalCount - a.totalCount)

    return result
  })

  // ===== 充值平均時長分析 =====
  const depositTimeAnalysis = computed(() => {
    const depositData = depositRecords.value
    if (depositData.length === 0) return null

    const isExcludedMerchant = (merchant) => {
      if (!merchant) return false
      const m = merchant.toLowerCase()
      return merchant.includes('線下') || merchant.includes('线下') || m.includes('test') || m.includes('qa')
    }

    const autoRecords = depositData.filter(r => {
      if (isExcludedMerchant(r.merchant)) return false
      if (r.receivedAmount <= 0) return false
      const status = r.status || ''
      return !status.includes('補單') && !status.includes('补单')
    })

    if (autoRecords.length === 0) return null

    const withTime = autoRecords.filter(r => r.processingTime !== null && r.processingTime >= 0)
    const overallAvgSeconds = withTime.length > 0
      ? withTime.reduce((sum, r) => sum + r.processingTime, 0) / withTime.length
      : null

    // 每日拆解
    const dailyMap = {}
    autoRecords.forEach(r => {
      const dateStr = (r.requestTime || '').substring(0, 10)
      if (!dateStr) return
      if (!dailyMap[dateStr]) dailyMap[dateStr] = { totalCount: 0, totalSeconds: 0, timeCount: 0, over3MinCount: 0 }
      dailyMap[dateStr].totalCount++
      if (r.processingTime !== null && r.processingTime >= 0) {
        dailyMap[dateStr].totalSeconds += r.processingTime
        dailyMap[dateStr].timeCount++
        if (r.processingTime > 180) dailyMap[dateStr].over3MinCount++
      }
    })

    const dailyData = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, d]) => ({
        date,
        totalCount: d.totalCount,
        avgSeconds: d.timeCount > 0 ? d.totalSeconds / d.timeCount : null,
        over3MinCount: d.over3MinCount
      }))

    const buckets = [
      { label: '< 1分', min: 0, max: 60 },
      { label: '1-3分', min: 60, max: 180 },
      { label: '3-5分', min: 180, max: 300 },
      { label: '5-10分', min: 300, max: 600 },
      { label: '> 10分', min: 600, max: Infinity }
    ]

    const getChannel = (r) => {
      const merchant = r.merchant || ''
      if (merchant.includes('支付宝') || merchant.includes('支付寶')) return '支付寶'
      if (merchant.includes('微信')) return '微信'
      const code = (r.bankCardCode || '').toUpperCase()
      if (code.startsWith('AUCTION')) return '極速'
      if (code.startsWith('GB') && !code.startsWith('GB-DAHAOMEN')) return '金寶'
      return '三方'
    }

    const calcChannelRow = (records, label) => {
      const total = records.length
      const withT = records.filter(r => r.processingTime !== null && r.processingTime >= 0)
      const avgSec = withT.length > 0 ? withT.reduce((s, r) => s + r.processingTime, 0) / withT.length : null
      const dist = buckets.map(b => {
        const cnt = withT.filter(r => r.processingTime >= b.min && r.processingTime < b.max).length
        return { label: b.label, count: cnt, percent: total > 0 ? (cnt / total) * 100 : 0 }
      })
      return { channel: label, totalCount: total, avgSeconds: avgSec, distribution: dist }
    }

    const channelGroups = { '支付寶': [], '微信': [], '金寶': [], '極速': [], '三方': [] }
    autoRecords.forEach(r => { const ch = getChannel(r); channelGroups[ch].push(r) })

    const channelBreakdown = [
      calcChannelRow(autoRecords, '整體'),
      calcChannelRow(channelGroups['支付寶'], '支付寶'),
      calcChannelRow(channelGroups['微信'], '微信'),
      calcChannelRow(channelGroups['金寶'], '金寶'),
      calcChannelRow(channelGroups['極速'], '極速'),
      calcChannelRow(channelGroups['三方'], '三方')
    ]

    const fmtHMS = (sec) => {
      const s = Math.round(sec)
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
    }

    const insights = []
    const overallRow = channelBreakdown[0]
    const overallOver3Pct = overallRow.distribution.slice(2).reduce((s, b) => s + b.percent, 0)

    if (overallOver3Pct >= 30) {
      insights.push({ type: 'warn', text: `整體 >3分鐘佔比達 ${overallOver3Pct.toFixed(1)}%，超過警戒門檻` })
    }

    const channelRows = channelBreakdown.slice(1).filter(ch => ch.totalCount >= 5)
    const slowChannels = channelRows
      .filter(ch => ch.distribution.slice(2).reduce((s, b) => s + b.percent, 0) > overallOver3Pct * 1.3)
      .sort((a, b) => b.distribution.slice(2).reduce((s, x) => s + x.percent, 0) - a.distribution.slice(2).reduce((s, x) => s + x.percent, 0))

    if (slowChannels.length > 0) {
      const top = slowChannels[0]
      const topOver3 = top.distribution.slice(2).reduce((s, b) => s + b.percent, 0)
      insights.push({ type: 'warn', text: `主要慢速渠道：${top.channel}，>3分佔比 ${topOver3.toFixed(1)}%，平均時間 ${top.avgSeconds !== null ? fmtHMS(top.avgSeconds) : '--'}` })
    }

    const withAvg = channelRows.filter(ch => ch.avgSeconds !== null).sort((a, b) => b.avgSeconds - a.avgSeconds)
    if (withAvg.length > 0 && overallAvgSeconds !== null && withAvg[0].avgSeconds > overallAvgSeconds * 1.2) {
      const slowest = withAvg[0]
      insights.push({ type: 'info', text: `${slowest.channel} 平均時間最長（${fmtHMS(slowest.avgSeconds)}），比整體平均高 ${Math.round((slowest.avgSeconds - overallAvgSeconds) / 60)} 分鐘` })
    }

    const daysWithTime = dailyData.filter(d => d.avgSeconds !== null)
    if (daysWithTime.length > 0) {
      const worstDay = [...daysWithTime].sort((a, b) => b.avgSeconds - a.avgSeconds)[0]
      if (worstDay.avgSeconds > 180) {
        insights.push({ type: 'info', text: `高峰日期：${worstDay.date}，平均 ${fmtHMS(worstDay.avgSeconds)}，>3分鐘 ${worstDay.over3MinCount} 筆` })
      }
    }

    if (daysWithTime.length >= 3) {
      const half = Math.floor(daysWithTime.length / 2)
      const firstAvg = daysWithTime.slice(0, half).reduce((s, d) => s + d.avgSeconds, 0) / half
      const lastAvg = daysWithTime.slice(-half).reduce((s, d) => s + d.avgSeconds, 0) / half
      if (lastAvg > firstAvg * 1.15) {
        insights.push({ type: 'warn', text: `趨勢惡化：近期平均比初期多 ${Math.round((lastAvg - firstAvg) / 60)} 分鐘` })
      } else if (lastAvg < firstAvg * 0.85) {
        insights.push({ type: 'good', text: `趨勢改善：近期平均比初期縮短 ${Math.round((firstAvg - lastAvg) / 60)} 分鐘` })
      } else {
        insights.push({ type: 'good', text: '趨勢穩定，無明顯波動' })
      }
    }

    if (insights.length === 0) insights.push({ type: 'good', text: '各渠道時間分佈正常，無明顯異常' })

    return { totalCount: autoRecords.length, overallAvgSeconds, dailyData, channelBreakdown, insights }
  })

  // ===== 提現時間分析（整體）=====
  const withdrawTimeAnalysis = computed(() => {
    const withdrawData = withdrawRecords.value

    if (withdrawData.length === 0) return null

    const isExcludedMerchant = (merchant) => {
      if (!merchant) return false
      const merchantLower = merchant.toLowerCase()
      return merchant.includes('線下') || merchant.includes('线下') ||
             merchantLower.includes('test') || merchantLower.includes('qa')
    }

    const allRecords = deduplicateWithdraw(withdrawData.filter(r => !isExcludedMerchant(r.merchant)))

    if (allRecords.length === 0) return null

    const isSuccess = (r) => {
      const transferStatus = r.transferStatus || ''
      const status = r.status || ''
      const ok = transferStatus === '轉帳完成' || transferStatus === '转帐完成' || transferStatus === '转账完成' ||
             status.includes('提現完成') || status.includes('提现完成')
      const actualAmount = r.actualAmount || r.payoutAmount || 0
      return ok && actualAmount !== 0
    }

    const successRecords = allRecords.filter(r => isSuccess(r))
    const successWithTime = successRecords.filter(r => r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0)

    // 每日平均處理時間
    const dailyMap = {}
    allRecords.forEach(r => {
      const dateStr = (r.requestTime || '').substring(0, 10)
      if (!dateStr) return
      if (!dailyMap[dateStr]) dailyMap[dateStr] = { totalApply: 0, totalSuccessCount: 0, successCount: 0, totalSeconds: 0, timeCount: 0, over30Count: 0 }
      dailyMap[dateStr].totalApply++
      if (isSuccess(r)) {
        dailyMap[dateStr].totalSuccessCount++
        if (r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0) {
          dailyMap[dateStr].successCount++
          dailyMap[dateStr].totalSeconds += r.avgTimeSeconds
          dailyMap[dateStr].timeCount++
          if (r.avgTimeSeconds > 1800) dailyMap[dateStr].over30Count++
        }
      }
    })

    const dailyData = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, d]) => ({
        date,
        totalApply: d.totalApply,
        successCount: d.totalSuccessCount,
        succRate: d.totalApply > 0 ? (d.totalSuccessCount / d.totalApply) * 100 : 0,
        avgSeconds: d.timeCount > 0 ? d.totalSeconds / d.timeCount : null,
        over30Count: d.over30Count
      }))

    const buckets = [
      { label: '< 2分', min: 0, max: 120 },
      { label: '2-5分', min: 120, max: 300 },
      { label: '5-15分', min: 300, max: 900 },
      { label: '15-30分', min: 900, max: 1800 },
      { label: '> 30分', min: 1800, max: Infinity }
    ]

    // 渠道分類函數
    const getChannel = (r) => {
      const bank = r.receivingBank || ''
      if (bank.includes('支付宝') || bank.includes('支付寶')) return '支付寶'
      const code = (r.payoutCardCode || '').toUpperCase()
      if (!code) return '三方'
      if (code.startsWith('GB-DAHAOMEN')) return '三方'
      if (code.startsWith('GB')) return '金寶'
      if (code.includes('AUCTION')) return '極速'
      return '三方'
    }

    // 計算單一渠道的 cross-tab 資料
    const calcChannelRow = (records, label) => {
      const apply = records.length
      const succ = records.filter(r => isSuccess(r))
      const succWithTime = succ.filter(r => r.avgTimeSeconds !== null && r.avgTimeSeconds >= 0)
      const avgSec = succWithTime.length > 0
        ? succWithTime.reduce((s, r) => s + r.avgTimeSeconds, 0) / succWithTime.length
        : null
      const dist = buckets.map(b => {
        const cnt = succWithTime.filter(r => r.avgTimeSeconds >= b.min && r.avgTimeSeconds < b.max).length
        return { label: b.label, count: cnt, percent: apply > 0 ? (cnt / apply) * 100 : 0 }
      })
      return { channel: label, totalApply: apply, successCount: succ.length, avgSeconds: avgSec, distribution: dist }
    }

    // 按渠道分組
    const channelGroups = { '支付寶': [], '金寶': [], '極速': [], '三方': [] }
    allRecords.forEach(r => {
      const ch = getChannel(r)
      if (channelGroups[ch]) channelGroups[ch].push(r)
    })

    const channelBreakdown = [
      calcChannelRow(allRecords, '整體'),
      calcChannelRow(channelGroups['支付寶'], '支付寶'),
      calcChannelRow(channelGroups['金寶'], '金寶'),
      calcChannelRow(channelGroups['極速'], '極速'),
      calcChannelRow(channelGroups['三方'], '三方')
    ]

    const overallAvgSeconds = successWithTime.length > 0
      ? successWithTime.reduce((sum, r) => sum + r.avgTimeSeconds, 0) / successWithTime.length
      : null

    // 格式化時間（供 insights 用）
    const fmtHMS = (sec) => {
      const s = Math.round(sec)
      const h = Math.floor(s / 3600)
      const m = Math.floor((s % 3600) / 60)
      const ss = s % 60
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
    }

    // ===== 拉長原因分析 =====
    const insights = []
    const overallRow = channelBreakdown[0]
    const overallOver30Pct = overallRow.distribution[4].percent

    // 1. 整體 >30分% 警示
    if (overallOver30Pct >= 20) {
      insights.push({ type: 'warn', text: `整體 >30分鐘佔比達 ${overallOver30Pct.toFixed(1)}%，超過警戒門檻` })
    }

    // 2. 找主要慢速渠道（>30分% 顯著高於整體，且申請筆數 > 10）
    const channelRows = channelBreakdown.slice(1).filter(ch => ch.totalApply >= 10)
    const slowChannels = channelRows
      .filter(ch => ch.distribution[4].percent > overallOver30Pct * 1.3)
      .sort((a, b) => b.distribution[4].percent - a.distribution[4].percent)

    if (slowChannels.length > 0) {
      const top = slowChannels[0]
      const over30Cnt = top.distribution[4].count
      insights.push({
        type: 'warn',
        text: `主要慢速渠道：${top.channel}，>30分佔比 ${top.distribution[4].percent.toFixed(1)}%（${over30Cnt} 筆），平均時間 ${top.avgSeconds !== null ? fmtHMS(top.avgSeconds) : '--'}`
      })
      if (slowChannels.length > 1) {
        const others = slowChannels.slice(1).map(ch => `${ch.channel} ${ch.distribution[4].percent.toFixed(1)}%`).join('、')
        insights.push({ type: 'warn', text: `其他慢速渠道：${others}` })
      }
    }

    // 3. 找哪個渠道平均時間最長（排除整體，有成功筆數）
    const withAvg = channelRows.filter(ch => ch.avgSeconds !== null).sort((a, b) => b.avgSeconds - a.avgSeconds)
    if (withAvg.length > 0 && overallAvgSeconds !== null) {
      const slowest = withAvg[0]
      if (slowest.avgSeconds > overallAvgSeconds * 1.2) {
        insights.push({
          type: 'info',
          text: `${slowest.channel} 平均時間最長（${fmtHMS(slowest.avgSeconds)}），比整體平均高 ${Math.round((slowest.avgSeconds - overallAvgSeconds) / 60)} 分鐘`
        })
      }
    }

    // 4. 最慢日期
    const daysWithTime = dailyData.filter(d => d.avgSeconds !== null)
    if (daysWithTime.length > 0) {
      const worstDay = [...daysWithTime].sort((a, b) => b.avgSeconds - a.avgSeconds)[0]
      if (worstDay.avgSeconds > 1800) {
        insights.push({
          type: 'info',
          text: `高峰日期：${worstDay.date}，平均 ${fmtHMS(worstDay.avgSeconds)}，>30分鐘 ${worstDay.over30Count} 筆`
        })
      }
    }

    // 5. 趨勢判斷（3天以上）
    if (daysWithTime.length >= 3) {
      const half = Math.floor(daysWithTime.length / 2)
      const firstAvg = daysWithTime.slice(0, half).reduce((s, d) => s + d.avgSeconds, 0) / half
      const lastAvg = daysWithTime.slice(-half).reduce((s, d) => s + d.avgSeconds, 0) / half
      const diffMin = Math.round((lastAvg - firstAvg) / 60)
      if (lastAvg > firstAvg * 1.15) {
        insights.push({ type: 'warn', text: `趨勢惡化：近期平均比初期多 ${diffMin} 分鐘` })
      } else if (lastAvg < firstAvg * 0.85) {
        insights.push({ type: 'good', text: `趨勢改善：近期平均比初期縮短 ${Math.abs(diffMin)} 分鐘` })
      } else {
        insights.push({ type: 'info', text: '趨勢平穩，無明顯惡化或改善' })
      }
    }

    // 6. 若無明顯問題
    if (insights.length === 0) {
      insights.push({ type: 'good', text: '各渠道時間分佈正常，無明顯異常' })
    }

    return {
      totalApply: allRecords.length,
      totalSuccess: successRecords.length,
      overallAvgSeconds,
      dailyData,
      channelBreakdown,
      insights
    }
  })

  return { pmAnalysisMetrics, pmCountMetrics, combinedDepositAnalysis, depositStatusAnalysis, manualOrderAnalysis, depositTimeAnalysis, withdrawTimeAnalysis }
}
