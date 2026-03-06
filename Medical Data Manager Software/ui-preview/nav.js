// Shared sidebar — injected into every page
// Usage: <div id="sidebar-mount"></div>  +  <script src="../nav.js"></script>

(function () {
  const pages = [
    { id: 'index',       label: '记录列表',  icon: '&#xF4F6;', href: 'index.html' },
    { id: 'record-new',  label: '新增记录',  icon: '&#xF63F;', href: 'record-new.html' },
    { id: 'dashboard',   label: '统计看板',  icon: '&#xF2CB;', href: 'dashboard.html' },
  ];
  const settings = [
    { id: 'hospitals',   label: '医院管理',  icon: '&#xF474;', href: 'hospitals.html' },
    { id: 'bodyparts',   label: '部位管理',  icon: '&#xF506;', href: '#' },
  ];

  function makeItem(p, currentId) {
    const active = p.id === currentId ? ' active' : '';
    return `<a class="nav-item${active}" href="${p.href}">
      <span class="nav-icon">${p.icon}</span>${p.label}
    </a>`;
  }

  function render(currentId) {
    return `
    <div class="sidebar-logo">
      <div class="logo-icon"><i class="bi bi-hospital"></i></div>
      <div class="logo-text">医学数据管理<small>存储管理系统</small></div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section-label">主功能</div>
      ${pages.map(p => makeItem(p, currentId)).join('\n')}
      <div class="nav-section-label">系统设置</div>
      ${settings.map(p => makeItem(p, currentId)).join('\n')}
    </nav>
    <div class="sidebar-footer">
      <span class="status-dot"></span>服务运行中
    </div>`;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const mount = document.getElementById('sidebar-mount');
    if (!mount) return;
    const currentId = mount.dataset.page || '';
    mount.innerHTML = render(currentId);
  });
})();
