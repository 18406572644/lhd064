<script lang="ts">
  import { activeTool, showToast } from '@/stores/ui.store';
  import { currentRoute, clearRoute, reorderMarkers, addMarker } from '@/stores/route.store';
  import { appSettings } from '@/stores/settings.store';
  import { MockAPI } from '@/services/mock-api';
  import { RouteOptimizer } from '@/services/optimizer';
  import type { MarkerType, RouteData } from '@/types';
  import { onMount } from 'svelte';

  type ToolType = MarkerType | 'select';

  interface ToolOption {
    id: ToolType;
    icon: string;
    nameCn: string;
    nameEn: string;
    color: string;
    bgColor: string;
  }

  const tools: ToolOption[] = [
    { id: 'select', icon: '✋', nameCn: '选择/移动', nameEn: 'Select', color: '#3E2C1C', bgColor: '#FBF5E6' },
    { id: 'attraction', icon: '🏛️', nameCn: '景点', nameEn: 'Attraction', color: '#5A7A4A', bgColor: '#E8EFE0' },
    { id: 'restaurant', icon: '🍽️', nameCn: '餐厅', nameEn: 'Restaurant', color: '#D4A03C', bgColor: '#FFF5E0' },
    { id: 'hotel', icon: '🏨', nameCn: '住宿', nameEn: 'Hotel', color: '#8B6F47', bgColor: '#F5EFE0' },
    { id: 'gas', icon: '⛽', nameCn: '加油站', nameEn: 'Gas Station', color: '#8B3A2E', bgColor: '#FDE8E0' }
  ];

  const tileStyles = [
    { id: 'vintage', label: '复古标准' },
    { id: 'satellite', label: '卫星' },
    { id: 'standard', label: '地形' }
  ] as const;

  let presetRoutes: RouteData[] = [];
  let selectedPresetId: string = '';
  let loadingPresets = false;

  $: markerCount = $currentRoute.markers.length;
  $: canOptimize = markerCount >= 3;
  $: canUndo = markerCount > 0;
  $: canClear = markerCount > 0;

  onMount(async () => {
    loadingPresets = true;
    try {
      presetRoutes = await MockAPI.getPresetRoutes();
      if (presetRoutes.length > 0) {
        selectedPresetId = presetRoutes[0].id;
      }
    } catch (e) {
      console.error(e);
    } finally {
      loadingPresets = false;
    }
  });

  function selectTool(toolId: ToolType) {
    activeTool.set(toolId);
  }

  function handleOptimize() {
    if (!canOptimize) return;
    const markers = $currentRoute.markers;
    const optimized = RouteOptimizer.optimizeRoute(markers, true);
    const newOrder = optimized.map(m => m.id);
    reorderMarkers(newOrder);
    showToast('路线已智能排序', 'success');
  }

  function handleClear() {
    if (!canClear) return;
    if (confirm('确定要清空所有标记点吗？此操作无法撤销。')) {
      clearRoute();
      showToast('路线已清空', 'info');
    }
  }

  function handleUndo() {
    if (!canUndo) return;
    const markers = $currentRoute.markers;
    const lastId = markers[markers.length - 1]?.id;
    if (lastId) {
      import('@/stores/route.store').then(({ removeMarker }) => {
        removeMarker(lastId);
        showToast('已撤销上一个标记', 'info');
      });
    }
  }

  function updateTileStyle(style: 'vintage' | 'satellite' | 'standard') {
    appSettings.update(s => ({ ...s, tileStyle: style }));
  }

  function toggleCompass() {
    appSettings.update(s => ({ ...s, showCompass: !s.showCompass }));
  }

  async function loadPresetRoute() {
    if (!selectedPresetId) {
      showToast('请先选择一条预设路线', 'error');
      return;
    }
    const preset = presetRoutes.find(r => r.id === selectedPresetId);
    if (!preset) return;

    if ($currentRoute.markers.length > 0) {
      const ok = confirm('当前路线有标记点，是否替换为预设路线？');
      if (!ok) return;
    }

    const cloned: RouteData = JSON.parse(JSON.stringify(preset));
    currentRoute.set({
      ...cloned,
      id: (await import('@/utils/id')).generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    showToast(`已载入路线：${preset.name}`, 'success');
  }
</script>

<style lang="scss">
  @use '../styles/mixins' as *;

  .tool-panel {
    width: 300px;
    height: 100%;
    @include scroll-panel;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;

    > * {
      position: relative;
      z-index: 1;
    }
  }

  .panel-header {
    text-align: center;
    padding: 8px 0 16px;
    border-bottom: 2px solid $warm-yellow;
    position: relative;

    &::after {
      content: '❦';
      position: absolute;
      bottom: -11px;
      left: 50%;
      transform: translateX(-50%);
      background: $sand;
      padding: 0 10px;
      color: $warm-yellow;
      font-size: 14px;
    }

    .scroll-ornament {
      font-size: 22px;
      color: $warm-yellow;
      letter-spacing: 8px;
      margin-bottom: 4px;
      opacity: 0.7;
    }

    h2 {
      font-family: $font-display;
      font-size: 22px;
      font-weight: 700;
      color: $deep-brown;
      letter-spacing: 4px;
      margin: 0;
      background: linear-gradient(180deg, $warm-yellow 0%, #A07828 50%, $warm-yellow 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 1px 1px 0 rgba(62, 44, 28, 0.05);
    }
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 4px 8px;
    margin: 0 4px;

    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(212, 160, 60, 0.4);
      border-radius: 3px;
    }
  }

  .section {
    margin-bottom: 18px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .section-title {
    font-family: $font-display;
    font-size: 13px;
    font-weight: 600;
    color: $highway-blue;
    letter-spacing: 2px;
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1px dashed rgba(212, 160, 60, 0.5);
    display: flex;
    align-items: center;
    gap: 8px;

    &::before,
    &::after {
      content: '❧';
      color: $warm-yellow;
      font-size: 11px;
    }
  }

  .tool-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .tool-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 2px solid rgba(62, 44, 28, 0.25);
    border-radius: 6px;
    background: #FBF5E6;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    text-align: left;
    font-family: $font-body;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(62, 44, 28, 0.15);
      border-color: rgba(62, 44, 28, 0.4);
    }

    &.active {
      border-width: 3px;
      background: darken(#FBF5E6, 3%);
      box-shadow:
        inset 0 1px 3px rgba(62, 44, 28, 0.1),
        0 2px 8px rgba(62, 44, 28, 0.12);

      .check-mark {
        opacity: 1;
      }
    }

    .tool-icon {
      font-size: 32px;
      line-height: 1;
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #FFF;
      border-radius: 8px;
      border: 1px solid rgba(62, 44, 28, 0.15);
    }

    .tool-names {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .tool-cn {
      font-size: 15px;
      font-weight: 700;
      color: inherit;
      line-height: 1.2;
    }

    .tool-en {
      font-size: 10px;
      color: rgba(62, 44, 28, 0.5);
      letter-spacing: 1px;
      text-transform: uppercase;
      font-family: $font-typewriter;
    }

    .check-mark {
      position: absolute;
      top: 6px;
      right: 8px;
      font-size: 14px;
      color: $moss-green;
      opacity: 0;
      transition: opacity 0.2s;
    }
  }

  .tool-btn[data-type="attraction"] {
    border-color: rgba(90, 122, 74, 0.4);
    &.active { border-color: $moss-green; }
    .tool-cn { color: $moss-green; }
    .tool-icon { background: #E8EFE0; border-color: rgba(90, 122, 74, 0.3); }
  }
  .tool-btn[data-type="restaurant"] {
    border-color: rgba(212, 160, 60, 0.4);
    &.active { border-color: $warm-yellow; }
    .tool-cn { color: #8B6914; }
    .tool-icon { background: #FFF5E0; border-color: rgba(212, 160, 60, 0.3); }
  }
  .tool-btn[data-type="hotel"] {
    border-color: rgba(139, 111, 71, 0.4);
    &.active { border-color: $deep-brown; }
    .tool-cn { color: #5C472F; }
    .tool-icon { background: #F5EFE0; border-color: rgba(139, 111, 71, 0.3); }
  }
  .tool-btn[data-type="gas"] {
    border-color: rgba(139, 58, 46, 0.4);
    &.active { border-color: $vintage-red; }
    .tool-cn { color: $vintage-red; }
    .tool-icon { background: #FDE8E0; border-color: rgba(139, 58, 46, 0.3); }
  }

  .action-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 12px;
    border: 2px solid rgba(62, 44, 28, 0.3);
    border-radius: 6px;
    background: #FBF5E6;
    font-family: $font-body;
    font-size: 14px;
    font-weight: 600;
    color: $deep-brown;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(62, 44, 28, 0.15);
      background: #FFF;
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .btn-icon {
      font-size: 18px;
    }
  }

  .action-btn.primary {
    background: linear-gradient(180deg, #3A7CB8 0%, $highway-blue 100%);
    color: #FFF;
    border-color: #1E4A78;
    &:hover:not(:disabled) {
      background: linear-gradient(180deg, #4A8CC8 0%, #2C6FA0 100%);
    }
  }

  .action-btn.danger {
    color: $vintage-red;
    border-color: rgba(139, 58, 46, 0.4);
    &:hover:not(:disabled) {
      background: #FDE8E0;
      border-color: $vintage-red;
    }
  }

  .tile-options {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
  }

  .tile-option {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: 1.5px solid rgba(62, 44, 28, 0.2);
    border-radius: 4px;
    background: #FBF5E6;
    cursor: pointer;
    font-family: $font-body;
    font-size: 13px;
    color: $deep-brown;
    transition: all 0.15s ease;

    &:hover {
      background: #FFF;
      border-color: rgba(62, 44, 28, 0.35);
    }

    &.active {
      border-color: $highway-blue;
      background: rgba(44, 95, 143, 0.06);
      .radio-dot {
        border-color: $highway-blue;
        &::after { transform: translate(-50%, -50%) scale(1); }
      }
    }

    .radio-dot {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(62, 44, 28, 0.4);
      border-radius: 50%;
      position: relative;
      flex-shrink: 0;

      &::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0);
        width: 8px;
        height: 8px;
        background: $highway-blue;
        border-radius: 50%;
        transition: transform 0.15s ease;
      }
    }
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 4px;
    font-family: $font-body;
    font-size: 13px;
    color: $deep-brown;
  }

  .switch {
    position: relative;
    width: 44px;
    height: 24px;
    background: rgba(62, 44, 28, 0.2);
    border-radius: 12px;
    cursor: pointer;
    transition: background 0.2s;
    border: 1.5px solid rgba(62, 44, 28, 0.3);

    &::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      background: #FFF;
      border-radius: 50%;
      transition: transform 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    &.on {
      background: $moss-green;
      border-color: #3D5A32;
      &::after { transform: translateX(20px); }
    }
  }

  .preset-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }

  .preset-select {
    flex: 1;
    padding: 8px 10px;
    border: 1.5px solid rgba(62, 44, 28, 0.3);
    border-radius: 4px;
    background: #FFF;
    font-family: $font-body;
    font-size: 13px;
    color: $deep-brown;
    cursor: pointer;
    outline: none;

    &:focus {
      border-color: $highway-blue;
    }
  }

  .load-btn {
    padding: 8px 14px;
    border: 1.5px solid $warm-yellow;
    border-radius: 4px;
    background: linear-gradient(180deg, $warm-yellow 0%, #B88820 100%);
    color: #FFF;
    font-family: $font-display;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;

    &:hover:not(:disabled) {
      filter: brightness(1.08);
      transform: translateY(-1px);
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .panel-footer {
    padding: 12px 8px 10px;
    border-top: 2px solid $warm-yellow;
    text-align: center;
    position: relative;

    &::before {
      content: '❦';
      position: absolute;
      top: -11px;
      left: 50%;
      transform: translateX(-50%);
      background: $sand;
      padding: 0 10px;
      color: $warm-yellow;
      font-size: 14px;
    }

    .ornament {
      font-size: 18px;
      color: $warm-yellow;
      letter-spacing: 6px;
      opacity: 0.7;
      margin-bottom: 6px;
    }

    .hint-text {
      font-family: $font-body;
      font-size: 11px;
      color: rgba(62, 44, 28, 0.6);
      font-style: italic;
      line-height: 1.5;
    }
  }
</style>

<aside class="tool-panel">
  <span class="scroll-corner tl"></span>
  <span class="scroll-corner tr"></span>
  <span class="scroll-corner bl"></span>
  <span class="scroll-corner br"></span>

  <header class="panel-header">
    <div class="scroll-ornament">❧ ❦ ❧</div>
    <h2>旅行工具</h2>
  </header>

  <div class="panel-body">
    <section class="section">
      <div class="section-title">选择标记类型</div>
      <div class="tool-list">
        {#each tools as tool}
          <button
            class="tool-btn {$activeTool === tool.id ? 'active' : ''}"
            data-type={tool.id}
            on:click={() => selectTool(tool.id)}
            title={`${tool.nameCn} (${tool.nameEn})`}
          >
            <span class="tool-icon">{tool.icon}</span>
            <div class="tool-names">
              <span class="tool-cn">{tool.nameCn}</span>
              <span class="tool-en">{tool.nameEn}</span>
            </div>
            <span class="check-mark">✓</span>
          </button>
        {/each}
      </div>
    </section>

    <section class="section">
      <div class="section-title">路线操作</div>
      <div class="action-group">
        <button
          class="action-btn primary"
          disabled={!canOptimize}
          on:click={handleOptimize}
          title={canOptimize ? '使用最近邻+2-opt算法优化标记顺序' : '至少需要3个标记点'}
        >
          <span class="btn-icon">🔀</span>
          <span>智能排序路线</span>
        </button>
        <button
          class="action-btn danger"
          disabled={!canClear}
          on:click={handleClear}
        >
          <span class="btn-icon">🗑️</span>
          <span>清空路线</span>
        </button>
        <button
          class="action-btn"
          disabled={!canUndo}
          on:click={handleUndo}
        >
          <span class="btn-icon">↩️</span>
          <span>撤销上一个标记</span>
        </button>
      </div>
    </section>

    <section class="section">
      <div class="section-title">地图图层</div>
      <div class="tile-options">
        {#each tileStyles as style}
          <label
            class="tile-option {$appSettings.tileStyle === style.id ? 'active' : ''}"
            on:click={() => updateTileStyle(style.id)}
          >
            <span class="radio-dot"></span>
            <span>{style.label}</span>
          </label>
        {/each}
      </div>
      <div class="toggle-row">
        <span>显示指北针</span>
        <div
          class="switch {$appSettings.showCompass ? 'on' : ''}"
          on:click={toggleCompass}
        ></div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">快速添加示例路线</div>
      <div class="preset-row">
        <select
          class="preset-select"
          bind:value={selectedPresetId}
          disabled={loadingPresets}
        >
          {#if loadingPresets}
            <option value="">加载中...</option>
          {:else}
            {#each presetRoutes as route}
              <option value={route.id}>{route.name}</option>
            {/each}
          {/if}
        </select>
        <button
          class="load-btn"
          disabled={loadingPresets || !selectedPresetId}
          on:click={loadPresetRoute}
        >
          载入
        </button>
      </div>
    </section>
  </div>

  <footer class="panel-footer">
    <div class="ornament">❧ ❦ ❧</div>
    <p class="hint-text">
      {#if $activeTool === 'select'}
        拖拽调整标记位置，点击标记查看详情
      {:else}
        点击地图添加选定类型的标记点
      {/if}
    </p>
  </footer>
</aside>
