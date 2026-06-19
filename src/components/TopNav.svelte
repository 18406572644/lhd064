<script lang="ts">
  import RoadSign from './RoadSign.svelte';
  import type { RouteData } from '@/types';
  import {
    currentRoute,
    clearRoute
  } from '@/stores/route.store';
  import {
    showRouteLibrary,
    showSettings,
    showPreview,
    showExport,
    showPlaza,
    showPublishPlaza,
    showToast
  } from '@/stores/ui.store';
  import { StorageService } from '@/services/storage.service';
  import { MockAPI } from '@/services/mock-api';
  import { formatDate } from '@/utils/format';

  let routeName = '';
  let routeNameInput: HTMLInputElement | null = null;
  let localRoute: RouteData | null = null;
  let markerCount = 0;

  $: if ($currentRoute) {
    routeName = $currentRoute.name;
    localRoute = $currentRoute;
    markerCount = $currentRoute.markers.length;
  }

  function handleNewRoute() {
    const confirmed = window.confirm('确定要新建路线吗？当前未保存的修改将丢失。');
    if (confirmed) {
      clearRoute();
      showToast('已创建新路线', 'info');
    }
  }

  async function handleSaveRoute() {
    if (!localRoute) return;
    try {
      const finalRoute: RouteData = {
        ...localRoute,
        name: routeName,
        updatedAt: Date.now()
      };

      const existingRoutes = StorageService.loadRoutes();
      const idx = existingRoutes.findIndex(r => r.id === finalRoute.id);
      if (idx >= 0) {
        existingRoutes[idx] = finalRoute;
      } else {
        existingRoutes.push(finalRoute);
      }
      StorageService.saveRoutes(existingRoutes);

      const result = await MockAPI.saveRoute(finalRoute);
      if (result.success) {
        currentRoute.update(r => ({ ...r, name: routeName, updatedAt: Date.now() }));
        showToast('路线保存成功！', 'success');
      } else {
        showToast('保存失败，请重试', 'error');
      }
    } catch (e) {
      showToast('保存出错，请重试', 'error');
      console.error('Save error:', e);
    }
  }

  function handleRouteLibrary() {
    showRouteLibrary.update(v => !v);
  }

  function handleSettings() {
    showSettings.update(v => !v);
  }

  function handlePreview() {
    if (markerCount < 2) return;
    showPreview.set(true);
  }

  function handleExport() {
    if (markerCount < 2) return;
    showExport.update(v => !v);
  }

  function handlePlaza() {
    showPlaza.set(true);
  }

  function handlePublishToPlaza() {
    if (markerCount < 2) {
      showToast('至少需要2个标记点才能发布到广场', 'info');
      return;
    }
    showPublishPlaza.set(true);
  }

  function handleRouteNameBlur() {
    if (routeName.trim() === '') {
      routeName = '新路线';
      if (routeNameInput) routeNameInput.value = routeName;
    }
    if (localRoute && localRoute.name !== routeName) {
      currentRoute.update(r => ({ ...r, name: routeName.trim(), updatedAt: Date.now() }));
    }
  }

  function handleRouteNameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  }

  $: createdAtStr = localRoute ? formatDate(localRoute.createdAt) : '';
</script>

<nav class="top-nav">
  <div class="nav-logo">
    <span class="logo-compass" aria-hidden="true">🧭</span>
    <span class="logo-text">VINTAGE ROADTRIP</span>
  </div>

  <div class="nav-signs">
    <RoadSign
      text="新建路线"
      icon="📋"
      color="#2C5F8F"
      textColor="#F5EFE0"
      size="sm"
      tilt={-1.5}
      on:click={handleNewRoute}
    />
    <RoadSign
      text="保存路线"
      icon="💾"
      color="#5A7A4A"
      textColor="#F5EFE0"
      size="sm"
      tilt={1}
      on:click={handleSaveRoute}
    />
    <RoadSign
      text="路线库"
      icon="🗂️"
      color="#3E2C1C"
      textColor="#D4A03C"
      size="sm"
      tilt={-0.8}
      on:click={handleRouteLibrary}
    />
    <RoadSign
      text="车辆设置"
      icon="🚗"
      color="#8B3A2E"
      textColor="#F5EFE0"
      size="sm"
      tilt={1.2}
      on:click={handleSettings}
    />
    <RoadSign
      text="预览行程单"
      icon="📜"
      color="#2C5F8F"
      textColor="#D4A03C"
      size="sm"
      tilt={-1}
      disabled={markerCount < 2}
      on:click={handlePreview}
    />
    <RoadSign
      text="导出"
      icon="📤"
      color="#D4A03C"
      textColor="#3E2C1C"
      size="sm"
      tilt={0.8}
      disabled={markerCount < 2}
      on:click={handleExport}
    />
    <RoadSign
      text="路线广场"
      icon="🏘️"
      color="#6B3FA0"
      textColor="#F5EFE0"
      size="sm"
      tilt={-1.2}
      on:click={handlePlaza}
    />
    <RoadSign
      text="发布到广场"
      icon="🚀"
      color="#C4782A"
      textColor="#F5EFE0"
      size="sm"
      tilt={0.6}
      disabled={markerCount < 2}
      on:click={handlePublishToPlaza}
    />
  </div>

  <div class="nav-route-info">
    <div class="route-name-wrapper">
      <label class="route-name-label" for="route-name-input">路线名称</label>
      <input
        id="route-name-input"
        bind:this={routeNameInput}
        type="text"
        bind:value={routeName}
        class="route-name-input"
        on:blur={handleRouteNameBlur}
        on:keydown={handleRouteNameKeydown}
        placeholder="输入路线名称..."
      />
    </div>
    <div class="route-meta">
      <span class="meta-icon">📅</span>
      <span class="meta-text">创建于 {createdAtStr}</span>
    </div>
  </div>
</nav>

<style lang="scss">
  @use '../styles/mixins' as *;

  .top-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    background:
      linear-gradient(180deg, rgba(245, 239, 224, 1) 0%, rgba(232, 220, 196, 1) 100%);
    border-bottom: 3px solid $deep-brown;
    box-shadow:
      0 2px 0 rgba(62, 44, 28, 0.15),
      0 4px 12px rgba(26, 20, 16, 0.15),
      inset 0 -2px 0 rgba(212, 160, 60, 0.2);
    position: relative;
    z-index: 50;
    gap: 12px;
    flex-shrink: 0;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 3px;
      background: repeating-linear-gradient(
        90deg,
        $deep-brown 0px,
        $deep-brown 12px,
        transparent 12px,
        transparent 20px,
        $warm-yellow 20px,
        $warm-yellow 32px,
        transparent 32px,
        transparent 40px
      );
      opacity: 0.4;
    }
  }

  .nav-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;

    .logo-compass {
      font-size: 32px;
      display: inline-block;
      filter: drop-shadow(1px 1px 0 rgba(62, 44, 28, 0.2));
      animation: compass-spin 8s linear infinite;
      animation-play-state: paused;

      &:hover {
        animation-play-state: running;
      }
    }

    .logo-text {
      font-family: $font-display;
      font-weight: 700;
      font-size: 20px;
      letter-spacing: 3px;
      color: $deep-brown;
      text-shadow:
        1px 1px 0 rgba(212, 160, 60, 0.3),
        2px 2px 4px rgba(62, 44, 28, 0.1);
      white-space: nowrap;
      background: linear-gradient(180deg, $deep-brown 0%, darken($deep-brown, 10%) 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }

  .nav-signs {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    justify-content: center;
    flex-wrap: wrap;
    padding: 2px 0;
    max-height: 72px;
    overflow: hidden;
  }

  .nav-route-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 220px;
    max-width: 280px;
    flex-shrink: 0;
    padding: 8px 14px;
    background:
      linear-gradient(135deg, rgba(245, 239, 224, 0.6) 0%, rgba(232, 220, 196, 0.7) 100%);
    border: 1.5px solid rgba(62, 44, 28, 0.25);
    border-radius: 2px;
    position: relative;
    box-shadow:
      1px 1px 0 rgba(62, 44, 28, 0.1),
      inset 0 0 30px rgba(212, 160, 60, 0.08);

    &::before,
    &::after {
      content: '';
      position: absolute;
      width: 12px;
      height: 12px;
      border: 1.5px solid rgba(62, 44, 28, 0.25);
    }

    &::before {
      top: 3px;
      left: 3px;
      border-right: none;
      border-bottom: none;
    }

    &::after {
      bottom: 3px;
      right: 3px;
      border-left: none;
      border-top: none;
    }
  }

  .route-name-wrapper {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .route-name-label {
    font-family: $font-typewriter;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: rgba(62, 44, 28, 0.5);
  }

  .route-name-input {
    background: rgba(255, 253, 245, 0.7);
    border: none;
    border-bottom: 1px dashed rgba(62, 44, 28, 0.3);
    padding: 4px 2px;
    font-family: $font-display;
    font-weight: 600;
    font-size: 14px;
    color: $deep-brown;
    outline: none;
    transition: all 0.2s ease;
    width: 100%;

    &:focus {
      border-bottom-color: $highway-blue;
      border-bottom-style: solid;
      background: rgba(255, 253, 245, 0.95);
    }

    &::placeholder {
      color: rgba(62, 44, 28, 0.3);
      font-weight: 400;
    }
  }

  .route-meta {
    display: flex;
    align-items: center;
    gap: 4px;

    .meta-icon {
      font-size: 11px;
      opacity: 0.7;
    }

    .meta-text {
      font-family: $font-typewriter;
      font-size: 10px;
      color: rgba(62, 44, 28, 0.55);
      white-space: nowrap;
    }
  }

  @keyframes compass-spin {
    0% { transform: rotate(0deg); }
    25% { transform: rotate(-8deg); }
    50% { transform: rotate(6deg); }
    75% { transform: rotate(-4deg); }
    100% { transform: rotate(0deg); }
  }
</style>
