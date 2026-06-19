<script lang="ts">
  import { showPlaza, showToast, openRouteDetail } from '@/stores/ui.store';
  import { CommunityService } from '@/services/community.service';
  import { CommunityStorage } from '@/services/community-storage.service';
  import { formatDistance } from '@/utils/distance';
  import {
    ROUTE_THEME_LABELS,
    ROUTE_THEME_ICONS,
    type CommunityRoute,
    type PlazaSortKey,
    type PlazaFilter,
    type DistanceRange,
    type MarkerCountRange,
    type RatingFilter,
    type DifficultyFilter,
    type RouteTheme,
    type FavoriteRoute
  } from '@/types';
  import { onMount } from 'svelte';

  type ViewTab = 'discover' | 'favorites' | 'watchlater';

  let routes: CommunityRoute[] = [];
  let recommendedRoutes: CommunityRoute[] = [];
  let loading = true;
  let sortKey: PlazaSortKey = 'rating';
  let searchQuery = '';
  let activeTab: ViewTab = 'discover';
  let showFilters = false;
  let favoriteMap: Map<string, FavoriteRoute> = new Map();
  let watchLaterIds: Set<string> = new Set();
  let editingTagRouteId: string | null = null;
  let newTagInput = '';

  let filter: PlazaFilter = {
    distance: 'all',
    markers: 'all',
    themes: [],
    difficulty: 'all',
    minRating: 'all'
  };

  const sortOptions: { key: PlazaSortKey; label: string; icon: string }[] = [
    { key: 'rating', label: '评分', icon: '⭐' },
    { key: 'distance', label: '里程', icon: '🛣️' },
    { key: 'markers', label: '标记数', icon: '📍' }
  ];

  const distanceOptions: { key: DistanceRange; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'short', label: '0-100km' },
    { key: 'medium', label: '100-500km' },
    { key: 'long', label: '500km+' }
  ];

  const markerOptions: { key: MarkerCountRange; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'few', label: '1-4个' },
    { key: 'medium', label: '5-9个' },
    { key: 'many', label: '10个+' }
  ];

  const difficultyOptions: { key: DifficultyFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 1, label: '★' },
    { key: 2, label: '★★' },
    { key: 3, label: '★★★' },
    { key: 4, label: '★★★★' },
    { key: 5, label: '★★★★★' }
  ];

  const ratingOptions: { key: RatingFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 3, label: '3星以上' },
    { key: 4, label: '4星以上' },
    { key: 5, label: '5星' }
  ];

  const allThemes: RouteTheme[] = ['nature', 'culture', 'food', 'road_trip'];

  let filteredRoutes: CommunityRoute[] = [];
  let favoriteRoutes: CommunityRoute[] = [];
  let watchLaterRoutes: CommunityRoute[] = [];

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
    list = CommunityService.filterRoutes(list, filter);
    list.sort((a, b) => {
      if (sortKey === 'rating') return b.rating - a.rating || b.publishedAt - a.publishedAt;
      if (sortKey === 'distance') return b.totalDistance - a.totalDistance || b.publishedAt - a.publishedAt;
      if (sortKey === 'markers') return b.markers.length - a.markers.length || b.publishedAt - a.publishedAt;
      return 0;
    });
    filteredRoutes = list;
  }

  $: {
    favoriteRoutes = routes.filter(r => favoriteMap.has(r.id));
  }

  $: {
    watchLaterRoutes = routes.filter(r => watchLaterIds.has(r.id));
  }

  $: hasActiveFilter =
    filter.distance !== 'all' ||
    filter.markers !== 'all' ||
    filter.themes.length > 0 ||
    filter.difficulty !== 'all' ||
    filter.minRating !== 'all';

  function loadFavoritesAndWatchLater() {
    const favs = CommunityStorage.loadFavorites();
    favoriteMap = new Map(favs.map(f => [f.routeId, f]));
    const wl = CommunityStorage.loadWatchLater();
    watchLaterIds = new Set(wl.map(w => w.routeId));
  }

  onMount(async () => {
    loading = true;
    try {
      routes = await CommunityService.loadPlazaRoutes();
      recommendedRoutes = await CommunityService.getRecommendations(6);
      loadFavoritesAndWatchLater();
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

  function toggleFavorite(route: CommunityRoute) {
    const fav = CommunityStorage.toggleFavorite(route.id);
    loadFavoritesAndWatchLater();
    showToast(fav ? '已加入收藏' : '已取消收藏', fav ? 'success' : 'info');
  }

  function toggleWatchLater(route: CommunityRoute) {
    const added = CommunityStorage.toggleWatchLater(route.id);
    loadFavoritesAndWatchLater();
    showToast(added ? '已加入稍后再看' : '已从稍后再看移除', added ? 'success' : 'info');
  }

  function startEditTags(route: CommunityRoute) {
    editingTagRouteId = route.id;
    newTagInput = '';
  }

  function cancelEditTags() {
    editingTagRouteId = null;
    newTagInput = '';
  }

  function addCustomTag(route: CommunityRoute) {
    const tag = newTagInput.trim();
    if (!tag) return;
    const fav = favoriteMap.get(route.id);
    if (fav) {
      const newTags = [...fav.customTags, tag];
      CommunityStorage.updateFavoriteTags(route.id, newTags);
      loadFavoritesAndWatchLater();
      newTagInput = '';
    }
  }

  function removeCustomTag(route: CommunityRoute, tagIdx: number) {
    const fav = favoriteMap.get(route.id);
    if (fav) {
      const newTags = fav.customTags.filter((_, i) => i !== tagIdx);
      CommunityStorage.updateFavoriteTags(route.id, newTags);
      loadFavoritesAndWatchLater();
    }
  }

  function toggleFilterTheme(theme: RouteTheme) {
    const idx = filter.themes.indexOf(theme);
    if (idx >= 0) {
      filter.themes.splice(idx, 1);
    } else {
      filter.themes.push(theme);
    }
    filter = { ...filter, themes: [...filter.themes] };
  }

  function resetFilters() {
    filter = {
      distance: 'all',
      markers: 'all',
      themes: [],
      difficulty: 'all',
      minRating: 'all'
    };
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
        recommendedRoutes = await CommunityService.getRecommendations(6);
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

  function viewDetail(route: CommunityRoute) {
    openRouteDetail(route.id);
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

        <div class="tab-bar">
          <button
            class="tab-btn {activeTab === 'discover' ? 'active' : ''}"
            on:click={() => activeTab = 'discover'}
          >
            <span class="tab-icon">🧭</span>发现
          </button>
          <button
            class="tab-btn {activeTab === 'favorites' ? 'active' : ''}"
            on:click={() => activeTab = 'favorites'}
          >
            <span class="tab-icon">⭐</span>收藏
            {#if favoriteMap.size > 0}
              <span class="tab-badge">{favoriteMap.size}</span>
            {/if}
          </button>
          <button
            class="tab-btn {activeTab === 'watchlater' ? 'active' : ''}"
            on:click={() => activeTab = 'watchlater'}
          >
            <span class="tab-icon">🕐</span>稍后再看
            {#if watchLaterIds.size > 0}
              <span class="tab-badge">{watchLaterIds.size}</span>
            {/if}
          </button>
        </div>

        {#if activeTab === 'discover'}
          {#if recommendedRoutes.length > 0 && !loading && !searchQuery && !hasActiveFilter}
            <section class="recommend-section">
              <div class="section-header">
                <span class="section-title">
                  <span class="title-icon">💡</span>猜你喜欢
                </span>
                <span class="section-hint">基于你的路线偏好</span>
              </div>
              <div class="recommend-scroll">
                {#each recommendedRoutes as recRoute (recRoute.id)}
                  <article class="recommend-card" on:click={() => viewDetail(recRoute)}>
                    {#if recRoute.thumbnail}
                      <img class="rec-thumb" src={recRoute.thumbnail} alt="" />
                    {:else}
                      <div class="rec-thumb-placeholder">
                        <span class="rec-emoji">🗺️</span>
                      </div>
                    {/if}
                    <div class="rec-body">
                      <h4 class="rec-name">{recRoute.routeName}</h4>
                      <div class="rec-tags">
                        {#each (recRoute.themes || []).slice(0, 2) as t}
                          <span class="mini-tag">
                            {ROUTE_THEME_ICONS[t]} {ROUTE_THEME_LABELS[t]}
                          </span>
                        {/each}
                      </div>
                      <div class="rec-stats">
                        <span>🛣️ {formatDistance(recRoute.totalDistance)}</span>
                        <span>⭐ {recRoute.rating}</span>
                      </div>
                    </div>
                  </article>
                {/each}
              </div>
            </section>
          {/if}

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
            <button
              class="filter-btn {showFilters ? 'active' : ''} {hasActiveFilter ? 'has-filter' : ''}"
              on:click={() => showFilters = !showFilters}
            >
              <span class="sort-icon">🔧</span>
              筛选
              {#if hasActiveFilter}
                <span class="filter-dot"></span>
              {/if}
            </button>
          </div>

          {#if showFilters}
            <div class="filter-panel">
              <div class="filter-row">
                <span class="filter-label">里程范围</span>
                <div class="filter-chips">
                  {#each distanceOptions as opt}
                    <button
                      class="chip {filter.distance === opt.key ? 'active' : ''}"
                      on:click={() => filter = { ...filter, distance: opt.key }}
                    >{opt.label}</button>
                  {/each}
                </div>
              </div>

              <div class="filter-row">
                <span class="filter-label">标记点数量</span>
                <div class="filter-chips">
                  {#each markerOptions as opt}
                    <button
                      class="chip {filter.markers === opt.key ? 'active' : ''}"
                      on:click={() => filter = { ...filter, markers: opt.key }}
                    >{opt.label}</button>
                  {/each}
                </div>
              </div>

              <div class="filter-row">
                <span class="filter-label">路线主题</span>
                <div class="filter-chips">
                  {#each allThemes as t}
                    <button
                      class="chip {filter.themes.includes(t) ? 'active' : ''}"
                      on:click={() => toggleFilterTheme(t)}
                    >
                      {ROUTE_THEME_ICONS[t]} {ROUTE_THEME_LABELS[t]}
                    </button>
                  {/each}
                </div>
              </div>

              <div class="filter-row">
                <span class="filter-label">难度等级</span>
                <div class="filter-chips">
                  {#each difficultyOptions as opt}
                    <button
                      class="chip {filter.difficulty === opt.key ? 'active' : ''}"
                      on:click={() => filter = { ...filter, difficulty: opt.key }}
                    >{opt.label}</button>
                  {/each}
                </div>
              </div>

              <div class="filter-row">
                <span class="filter-label">平均评分</span>
                <div class="filter-chips">
                  {#each ratingOptions as opt}
                    <button
                      class="chip {filter.minRating === opt.key ? 'active' : ''}"
                      on:click={() => filter = { ...filter, minRating: opt.key }}
                    >{opt.label}</button>
                  {/each}
                </div>
              </div>

              {#if hasActiveFilter}
                <button class="reset-filter-btn" on:click={resetFilters}>清除全部筛选</button>
              {/if}
            </div>
          {/if}

          <span class="route-count">共 {filteredRoutes.length} 条路线</span>

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
          {:else if filteredRoutes.length === 0}
            <div class="empty-state">
              <div class="empty-icon">🏘️</div>
              <div class="empty-title">暂无匹配路线</div>
              <div class="empty-text">
                {searchQuery || hasActiveFilter ? '没有找到匹配的路线，试试调整筛选条件' : '还没有路线发布到广场，快去发布你的第一条路线吧！'}
              </div>
            </div>
          {:else}
            <div class="waterfall">
              {#each filteredRoutes as route (route.id)}
                <article class="plaza-card">
                  <div class="card-actions">
                    <button
                      class="icon-btn {favoriteMap.has(route.id) ? 'favorited' : ''}"
                      on:click|stopPropagation={() => toggleFavorite(route)}
                      title={favoriteMap.has(route.id) ? '取消收藏' : '收藏'}
                    >
                      {favoriteMap.has(route.id) ? '⭐' : '☆'}
                    </button>
                    <button
                      class="icon-btn {watchLaterIds.has(route.id) ? 'watchlater' : ''}"
                      on:click|stopPropagation={() => toggleWatchLater(route)}
                      title={watchLaterIds.has(route.id) ? '移除稍后再看' : '稍后再看'}
                    >
                      {watchLaterIds.has(route.id) ? '🕑' : '🕐'}
                    </button>
                  </div>

                  <div class="card-header" on:click={() => viewDetail(route)}>
                    <div class="author-row">
                      <span class="author-avatar">{route.author.charAt(0)}</span>
                      <span class="author-name">{route.author}</span>
                      <span class="publish-date">{formatPublishDate(route.publishedAt)}</span>
                    </div>
                    <div class="star-row" title="难度评分 {route.rating}/5">
                      <span class="stars">{starDisplay(route.rating)}</span>
                    </div>
                  </div>

                  <div class="card-body" on:click={() => viewDetail(route)}>
                    <h3 class="route-name">{route.routeName}</h3>
                    {#if route.themes && route.themes.length > 0}
                      <div class="theme-tags">
                        {#each route.themes as t}
                          <span class="theme-tag">
                            {ROUTE_THEME_ICONS[t]} {ROUTE_THEME_LABELS[t]}
                          </span>
                        {/each}
                      </div>
                    {/if}
                    {#if route.description}
                      <p class="route-desc">{route.description}</p>
                    {/if}

                    <div class="route-stats">
                      <span class="stat">📍 {route.markers.length}</span>
                      <span class="stat">🛣️ {formatDistance(route.totalDistance)}</span>
                      <span class="stat">🔄 {route.clonedCount}</span>
                    </div>

                    {#if favoriteMap.has(route.id)}
                      {#const fav = favoriteMap.get(route.id)}
                        {#if fav && fav.customTags.length > 0}
                          <div class="custom-tags-section">
                            <span class="custom-tags-label">我的标签：</span>
                            {#each fav.customTags as tag, i}
                              <span class="custom-tag" on:click|stopPropagation={() => {}}>
                                {tag}
                                <button class="tag-remove" on:click|stopPropagation={() => removeCustomTag(route, i)}>×</button>
                              </span>
                            {/each}
                          </div>
                        {/if}
                      {/const}
                    {/if}
                  </div>

                  <div class="card-footer">
                    <button class="action-btn clone-btn" on:click={() => cloneRoute(route)}>
                      📋 克隆
                    </button>
                    {#if favoriteMap.has(route.id)}
                      {#if editingTagRouteId === route.id}
                        <div class="tag-input-wrap">
                          <input
                            class="tag-input"
                            placeholder="自定义标签"
                            bind:value={newTagInput}
                            on:keydown={(e) => {
                              if (e.key === 'Enter') addCustomTag(route);
                              if (e.key === 'Escape') cancelEditTags();
                            }}
                            on:blur={cancelEditTags}
                            on:click|stopPropagation={() => {}}
                          />
                        </div>
                      {:else}
                        <button class="action-btn tag-btn" on:click={() => startEditTags(route)}>
                          🏷️ 标签
                        </button>
                      {/if}
                    {/if}
                    <button class="action-btn delete-btn" on:click={() => deleteRoute(route)}>
                      🗑️
                    </button>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        {:else if activeTab === 'favorites'}
          {#if favoriteRoutes.length === 0}
            <div class="empty-state">
              <div class="empty-icon">⭐</div>
              <div class="empty-title">暂无收藏</div>
              <div class="empty-text">去发现页面收藏你喜欢的路线吧</div>
            </div>
          {:else}
            <div class="waterfall">
              {#each favoriteRoutes as route (route.id)}
                <article class="plaza-card">
                  <div class="card-header" on:click={() => viewDetail(route)}>
                    <div class="author-row">
                      <span class="author-avatar">{route.author.charAt(0)}</span>
                      <span class="author-name">{route.author}</span>
                    </div>
                    <button
                      class="icon-btn favorited"
                      on:click|stopPropagation={() => toggleFavorite(route)}
                      title="取消收藏"
                    >⭐</button>
                  </div>
                  <div class="card-body" on:click={() => viewDetail(route)}>
                    <h3 class="route-name">{route.routeName}</h3>
                    {#if route.themes && route.themes.length > 0}
                      <div class="theme-tags">
                        {#each route.themes as t}
                          <span class="theme-tag">
                            {ROUTE_THEME_ICONS[t]} {ROUTE_THEME_LABELS[t]}
                          </span>
                        {/each}
                      </div>
                    {/if}
                    <div class="route-stats">
                      <span class="stat">📍 {route.markers.length}</span>
                      <span class="stat">🛣️ {formatDistance(route.totalDistance)}</span>
                    </div>
                    {#const fav = favoriteMap.get(route.id)}
                      {#if fav}
                        <div class="custom-tags-section">
                          <span class="custom-tags-label">我的标签：</span>
                          {#each fav.customTags as tag, i}
                            <span class="custom-tag">
                              {tag}
                              <button class="tag-remove" on:click|stopPropagation={() => removeCustomTag(route, i)}>×</button>
                            </span>
                          {/each}
                          {#if editingTagRouteId === route.id}
                            <input
                              class="tag-input-inline"
                              placeholder="添加标签"
                              bind:value={newTagInput}
                              on:keydown={(e) => {
                                if (e.key === 'Enter') addCustomTag(route);
                                if (e.key === 'Escape') cancelEditTags();
                              }}
                              on:blur={cancelEditTags}
                              on:click|stopPropagation={() => {}}
                            />
                          {:else}
                            <button class="add-tag-btn" on:click|stopPropagation={() => startEditTags(route)}>+ 添加</button>
                          {/if}
                        </div>
                      {/if}
                    {/const}
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        {:else if activeTab === 'watchlater'}
          {#if watchLaterRoutes.length === 0}
            <div class="empty-state">
              <div class="empty-icon">🕐</div>
              <div class="empty-title">稍后再看列表为空</div>
              <div class="empty-text">发现感兴趣的路线可以先加入稍后再看</div>
            </div>
          {:else}
            <div class="waterfall">
              {#each watchLaterRoutes as route (route.id)}
                <article class="plaza-card">
                  <div class="card-header" on:click={() => viewDetail(route)}>
                    <div class="author-row">
                      <span class="author-avatar">{route.author.charAt(0)}</span>
                      <span class="author-name">{route.author}</span>
                    </div>
                    <button
                      class="icon-btn watchlater"
                      on:click|stopPropagation={() => toggleWatchLater(route)}
                      title="移除"
                    >🕑</button>
                  </div>
                  <div class="card-body" on:click={() => viewDetail(route)}>
                    <h3 class="route-name">{route.routeName}</h3>
                    {#if route.themes && route.themes.length > 0}
                      <div class="theme-tags">
                        {#each route.themes as t}
                          <span class="theme-tag">
                            {ROUTE_THEME_ICONS[t]} {ROUTE_THEME_LABELS[t]}
                          </span>
                        {/each}
                      </div>
                    {/if}
                    <div class="route-stats">
                      <span class="stat">📍 {route.markers.length}</span>
                      <span class="stat">🛣️ {formatDistance(route.totalDistance)}</span>
                      <span class="stat">⭐ {route.rating}</span>
                    </div>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
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

  .tab-bar {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
    background: rgba(139, 111, 71, 0.12);
    padding: 4px;
    border-radius: 22px;
  }

  .tab-btn {
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
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    position: relative;

    .tab-icon { font-size: 13px; }
    .tab-badge {
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      background: $vintage-red;
      color: #FFF;
      font-family: $font-typewriter;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &:hover { color: $deep-brown; }

    &.active {
      background: #FBF5E6;
      color: $highway-blue;
      box-shadow: 0 2px 6px rgba(62, 44, 28, 0.1);
      .tab-badge { background: $highway-blue; }
    }
  }

  .recommend-section {
    margin-bottom: 16px;
    padding: 12px;
    background: linear-gradient(135deg, rgba(212, 160, 60, 0.1), rgba(44, 95, 143, 0.08));
    border: 1.5px solid rgba(212, 160, 60, 0.3);
    border-radius: 10px;
  }

  .section-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 10px;

    .section-title {
      font-family: $font-display;
      font-size: 14px;
      font-weight: 700;
      color: $deep-brown;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      gap: 6px;

      .title-icon { font-size: 16px; }
    }

    .section-hint {
      font-family: $font-typewriter;
      font-size: 10px;
      color: rgba(62, 44, 28, 0.5);
    }
  }

  .recommend-scroll {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 4px;
    margin: 0 -4px;
    padding-left: 4px;
    padding-right: 4px;

    &::-webkit-scrollbar {
      height: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(212, 160, 60, 0.3);
      border-radius: 2px;
    }
  }

  .recommend-card {
    flex-shrink: 0;
    width: 160px;
    background: #FBF5E6;
    border: 1.5px solid rgba(139, 111, 71, 0.25);
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      transform: translateY(-2px);
      border-color: rgba(212, 160, 60, 0.5);
      box-shadow: 0 4px 12px rgba(62, 44, 28, 0.12);
    }
  }

  .rec-thumb {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    display: block;
  }

  .rec-thumb-placeholder {
    aspect-ratio: 4 / 3;
    background: linear-gradient(135deg, #E8DCC4, #C9B896);
    display: flex;
    align-items: center;
    justify-content: center;
    .rec-emoji { font-size: 36px; }
  }

  .rec-body {
    padding: 8px 10px 10px;
  }

  .rec-name {
    font-family: 'Ma Shan Zheng', 'Kaiti', serif;
    font-size: 14px;
    color: $deep-brown;
    margin: 0 0 6px;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .rec-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin-bottom: 6px;

    .mini-tag {
      font-family: $font-typewriter;
      font-size: 9px;
      padding: 2px 5px;
      background: rgba(44, 95, 143, 0.08);
      border-radius: 3px;
      color: $highway-blue;
    }
  }

  .rec-stats {
    display: flex;
    justify-content: space-between;
    font-family: $font-typewriter;
    font-size: 10px;
    color: rgba(62, 44, 28, 0.6);
  }

  .sort-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
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

  .filter-btn {
    margin-left: auto;
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
    display: flex;
    align-items: center;
    gap: 3px;
    position: relative;

    &:hover { color: $deep-brown; }
    &.active {
      background: rgba(212, 160, 60, 0.15);
      color: #B8860B;
    }
    &.has-filter .sort-icon {
      color: $warm-yellow;
    }
    .filter-dot {
      position: absolute;
      top: 5px;
      right: 5px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: $vintage-red;
    }
  }

  .route-count {
    display: block;
    font-family: $font-typewriter;
    font-size: 11px;
    color: rgba(62, 44, 28, 0.5);
    margin-bottom: 10px;
    padding: 0 4px;
  }

  .filter-panel {
    background: rgba(255, 250, 235, 0.9);
    border: 1.5px solid rgba(139, 111, 71, 0.25);
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .filter-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .filter-label {
    font-family: $font-display;
    font-size: 11px;
    font-weight: 600;
    color: rgba(62, 44, 28, 0.7);
    letter-spacing: 0.5px;
  }

  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .chip {
    padding: 5px 10px;
    border: 1.5px solid rgba(139, 111, 71, 0.3);
    border-radius: 14px;
    background: #FBF5E6;
    font-family: $font-display;
    font-size: 11px;
    font-weight: 500;
    color: rgba(62, 44, 28, 0.7);
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;

    &:hover {
      border-color: rgba(212, 160, 60, 0.5);
      background: rgba(255, 240, 180, 0.3);
    }

    &.active {
      border-color: $highway-blue;
      background: rgba(44, 95, 143, 0.1);
      color: $highway-blue;
      font-weight: 600;
    }
  }

  .reset-filter-btn {
    align-self: flex-start;
    padding: 6px 14px;
    border: 1.5px solid rgba(139, 58, 46, 0.35);
    border-radius: 14px;
    background: rgba(255, 250, 235, 0.7);
    font-family: $font-display;
    font-size: 11px;
    font-weight: 600;
    color: $vintage-red;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: rgba(139, 58, 46, 0.08);
      border-color: $vintage-red;
    }
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
    position: relative;

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 16px rgba(62, 44, 28, 0.15);
      border-color: rgba(212, 160, 60, 0.5);
    }
  }

  .card-actions {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    gap: 4px;
    z-index: 2;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 250, 235, 0.95);
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);

    &:hover { transform: scale(1.1); }
    &.favorited { background: rgba(212, 160, 60, 0.2); }
    &.watchlater { background: rgba(44, 95, 143, 0.12); }
  }

  .card-header {
    padding: 10px 12px 6px;
    border-bottom: 1px dashed rgba(139, 111, 71, 0.2);
    cursor: pointer;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 6px;
  }

  .author-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    flex: 1;
    min-width: 0;
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
    flex-shrink: 0;
    .stars {
      font-size: 13px;
      color: $warm-yellow;
      letter-spacing: 1px;
      text-shadow: 0 1px 2px rgba(212, 160, 60, 0.3);
    }
  }

  .card-body {
    padding: 8px 12px 10px;
    cursor: pointer;
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

  .theme-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
  }

  .theme-tag {
    font-family: $font-typewriter;
    font-size: 10px;
    padding: 3px 7px;
    background: rgba(44, 95, 143, 0.08);
    border-radius: 4px;
    color: $highway-blue;
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

  .custom-tags-section {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed rgba(212, 160, 60, 0.3);

    .custom-tags-label {
      font-family: $font-typewriter;
      font-size: 10px;
      color: rgba(62, 44, 28, 0.5);
    }
  }

  .custom-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px 3px 9px;
    background: rgba(212, 160, 60, 0.15);
    border: 1px solid rgba(212, 160, 60, 0.4);
    border-radius: 12px;
    font-family: $font-display;
    font-size: 11px;
    color: rgba(62, 44, 28, 0.8);

    .tag-remove {
      border: none;
      background: none;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      color: rgba(62, 44, 28, 0.5);
      padding: 0;
      width: 14px;
      height: 14px;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover { color: $vintage-red; }
    }
  }

  .add-tag-btn {
    padding: 3px 8px;
    border: 1px dashed rgba(139, 111, 71, 0.4);
    border-radius: 10px;
    background: transparent;
    font-family: $font-display;
    font-size: 10px;
    color: rgba(62, 44, 28, 0.5);
    cursor: pointer;

    &:hover {
      border-color: $highway-blue;
      color: $highway-blue;
    }
  }

  .tag-input-inline {
    width: 70px;
    padding: 2px 6px;
    border: 1px solid $highway-blue;
    border-radius: 10px;
    background: #FFF;
    font-family: $font-body;
    font-size: 11px;
    color: $deep-brown;
    outline: none;
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

    &.tag-btn {
      background: rgba(212, 160, 60, 0.08);
      color: #B8860B;

      &:hover {
        background: rgba(212, 160, 60, 0.15);
        border-color: $warm-yellow;
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

  .tag-input-wrap {
    flex: 1;
    display: flex;
    align-items: center;

    .tag-input {
      width: 100%;
      padding: 5px 8px;
      border: 1.5px solid $highway-blue;
      border-radius: 4px;
      background: #FFF;
      font-family: $font-body;
      font-size: 11px;
      color: $deep-brown;
      outline: none;
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
