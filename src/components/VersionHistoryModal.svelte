<script lang="ts">
  import { onMount } from 'svelte';
  import { showVersionHistory, showToast } from '@/stores/ui.store';
  import { currentRoute } from '@/stores/route.store';
  import { StorageService } from '@/services/storage.service';
  import { resetLastSavedHash } from '@/services/autosave.service';
  import type { DraftRouteSnapshot, RouteData } from '@/types';
  import { formatDistance } from '@/utils/distance';
  import { padZero } from '@/utils/format';
  import { get } from 'svelte/store';

  let snapshots: DraftRouteSnapshot[] = [];
  let loading = true;
  let selectedSnapshot: DraftRouteSnapshot | null = null;
  let confirmingRestore = false;

  function formatDateTime(ts: number): string {
    const d = new Date(ts);
    const month = padZero(d.getMonth() + 1);
    const day = padZero(d.getDate());
    const hours = padZero(d.getHours());
    const mins = padZero(d.getMinutes());
    const secs = padZero(d.getSeconds());
    return `${month}-${day} ${hours}:${mins}:${secs}`;
  }

  function getMarkerDiff(snapshot: DraftRouteSnapshot): { count: number; sign: '+' | '-' | '='; text: string } {
    const current = get(currentRoute);
    const diff = snapshot.markers.length - current.markers.length;
    if (diff === 0) return { count: 0, sign: '=', text: '相同' };
    return {
      count: Math.abs(diff),
      sign: diff > 0 ? '+' : '-',
      text: diff > 0 ? `+${diff}` : `${diff}`
    };
  }

  function getDistanceDiff(snapshot: DraftRouteSnapshot): { diff: number; sign: '+' | '-' | '='; text: string } {
    const current = get(currentRoute);
    let currentDist = 0;
    if (current.markers.length >= 2) {
      currentDist = (current.totalDistance && current.totalDistance > 0)
        ? current.totalDistance
        : calculateSimpleDistance(current.markers);
    }
    const diff = snapshot.totalDistance - currentDist;
    if (Math.abs(diff) < 0.01) return { diff: 0, sign: '=', text: '相同' };
    return {
      diff,
      sign: diff > 0 ? '+' : '-',
      text: formatSignedDistance(diff)
    };
  }

  function formatSignedDistance(km: number): string {
    const abs = Math.abs(km);
    const sign = km > 0 ? '+' : '-';
    if (abs >= 1) {
      return `${sign}${abs.toFixed(1)} km`;
    }
    return `${sign}${Math.round(abs * 1000)} m`;
  }

  function calculateSimpleDistance(markers: { lat: number; lng: number }[]): number {
    const EARTH_RADIUS_KM = 6371;
    const toRad = (deg: number) => deg * Math.PI / 180;
    let dist = 0;
    for (let i = 0; i < markers.length - 1; i++) {
      const dLat = toRad(markers[i + 1].lat - markers[i].lat);
      const dLon = toRad(markers[i + 1].lng - markers[i].lng);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(markers[i].lat)) * Math.cos(toRad(markers[i + 1].lat)) *
        Math.sin(dLon / 2) ** 2;
      dist += EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    return dist;
  }

  function close() {
    showVersionHistory.set(false);
  }

  function onMaskClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function selectSnapshot(snap: DraftRouteSnapshot) {
    selectedSnapshot = selectedSnapshot?.id === snap.id ? null : snap;
    confirmingRestore = false;
  }

  function askRestore() {
    if (!selectedSnapshot) return;
    confirmingRestore = true;
  }

  function cancelRestore() {
    confirmingRestore = false;
  }

  function doRestore() {
    if (!selectedSnapshot) return;
    const snap = selectedSnapshot;
    currentRoute.update(route => ({
      ...route,
      name: snap.routeName,
      markers: JSON.parse(JSON.stringify(snap.markers)),
      updatedAt: Date.now()
    } as RouteData));
    resetLastSavedHash();
    showToast(`已恢复至 ${formatDateTime(snap.savedAt)} 的版本`, 'success');
    close();
  }

  async function loadSnapshots() {
    loading = true;
    try {
      const route = get(currentRoute);
      snapshots = await StorageService.getDraftSnapshots(route.id);
    } catch (e) {
      console.error('Failed to load snapshots:', e);
      showToast('加载历史版本失败', 'error');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadSnapshots();
  });
</script>

<style lang="scss">
  @use '../styles/mixins' as *;

  .modal-mask {
    position: fixed;
    inset: 0;
    background: rgba(26, 20, 16, 0.55);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.25s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-panel {
    width: 560px;
    max-width: 92vw;
    max-height: 80vh;
    background:
      linear-gradient(180deg, rgba(255, 252, 242, 1) 0%, rgba(245, 239, 224, 1) 100%);
    border: 3px solid $deep-brown;
    border-radius: 6px;
    box-shadow:
      0 8px 32px rgba(26, 20, 16, 0.35),
      inset 0 0 60px rgba(212, 160, 60, 0.06);
    display: flex;
    flex-direction: column;
    animation: modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes modalIn {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 2px solid rgba(62, 44, 28, 0.2);
    flex-shrink: 0;

    .title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: $font-display;
      font-weight: 700;
      font-size: 18px;
      color: $deep-brown;

      .title-icon {
        font-size: 22px;
      }
    }

    .close-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      font-size: 20px;
      color: rgba(62, 44, 28, 0.5);
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;

      &:hover {
        background: rgba(62, 44, 28, 0.08);
        color: $deep-brown;
      }
    }
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .empty-state {
    padding: 48px 24px;
    text-align: center;
    color: rgba(62, 44, 28, 0.5);
    font-family: $font-body;

    .empty-icon {
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.5;
    }
    .empty-text {
      font-size: 14px;
      font-style: italic;
      line-height: 1.6;
    }
  }

  .snapshot-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(255, 250, 235, 0.8);
    border: 1.5px solid rgba(62, 44, 28, 0.15);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 250, 235, 1);
      border-color: rgba(62, 44, 28, 0.3);
      transform: translateX(2px);
    }

    &.selected {
      border-color: $highway-blue;
      background: linear-gradient(135deg, rgba(44, 95, 143, 0.06), rgba(44, 95, 143, 0.03));
      box-shadow: 0 2px 8px rgba(44, 95, 143, 0.12);
    }
  }

  .snap-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .snap-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .snap-time {
    font-family: $font-typewriter;
    font-size: 14px;
    font-weight: 700;
    color: $deep-brown;
  }

  .snap-name {
    font-family: $font-body;
    font-size: 12px;
    color: rgba(62, 44, 28, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .snap-stats {
    display: flex;
    gap: 10px;
    flex-shrink: 0;
  }

  .stat-chip {
    font-family: $font-typewriter;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 3px;

    &.neutral {
      background: rgba(62, 44, 28, 0.08);
      color: rgba(62, 44, 28, 0.65);
    }
  }

  .diff-panel {
    background: linear-gradient(135deg, rgba(212, 160, 60, 0.08), rgba(212, 160, 60, 0.03));
    border: 1.5px solid rgba(212, 160, 60, 0.4);
    border-radius: 6px;
    padding: 14px 16px;
    margin-bottom: 8px;
  }

  .diff-title {
    font-family: $font-display;
    font-weight: 700;
    font-size: 13px;
    color: $deep-brown;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .diff-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .diff-cell {
    display: flex;
    flex-direction: column;
    gap: 3px;

    .diff-label {
      font-family: $font-body;
      font-size: 11px;
      color: rgba(62, 44, 28, 0.55);
    }
    .diff-value {
      font-family: $font-typewriter;
      font-size: 15px;
      font-weight: 700;

      &.pos { color: $moss-green; }
      &.neg { color: $vintage-red; }
      &.eq { color: rgba(62, 44, 28, 0.6); }
    }
  }

  .confirm-box {
    background: rgba(139, 58, 46, 0.06);
    border: 1.5px solid rgba(139, 58, 46, 0.3);
    border-radius: 6px;
    padding: 12px 14px;
    margin-top: 10px;

    .confirm-text {
      font-family: $font-body;
      font-size: 13px;
      color: rgba(62, 44, 28, 0.8);
      line-height: 1.6;
      margin-bottom: 10px;
    }
  }

  .modal-footer {
    padding: 14px 20px;
    border-top: 2px solid rgba(62, 44, 28, 0.15);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-shrink: 0;
  }

  .footer-left {
    font-family: $font-typewriter;
    font-size: 11px;
    color: rgba(62, 44, 28, 0.5);
  }

  .footer-actions {
    display: flex;
    gap: 8px;
  }

  .btn {
    padding: 8px 18px;
    border-radius: 4px;
    font-family: $font-display;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    border: none;

    &.btn-secondary {
      background: rgba(62, 44, 28, 0.08);
      color: rgba(62, 44, 28, 0.75);
      &:hover {
        background: rgba(62, 44, 28, 0.15);
      }
    }

    &.btn-danger {
      background: $vintage-red;
      color: #FFF;
      &:hover {
        background: #6B2C22;
      }
      &:disabled {
        background: rgba(139, 58, 46, 0.3);
        cursor: not-allowed;
      }
    }
  }

  .loading-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    gap: 10px;
    font-family: $font-body;
    font-size: 14px;
    color: rgba(62, 44, 28, 0.6);
    font-style: italic;

    .spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid rgba(44, 95, 143, 0.2);
      border-top-color: $highway-blue;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

<div class="modal-mask" on:click={onMaskClick}>
  <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="version-history-title">
    <div class="modal-header">
      <div class="title">
        <span class="title-icon">🕘</span>
        <span id="version-history-title">历史版本</span>
      </div>
      <button class="close-btn" on:click={close} aria-label="关闭">✕</button>
    </div>

    <div class="modal-body">
      {#if loading}
        <div class="loading-bar">
          <div class="spinner"></div>
          正在加载历史版本...
        </div>
      {:else if snapshots.length === 0}
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-text">
            暂无自动保存的历史版本<br />
            系统每隔 30 秒会自动保存当前路线快照
          </div>
        </div>
      {:else}
        {#if selectedSnapshot}
          {@const markerDiff = getMarkerDiff(selectedSnapshot)}
          {@const distDiff = getDistanceDiff(selectedSnapshot)}
          <div class="diff-panel">
            <div class="diff-title">
              <span>📊</span>
              <span>与当前版本对比</span>
            </div>
            <div class="diff-grid">
              <div class="diff-cell">
                <span class="diff-label">标记点数量</span>
                <span class="diff-value {markerDiff.sign === '=' ? 'eq' : markerDiff.sign === '+' ? 'pos' : 'neg'}">
                  {markerDiff.text} 个
                </span>
              </div>
              <div class="diff-cell">
                <span class="diff-label">里程变化</span>
                <span class="diff-value {distDiff.sign === '=' ? 'eq' : distDiff.sign === '+' ? 'pos' : 'neg'}">
                  {distDiff.text}
                </span>
              </div>
            </div>

            {#if confirmingRestore}
              <div class="confirm-box">
                <div class="confirm-text">
                  ⚠️ 恢复后当前未保存的修改将丢失，确定要恢复到此版本吗？
                </div>
                <div class="footer-actions" style="justify-content: flex-end;">
                  <button class="btn btn-secondary" on:click={cancelRestore}>取消</button>
                  <button class="btn btn-danger" on:click={doRestore}>确认恢复</button>
                </div>
              </div>
            {/if}
          </div>
        {/if}

        {#each snapshots as snap (snap.id)}
          <div
            class="snapshot-item {selectedSnapshot?.id === snap.id ? 'selected' : ''}"
            on:click={() => selectSnapshot(snap)}
          >
            <span class="snap-icon">💾</span>
            <div class="snap-main">
              <span class="snap-time">{formatDateTime(snap.savedAt)}</span>
              <span class="snap-name">{snap.routeName}</span>
            </div>
            <div class="snap-stats">
              <span class="stat-chip neutral">{snap.markers.length} 个点</span>
              <span class="stat-chip neutral">{formatDistance(snap.totalDistance)}</span>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <div class="modal-footer">
      <span class="footer-left">保留最近 {snapshots.length > 0 ? '10' : ''} 个快照</span>
      <div class="footer-actions">
        <button class="btn btn-secondary" on:click={close}>关闭</button>
        {#if selectedSnapshot && !confirmingRestore}
          <button class="btn btn-danger" on:click={askRestore}>恢复此版本</button>
        {/if}
      </div>
    </div>
  </div>
</div>
