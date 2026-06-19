<script lang="ts">
  import { showRouteLibrary, showToast } from '@/stores/ui.store';
  import { currentRoute } from '@/stores/route.store';
  import { MockAPI } from '@/services/mock-api';
  import type { RouteData } from '@/types';
  import { formatDistance } from '@/utils/distance';
  import { formatDate } from '@/utils/format';
  import { generateId } from '@/utils/id';
  import { onMount } from 'svelte';

  type FilterType = 'all' | 'recent' | 'favorites';

  interface FilterOption {
    id: FilterType;
    label: string;
    icon: string;
  }

  const filters: FilterOption[] = [
    { id: 'all', label: '全部', icon: '📚' },
    { id: 'recent', label: '最近', icon: '🕒' },
    { id: 'favorites', label: '收藏', icon: '⭐' }
  ];

  let routes: RouteData[] = [];
  let loading = true;
  let searchQuery = '';
  let activeFilter: FilterType = 'all';
  let favorites = new Set<string>();
  let renamingId: string | null = null;
  let renameInput = '';

  $: filteredRoutes = (() => {
    let list = routes;
    if (activeFilter === 'recent') {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      list = list.filter(r => r.updatedAt >= cutoff);
    } else if (activeFilter === 'favorites') {
      list = list.filter(r => favorites.has(r.id));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(r => r.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  })();

  onMount(async () => {
    loading = true;
    try {
      routes = await MockAPI.loadRoutes();
    } catch (e) {
      console.error(e);
      showToast('加载路线失败', 'error');
    } finally {
      loading = false;
    }
  });

  function close() {
    showRouteLibrary.set(false);
  }

  function onMaskClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function calcDuration(route: RouteData): string {
    const hours = route.totalDistance / 80 + (route.markers.length * 60) / 60;
    if (hours < 1) {
      return `${Math.round(hours * 60)}分钟`;
    }
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}小时`;
    return `${h}h${m}m`;
  }

  function isPreset(id: string): boolean {
    return id.startsWith('preset-');
  }

  async function loadRoute(route: RouteData) {
    if ($currentRoute.markers.length > 0) {
      const ok = confirm(`加载「${route.name}」将替换当前路线，是否继续？`);
      if (!ok) return;
    }
    const cloned: RouteData = JSON.parse(JSON.stringify(route));
    currentRoute.set({
      ...cloned,
      id: isPreset(route.id) ? generateId() : cloned.id,
      createdAt: isPreset(route.id) ? Date.now() : cloned.createdAt,
      updatedAt: Date.now()
    });
    close();
    showToast(`已加载路线：${route.name}`, 'success');
  }

  async function deleteRoute(route: RouteData) {
    const ok = confirm(`确定要删除「${route.name}」吗？此操作无法撤销。`);
    if (!ok) return;
    const success = await MockAPI.deleteRoute(route.id);
    if (success) {
      routes = routes.filter(r => r.id !== route.id);
      favorites.delete(route.id);
      showToast('路线已删除', 'info');
    } else {
      showToast('删除失败', 'error');
    }
  }

  function startRename(route: RouteData) {
    renamingId = route.id;
    renameInput = route.name;
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('.rename-input');
      input?.focus();
      input?.select();
    }, 50);
  }

  function cancelRename() {
    renamingId = null;
    renameInput = '';
  }

  async function confirmRename(id: string) {
    const name = renameInput.trim();
    if (!name) {
      showToast('路线名不能为空', 'error');
      return;
    }
    const route = routes.find(r => r.id === id);
    if (!route) return;
    const updated: RouteData = { ...route, name, updatedAt: Date.now() };
    const result = await MockAPI.saveRoute(updated);
    if (result.success) {
      routes = routes.map(r => r.id === id ? updated : r);
      showToast('已重命名', 'success');
    } else {
      showToast('保存失败', 'error');
    }
    cancelRename();
  }

  function toggleFavorite(id: string) {
    const next = new Set(favorites);
    if (next.has(id)) {
      next.delete(id);
      showToast('已取消收藏', 'info');
    } else {
      next.add(id);
      showToast('已加入收藏', 'success');
    }
    favorites = next;
  }

  async function exportAll() {
    const data = { routes, exportedAt: Date.now(), version: '1.0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `routes_backup_${formatDate(Date.now()).replace(/[年月]/g, '-').replace('日', '')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('数据已导出', 'success');
  }

  function triggerImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Array.isArray(data.routes)) {
          const imported: RouteData[] = data.routes;
          for (const route of imported) {
            if (!routes.find(r => r.id === route.id)) {
              await MockAPI.saveRoute(route);
              routes.push(route);
            }
          }
          routes = [...routes];
          showToast(`已导入 ${imported.length} 条路线`, 'success');
        }
      } catch (e) {
        showToast('导入失败：文件格式错误', 'error');
      }
    };
    input.click();
  }
</script>

<style lang="scss">
  @use '../styles/mixins' as *;

  .mask {
    position: fixed;
    inset: 0;
    background: rgba(26, 20, 16, 0.55);
    z-index: 1000;
    display: flex;
    justify-content: flex-end;
    animation: fadeIn 0.25s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .drawer {
    width: 420px;
    max-width: 100vw;
    height: 100vh;
    background: $sand;
    display: flex;
    flex-direction: column;
    box-shadow: -8px 0 32px rgba(26, 20, 16, 0.3);
    animation: slideIn 0.3s ease;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E");
      pointer-events: none;
    }
    > * { position: relative; z-index: 1; }
  }

  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .drawer-header {
    padding: 20px 20px 16px;
    background: linear-gradient(180deg, #5C472F 0%, #3E2C1C 100%);
    border-bottom: 4px solid $warm-yellow;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;

    &::before,
    &::after {
      content: '';
      position: absolute;
      bottom: -4px;
      width: 18px;
      height: 18px;
      background: #FBF5E6;
      border: 4px solid $warm-yellow;
      border-radius: 50%;
    }
    &::before { left: 16px; }
    &::after { right: 16px; }

    .title-wrap {
      flex: 1;
      text-align: center;
      padding: 0 40px;
    }

    h2 {
      font-family: $font-display;
      font-size: 22px;
      font-weight: 700;
      color: $warm-yellow;
      letter-spacing: 5px;
      margin: 0;
      text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
    }
    .subtitle {
      font-family: $font-typewriter;
      font-size: 10px;
      color: rgba(245, 239, 224, 0.6);
      letter-spacing: 3px;
      margin-top: 4px;
      text-transform: uppercase;
    }

    .close-btn {
      width: 36px;
      height: 36px;
      border: 2px solid rgba(245, 239, 224, 0.4);
      border-radius: 50%;
      background: rgba(245, 239, 224, 0.08);
      color: #FBF5E6;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background: $vintage-red;
        border-color: $vintage-red;
        transform: rotate(90deg);
      }
    }
  }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 18px;

    &::-webkit-scrollbar {
      width: 7px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(212, 160, 60, 0.45);
      border-radius: 4px;
    }
  }

  .search-box {
    position: relative;
    margin-bottom: 12px;

    .search-icon {
      position: absolute;
      top: 50%;
      left: 14px;
      transform: translateY(-50%);
      font-size: 16px;
      color: rgba(62, 44, 28, 0.5);
    }

    input {
      width: 100%;
      padding: 11px 14px 11px 42px;
      background: #FBF5E6;
      border: 2px solid rgba(139, 111, 71, 0.3);
      border-radius: 24px;
      font-family: $font-body;
      font-size: 14px;
      color: $deep-brown;
      outline: none;
      transition: all 0.2s;

      &:focus {
        border-color: $highway-blue;
        box-shadow: 0 0 0 3px rgba(44, 95, 143, 0.1);
      }
    }
  }

  .filter-bar {
    display: flex;
    gap: 6px;
    margin-bottom: 16px;
    background: rgba(139, 111, 71, 0.12);
    padding: 4px;
    border-radius: 22px;
  }

  .filter-btn {
    flex: 1;
    padding: 8px 10px;
    border: none;
    background: transparent;
    border-radius: 18px;
    font-family: $font-display;
    font-size: 12px;
    font-weight: 600;
    color: rgba(62, 44, 28, 0.6);
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: 0.5px;
    white-space: nowrap;

    .f-icon { margin-right: 4px; }

    &:hover { color: $deep-brown; }

    &.active {
      background: #FBF5E6;
      color: $highway-blue;
      box-shadow: 0 2px 6px rgba(62, 44, 28, 0.1);
    }
  }

  .route-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .route-card {
    background: #FBF5E6;
    border: 1.5px solid rgba(139, 111, 71, 0.25);
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.2s ease;
    position: relative;

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 16px rgba(62, 44, 28, 0.15);
      border-color: rgba(212, 160, 60, 0.5);
    }
  }

  .thumb-wrap {
    aspect-ratio: 4 / 3;
    background: linear-gradient(135deg, #E8DCC4, #C9B896);
    position: relative;
    overflow: hidden;

    .placeholder-map {
      position: absolute;
      inset: 0;
      opacity: 0.6;
      background:
        radial-gradient(ellipse at 30% 40%, rgba(90, 122, 74, 0.2) 0%, transparent 50%),
        radial-gradient(ellipse at 70% 60%, rgba(44, 95, 143, 0.2) 0%, transparent 50%),
        repeating-linear-gradient(
          45deg,
          transparent,
          transparent 10px,
          rgba(139, 111, 71, 0.06) 10px,
          rgba(139, 111, 71, 0.06) 20px
        );

      &::before,
      &::after {
        content: '';
        position: absolute;
        width: 6px;
        height: 6px;
        background: $vintage-red;
        border: 1.5px solid #FFF;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }
      &::before { top: 28%; left: 22%; }
      &::after { top: 58%; left: 66%; background: $highway-blue; }
    }

    .compass {
      position: absolute;
      top: 8px;
      right: 8px;
      font-size: 20px;
      opacity: 0.7;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .favorite-btn {
      position: absolute;
      top: 6px;
      left: 6px;
      width: 28px;
      height: 28px;
      border: none;
      background: rgba(255, 250, 235, 0.9);
      border-radius: 50%;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      &:hover { transform: scale(1.1); }
    }
  }

  .card-body {
    padding: 10px 12px 12px;
  }

  .route-name {
    font-family: 'Ma Shan Zheng', 'Kaiti', serif;
    font-size: 16px;
    color: $deep-brown;
    line-height: 1.3;
    min-height: 40px;
    margin-bottom: 6px;
    padding: 4px 6px;
    background: rgba(255, 240, 180, 0.4);
    border-left: 3px solid $warm-yellow;
    transform: rotate(-0.8deg);
    box-shadow: 1px 2px 4px rgba(62, 44, 28, 0.08);
    word-break: break-all;
  }

  .rename-input {
    width: 100%;
    font-family: inherit;
    font-size: 15px;
    padding: 4px 6px;
    border: 2px solid $highway-blue;
    border-radius: 3px;
    background: #FFF;
    color: $deep-brown;
    outline: none;
    transform: rotate(-0.8deg);
  }

  .dates {
    font-family: $font-typewriter;
    font-size: 10px;
    color: rgba(62, 44, 28, 0.5);
    line-height: 1.5;
    margin-bottom: 8px;
  }

  .stats {
    display: flex;
    justify-content: space-between;
    font-family: $font-typewriter;
    font-size: 10px;
    color: rgba(62, 44, 28, 0.7);
    padding: 8px 0;
    border-top: 1px dashed rgba(139, 111, 71, 0.3);

    span {
      display: flex;
      align-items: center;
      gap: 3px;
    }
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    margin-top: 8px;
  }

  .action-btn {
    padding: 6px 4px;
    border: 1.5px solid rgba(139, 111, 71, 0.25);
    border-radius: 4px;
    background: rgba(255, 250, 235, 0.7);
    font-family: $font-display;
    font-size: 11px;
    font-weight: 600;
    color: $deep-brown;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: #FFF;
      border-color: $warm-yellow;
    }

    &.load:hover {
      background: rgba(44, 95, 143, 0.08);
      border-color: $highway-blue;
      color: $highway-blue;
    }
    &.delete:hover {
      background: rgba(139, 58, 46, 0.08);
      border-color: $vintage-red;
      color: $vintage-red;
    }
  }

  .empty-state {
    padding: 60px 30px;
    text-align: center;

    .empty-icon {
      font-size: 72px;
      opacity: 0.25;
      margin-bottom: 20px;
    }
    .empty-title {
      font-family: $font-display;
      font-size: 18px;
      color: $deep-brown;
      margin-bottom: 8px;
      letter-spacing: 2px;
    }
    .empty-text {
      font-family: $font-body;
      font-size: 13px;
      color: rgba(62, 44, 28, 0.55);
      font-style: italic;
      line-height: 1.7;
    }
  }

  .skeleton {
    .route-grid { gap: 12px; }
    .skel-card {
      background: #FBF5E6;
      border-radius: 8px;
      overflow: hidden;
      animation: pulse 1.5s ease-in-out infinite;
    }
    .skel-thumb {
      aspect-ratio: 4 / 3;
      background: linear-gradient(90deg, #E8DCC4, #D4C8A8, #E8DCC4);
      background-size: 200% 100%;
      animation: shimmer 1.5s linear infinite;
    }
    .skel-body { padding: 12px; }
    .skel-line {
      height: 12px;
      background: #E8DCC4;
      border-radius: 4px;
      margin-bottom: 8px;
      &.short { width: 60%; }
    }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.85; }
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .drawer-footer {
    padding: 12px 18px 16px;
    border-top: 2px solid $warm-yellow;
    background: rgba(255, 250, 235, 0.7);
    display: flex;
    gap: 10px;

    .footer-btn {
      flex: 1;
      padding: 10px;
      border: 1.5px solid rgba(139, 111, 71, 0.35);
      border-radius: 6px;
      background: #FBF5E6;
      font-family: $font-display;
      font-size: 12px;
      font-weight: 600;
      color: $deep-brown;
      cursor: pointer;
      transition: all 0.2s;
      letter-spacing: 0.5px;

      &:hover {
        background: #FFF;
        border-color: $highway-blue;
        color: $highway-blue;
        transform: translateY(-1px);
      }
    }
  }
</style>

{#if $showRouteLibrary}
  <div class="mask" on:click={onMaskClick}>
    <aside class="drawer" role="dialog" aria-label="路线档案库">
      <header class="drawer-header">
        <div style="width:36px"></div>
        <div class="title-wrap">
          <h2>路线档案库</h2>
          <div class="subtitle">Route Archives</div>
        </div>
        <button class="close-btn" on:click={close} aria-label="关闭">✕</button>
      </header>

      <div class="drawer-body">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            placeholder="搜索路线名称..."
            bind:value={searchQuery}
          />
        </div>

        <div class="filter-bar">
          {#each filters as f}
            <button
              class="filter-btn {activeFilter === f.id ? 'active' : ''}"
              on:click={() => activeFilter = f.id}
            >
              <span class="f-icon">{f.icon}</span>
              {f.label}
            </button>
          {/each}
        </div>

        {#if loading}
          <div class="skeleton">
            <div class="route-grid">
              {#each { length: 4 } as _, i}
                <div class="skel-card">
                  <div class="skel-thumb"></div>
                  <div class="skel-body">
                    <div class="skel-line"></div>
                    <div class="skel-line short"></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {:else if filteredRoutes.length === 0}
          <div class="empty-state">
            <div class="empty-icon">📖</div>
            <div class="empty-title">空空如也</div>
            <div class="empty-text">
              {searchQuery ? '没有找到匹配的路线' : '还没有保存的路线，开始规划你的第一次复古旅程吧'}
            </div>
          </div>
        {:else}
          <div class="route-grid">
            {#each filteredRoutes as route}
              <article class="route-card">
                <div class="thumb-wrap">
                  <button
                    class="favorite-btn"
                    on:click={() => toggleFavorite(route.id)}
                    title={favorites.has(route.id) ? '取消收藏' : '收藏'}
                  >
                    {favorites.has(route.id) ? '⭐' : '☆'}
                  </button>
                  {#if route.thumbnail}
                    <img src={route.thumbnail} alt={route.name} />
                  {:else}
                    <div class="placeholder-map"></div>
                    <span class="compass">🧭</span>
                  {/if}
                </div>
                <div class="card-body">
                  {#if renamingId === route.id}
                    <input
                      class="rename-input"
                      bind:value={renameInput}
                      on:keydown={(e) => {
                        if (e.key === 'Enter') confirmRename(route.id);
                        if (e.key === 'Escape') cancelRename();
                      }}
                      on:blur={() => confirmRename(route.id)}
                    />
                  {:else}
                    <div class="route-name">{route.name}</div>
                  {/if}
                  <div class="dates">
                    创建 {formatDate(route.createdAt)}<br />
                    更新 {formatDate(route.updatedAt)}
                  </div>
                  <div class="stats">
                    <span>📍 {route.markers.length}</span>
                    <span>🛣️ {formatDistance(route.totalDistance || 0)}</span>
                    <span>⏱️ {calcDuration(route)}</span>
                  </div>
                  <div class="actions">
                    <button
                      class="action-btn load"
                      on:click={() => loadRoute(route)}
                    >📂 加载</button>
                    <button
                      class="action-btn"
                      on:click={() => startRename(route)}
                    >✏️ 重命名</button>
                    <button
                      class="action-btn delete"
                      on:click={() => deleteRoute(route)}
                    >🗑️ 删除</button>
                  </div>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </div>

      <footer class="drawer-footer">
        <button class="footer-btn" on:click={triggerImport}>
          📥 导入数据
        </button>
        <button class="footer-btn" on:click={exportAll}>
          📤 导出全部
        </button>
      </footer>
    </aside>
  </div>
{/if}
