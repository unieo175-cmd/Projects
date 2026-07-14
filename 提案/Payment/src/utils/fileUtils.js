import * as XLSX from 'xlsx';

export const parseXLSXToCSV = async (file) => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_csv(firstSheet);
};

export const getFileExtension = (filename) => {
  return filename.split('.').pop().toLowerCase();
};

export const detectFileType = (content) => {
  const lines = content.split('\n');
  if (lines.length < 1) return 'unknown';

  const header = lines[0].toLowerCase();

  const depositKeywords = ['到帳金額', '到账金额', '銀行名稱', '银行名称', '銀行卡編碼', '银行卡编码', '收款商戶', '收款商户'];
  const withdrawKeywords = ['收款銀行', '收款银行', '收款卡號', '收款卡号', '收款姓名', '收款地址', '出款商戶', '出款商户', '出款卡編碼', '出款卡编码'];

  const hasDepositKeyword = depositKeywords.some(k => header.includes(k.toLowerCase()));
  const hasWithdrawKeyword = withdrawKeywords.some(k => header.includes(k.toLowerCase()));

  if (!hasDepositKeyword && !hasWithdrawKeyword && lines.length > 1) {
    const dataLine = lines[1].toLowerCase();
    const depositStatusKeywords = ['已充值', '未充值', '信用評分', '信用评分', '回單驗證', '回单验证'];
    const withdrawStatusKeywords = ['转账完成', '轉帳完成', '转账失败', '轉帳失敗', '通知完成'];

    const hasDepositStatus = depositStatusKeywords.some(k => dataLine.includes(k.toLowerCase()));
    const hasWithdrawStatus = withdrawStatusKeywords.some(k => dataLine.includes(k.toLowerCase()));

    if (hasDepositStatus && !hasWithdrawStatus) return 'deposit';
    if (hasWithdrawStatus && !hasDepositStatus) return 'withdraw';
  }

  if (hasDepositKeyword && !hasWithdrawKeyword) return 'deposit';
  if (hasWithdrawKeyword && !hasDepositKeyword) return 'withdraw';

  return 'unknown';
};
