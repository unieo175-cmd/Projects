// ===== 提现 CSV 解析 =====
export const parseWithdrawCSV = (content) => {
  const cleanContent = content.replace(/^\uFEFF/, '');
  const lines = cleanContent.split('\n');
  const records = [];

  // ===== 資料清洗統計 =====
  let totalRows = 0;
  let skippedEmpty = 0;
  let skippedShortColumns = 0;
  let skippedTestQa = 0;
  let skippedOffline = 0;

  console.log('提现 CSV 解析：总行数', lines.length);

  for (let i = 1; i < lines.length; i++) {
    totalRows++;
    const line = lines[i];
    if (!line.trim()) {
      skippedEmpty++;
      continue;
    }

    // 支援兩種 CSV 格式：
    // 1. Excel 格式: "=""value"""
    // 2. Google Sheets 格式: value 或 "value"
    let matches = line.match(/\"=\"\"([^\"]*)\"\"\"/g);
    let clean;

    // 至少需要 15 欄（到 status 欄位）
    if (matches && matches.length >= 15) {
      // Excel 格式
      clean = (m) => m ? m.replace(/^\"=\"\"/, '').replace(/\"\"\"$/, '').trim() : '';
    } else {
      // Google Sheets 普通 CSV 格式 - 使用 CSV 解析
      matches = [];
      let current = '';
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          matches.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      matches.push(current);
      // 至少需要 15 欄（到 status 欄位）
      if (matches.length < 15) {
        skippedShortColumns++;
        continue;
      }
      clean = (m) => (m || '').trim();
    }

    const record = {
      id: clean(matches[0]),
      parentId: clean(matches[1]),
      agent: clean(matches[2]),
      merchant: clean(matches[3]),
      platformOrderId: clean(matches[4]),
      merchantOrderId: clean(matches[5]),
      requestAmount: parseFloat(clean(matches[6]).replace(/,/g, '')) || 0,
      merchantRebate: parseFloat(clean(matches[7]).replace(/,/g, '')) || 0,
      actualAmount: parseFloat(clean(matches[8]).replace(/,/g, '')) || 0,
      receivingBank: clean(matches[9]),
      receivingCard: clean(matches[10]),
      receivingName: clean(matches[11]),
      receivingAddress: clean(matches[12]),
      poolId: clean(matches[13]),
      status: clean(matches[14]),
      merchantReceiveStatus: clean(matches[15]),
      notifyMerchantTime: clean(matches[16]).replace(/\//g, '-'),
      userId: clean(matches[17]),
      userLevel: clean(matches[18]),
      requestTime: clean(matches[19]).replace(/\//g, '-'), // 统一日期格式为 YYYY-MM-DD
      poolCreateTime: matches[20] ? clean(matches[20]) : '',
      remainPoolCreateTime: matches[21] ? clean(matches[21]) : '',
      transferId: matches[22] ? clean(matches[22]) : '',
      payoutMerchant: matches[23] ? clean(matches[23]) : '',
      payoutCardCode: matches[24] ? clean(matches[24]) : '',
      payoutBank: matches[25] ? clean(matches[25]) : '',
      payoutAccount: matches[26] ? clean(matches[26]) : '',
      payoutAmount: matches[27] ? parseFloat(clean(matches[27]).replace(/,/g, '')) || 0 : 0,
      remark: '', // 不從 CSV 讀取，後面會根據 receivingBank 計算
      transferStatus: (matches[28] ? clean(matches[28]) : '') || (matches[29] ? clean(matches[29]) : '') // AC/AD 栏位（說明）- 转账状态 (转账完成/转账失败)
    };

    // 调试：打印第一条记录的关键字段
    if (i === 1) {
      console.log('提现第一条记录 - status:', record.status, ', transferStatus:', record.transferStatus, ', merchantReceiveStatus:', record.merchantReceiveStatus);
      console.log('提现第一条记录 - 列数:', matches.length, ', matches[14]:', matches[14], ', matches[28]:', matches[28]);
      // 打印所有欄位以找出「說明」欄位的正確位置
      console.log('提现CSV欄位對照（尋找說明欄位）:');
      for (let j = 0; j < Math.min(matches.length, 35); j++) {
        const val = matches[j] ? matches[j].trim() : '';
        if (val.includes('轉帳') || val.includes('转账') || val.includes('转帐') || val === '银行卡' || val === '支付宝' || val === '支付寶') {
          console.log(`  [${j}] = "${val}" *** 可能是說明或收款銀行`);
        }
      }
    }

    // 计算 isAutoWithdraw (AD栏位公式)：IF(AC="转账完成" AND P="通知完成", 1, 0)
    // 若 transferStatus 不是有效轉帳狀態值，則用 status 字段判断
    const validTransferStatus = record.transferStatus === '转账完成' || record.transferStatus === '轉帳完成' || record.transferStatus === '转帐完成';
    const isTransferDone = validTransferStatus
      ? true
      : (record.status && (record.status.includes('提現完成') || record.status.includes('提现完成')));
    const isNotifyDone = record.merchantReceiveStatus === '通知完成';
    record.isAutoWithdraw = (isTransferDone && isNotifyDone) ? 1 : 0;

    // remark 从 receivingBank（收款銀行）欄位計算，不從 CSV 讀取
    // 優先使用 receivingBank，若為空則用商戶名稱判斷
    const receivingBank = record.receivingBank || '';
    const merchantName = record.merchant || '';

    if (receivingBank.includes('支付宝') || receivingBank.includes('支付寶')) {
      record.remark = '支付宝';
    } else if (receivingBank.includes('微信')) {
      record.remark = '微信';
    } else if (merchantName.includes('支付宝') || merchantName.includes('支付寶')) {
      record.remark = '支付宝';
    } else if (merchantName.includes('微信')) {
      record.remark = '微信';
    } else {
      record.remark = '银行卡';
    }

    // 计算处理时间 (AE公式)：IF(V="", Q-T, Q-V)
    // Q = notifyMerchantTime (通知商户时间), T = requestTime (建立时间), V = remainPoolCreateTime (剩余池建立时间)
    // 如果 V 为空：使用 Q - T
    // 如果 V 不为空：使用 Q - V
    record.avgTimeSeconds = null;

    const qTime = record.notifyMerchantTime && record.notifyMerchantTime !== '' && !record.notifyMerchantTime.startsWith('0000')
      ? new Date(record.notifyMerchantTime) : null;
    const tTime = record.requestTime && record.requestTime !== '' && !record.requestTime.startsWith('0000')
      ? new Date(record.requestTime) : null;
    const vTime = record.remainPoolCreateTime && record.remainPoolCreateTime !== '' && !record.remainPoolCreateTime.startsWith('0000')
      ? new Date(record.remainPoolCreateTime) : null;

    if (qTime && !isNaN(qTime)) {
      if (!vTime || isNaN(vTime)) {
        // V 为空，使用 Q - T
        if (tTime && !isNaN(tTime)) {
          record.avgTimeSeconds = (qTime - tTime) / 1000;
        }
      } else {
        // V 不为空，使用 Q - V
        record.avgTimeSeconds = (qTime - vTime) / 1000;
      }
    }

    // 过滤无效时间
    if (record.avgTimeSeconds !== null && (record.avgTimeSeconds < 0 || record.avgTimeSeconds > 86400)) {
      record.avgTimeSeconds = null;
    }

    // 过滤掉商户名称包含「test」、「qa」的记录（線下記錄保留，依據 PRD 數據範圍含線下）
    const merchantLower = record.merchant.toLowerCase();
    if (merchantLower.includes('test') || merchantLower.includes('qa')) {
      skippedTestQa++;
      continue;
    }
    // 線下記錄不再排除，計入 offline 統計但保留在結果中
    if (record.merchant.includes('线下') || record.merchant.includes('線下')) {
      skippedOffline++;  // 僅計數，不 continue
    }

    records.push(record);
  }

  // ===== 輸出資料清洗統計 =====
  console.log('='.repeat(60));
  console.log('【提現 CSV 資料清洗結果】');
  console.log(`  CSV 總行數（不含標題）: ${totalRows.toLocaleString()}`);
  console.log(`  跳過（空行）: ${skippedEmpty.toLocaleString()}`);
  console.log(`  跳過（欄位不足）: ${skippedShortColumns.toLocaleString()}`);
  console.log(`  跳過（test/qa 商戶）: ${skippedTestQa.toLocaleString()}`);
  console.log(`  線下商戶（已保留）: ${skippedOffline.toLocaleString()}`);
  console.log(`  清洗後有效記錄數: ${records.length.toLocaleString()}`);
  console.log('='.repeat(60));

  return records;
};
