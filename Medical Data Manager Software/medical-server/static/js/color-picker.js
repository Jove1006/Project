/**
 * 模型文件颜色选择器（弹窗版）
 * 点击调色板图标 → 屏幕居中弹出颜色选择 Modal
 * 样式通过 JS 注入，不依赖外部 CSS 缓存
 */
(function () {
  'use strict';

  /* ── 预设色板（30 种高区分度颜色） ─────────────────── */
  var PRESETS = [
    { hex: '#FFFFFF', label: '白色' },
    { hex: '#E53935', label: '红色' },
    { hex: '#D81B60', label: '玫红' },
    { hex: '#8E24AA', label: '紫色' },
    { hex: '#5E35B1', label: '深紫' },
    { hex: '#3949AB', label: '靛蓝' },
    { hex: '#1E88E5', label: '蓝色' },
    { hex: '#039BE5', label: '亮蓝' },
    { hex: '#00ACC1', label: '青色' },
    { hex: '#00897B', label: '蓝绿' },
    { hex: '#43A047', label: '绿色' },
    { hex: '#7CB342', label: '黄绿' },
    { hex: '#C0CA33', label: '青柠' },
    { hex: '#FDD835', label: '黄色' },
    { hex: '#FFB300', label: '琥珀' },
    { hex: '#FB8C00', label: '橙色' },
    { hex: '#F4511E', label: '深橙' },
    { hex: '#6D4C41', label: '棕色' },
    { hex: '#FF80AB', label: '粉色' },
    { hex: '#EA80FC', label: '淡紫' },
    { hex: '#B388FF', label: '薰衣草' },
    { hex: '#82B1FF', label: '浅蓝' },
    { hex: '#80D8FF', label: '天蓝' },
    { hex: '#A7FFEB', label: '薄荷' },
    { hex: '#CCFF90', label: '嫩绿' },
    { hex: '#FFD180', label: '杏色' },
    { hex: '#FF9E80', label: '珊瑚' },
    { hex: '#78909C', label: '蓝灰' },
    { hex: '#212121', label: '黑色' },
    { hex: '#E8D44D', label: '金色' },
  ];

  /* ── 注入样式（确保不受外部缓存影响） ───────────── */
  function injectStyles() {
    if (document.getElementById('cp-injected-styles')) return;
    var style = document.createElement('style');
    style.id = 'cp-injected-styles';
    style.textContent =
      '#modal-color-picker .cp-grid{' +
        'display:grid;grid-template-columns:repeat(6,42px);gap:10px;' +
        'justify-content:center;padding:4px 0 0;margin-bottom:20px;' +
      '}' +
      '#modal-color-picker .cp-swatch{' +
        'display:block;width:42px;height:42px;border-radius:10px;padding:0;margin:0;' +
        'border:2px solid #e5e7eb;cursor:pointer;outline:none;' +
        'transition:transform .15s,border-color .15s,box-shadow .15s;' +
        'box-sizing:border-box;-webkit-appearance:none;appearance:none;' +
      '}' +
      '#modal-color-picker .cp-swatch:hover{' +
        'transform:scale(1.08);border-color:#a1a1aa;' +
        'box-shadow:0 3px 10px rgba(0,0,0,.12);' +
      '}' +
      '#modal-color-picker .cp-swatch.active{' +
        'border:3px solid #6366f1;' +
        'box-shadow:0 0 0 3px rgba(99,102,241,.2);' +
      '}' +
      '#modal-color-picker .cp-divider{' +
        'border:none;border-top:1px solid #f0f2f5;margin:0 0 16px;' +
      '}' +
      '#modal-color-picker .cp-custom-wrap{' +
        'background:#f8fafc;border-radius:10px;padding:14px 16px;' +
      '}' +
      '#modal-color-picker .cp-custom-label{' +
        'display:block;font-size:12.5px;font-weight:600;color:#4b5563;margin-bottom:10px;' +
      '}' +
      '#modal-color-picker .cp-custom-row{' +
        'display:flex;align-items:center;gap:12px;' +
      '}' +
      '#modal-color-picker .cp-native-color{' +
        'width:40px;height:40px;border:1px solid #e5e7eb;border-radius:8px;' +
        'padding:2px;cursor:pointer;background:none;' +
      '}' +
      '#modal-color-picker .cp-hex-input{' +
        'width:100px;height:40px;border:1px solid #e5e7eb;border-radius:8px;' +
        'padding:0 10px;font-family:monospace;font-size:14px;' +
        'text-transform:uppercase;color:#374151;background:#fff;outline:none;' +
        'transition:border-color .15s,box-shadow .15s;' +
      '}' +
      '#modal-color-picker .cp-hex-input:focus{' +
        'border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1);' +
      '}' +
      '#modal-color-picker .cp-preview{' +
        'width:40px;height:40px;border-radius:8px;border:1px solid #e5e7eb;' +
        'margin-left:auto;flex-shrink:0;' +
      '}';
    document.head.appendChild(style);
  }

  /* ── 状态 ───────────────────────────────────────────── */
  var currentFileId = null;
  var currentBtn = null;
  var overlay = null;
  var selectedHex = '#FFFFFF';

  /* ── 构建 Modal DOM（只创建一次） ─────────────────── */
  function ensureModal() {
    if (overlay) return;
    injectStyles();

    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-color-picker';
    overlay.innerHTML =
      '<div class="modal-box" style="width:420px">' +
        '<div class="modal-header">' +
          '<span class="modal-title">' +
            '<i class="bi bi-palette" style="margin-right:6px;color:#6366f1"></i>选择模型颜色' +
          '</span>' +
          '<button class="btn btn-ghost btn-icon" id="cp-close"><i class="bi bi-x-lg"></i></button>' +
        '</div>' +
        '<div class="modal-body" style="padding:20px 24px">' +
          '<div class="cp-grid" id="cp-grid"></div>' +
          '<hr class="cp-divider">' +
          '<div class="cp-custom-wrap">' +
            '<label class="cp-custom-label">自定义颜色</label>' +
            '<div class="cp-custom-row">' +
              '<input type="color" id="cp-native" class="cp-native-color" value="#FFFFFF">' +
              '<input type="text" id="cp-hex-input" class="cp-hex-input" value="#FFFFFF" maxlength="7" spellcheck="false">' +
              '<div id="cp-preview" class="cp-preview" style="background:#FFFFFF"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-default" id="cp-cancel">取消</button>' +
          '<button class="btn btn-primary" id="cp-confirm">确认</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // 渲染预设色块
    var grid = document.getElementById('cp-grid');
    PRESETS.forEach(function (p) {
      var swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'cp-swatch';
      swatch.dataset.hex = p.hex;
      swatch.title = p.label;
      swatch.style.backgroundColor = p.hex;
      if (p.hex === '#FFFFFF') {
        swatch.style.borderColor = '#d1d5db';
      }
      swatch.addEventListener('click', function () { selectColor(p.hex); });
      grid.appendChild(swatch);
    });

    // 事件绑定
    document.getElementById('cp-close').addEventListener('click', hide);
    document.getElementById('cp-cancel').addEventListener('click', hide);
    document.getElementById('cp-confirm').addEventListener('click', confirm);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) hide(); });

    document.getElementById('cp-native').addEventListener('input', function () {
      selectColor(this.value);
    });
    document.getElementById('cp-hex-input').addEventListener('change', function () {
      var v = this.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) selectColor(v);
    });
  }

  /* ── 选中颜色 ──────────────────────────────────────── */
  function selectColor(hex) {
    selectedHex = hex.toUpperCase();
    document.querySelectorAll('#modal-color-picker .cp-swatch').forEach(function (s) {
      s.classList.toggle('active', s.dataset.hex === selectedHex);
    });
    document.getElementById('cp-native').value = selectedHex;
    document.getElementById('cp-hex-input').value = selectedHex;
    document.getElementById('cp-preview').style.backgroundColor = selectedHex;
  }

  /* ── 显示 / 隐藏 ──────────────────────────────────── */
  function show(btn) {
    ensureModal();
    currentBtn = btn;
    currentFileId = btn.dataset.fileId;

    var row = btn.closest('tr');
    var existing = (row && row.dataset.modelColor) ? row.dataset.modelColor : '#FFFFFF';
    selectColor(existing);

    overlay.classList.add('open');
  }

  function hide() {
    if (overlay) overlay.classList.remove('open');
    currentBtn = null;
    currentFileId = null;
  }

  /* ── 确认 ──────────────────────────────────────────── */
  function confirm() {
    if (!currentBtn) { hide(); return; }

    var icon = currentBtn.querySelector('i');
    if (icon) icon.style.color = selectedHex === '#FFFFFF' ? '#6366f1' : selectedHex;

    var row = currentBtn.closest('tr');
    if (row) row.dataset.modelColor = selectedHex;

    // 保存到后端
    if (currentFileId) {
      fetch('/api/files/' + currentFileId + '/color', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color_hex: selectedHex === '#FFFFFF' ? null : selectedHex })
      })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        console.log('[Color] saved file', currentFileId, '→', selectedHex);
      })
      .catch(function (err) {
        console.error('[Color] save failed:', err);
      });
    }

    hide();
  }

  /* ── 初始化 ────────────────────────────────────────── */
  function init() {
    document.querySelectorAll('.color-pick-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        show(btn);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
