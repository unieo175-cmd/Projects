import { ref } from 'vue';
import { parseCSV, parseWithdrawCSV } from '../utils/csvParser';
import { parseXLSXToCSV, getFileExtension, detectFileType } from '../utils/fileUtils';

const MAX_FILE_SIZE = 500 * 1024 * 1024;

export function useFileUpload({
  depositRecords,
  withdrawRecords,
  hasDepositData,
  hasWithdrawData,
  depositFileName,
  withdrawFileName,
  dataDate,
  activeTab,
  allRecords,
  filteredRecords,
  isLoading,
  loadingProgress,
  loadingStatus,
  saveDepositToStorage,
  saveWithdrawToStorage,
}) {
  const depositFileInput = ref(null);
  const withdrawFileInput = ref(null);

  const openDepositFile = () => {
    console.log('=== openDepositFile 被點擊 ===');
    const input = depositFileInput.value;
    if (input) {
      input.value = '';
      input.click();
    } else {
      console.error('depositFileInput ref 不存在');
    }
  };

  const openWithdrawFile = () => {
    console.log('=== openWithdrawFile 被點擊 ===');
    const input = withdrawFileInput.value;
    if (input) {
      input.value = '';
      input.click();
    } else {
      console.error('withdrawFileInput ref 不存在');
    }
  };

  const handleDepositDrop = (e) => {
    console.log('=== handleDepositDrop ===');
    const files = e.dataTransfer.files;
    if (files.length > 0) handleDepositUpload({ target: { files } });
  };

  const handleWithdrawDrop = (e) => {
    console.log('=== handleWithdrawDrop ===');
    const files = e.dataTransfer.files;
    if (files.length > 0) handleWithdrawUpload({ target: { files } });
  };

  const handleDepositUpload = async (event) => {
    console.log('handleDepositUpload 被调用', event.target.files);
    const file = event.target.files[0];
    if (!file) { console.log('没有选择文件'); return; }
    console.log('开始上传文件:', file.name, '大小:', file.size);

    if (file.size > MAX_FILE_SIZE) {
      alert('文件大小超过 500MB 限制，请选择较小的文件');
      event.target.value = '';
      return;
    }

    isLoading.value = true;
    loadingProgress.value = 0;
    loadingStatus.value = '正在读取充值数据...';

    try {
      loadingProgress.value = 30;
      const ext = getFileExtension(file.name);
      let content;

      if (ext === 'xlsx' || ext === 'xls') {
        loadingStatus.value = '正在解析 Excel 文件...';
        content = await parseXLSXToCSV(file);
      } else {
        content = await file.text();
      }

      const detectedType = detectFileType(content);
      console.log('检测到文件类型:', detectedType);

      if (detectedType === 'withdraw') {
        isLoading.value = false;
        const confirmSwitch = confirm('检测到这可能是「提现」数据文件，而非「充值」数据文件。\n\n是否要改为导入到「提现数据」？\n\n点击「确定」导入为提现数据\n点击「取消」仍然按充值数据处理');
        if (confirmSwitch) {
          isLoading.value = true;
          loadingStatus.value = '正在解析提现数据...';
          const parsed = parseWithdrawCSV(content);
          withdrawRecords.value = parsed;
          hasWithdrawData.value = true;
          withdrawFileName.value = file.name;
          allRecords.value = parsed;
          filteredRecords.value = [...parsed];
          activeTab.value = 'withdraw';
          loadingProgress.value = 100;
          loadingStatus.value = `提现数据导入完成！共 ${parsed.length} 笔记录`;
          saveWithdrawToStorage();
          setTimeout(() => { isLoading.value = false; }, 500);
          event.target.value = '';
          return;
        }
        isLoading.value = true;
      }

      loadingProgress.value = 60;
      loadingStatus.value = '正在解析充值数据...';

      const parsed = parseCSV(content);
      depositRecords.value = parsed;
      hasDepositData.value = true;
      depositFileName.value = file.name;

      if (parsed.length > 0 && parsed[0].requestTime) {
        dataDate.value = parsed[0].requestTime.split(' ')[0];
      }

      allRecords.value = parsed;
      filteredRecords.value = [...parsed];
      activeTab.value = 'deposit';
      loadingProgress.value = 100;
      loadingStatus.value = `充值数据导入完成！共 ${parsed.length} 笔记录`;
      saveDepositToStorage();

    } catch (error) {
      console.error('Error loading deposit data:', error);
      loadingStatus.value = '导入失败: ' + error.message;
    } finally {
      setTimeout(() => { isLoading.value = false; }, 500);
      event.target.value = '';
    }
  };

  const handleWithdrawUpload = async (event) => {
    console.log('handleWithdrawUpload 被调用', event.target.files);
    const file = event.target.files[0];
    if (!file) { console.log('没有选择文件'); return; }
    console.log('开始上传提现文件:', file.name, '大小:', file.size);

    if (file.size > MAX_FILE_SIZE) {
      alert('文件大小超过 500MB 限制，请选择较小的文件');
      event.target.value = '';
      return;
    }

    isLoading.value = true;
    loadingProgress.value = 0;
    loadingStatus.value = '正在读取提现数据...';

    try {
      loadingProgress.value = 30;
      const ext = getFileExtension(file.name);
      let content;

      if (ext === 'xlsx' || ext === 'xls') {
        loadingStatus.value = '正在解析 Excel 文件...';
        content = await parseXLSXToCSV(file);
      } else {
        content = await file.text();
      }

      const detectedType = detectFileType(content);
      console.log('检测到文件类型:', detectedType);

      if (detectedType === 'deposit') {
        isLoading.value = false;
        const confirmSwitch = confirm('检测到这可能是「充值」数据文件，而非「提现」数据文件。\n\n是否要改为导入到「充值数据」？\n\n点击「确定」导入为充值数据\n点击「取消」仍然按提现数据处理');
        if (confirmSwitch) {
          isLoading.value = true;
          loadingStatus.value = '正在解析充值数据...';
          const parsed = parseCSV(content);
          depositRecords.value = parsed;
          hasDepositData.value = true;
          depositFileName.value = file.name;
          if (parsed.length > 0 && parsed[0].requestTime) {
            dataDate.value = parsed[0].requestTime.split(' ')[0];
          }
          allRecords.value = parsed;
          filteredRecords.value = [...parsed];
          activeTab.value = 'deposit';
          loadingProgress.value = 100;
          loadingStatus.value = `充值数据导入完成！共 ${parsed.length} 笔记录`;
          saveDepositToStorage();
          setTimeout(() => { isLoading.value = false; }, 500);
          event.target.value = '';
          return;
        }
        isLoading.value = true;
      }

      loadingProgress.value = 60;
      loadingStatus.value = '正在解析提现数据...';

      const parsed = parseWithdrawCSV(content);
      withdrawRecords.value = parsed;
      hasWithdrawData.value = true;
      withdrawFileName.value = file.name;

      allRecords.value = parsed;
      filteredRecords.value = [...parsed];
      activeTab.value = 'withdraw';
      loadingProgress.value = 100;
      loadingStatus.value = `提现数据导入完成！共 ${parsed.length} 笔记录`;
      saveWithdrawToStorage();

    } catch (error) {
      console.error('Error loading withdraw data:', error);
      loadingStatus.value = '导入失败: ' + error.message;
    } finally {
      setTimeout(() => { isLoading.value = false; }, 500);
      event.target.value = '';
    }
  };

  const loadTestData = async () => {
    console.log('=== 开始载入测试数据 ===');
    isLoading.value = true;
    loadingProgress.value = 0;
    loadingStatus.value = '正在载入测试数据...';

    try {
      loadingStatus.value = '正在载入充值数据...';
      loadingProgress.value = 10;
      console.log('正在 fetch /testdata/deposit.csv ...');
      const depositResponse = await fetch('/testdata/deposit.csv');
      console.log('deposit.csv response status:', depositResponse.status);
      if (!depositResponse.ok) throw new Error('无法载入充值数据: ' + depositResponse.status);
      const depositContent = await depositResponse.text();
      console.log('充值 CSV 内容长度:', depositContent.length, '字符');
      loadingProgress.value = 30;

      console.log('开始解析充值数据...');
      const depositParsed = parseCSV(depositContent);
      console.log('充值解析结果:', depositParsed.length, '笔');
      if (depositParsed.length === 0) console.warn('警告: 充值数据解析结果为空!');

      depositRecords.value = depositParsed;
      hasDepositData.value = depositParsed.length > 0;
      depositFileName.value = '24437_充值紀錄_20260126_20260201.csv';
      if (depositParsed.length > 0 && depositParsed[0].requestTime) {
        dataDate.value = depositParsed[0].requestTime.split(' ')[0];
      }

      loadingStatus.value = '正在载入提现数据...';
      loadingProgress.value = 50;
      const withdrawResponse = await fetch('/testdata/withdraw.csv');
      if (!withdrawResponse.ok) throw new Error('无法载入提现数据: ' + withdrawResponse.status);
      const withdrawContent = await withdrawResponse.text();
      loadingProgress.value = 70;

      const withdrawParsed = parseWithdrawCSV(withdrawContent);
      console.log('提现解析结果:', withdrawParsed.length, '笔');
      withdrawRecords.value = withdrawParsed;
      hasWithdrawData.value = withdrawParsed.length > 0;
      withdrawFileName.value = '24455_提現紀錄_20260126_20260201.csv';

      allRecords.value = depositParsed;
      filteredRecords.value = [...depositParsed];
      activeTab.value = 'deposit';

      loadingProgress.value = 90;
      loadingStatus.value = '正在保存数据...';
      await saveDepositToStorage();
      await saveWithdrawToStorage();

      loadingProgress.value = 100;
      loadingStatus.value = `测试数据载入完成！充值 ${depositParsed.length} 笔，提现 ${withdrawParsed.length} 笔`;
      console.log('=== 测试数据载入完成 ===');

    } catch (error) {
      console.error('载入测试数据失败:', error);
      loadingStatus.value = '载入失败: ' + error.message;
      alert('载入测试数据失败: ' + error.message);
    } finally {
      setTimeout(() => { isLoading.value = false; }, 1000);
    }
  };

  return {
    depositFileInput,
    withdrawFileInput,
    openDepositFile,
    openWithdrawFile,
    handleDepositDrop,
    handleWithdrawDrop,
    handleDepositUpload,
    handleWithdrawUpload,
    loadTestData,
  };
}
