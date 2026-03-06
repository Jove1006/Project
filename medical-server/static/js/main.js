/* Medical Data Management — main.js */

const FLASH_MSGS = {
  record_created: '记录创建成功',
  record_updated: '记录信息已更新',
  record_deleted: '记录已删除',
  batch_deleted:  '已批量删除选中记录',
  file_uploaded:  '文件上传成功',
  file_deleted:   '文件已删除',
};

document.addEventListener('DOMContentLoaded', function () {
  const params = new URLSearchParams(window.location.search);
  const msg = params.get('msg');
  if (msg) {
    const flash = document.getElementById('flash');
    const text  = document.getElementById('flash-text');
    if (flash && text) {
      text.textContent = FLASH_MSGS[msg] || '操作成功';
      flash.className = 'flash success';
      setTimeout(() => { flash.className = 'flash'; }, 3500);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('msg');
    history.replaceState(null, '', url.toString());
  }
});
