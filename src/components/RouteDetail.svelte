<script lang="ts">
  import { showRouteDetail, showToast, openRouteDetail } from '@/stores/ui.store';
  import { CommunityService } from '@/services/community.service';
  import { CommunityStorage } from '@/services/community-storage.service';
  import { formatDistance } from '@/utils/distance';
  import {
    ROUTE_THEME_LABELS,
    ROUTE_THEME_ICONS,
    type CommunityRoute,
    type FavoriteRoute,
    type MarkerType
  } from '@/types';
  import { onMount } from 'svelte';

  let route: CommunityRoute | null = null;
  let similarRoutes: CommunityRoute[] = [];
  let loading = true;
  let isFavorite = false;
  let isWatchLater = false;
  let favoriteData: FavoriteRoute | undefined;
  let editingTags = false;
  let newTagInput = '';

  const MARKER_TYPE_LABELS: Record<MarkerType, string> = {
    attraction: '景点',
    restaurant: '餐饮',
    hotel: '住宿',
    gas: '加油站'
  };

  const MARKER_TYPE_ICONS: Record<MarkerType, string> = {
    attraction: '🏛️',
    restaurant: '🍽️',
    hotel: '🏨',
    gas: '⛽'
  };

  const DIFFICULTY_LABELS: Record<number, string> = {
    1: '轻松休闲',
    2: '简单易行',
    3: '中等难度',
    4: '较有挑战',
    5: '极限挑战'
  };

  $: routeId = $showRouteDetail;

  async function loadData() {
    if (!routeId) {
      route = null;
      similarRoutes = [];
      return;
    }
    loading = true;
    try {
      const allRoutes = await CommunityService.loadPlazaRoutes();
      route = allRoutes.find(r => r.id === routeId) || null;
      if (route) {
        similarRoutes = await CommunityService.getSimilarRoutes(routeId, 4);
        isFavorite = CommunityStorage.isFavorite(routeId);
        isWatchLater = CommunityStorage.isWatchLater(routeId);
        favoriteData = CommunityStorage.getFavorite(routeId);
      }
    } catch (e) {
      console.error(e);
      showToast('加载路线详情失败', 'error');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadData();
  });

  $: if (routeId) {
    loadData();
  }

  function close() {
    showRouteDetail.set(null);
  }

  function onMaskClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function starDisplay(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  function formatFullDate(ts: number): string {
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}年${month}月${day}日`;
  }

  async function cloneRoute() {
    if (!route) return;
    try {
      await CommunityService.cloneToMyRoutes(route);
      route = { ...route, clonedCount: route.clonedCount + 1 };
      showToast(`已克隆「${route.routeName}」到我的路线库`, 'success');
    } catch (e: any) {
      showToast('克隆失败：' + (e.message || '未知错误'), 'error');
    }
  }

  function toggleFavorite() {
    if (!route) return;
    const fav = CommunityStorage.toggleFavorite(route.id);
    isFavorite = fav;
    if (fav) {
      favoriteData = CommunityStorage.getFavorite(route.id);
    } else {
      favoriteData = undefined;
    }
    showToast(fav ? '已加入收藏' : '已取消收藏', fav ? 'success' : 'info');
  }

  function toggleWatchLater() {
    if (!route) return;
    const added = CommunityStorage.toggleWatchLater(route.id);
    isWatchLater = added;
    showToast(added ? '已加入稍后再看' : '已从稍后再看移除', added ? 'success' : 'info');
  }

  function startEditTags() {
    editingTags = true;
    newTagInput = '';
  }

  function cancelEditTags() {
    editingTags = false;
    newTagInput = '';
  }

  function addCustomTag() {
    if (!route) return;
    const tag = newTagInput.trim();
    if (!tag) return;
    const fav = CommunityStorage.getFavorite(route.id);
    if (fav) {
      const newTags = [...fav.customTags, tag];
      CommunityStorage.updateFavoriteTags(route.id, newTags);
      favoriteData = CommunityStorage.getFavorite(route.id);
      newTagInput = '';
    }
  }

  function removeCustomTag(tagIdx: number) {
    if (!route) return;
    const fav = CommunityStorage.getFavorite(route.id);
    if (fav) {
      const newTags = fav.customTags.filter((_, i) => i !== tagIdx);
      CommunityStorage.updateFavoriteTags(route.id, newTags);
      favoriteData = CommunityStorage.getFavorite(route.id);
    }
  }

  function viewSimilar(sr: CommunityRoute) {
    openRouteDetail(sr.id);
  }

  function calcDuration(totalDistance: number, markersCount: number): string {
    const hours = totalDistance / 80 + (markersCount * 60) / 60;
    if (hours < 1) {
      return `${Math.round(hours * 60)}分钟`;
    }
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}小时`;
    return `${h}h${m}m`;
  }
</script>

{#if $showRouteDetail}
  <div class="mask" on:click={onMaskClick}>
    <aside class="drawer" role="dialog" aria-label="路线详情">
      <header class="drawer-header">
        <div style="width:36px"></div>
        <div class="title-wrap">
          <h2>路线详情</h2>
          <div class="subtitle">Route Detail</div>
        </div>
        <button class="close-btn" on:click={close} aria-label="关闭">✕</button>
      </header>

      <div class="drawer-body">
        {#if loading}
          <div class="loading-wrap">
            <div class="spinner"></div>
            <div class="loading-text">加载中...</div>
          </div>
        {:else if !route}
          <div class="empty-state">
            <div class="empty-icon">🗺️</div>
            <div class="empty-title">路线不存在</div>
            <div class="empty-text">该路线可能已被删除</div>
          </div>
        {:else}
          <section class="hero-section">
            {#if route.thumbnail}
              <img class="hero-img" src={route.thumbnail} alt="" />
            {:else}
              <div class="hero-placeholder">
                <span class="hero-emoji">🗺️</span>
              </div>
            {/if}
            <div class="hero-overlay">
              <h1 class="hero-title">{route.routeName}</h1>
              <div class="hero-author">
                <span class="author-avatar">{route.author.charAt(0)}</span>
                <span class="author-name">{route.author}</span>
                <span class="publish-date">发布于 {formatFullDate(route.publishedAt)}</span>
              </div>
            </div>
          </section>

          <section class="quick-actions">
            <button
              class="action-primary {isFavorite ? 'active' : ''}"
              on:click={toggleFavorite}
            >
              <span class="act-icon">{isFavorite ? '⭐' : '☆'}</span>
              {isFavorite ? '已收藏' : '收藏'}
            </button>
            <button
              class="action-primary {isWatchLater ? 'active' : ''}"
              on:click={toggleWatchLater}
            >
              <span class="act-icon">{isWatchLater ? '🕑' : '🕐'}</span>
              {isWatchLater ? '已添加' : '稍后再看'}
            </button>
            <button class="action-primary" on:click={cloneRoute}>
              <span class="act-icon">📋</span>克隆
            </button>
          </section>

          {#if isFavorite && favoriteData}
            <section class="section">
              <div class="section-header">
                <span class="section-title"><span class="title-icon">🏷️</span>我的自定义标签</span>
                {#if !editingTags}
                  <button class="link-btn" on:click={startEditTags}>+ 添加</button>
                {:else}
                  <button class="link-btn" on:click={cancelEditTags}>取消</button>
                {/if}
              </div>
              <div class="tags-area">
                {#each favoriteData.customTags as tag, i}
                  <span class="custom-tag">
                    {tag}
                    <button class="tag-remove" on:click={() => removeCustomTag(i)}>×</button>
                  </span>
                {/each}
                {#if editingTags}
                  <input
                    class="tag-input-inline"
                    placeholder="输入标签后回车"
                    bind:value={newTagInput}
                    on:keydown={(e) => {
                      if (e.key === 'Enter') addCustomTag();
                      if (e.key === 'Escape') cancelEditTags();
                    }}
                    on:blur={cancelEditTags}
                  />
                {/if}
                {#if favoriteData.customTags.length === 0 && !editingTags}
                  <span class="empty-hint">还没有自定义标签，点击右上角添加</span>
                {/if}
              </div>
            </section>
          {/if}

          <section class="section">
            <div class="section-header">
              <span class="section-title"><span class="title-icon">📊</span>路线概览</span>
            </div>
            <div class="stats-grid">
              <div class="stat-card">
                <span class="stat-icon">🛣️</span>
                <span class="stat-value">{formatDistance(route.totalDistance)}</span>
                <span class="stat-label">总里程</span>
              </div>
              <div class="stat-card">
                <span class="stat-icon">📍</span>
                <span class="stat-value">{route.markers.length}</span>
                <span class="stat-label">标记点</span>
              </div>
              <div class="stat-card">
                <span class="stat-icon">⏱️</span>
                <span class="stat-value">{calcDuration(route.totalDistance, route.markers.length)}</span>
                <span class="stat-label">预计时长</span>
              </div>
              <div class="stat-card">
                <span class="stat-icon">🔄</span>
                <span class="stat-value">{route.clonedCount}</span>
                <span class="stat-label">被克隆</span>
              </div>
            </div>

            <div class="meta-row">
              <div class="meta-item">
                <span class="meta-label">难度等级</span>
                <div class="meta-value">
                  <span class="stars">{starDisplay(route.rating)}</span>
                  <span class="diff-text">{DIFFICULTY_LABELS[route.rating]}</span>
                </div>
              </div>
            </div>

            {#if route.themes && route.themes.length > 0}
              <div class="meta-row">
                <span class="meta-label">主题标签</span>
                <div class="theme-tags">
                  {#each route.themes as t}
                    <span class="theme-tag">
                      {ROUTE_THEME_ICONS[t]} {ROUTE_THEME_LABELS[t]}
                    </span>
                  {/each}
                </div>
              </div>
            {/if}
          </section>

          {#if route.description}
            <section class="section">
              <div class="section-header">
                <span class="section-title"><span class="title-icon">📝</span>路线简介</span>
              </div>
              <p class="description-text">{route.description}</p>
            </section>
          {/if}

          <section class="section">
            <div class="section-header">
              <span class="section-title"><span class="title-icon">📍</span>路线标记点</span>
              <span class="section-count">共 {route.markers.length} 个</span>
            </div>
            <div class="marker-list">
              {#each route.markers as marker, idx}
                <div class="marker-item">
                  <div class="marker-index">{idx + 1}</div>
                  <div class="marker-icon">{MARKER_TYPE_ICONS[marker.type]}</div>
                  <div class="marker-info">
                    <span class="marker-name">{marker.name}</span>
                    <span class="marker-type">{MARKER_TYPE_LABELS[marker.type]}</span>
                  </div>
                  {#if marker.note}
                    <div class="marker-note">{marker.note}</div>
                  {/if}
                </div>
              {/each}
            </div>
          </section>

          {#if similarRoutes.length > 0}
            <section class="section">
              <div class="section-header">
                <span class="section-title"><span class="title-icon">🔗</span>相似路线推荐</span>
                <span class="section-hint">基于地理位置与标签相似度</span>
              </div>
              <div class="similar-list">
                {#each similarRoutes as sr (sr.id)}
                  <article class="similar-card" on:click={() => viewSimilar(sr)}>
                    <div class="similar-icon">🗺️</div>
                    <div class="similar-body">
                      <h4 class="similar-name">{sr.routeName}</h4>
                      <div class="similar-tags">
                        {#each (sr.themes || []).slice(0, 2) as t}
                          <span class="mini-tag">
                            {ROUTE_THEME_ICONS[t]} {ROUTE_THEME_LABELS[t]}
                          </span>
                        {/each}
                      </div>
                      <div class="similar-stats">
                        <span>🛣️ {formatDistance(sr.totalDistance)}</span>
                        <span>📍 {sr.markers.length}</span>
                        <span>⭐ {sr.rating}</span>
                      </div>
                    </div>
                    <div class="similar-arrow">›</div>
                  </article>
                {/each}
              </div>
            </section>
          {/if}
        {/if}
      </div>
    </aside>
  </div>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  .mask {
    position: fixed;
    inset: 0;
    background: rgba(26, 20, 16, 0.55);
    z-index: 1001;
    display: flex;
    justify-content: flex-end;
    animation: fadeIn 0.25s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .drawer {
    width: 440px;
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
      font-size: 20px;
      font-weight: 700;
      color: $warm-yellow;
      letter-spacing: 5px;
      margin: 0;
      text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
    }
    .subtitle {
      font-family: $font-typewriter;
      font-size: 9px;
      color: rgba(245, 239, 224, 0.6);
      letter-spacing: 3px;
      margin-top: 3px;
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
    padding: 0 0 24px;

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

  .loading-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 24px;
    gap: 16px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(44, 95, 143, 0.2);
    border-top-color: $highway-blue;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-text {
    font-family: $font-body;
    font-size: 14px;
    color: rgba(62, 44, 28, 0.6);
    font-style: italic;
  }

  .hero-section {
    position: relative;
    margin-bottom: 0;
  }

  .hero-img {
    width: 100%;
    height: 180px;
    object-fit: cover;
    display: block;
  }

  .hero-placeholder {
    height: 180px;
    background: linear-gradient(135deg, #5C8A5A, #2C5F8F);
    display: flex;
    align-items: center;
    justify-content: center;
    .hero-emoji { font-size: 64px; }
  }

  .hero-overlay {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    padding: 40px 18px 14px;
    background: linear-gradient(180deg, transparent 0%, rgba(62, 44, 28, 0.85) 100%);

    .hero-title {
      font-family: 'Ma Shan Zheng', 'Kaiti', serif;
      font-size: 22px;
      color: #FFF;
      margin: 0 0 8px;
      text-shadow: 1px 1px 3px rgba(0,0,0,0.4);
    }

    .hero-author {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .author-avatar {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: linear-gradient(135deg, $highway-blue, #245279);
      color: $warm-yellow;
      font-family: $font-display;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .author-name {
      font-family: $font-display;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
    }

    .publish-date {
      font-family: $font-typewriter;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.6);
      margin-left: auto;
    }
  }

  .quick-actions {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    padding: 12px 18px;
    background: rgba(255, 250, 235, 0.6);
    border-bottom: 1px dashed rgba(139, 111, 71, 0.2);
  }

  .action-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 9px 8px;
    border: 1.5px solid rgba(139, 111, 71, 0.3);
    border-radius: 6px;
    background: #FBF5E6;
    font-family: $font-display;
    font-size: 12px;
    font-weight: 600;
    color: $deep-brown;
    cursor: pointer;
    transition: all 0.2s;

    .act-icon { font-size: 14px; }

    &:hover {
      background: #FFF;
      border-color: rgba(212, 160, 60, 0.5);
    }

    &.active {
      background: rgba(212, 160, 60, 0.12);
      border-color: $warm-yellow;
      color: #8B6914;
    }
  }

  .section {
    padding: 16px 18px;
    border-bottom: 1px solid rgba(139, 111, 71, 0.15);

    &:last-child {
      border-bottom: none;
    }
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

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

    .section-count,
    .section-hint {
      font-family: $font-typewriter;
      font-size: 10px;
      color: rgba(62, 44, 28, 0.5);
    }
  }

  .link-btn {
    border: none;
    background: none;
    color: $highway-blue;
    font-family: $font-display;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    padding: 2px 6px;

    &:hover { text-decoration: underline; }
  }

  .tags-area {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .custom-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px 4px 10px;
    background: rgba(212, 160, 60, 0.15);
    border: 1px solid rgba(212, 160, 60, 0.4);
    border-radius: 12px;
    font-family: $font-display;
    font-size: 12px;
    color: rgba(62, 44, 28, 0.85);

    .tag-remove {
      border: none;
      background: none;
      cursor: pointer;
      font-size: 15px;
      line-height: 1;
      color: rgba(62, 44, 28, 0.5);
      padding: 0;
      width: 15px;
      height: 15px;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover { color: $vintage-red; }
    }
  }

  .tag-input-inline {
    width: 80px;
    padding: 3px 8px;
    border: 1px solid $highway-blue;
    border-radius: 10px;
    background: #FFF;
    font-family: $font-body;
    font-size: 12px;
    color: $deep-brown;
    outline: none;
  }

  .empty-hint {
    font-family: $font-body;
    font-size: 12px;
    color: rgba(62, 44, 28, 0.45);
    font-style: italic;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }

  .stat-card {
    background: rgba(255, 250, 235, 0.85);
    border: 1.5px solid rgba(139, 111, 71, 0.2);
    border-radius: 8px;
    padding: 10px 6px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;

    .stat-icon { font-size: 18px; }
    .stat-value {
      font-family: $font-typewriter;
      font-size: 13px;
      font-weight: 700;
      color: $highway-blue;
      line-height: 1;
    }
    .stat-label {
      font-family: $font-display;
      font-size: 9px;
      color: rgba(62, 44, 28, 0.55);
      letter-spacing: 0.5px;
    }
  }

  .meta-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 0;
    border-top: 1px dashed rgba(139, 111, 71, 0.18);

    &:first-of-type { border-top: none; }
  }

  .meta-label {
    flex-shrink: 0;
    width: 60px;
    font-family: $font-display;
    font-size: 12px;
    font-weight: 600;
    color: rgba(62, 44, 28, 0.6);
    padding-top: 2px;
  }

  .meta-value {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .stars {
      font-size: 14px;
      color: $warm-yellow;
      letter-spacing: 1px;
      text-shadow: 0 1px 2px rgba(212, 160, 60, 0.3);
    }

    .diff-text {
      font-family: $font-body;
      font-size: 12px;
      color: rgba(62, 44, 28, 0.7);
      font-style: italic;
    }
  }

  .theme-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .theme-tag {
    font-family: $font-typewriter;
    font-size: 11px;
    padding: 3px 8px;
    background: rgba(44, 95, 143, 0.08);
    border-radius: 4px;
    color: $highway-blue;
  }

  .description-text {
    font-family: $font-body;
    font-size: 13px;
    color: rgba(62, 44, 28, 0.75);
    line-height: 1.8;
    margin: 0;
    padding: 4px 8px;
    background: rgba(255, 240, 180, 0.2);
    border-left: 3px solid $warm-yellow;
    border-radius: 0 4px 4px 0;
  }

  .marker-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .marker-item {
    display: grid;
    grid-template-columns: 28px 28px 1fr;
    grid-template-rows: auto auto;
    gap: 4px 8px;
    padding: 10px 12px;
    background: rgba(255, 250, 235, 0.7);
    border: 1.5px solid rgba(139, 111, 71, 0.18);
    border-radius: 8px;
    align-items: center;

    .marker-index {
      grid-row: 1 / span 2;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: linear-gradient(135deg, $highway-blue, #245279);
      color: $warm-yellow;
      font-family: $font-display;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .marker-icon {
      font-size: 18px;
    }

    .marker-info {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .marker-name {
        font-family: $font-display;
        font-size: 13px;
        font-weight: 600;
        color: $deep-brown;
      }
      .marker-type {
        font-family: $font-typewriter;
        font-size: 10px;
        color: rgba(62, 44, 28, 0.5);
      }
    }

    .marker-note {
      grid-column: 2 / span 2;
      font-family: $font-body;
      font-size: 11px;
      color: rgba(62, 44, 28, 0.6);
      line-height: 1.5;
      padding-top: 2px;
      border-top: 1px dashed rgba(139, 111, 71, 0.15);
    }
  }

  .similar-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .similar-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: rgba(255, 250, 235, 0.7);
    border: 1.5px solid rgba(139, 111, 71, 0.2);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: #FFF;
      border-color: rgba(212, 160, 60, 0.5);
      transform: translateX(2px);
    }

    .similar-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: linear-gradient(135deg, #E8DCC4, #C9B896);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }

    .similar-body {
      flex: 1;
      min-width: 0;

      .similar-name {
        font-family: $font-display;
        font-size: 13px;
        font-weight: 600;
        color: $deep-brown;
        margin: 0 0 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .similar-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        margin-bottom: 4px;

        .mini-tag {
          font-family: $font-typewriter;
          font-size: 9px;
          padding: 2px 5px;
          background: rgba(44, 95, 143, 0.08);
          border-radius: 3px;
          color: $highway-blue;
        }
      }

      .similar-stats {
        display: flex;
        gap: 10px;
        font-family: $font-typewriter;
        font-size: 10px;
        color: rgba(62, 44, 28, 0.55);
      }
    }

    .similar-arrow {
      font-size: 22px;
      color: rgba(62, 44, 28, 0.35);
      flex-shrink: 0;
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
</style>
