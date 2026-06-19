<script lang="ts">
  import { showPlaza, showToast } from '@/stores/ui.store';
  import { CommunityService } from '@/services/community.service';
  import { formatDistance } from '@/utils/distance';
  import type { CommunityRoute, PlazaSortKey } from '@/types';
  import { onMount } from 'svelte';

  let routes: CommunityRoute[] = [];
  let loading = true;
  let sortKey: PlazaSortKey = 'rating';
  let searchQuery = '';

  const sortOptions: { key: PlazaSortKey; label: string; icon: string }[] = [
    { key: 'rating', label: '评分', icon: '⭐' },
    { key: 'distance', label: '里程', icon: '🛣️' },
    { key: 'markers', label: '标记数', icon: '📍' }
  ];

  let sortedRoutes: CommunityRoute[] = [];

  $: {
    let list = routes.slice();
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        r.routeName.toLowerCase().includes(q) ||
        r.author.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sortKey === 'rating') return b.rating - a.rating || b.publishedAt - a.publishedAt;
      if (sortKey === 'distance') return b.totalDistance - a.totalDistance || b.publishedAt - a.publishedAt;
      if (sortKey === 'markers') return b.markers.length - a.markers.length || b.publishedAt - a.publishedAt;
      return 0;
    });
    sortedRoutes = list;
  }

  onMount(async () => {
    loading = true;
    try {
      routes = await CommunityService.loadPlazaRoutes();
    } catch (e) {
      console.error(e);
      showToast('加载广场数据失败', 'error');
    } finally {
      loading = false;
    }
  });

  function close() {
    showPlaza.set(false);
  }

  function onMaskClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function starDisplay(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  async function cloneRoute(route: CommunityRoute) {
    try {
      const newRoute = await CommunityService.cloneToMyRoutes(route);
      routes = routes.map(r =>
        r.id === route.id ? { ...r, clonedCount: r.clonedCount + 1 } : r
      );
      showToast(`已克隆「${route.routeName}」到我的路线库`, 'success');
    } catch (e: any) {
      showToast('克隆失败：' + (e.message || '未知错误'), 'error');
    }
  }

  async function deleteRoute(route: CommunityRoute) {
    const ok = confirm(`确定要从广场删除「${route.routeName}」吗？`);
    if (!ok) return;
    try {
      await CommunityService.deleteFromPlaza(route.id);
      routes = routes.filter(r => r.id !== route.id);
      showToast('已从广场删除', 'info');
    } catch (e) {
      showToast('删除失败', 'error');
    }
  }

  async function exportAll() {
    if (routes.length === 0) {
      showToast('广场暂无路线可导出', 'info');
      return;
    }
    try {
      await CommunityService.exportPackage();
      showToast('社区路线包已导出', 'success');
    } catch (e: any) {
      showToast('导出失败：' + (e.message || '未知错误'), 'error');
    }
  }

  function triggerImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const result = await CommunityService.importPackage(file);
        showToast(`已导入 ${result.imported} 条路线${result.skipped > 0 ? `，跳过 ${result.skipped} 条重复路线` : ''}`, 'success');
        routes = await CommunityService.loadPlazaRoutes();
      } catch (e: any) {
        showToast('导入失败：' + (e.message || '文件格式错误'), 'error');
      }
    };
    input.click();
  }

  function formatPublishDate(ts: number): string {
    const d = new Date(ts);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}月${day}日`;
  }
</script>

{#if $showPlaza}
  <div class="mask" on:click={onMaskClick}>
    <aside class="drawer" role="dialog" aria-label="路线广场">
      <header class="drawer-header">
        <div style="width:36px"></div>
        <div class="title-wrap">
          <h2>路线广场</h2>
          <div class="subtitle">Community Plaza</div>
        </div>
        <button class="close-btn" on:click={close} aria-label="关闭">✕</button>
      </header>

      <div class="drawer-body">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            placeholder="搜索路线、作者..."
            bind:value={searchQuery}
          />
        </div>

        <div class="sort-bar">
          {#each sortOptions as opt}
            <button
              class="sort-btn {sortKey === opt.key ? 'active' : ''}"
              on:click={() => sortKey = opt.key}
            >
              <span class="sort-icon">{opt.icon}</span>
              {opt.label}
              {#if sortKey === opt.key}
                <span class="sort-arrow">▼</span>
              {/if}
            </button>
          {/each}
          <span class="route-count">共 {sortedRoutes.length} 条</span>
        </div>

        {#if loading}
          <div class="skeleton">
            <div class="waterfall" style="column-count: 2;">
              {#each { length: 4 } as _}
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
        {:else if sortedRoutes.length === 0}
          <div class="empty-state">
            <div class="empty-icon">🏘️</div>
            <div class="empty-title">广场空空如也</div>
            <div class="empty-text">
              {searchQuery ? '没有找到匹配的路线' : '还没有路线发布到广场，快去发布你的第一条路线吧！'}
            </div>
          </div>
        {:else}
          <div class="waterfall">
            {#each sortedRoutes as route (route.id)}
              <article class="plaza-card">
                <div class="card-header">
                  <div class="author-row">
                    <span class="author-avatar">{route.author.charAt(0)}</span>
                    <span class="author-name">{route.author}</span>
                    <span class="publish-date">{formatPublishDate(route.publishedAt)}</span>
                  </div>
                  <div class="star-row" title="难度评分 {route.rating}/5">
                    <span class="stars">{starDisplay(route.rating)}</span>
                  </div>
                </div>

                <div class="card-body">
                  <h3 class="route-name">{route.routeName}</h3>
                  {#if route.description}
                    <p class="route-desc">{route.description}</p>
                  {/if}

                  <div class="route-stats">
                    <span class="stat">📍 {route.markers.length}</span>
                    <span class="stat">🛣️ {formatDistance(route.totalDistance)}</span>
                    <span class="stat">🔄 {route.clonedCount}</span>
                  </div>
                </div>

                <div class="card-footer">
                  <button class="action-btn clone-btn" on:click={() => cloneRoute(route)}>
                    📋 克隆到我的路线库
                  </button>
                  <button class="action-btn delete-btn" on:click={() => deleteRoute(route)}>
                    🗑️
                  </button>
                </div>
              </article>
            {/each}
          </div>
        {/if}
      </div>

      <footer class="drawer-footer">
        <button class="footer-btn" on:click={triggerImport}>
          📥 导入路线包
        </button>
        <button class="footer-btn" on:click={exportAll}>
          📤 导出路线包
        </button>
      </footer>
    </aside>
  </div>
{/if}

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
    width: 480px;
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

  .sort-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 16px;
    background: rgba(139, 111, 71, 0.12);
    padding: 4px;
    border-radius: 22px;
  }

  .sort-btn {
    flex: none;
    padding: 7px 12px;
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
    display: flex;
    align-items: center;
    gap: 3px;

    .sort-icon { margin-right: 2px; }
    .sort-arrow { font-size: 8px; margin-left: 2px; }

    &:hover { color: $deep-brown; }

    &.active {
      background: #FBF5E6;
      color: $highway-blue;
      box-shadow: 0 2px 6px rgba(62, 44, 28, 0.1);
    }
  }

  .route-count {
    margin-left: auto;
    font-family: $font-typewriter;
    font-size: 11px;
    color: rgba(62, 44, 28, 0.5);
    padding-right: 8px;
  }

  .waterfall {
    column-count: 2;
    column-gap: 12px;
  }

  .plaza-card {
    break-inside: avoid;
    margin-bottom: 12px;
    background: #FBF5E6;
    border: 1.5px solid rgba(139, 111, 71, 0.25);
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.2s ease;

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 16px rgba(62, 44, 28, 0.15);
      border-color: rgba(212, 160, 60, 0.5);
    }
  }

  .card-header {
    padding: 10px 12px 6px;
    border-bottom: 1px dashed rgba(139, 111, 71, 0.2);
  }

  .author-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .author-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: linear-gradient(135deg, $highway-blue, #245279);
    color: $warm-yellow;
    font-family: $font-display;
    font-size: 13px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .author-name {
    font-family: $font-display;
    font-size: 13px;
    font-weight: 600;
    color: $deep-brown;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .publish-date {
    font-family: $font-typewriter;
    font-size: 10px;
    color: rgba(62, 44, 28, 0.45);
    flex-shrink: 0;
  }

  .star-row {
    .stars {
      font-size: 13px;
      color: $warm-yellow;
      letter-spacing: 1px;
      text-shadow: 0 1px 2px rgba(212, 160, 60, 0.3);
    }
  }

  .card-body {
    padding: 8px 12px 10px;
  }

  .route-name {
    font-family: 'Ma Shan Zheng', 'Kaiti', serif;
    font-size: 16px;
    color: $deep-brown;
    line-height: 1.3;
    min-height: 32px;
    margin: 0 0 6px;
    padding: 4px 6px;
    background: rgba(255, 240, 180, 0.4);
    border-left: 3px solid $warm-yellow;
    transform: rotate(-0.6deg);
    box-shadow: 1px 2px 4px rgba(62, 44, 28, 0.08);
    word-break: break-all;
  }

  .route-desc {
    font-family: $font-body;
    font-size: 12px;
    color: rgba(62, 44, 28, 0.65);
    line-height: 1.6;
    margin: 0 0 8px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .route-stats {
    display: flex;
    gap: 12px;
    font-family: $font-typewriter;
    font-size: 11px;
    color: rgba(62, 44, 28, 0.65);
    padding: 6px 0;
    border-top: 1px dashed rgba(139, 111, 71, 0.2);

    .stat {
      display: flex;
      align-items: center;
      gap: 3px;
    }
  }

  .card-footer {
    padding: 8px 12px;
    display: flex;
    gap: 6px;
  }

  .action-btn {
    border: 1.5px solid rgba(139, 111, 71, 0.25);
    border-radius: 4px;
    font-family: $font-display;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    padding: 6px 8px;

    &.clone-btn {
      flex: 1;
      background: rgba(44, 95, 143, 0.06);
      color: $highway-blue;

      &:hover {
        background: rgba(44, 95, 143, 0.12);
        border-color: $highway-blue;
      }
    }

    &.delete-btn {
      background: rgba(255, 250, 235, 0.7);
      color: rgba(62, 44, 28, 0.5);

      &:hover {
        background: rgba(139, 58, 46, 0.08);
        border-color: $vintage-red;
        color: $vintage-red;
      }
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
    .waterfall { column-gap: 12px; }
    .skel-card {
      break-inside: avoid;
      margin-bottom: 12px;
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
