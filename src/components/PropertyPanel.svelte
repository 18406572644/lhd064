<script lang="ts">
  import { currentRoute, segments, selectedMarkerId, updateMarker, removeMarker, reorderMarkers, selectMarker } from '@/stores/route.store';
  import { vehicleConfig } from '@/stores/settings.store';
  import { showToast } from '@/stores/ui.store';
  import { formatDistance } from '@/utils/distance';
  import { formatDuration } from '@/utils/format';
  import type { MarkerData, RouteSegment, MarkerType } from '@/types';
  import { derived } from 'svelte/store';

  type TabType = 'marker' | 'segments';

  interface TabOption {
    id: TabType;
    label: string;
    icon: string;
  }

  const tabs: TabOption[] = [
    { id: 'marker', label: '标记详情', icon: '📝' },
    { id: 'segments', label: '路线分段', icon: '🛣️' }
  ];

  const markerTypeInfo: Record<MarkerType, { icon: string; label: string; color: string }> = {
    attraction: { icon: '🏛️', label: '景点', color: '#5A7A4A' },
    restaurant: { icon: '🍽️', label: '餐厅', color: '#D4A03C' },
    hotel: { icon: '🏨', label: '住宿', color: '#8B6F47' },
    gas: { icon: '⛽', label: '加油站', color: '#8B3A2E' }
  };

  let activeTab: TabType = 'marker';

  let editName = '';
  let editNote = '';
  let editArrivalTime = '';
  let editStayDuration = '';
  let photoUrlInput = '';

  let dragIndex: number | null = null;
  let dragOverIndex: number | null = null;

  let previewPhotoUrl: string | null = null;

  const selectedMarker = derived(
    [currentRoute, selectedMarkerId],
    ([$route, $id]) => $route.markers.find(m => m.id === $id) || null
  );

  let lastSelectedMarkerId: string | null = null;

  $: {
    const m = $selectedMarker;
    if (m) {
      if (m.id !== lastSelectedMarkerId) {
        lastSelectedMarkerId = m.id;
        editName = m.name;
        editNote = m.note;
        editArrivalTime = m.arrivalTime || '';
        editStayDuration = m.stayDuration != null ? String(m.stayDuration) : '';
      }
    } else {
      lastSelectedMarkerId = null;
    }
  }

  $: markerCount = $currentRoute.markers.length;
  $: canShowSegments = markerCount >= 2;
  $: totalDist = $segments.reduce((sum, s) => sum + s.distance, 0);
  $: totalDurationHrs = (() => {
    const avgSpeed = $vehicleConfig.averageSpeed;
    const restStopInterval = $vehicleConfig.restStopInterval;
    const restStopDuration = $vehicleConfig.restStopDuration;
    const drivingHrs = totalDist / avgSpeed;
    const restStops = Math.max(0, Math.floor(totalDist / restStopInterval));
    const restHrs = (restStops * restStopDuration) / 60;
    const stayMinutes = $currentRoute.markers.reduce((sum, m) => sum + (m.stayDuration || 0), 0);
    const stayHrs = stayMinutes / 60;
    return drivingHrs + restHrs + stayHrs;
  })();

  function commitName() {
    const id = $selectedMarkerId;
    if (!id) return;
    updateMarker(id, { name: editName.trim() });
  }

  function commitNote() {
    const id = $selectedMarkerId;
    if (!id) return;
    updateMarker(id, { note: editNote });
  }

  function commitArrivalTime() {
    const id = $selectedMarkerId;
    if (!id) return;
    updateMarker(id, { arrivalTime: editArrivalTime || undefined });
  }

  function commitStayDuration() {
    const id = $selectedMarkerId;
    if (!id) return;
    const val = parseInt(editStayDuration, 10);
    updateMarker(id, { stayDuration: isNaN(val) ? undefined : val });
  }

  function blurOnEnter(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      const el = e.currentTarget as HTMLElement;
      el.blur();
    }
  }

  function copyCoords(lat: number, lng: number) {
    const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    navigator.clipboard?.writeText(text).then(() => {
      showToast('坐标已复制到剪贴板', 'success');
    }).catch(() => {
      showToast('复制失败', 'error');
    });
  }

  function handleDeleteMarker() {
    const id = $selectedMarkerId;
    if (!id) return;
    const m = $currentRoute.markers.find(x => x.id === id);
    const name = m?.name || '此标记';
    if (confirm(`确定要删除「${name}」吗？`)) {
      removeMarker(id);
      showToast('标记已删除', 'info');
    }
  }

  function addPhotoByUrl() {
    const id = $selectedMarkerId;
    const url = photoUrlInput.trim();
    if (!id || !url) return;
    const marker = $currentRoute.markers.find(m => m.id === id);
    if (!marker) return;
    const urls = [...(marker.photoUrls || []), url];
    updateMarker(id, { photoUrls: urls });
    photoUrlInput = '';
    showToast('照片已添加', 'success');
  }

  function handlePhotoFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const id = $selectedMarkerId;
    if (!input.files || !input.files.length || !id) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const marker = $currentRoute.markers.find(m => m.id === id);
      if (!marker) return;
      const urls = [...(marker.photoUrls || []), dataUrl];
      updateMarker(id, { photoUrls: urls });
      showToast('照片已添加', 'success');
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  function removePhoto(idx: number) {
    const id = $selectedMarkerId;
    if (!id) return;
    const marker = $currentRoute.markers.find(m => m.id === id);
    if (!marker) return;
    const urls = [...marker.photoUrls];
    urls.splice(idx, 1);
    updateMarker(id, { photoUrls: urls });
  }

  function openPreview(url: string) {
    previewPhotoUrl = url;
  }

  function closePreview() {
    previewPhotoUrl = null;
  }

  function onDragStart(index: number) {
    dragIndex = index;
  }

  function onDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    dragOverIndex = index;
  }

  function onDragLeave() {
    dragOverIndex = null;
  }

  function onDrop(targetIndex: number) {
    if (dragIndex == null || dragIndex === targetIndex) {
      dragIndex = null;
      dragOverIndex = null;
      return;
    }
    const ids = $currentRoute.markers.map(m => m.id);
    const [movedId] = ids.splice(dragIndex, 1);
    ids.splice(targetIndex, 0, movedId);
    reorderMarkers(ids);
    showToast('分段顺序已更新', 'success');
    dragIndex = null;
    dragOverIndex = null;
  }

  function getBearingArrow(bearing?: number): string {
    if (bearing == null) return '➡️';
    const arrows = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
    const idx = Math.round(((bearing % 360) / 45)) % 8;
    return arrows[idx];
  }

  function formatSegmentDuration(distance: number): string {
    const hrs = distance / $vehicleConfig.averageSpeed;
    return formatDuration(hrs);
  }
</script>

<style lang="scss">
  @use '../styles/mixins' as *;

  .property-panel {
    width: 340px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #FAF3E0;
    position: relative;
    overflow-y: auto;
    overflow-x: hidden;
    box-shadow: -4px 0 20px rgba(62, 44, 28, 0.15);
    border-left: 3px double rgba(139, 111, 71, 0.5);

    &::before {
      content: '';
      position: absolute;
      top: 0; right: 0; bottom: 0; left: 0;
      background-image:
        repeating-linear-gradient(
          transparent,
          transparent 27px,
          rgba(139, 111, 71, 0.12) 27px,
          rgba(139, 111, 71, 0.12) 28px
        );
      pointer-events: none;
      z-index: 0;
    }

    > * {
      position: relative;
      z-index: 1;
    }
  }

  .tabs {
    display: flex;
    border-bottom: 2px solid $warm-yellow;
    background: rgba(255, 250, 235, 0.9);
    padding: 0 8px;

    .tab {
      flex: 1;
      padding: 12px 8px 10px;
      border: none;
      background: transparent;
      font-family: $font-display;
      font-size: 13px;
      font-weight: 600;
      color: rgba(62, 44, 28, 0.5);
      cursor: pointer;
      position: relative;
      transition: all 0.2s;
      letter-spacing: 1px;

      .tab-icon {
        margin-right: 4px;
      }

      &:hover {
        color: $deep-brown;
      }

      &.active {
        color: $highway-blue;
        &::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 10%;
          right: 10%;
          height: 3px;
          background: $highway-blue;
          border-radius: 2px 2px 0 0;
        }
      }
    }
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 18px;

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

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;

    .empty-icon {
      font-size: 56px;
      opacity: 0.3;
      margin-bottom: 16px;
    }
    .empty-text {
      font-family: $font-body;
      font-size: 14px;
      color: rgba(62, 44, 28, 0.55);
      font-style: italic;
      line-height: 1.6;
    }
  }

  .marker-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px;
    background: rgba(255, 250, 235, 0.8);
    border: 1.5px solid rgba(139, 111, 71, 0.25);
    border-radius: 6px;
    margin-bottom: 18px;

    .type-icon-box {
      width: 56px;
      height: 56px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      border-radius: 10px;
      border: 2px solid rgba(62, 44, 28, 0.15);
      flex-shrink: 0;
    }

    .type-meta {
      flex: 1;
      min-width: 0;

      .type-tag {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 10px;
        font-family: $font-typewriter;
        font-size: 11px;
        font-weight: 600;
        color: #FFF;
        letter-spacing: 1px;
        margin-bottom: 6px;
      }

      .coords-line {
        font-family: $font-typewriter;
        font-size: 11px;
        color: rgba(62, 44, 28, 0.55);
        cursor: pointer;
        padding: 3px 6px;
        border-radius: 3px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: background 0.15s;

        &:hover {
          background: rgba(212, 160, 60, 0.15);
        }

        .copy-icon {
          font-size: 10px;
          opacity: 0.6;
        }
      }
    }
  }

  .field-group {
    margin-bottom: 16px;

    .field-label {
      display: block;
      font-family: $font-display;
      font-size: 12px;
      font-weight: 600;
      color: $highway-blue;
      letter-spacing: 1px;
      margin-bottom: 6px;
      text-transform: uppercase;

      .label-hint {
        font-family: $font-body;
        font-size: 10px;
        font-weight: 400;
        color: rgba(62, 44, 28, 0.4);
        text-transform: none;
        letter-spacing: 0;
        margin-left: 6px;
        font-style: italic;
      }
    }
  }

  .lined-input {
    width: 100%;
    background: transparent;
    border: none;
    border-bottom: 1.5px solid rgba(139, 111, 71, 0.4);
    padding: 8px 4px 6px;
    font-family: $font-body;
    font-size: 15px;
    color: $deep-brown;
    outline: none;
    transition: border-color 0.2s;

    &:focus {
      border-bottom-color: $highway-blue;
    }
  }

  .lined-textarea {
    width: 100%;
    min-height: 80px;
    background: rgba(255, 250, 235, 0.5);
    background-image: repeating-linear-gradient(
      transparent,
      transparent 23px,
      rgba(139, 111, 71, 0.18) 23px,
      rgba(139, 111, 71, 0.18) 24px
    );
    background-attachment: local;
    line-height: 24px;
    border: 1px solid rgba(139, 111, 71, 0.2);
    border-radius: 4px;
    padding: 6px 10px;
    font-family: 'Ma Shan Zheng', 'Kaiti', 'STKaiti', 'KaiTi', serif;
    font-size: 16px;
    color: $deep-brown;
    outline: none;
    resize: vertical;
    transition: border-color 0.2s;

    &:focus {
      border-color: $highway-blue;
    }
  }

  .num-input {
    width: 100%;
    background: rgba(255, 250, 235, 0.7);
    border: 1px solid rgba(139, 111, 71, 0.25);
    border-radius: 4px;
    padding: 8px 10px;
    font-family: $font-body;
    font-size: 14px;
    color: $deep-brown;
    outline: none;
    transition: border-color 0.2s;

    &:focus {
      border-color: $highway-blue;
    }
  }

  .time-input {
    width: 100%;
    background: rgba(255, 250, 235, 0.7);
    border: 1px solid rgba(139, 111, 71, 0.25);
    border-radius: 4px;
    padding: 8px 10px;
    font-family: $font-typewriter;
    font-size: 14px;
    color: $deep-brown;
    outline: none;
    transition: border-color 0.2s;

    &:focus {
      border-color: $highway-blue;
    }
  }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .danger-btn {
    width: 100%;
    margin-top: 8px;
    padding: 12px;
    background: linear-gradient(180deg, #A84538 0%, $vintage-red 100%);
    color: #FFF;
    border: 2px solid #6B2A20;
    border-radius: 6px;
    font-family: $font-display;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 2px;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 3px 0 #6B2A20, 0 4px 10px rgba(139, 58, 46, 0.25);

    &:hover {
      filter: brightness(1.08);
      transform: translateY(-1px);
      box-shadow: 0 4px 0 #6B2A20, 0 5px 14px rgba(139, 58, 46, 0.3);
    }
    &:active {
      transform: translateY(2px);
      box-shadow: 0 1px 0 #6B2A20, 0 2px 6px rgba(139, 58, 46, 0.2);
    }
  }

  .photos-section {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px dashed rgba(139, 111, 71, 0.35);
  }

  .photo-input-row {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;

    .url-input {
      flex: 1;
      min-width: 0;
      padding: 7px 9px;
      font-size: 12px;
      font-family: $font-typewriter;
      border: 1px solid rgba(139, 111, 71, 0.25);
      border-radius: 4px;
      background: rgba(255, 250, 235, 0.7);
      color: $deep-brown;
      outline: none;
      &:focus { border-color: $highway-blue; }
    }

    .mini-btn {
      padding: 6px 10px;
      border: 1px solid rgba(139, 111, 71, 0.3);
      border-radius: 4px;
      background: rgba(255, 250, 235, 0.9);
      font-family: $font-display;
      font-size: 12px;
      font-weight: 600;
      color: $deep-brown;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;

      &:hover {
        background: #FFF;
        border-color: $highway-blue;
        color: $highway-blue;
      }
    }
  }

  .file-label {
    display: block;
    padding: 10px;
    border: 1.5px dashed rgba(139, 111, 71, 0.4);
    border-radius: 6px;
    text-align: center;
    font-family: $font-body;
    font-size: 12px;
    color: rgba(62, 44, 28, 0.6);
    cursor: pointer;
    margin-bottom: 12px;
    transition: all 0.2s;

    &:hover {
      background: rgba(212, 160, 60, 0.08);
      border-color: $warm-yellow;
      color: $deep-brown;
    }

    input { display: none; }
  }

  .photo-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .photo-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
    border: 1.5px solid rgba(139, 111, 71, 0.3);
    cursor: zoom-in;
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.03);

      .remove-photo {
        opacity: 1;
      }
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .remove-photo {
      position: absolute;
      top: 3px;
      right: 3px;
      width: 22px;
      height: 22px;
      border: none;
      border-radius: 50%;
      background: rgba(139, 58, 46, 0.9);
      color: #FFF;
      font-size: 12px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }
  }

  .preview-overlay {
    position: fixed;
    inset: 0;
    background: rgba(26, 20, 16, 0.85);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
    padding: 24px;

    img {
      max-width: 90vw;
      max-height: 90vh;
      object-fit: contain;
      border: 4px solid #FBF5E6;
      border-radius: 4px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
    }
  }

  .segments-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .segment-card {
    background: rgba(255, 250, 235, 0.85);
    border: 1.5px solid rgba(139, 111, 71, 0.25);
    border-radius: 6px;
    padding: 10px 12px 10px 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all 0.2s;

    &.dragging {
      opacity: 0.5;
    }
    &.drag-over {
      border-color: $highway-blue;
      background: rgba(44, 95, 143, 0.06);
      transform: translateY(-2px);
    }

    .drag-handle {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 6px 4px;
      cursor: grab;
      color: rgba(62, 44, 28, 0.35);
      font-size: 8px;
      line-height: 1;
      user-select: none;

      &:active { cursor: grabbing; }
    }

    .seg-main {
      flex: 1;
      min-width: 0;
    }

    .seg-index {
      display: inline-block;
      padding: 1px 7px;
      background: $warm-yellow;
      color: #3E2C1C;
      font-family: $font-typewriter;
      font-size: 11px;
      font-weight: 700;
      border-radius: 10px;
      margin-bottom: 4px;
    }

    .seg-from-to {
      font-family: $font-body;
      font-size: 13px;
      color: $deep-brown;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      .arrow {
        color: $warm-yellow;
        font-size: 14px;
        flex-shrink: 0;
      }
    }

    .seg-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6px;

      .seg-dist-time {
        font-family: $font-typewriter;
        font-size: 11px;
        color: rgba(62, 44, 28, 0.55);
        display: flex;
        gap: 10px;
      }

      .bearing-icon {
        font-size: 18px;
        opacity: 0.7;
      }
    }
  }

  .segments-total {
    margin-top: 12px;
    padding: 14px 16px;
    background: linear-gradient(135deg, rgba(44, 95, 143, 0.08), rgba(212, 160, 60, 0.08));
    border: 2px solid rgba(44, 95, 143, 0.3);
    border-radius: 6px;
    font-weight: 700;

    .total-row {
      display: flex;
      justify-content: space-between;
      font-family: $font-display;
      font-size: 15px;
      color: $deep-brown;
      letter-spacing: 0.5px;

      &.main {
        font-size: 16px;
        color: $highway-blue;
        margin-bottom: 4px;
      }

      .total-label {
        display: flex;
        align-items: center;
        gap: 6px;
      }
    }
  }
</style>

<aside class="property-panel">
  <div class="tabs">
    {#each tabs as tab}
      <button
        class="tab {activeTab === tab.id ? 'active' : ''}"
        on:click={() => activeTab = tab.id}
      >
        <span class="tab-icon">{tab.icon}</span>
        {tab.label}
      </button>
    {/each}
  </div>

  <div class="panel-body">
    {#if activeTab === 'marker'}
      {#if $selectedMarker}
        {@const typeInfo = markerTypeInfo[$selectedMarker.type]}
        <div class="marker-header">
          <div class="type-icon-box" style="background: {typeInfo.color}18; border-color: {typeInfo.color}40;">
            {typeInfo.icon}
          </div>
          <div class="type-meta">
            <span class="type-tag" style="background: {typeInfo.color};">
              {typeInfo.label}
            </span>
            <div
              class="coords-line"
              on:click={() => copyCoords($selectedMarker.lat, $selectedMarker.lng)}
              title="点击复制坐标"
            >
              📍 {$selectedMarker.lat.toFixed(4)}, {$selectedMarker.lng.toFixed(4)}
              <span class="copy-icon">📋</span>
            </div>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">
            名称
            <span class="label-hint">（按回车保存）</span>
          </label>
          <input
            class="lined-input"
            type="text"
            bind:value={editName}
            on:blur={commitName}
            on:keydown={blurOnEnter}
            placeholder="给这个点起个名字..."
          />
        </div>

        <div class="two-col">
          <div class="field-group">
            <label class="field-label">到达时间</label>
            <input
              class="time-input"
              type="time"
              bind:value={editArrivalTime}
              on:change={commitArrivalTime}
              on:blur={commitArrivalTime}
            />
          </div>
          <div class="field-group">
            <label class="field-label">
              停留时长
              <span class="label-hint">分钟</span>
            </label>
            <input
              class="num-input"
              type="number"
              min="0"
              step="5"
              bind:value={editStayDuration}
              on:change={commitStayDuration}
              on:blur={commitStayDuration}
              placeholder="--"
            />
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">备注</label>
          <textarea
            class="lined-textarea"
            bind:value={editNote}
            on:blur={commitNote}
            placeholder="记录一些想法、注意事项..."
          ></textarea>
        </div>

        <div class="photos-section">
          <div class="field-group">
            <label class="field-label">照片</label>
            <div class="photo-input-row">
              <input
                class="url-input"
                type="text"
                placeholder="粘贴图片URL..."
                bind:value={photoUrlInput}
                on:keydown={(e) => { if (e.key === 'Enter') addPhotoByUrl(); }}
              />
              <button class="mini-btn" on:click={addPhotoByUrl}>添加</button>
            </div>
            <label class="file-label">
              📷 从本地上传图片
              <input type="file" accept="image/*" on:change={handlePhotoFile} />
            </label>
          </div>
          {#if $selectedMarker.photoUrls && $selectedMarker.photoUrls.length > 0}
            <div class="photo-grid">
              {#each $selectedMarker.photoUrls as url, idx}
                <div class="photo-item" on:click={() => openPreview(url)}>
                  <img src={url} alt="照片 {idx + 1}" />
                  <button
                    class="remove-photo"
                    on:click|stopPropagation={() => removePhoto(idx)}
                    title="删除照片"
                  >✕</button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <button class="danger-btn" on:click={handleDeleteMarker}>
          🗑️ 删除此标记
        </button>
      {:else}
        <div class="empty-state">
          <div class="empty-icon">📜</div>
          <div class="empty-text">
            点击地图上的标记点<br />
            查看和编辑详情
          </div>
        </div>
      {/if}
    {:else}
      {#if canShowSegments}
        <div class="segments-list">
          {#each $segments as seg, idx}
            {@const fromName = seg.from?.name || '起点'}
            {@const toName = seg.to?.name || '终点'}
            <div
              class="segment-card {dragIndex === idx ? 'dragging' : ''} {dragOverIndex === idx && dragIndex !== idx ? 'drag-over' : ''}"
              draggable="true"
              on:dragstart={() => onDragStart(idx)}
              on:dragover={(e) => onDragOver(e, idx)}
              on:dragleave={onDragLeave}
              on:drop={() => onDrop(idx)}
            >
              <div class="drag-handle" title="拖拽排序">
                <span>•••</span>
                <span>•••</span>
              </div>
              <div class="seg-main">
                <span class="seg-index">#{idx + 1}</span>
                <div class="seg-from-to">
                  <span style="overflow:hidden;text-overflow:ellipsis;">{fromName}</span>
                  <span class="arrow">→</span>
                  <span style="overflow:hidden;text-overflow:ellipsis;">{toName}</span>
                </div>
                <div class="seg-meta">
                  <div class="seg-dist-time">
                    <span>📏 {formatDistance(seg.distance)}</span>
                    <span>⏱️ {formatSegmentDuration(seg.distance)}</span>
                  </div>
                  <span class="bearing-icon" title="方向">
                    {getBearingArrow(seg.bearing)}
                  </span>
                </div>
              </div>
            </div>
          {/each}
        </div>

        <div class="segments-total">
          <div class="total-row main">
            <span class="total-label">📊 路线总计</span>
            <span>{markerCount} 个标记</span>
          </div>
          <div class="total-row">
            <span class="total-label">🛣️ 总里程</span>
            <span>{formatDistance(totalDist)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">⏱️ 预估总时间</span>
            <span>{formatDuration(totalDurationHrs)}</span>
          </div>
        </div>
      {:else}
        <div class="empty-state">
          <div class="empty-icon">🛤️</div>
          <div class="empty-text">
            至少添加 2 个标记点<br />
            以生成路线分段
          </div>
        </div>
      {/if}
    {/if}
  </div>

  {#if previewPhotoUrl}
    <div class="preview-overlay" on:click={closePreview}>
      <img src={previewPhotoUrl} alt="照片预览" on:click|stopPropagation />
    </div>
  {/if}
</aside>
