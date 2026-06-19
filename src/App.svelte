<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import TopNav from './components/TopNav.svelte';
  import ToolPanel from './components/ToolPanel.svelte';
  import MapView from './components/MapView.svelte';
  import MapLibreView from './components/MapLibreView.svelte';
  import PropertyPanel from './components/PropertyPanel.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import RouteLibrary from './components/RouteLibrary.svelte';
  import PreviewModal from './components/PreviewModal.svelte';
  import ExportModal from './components/ExportModal.svelte';
  import SettingsModal from './components/SettingsModal.svelte';
  import RoutePlaza from './components/RoutePlaza.svelte';
  import PublishToPlaza from './components/PublishToPlaza.svelte';
  import VersionHistoryModal from './components/VersionHistoryModal.svelte';
  import RouteDetail from './components/RouteDetail.svelte';

  import {
    showRouteLibrary,
    showPreview,
    showExport,
    showSettings,
    showPlaza,
    showPublishPlaza,
    showVersionHistory,
    showRouteDetail,
    toast,
    activeTool
  } from './stores/ui.store';

  import { startAutosave, stopAutosave, resetLastSavedHash } from './services/autosave.service';
  import { currentRoute } from './stores/route.store';
  import { appSettings } from './stores/settings.store';

  import type { MarkerType } from './types';

  let prevRouteId = '';

  $: {
    if ($currentRoute && $currentRoute.id !== prevRouteId) {
      prevRouteId = $currentRoute.id;
      resetLastSavedHash();
    }
  }

  onMount(() => {
    startAutosave();
  });

  onDestroy(() => {
    stopAutosave();
  });

  $: cursorClass =
    $activeTool !== 'select' && $activeTool !== 'route' ? 'cursor-crosshair' : '';

  function dismissToast() {
    toast.set(null);
  }
</script>

<div class="app-root {cursorClass}">
  <!-- ========== 顶栏 ========== -->
  <TopNav />

  <!-- ========== 主体工作区 ========== -->
  <div class="workspace">
    <!-- 左侧工具面板 -->
    <aside class="left-panel">
      <ToolPanel />
    </aside>

    <!-- 中央地图区 -->
    <main class="map-area">
      {#if $appSettings.mapMode === '2d'}
        <MapView />
      {:else}
        <MapLibreView />
      {/if}

      <!-- 工具提示（选择标记模式时） -->
      {#if $activeTool !== 'select' && $activeTool !== 'route'}
        <div class="map-tip">
          <span class="tip-icon">📍</span>
          <span class="tip-text">
            点击地图任意位置添加
            {#if $activeTool === 'attraction'}🏛️ 景点{/if}
            {#if $activeTool === 'restaurant'}🍽️ 餐厅{/if}
            {#if $activeTool === 'hotel'}🏨 住宿{/if}
            {#if $activeTool === 'gas'}⛽ 加油站{/if}
            标记
          </span>
          <button class="tip-cancel" on:click={() => activeTool.set('select')}>
            ✕ 取消
          </button>
        </div>
      {/if}

      <!-- 地图四角装饰 -->
      <div class="corner-decoration corner-tl">┏</div>
      <div class="corner-decoration corner-tr">┓</div>
      <div class="corner-decoration corner-bl">┗</div>
      <div class="corner-decoration corner-br">┛</div>
    </main>

    <!-- 右侧属性面板 -->
    <aside class="right-panel">
      <PropertyPanel />
    </aside>
  </div>

  <!-- ========== 底部状态栏 ========== -->
  <StatusBar />

  <!-- ========== 弹窗层 ========== -->
  {#if $showRouteLibrary}
    <RouteLibrary />
  {/if}

  {#if $showPreview}
    <PreviewModal />
  {/if}

  {#if $showExport}
    <ExportModal />
  {/if}

  {#if $showSettings}
    <SettingsModal />
  {/if}

  {#if $showVersionHistory}
    <VersionHistoryModal />
  {/if}

  <RoutePlaza />
  <PublishToPlaza />
  <RouteDetail />

  <!-- ========== Toast 提示 ========== -->
  {#if $toast}
    <div class="toast toast-{$toast.type}" on:click={dismissToast}>
      <span class="toast-icon">
        {#if $toast.type === 'success'}✅{/if}
        {#if $toast.type === 'error'}❌{/if}
        {#if $toast.type === 'info'}ℹ️{/if}
      </span>
      <span class="toast-message">{$toast.msg}</span>
    </div>
  {/if}
</div>

<style lang="scss">
  @use './styles/mixins' as *;

  .app-root {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    @include paper-texture;
    background-color: $sand;
    font-family: $font-body;
    color: $deep-brown;
  }

  .workspace {
    display: grid;
    grid-template-columns: 300px 1fr 340px;
    overflow: hidden;
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
  }

  .left-panel {
    z-index: 10;
    box-shadow: 4px 0 12px rgba(62, 44, 28, 0.15);
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .right-panel {
    z-index: 10;
    box-shadow: -4px 0 12px rgba(62, 44, 28, 0.15);
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .map-area {
    position: relative;
    overflow: hidden;
    height: 100%;
    width: 100%;
    min-height: 0;
    min-width: 0;
    @include paper-texture;

    &.cursor-crosshair :global(#vintage-map) {
      cursor: crosshair !important;
    }
  }

  .map-tip {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 500;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px;
    background: $highway-blue;
    color: $warm-yellow;
    border: 3px solid $cream;
    border-radius: 4px;
    box-shadow: 0 6px 20px rgba(44, 95, 143, 0.4);
    font-family: $font-typewriter;
    font-size: 14px;
    letter-spacing: 0.5px;
    animation: fadeInDown 0.35s ease;

    .tip-icon {
      font-size: 18px;
    }

    .tip-cancel {
      background: rgba(255, 255, 255, 0.15);
      color: $warm-yellow;
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 3px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      transition: all 0.2s;

      &:hover {
        background: rgba(255, 255, 255, 0.28);
      }
    }
  }

  @keyframes fadeInDown {
    from {
      opacity: 0;
      transform: translate(-50%, -12px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  .corner-decoration {
    position: absolute;
    z-index: 400;
    font-size: 42px;
    color: rgba(62, 44, 28, 0.25);
    font-family: serif;
    pointer-events: none;
    text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.5);

    &.corner-tl { top: 8px; left: 10px; }
    &.corner-tr { top: 8px; right: 10px; }
    &.corner-bl { bottom: 8px; left: 10px; }
    &.corner-br { bottom: 8px; right: 10px; }
  }

  .toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 24px;
    background: $cream;
    border: 2px solid $deep-brown;
    border-radius: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    font-family: $font-typewriter;
    font-size: 14px;
    color: $deep-brown;
    cursor: pointer;
    animation: toastIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

    &.toast-success {
      border-color: $moss-green;
      background: linear-gradient(135deg, $cream, #e8f0e3);
    }
    &.toast-error {
      border-color: $vintage-red;
      background: linear-gradient(135deg, $cream, #f4e3e0);
    }
    &.toast-info {
      border-color: $highway-blue;
      background: linear-gradient(135deg, $cream, #e3ecf4);
    }

    .toast-icon {
      font-size: 18px;
    }
  }

  @keyframes toastIn {
    from {
      opacity: 0;
      transform: translate(-50%, 24px) scale(0.92);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0) scale(1);
    }
  }

  @media (max-width: 1200px) {
    .left-panel, .right-panel {
      position: absolute;
      top: 0;
      bottom: 0;
      transition: transform 0.35s ease;
    }
    .left-panel { left: 0; }
    .right-panel { right: 0; }
  }

  @media (max-width: 768px) {
    .app-root {
      grid-template-rows: auto 1fr auto;
    }
    .map-tip {
      font-size: 12px;
      padding: 8px 14px;
      gap: 8px;
      top: 10px;
    }
  }
</style>
