<script lang="ts">
  import { showPreview, showToast } from '@/stores/ui.store';
  import { currentRoute, segments } from '@/stores/route.store';
  import { vehicleConfig } from '@/stores/settings.store';
  import { calculateTripEstimates } from '@/services/trip-estimator';
  import { ExportService } from '@/services/export.service';
  import { formatDistance } from '@/utils/distance';
  import { formatDuration, formatCurrency, formatDate } from '@/utils/format';
  import type { MarkerType } from '@/types';

  const markerTypeInfo: Record<MarkerType, { icon: string; label: string; color: string }> = {
    attraction: { icon: '🏛️', label: '景点', color: '#5A7A4A' },
    restaurant: { icon: '🍽️', label: '餐厅', color: '#D4A03C' },
    hotel: { icon: '🏨', label: '住宿', color: '#8B6F47' },
    gas: { icon: '⛽', label: '加油站', color: '#8B3A2E' }
  };

  const safetyTips = [
    '长途驾驶前请检查轮胎气压、机油、水箱和灯光',
    '建议每行驶 2 小时休息 15 分钟，避免疲劳驾驶',
    '山区路段注意弯道路况，提前鸣笛减速',
    '请随身携带驾驶证、行驶证和保险单据',
    '加油站间距较大的路段，建议保持半箱以上油量'
  ];

  $: estimates = calculateTripEstimates($currentRoute.markers, $vehicleConfig);
  $: startName = $currentRoute.markers[0]?.name || '起点';
  $: endName = $currentRoute.markers[$currentRoute.markers.length - 1]?.name || '终点';
  $: todayStamp = formatDate(Date.now());

  function close() {
    showPreview.set(false);
  }

  function onMaskClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function handlePrint() {
    ExportService.printItinerary($currentRoute, estimates.segments, estimates);
    showToast('正在打开打印窗口...', 'info');
  }

  function handleDownloadGPX() {
    ExportService.exportGPX($currentRoute).then(() => {
      showToast('GPX 文件已下载', 'success');
    }).catch(() => {
      showToast('下载失败', 'error');
    });
  }

  function truncateNote(note: string, max = 30): string {
    if (!note) return '';
    return note.length > max ? note.slice(0, max) + '...' : note;
  }
</script>

<style lang="scss">
  @use '../styles/mixins' as *;

  .mask {
    position: fixed;
    inset: 0;
    background: rgba(62, 44, 28, 0.55);
    z-index: 1500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: maskIn 0.25s ease;
    backdrop-filter: blur(2px);

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E");
      pointer-events: none;
    }
  }

  @keyframes maskIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal {
    width: 720px;
    max-width: 100%;
    max-height: 90vh;
    background: #FBF5E6;
    border-radius: 4px;
    box-shadow: 0 24px 64px rgba(26, 20, 16, 0.5);
    display: flex;
    flex-direction: column;
    position: relative;
    animation: modalIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    overflow: hidden;
  }

  @keyframes modalIn {
    from { opacity: 0; transform: translateY(30px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .tear-line {
    position: relative;
    padding: 12px 24px 14px;
    background: linear-gradient(180deg, #F5EFE0, #FBF5E6);
    border-bottom: 2px dashed rgba(139, 111, 71, 0.4);

    &::after {
      content: '';
      position: absolute;
      left: 0; right: 0; bottom: -1px;
      height: 2px;
      background-image: radial-gradient(circle, transparent 4px, #FBF5E6 4px);
      background-size: 14px 2px;
      background-position: 0 50%;
    }

    .tear-icon {
      position: absolute;
      top: 50%;
      right: 18px;
      transform: translateY(-50%);
      font-size: 22px;
      color: rgba(139, 111, 71, 0.5);
    }
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 28px 36px 24px;
    position: relative;

    &::-webkit-scrollbar {
      width: 8px;
    }
    &::-webkit-scrollbar-track {
      background: rgba(139, 111, 71, 0.05);
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(212, 160, 60, 0.4);
      border-radius: 4px;
    }
  }

  .header-section {
    text-align: center;
    position: relative;
    margin-bottom: 24px;
  }

  .postmark {
    position: absolute;
    top: -8px;
    left: 0;
    width: 96px;
    height: 96px;
    border: 3px double $vintage-red;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transform: rotate(-15deg);
    opacity: 0.75;
    background: rgba(255, 255, 255, 0.4);
    color: $vintage-red;
    font-family: $font-typewriter;
    pointer-events: none;

    .pm-label {
      font-size: 9px;
      letter-spacing: 2px;
      text-transform: uppercase;
      opacity: 0.7;
    }
    .pm-date {
      font-size: 12px;
      font-weight: 700;
      line-height: 1.1;
      margin: 2px 0;
    }
    .pm-city {
      font-size: 8px;
      letter-spacing: 2px;
      opacity: 0.6;
    }
  }

  .route-title {
    font-family: $font-display;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 6px;
    margin: 0 0 8px;
    background: linear-gradient(180deg, $warm-yellow 0%, #A07828 45%, $warm-yellow 55%, #B88820 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0.5px 0.5px 0 rgba(62, 44, 28, 0.08);
  }

  .route-subtitle {
    font-family: $font-body;
    font-size: 20px;
    color: $deep-brown;
    font-weight: 600;
    margin: 0;
    letter-spacing: 2px;
  }

  .stats-card {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: $warm-yellow;
    border: 2px solid $warm-yellow;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 28px;

    .stat-item {
      background: #FBF5E6;
      padding: 20px 16px;
      text-align: center;
      position: relative;

      &::after {
        content: '';
        position: absolute;
        right: 0;
        top: 20%;
        bottom: 20%;
        width: 1px;
        background: rgba(212, 160, 60, 0.4);
      }
      &:last-child::after { display: none; }

      .stat-value {
        font-family: $font-typewriter;
        font-size: 26px;
        font-weight: 700;
        color: $highway-blue;
        line-height: 1;
        margin-bottom: 6px;
      }
      .stat-unit {
        font-family: $font-typewriter;
        font-size: 12px;
        color: rgba(62, 44, 28, 0.5);
        margin-left: 2px;
        font-weight: 400;
      }
      .stat-label {
        font-family: $font-display;
        font-size: 11px;
        color: rgba(62, 44, 28, 0.55);
        letter-spacing: 2px;
        text-transform: uppercase;
      }
    }
  }

  .route-flow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-bottom: 28px;
    padding: 14px 20px;
    background: linear-gradient(90deg, rgba(44, 95, 143, 0.06), rgba(212, 160, 60, 0.08), rgba(139, 58, 46, 0.06));
    border-radius: 8px;
    border: 1px solid rgba(212, 160, 60, 0.25);

    .flow-point {
      font-family: $font-display;
      font-size: 16px;
      font-weight: 700;
      color: $deep-brown;
      padding: 4px 14px;
      background: rgba(255, 250, 235, 0.8);
      border: 1.5px solid rgba(139, 111, 71, 0.3);
      border-radius: 4px;
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .flow-arrow {
      font-size: 28px;
      color: $warm-yellow;
      flex-shrink: 0;
    }
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin: 22px 0 18px;

    .sh-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(212, 160, 60, 0.6), transparent);
    }

    .sh-text {
      font-family: $font-display;
      font-size: 14px;
      font-weight: 700;
      color: $highway-blue;
      letter-spacing: 4px;
      text-transform: uppercase;
      white-space: nowrap;
    }
  }

  .timeline {
    position: relative;
    padding-left: 38px;

    &::before {
      content: '';
      position: absolute;
      left: 14px;
      top: 12px;
      bottom: 12px;
      width: 2px;
      background: repeating-linear-gradient(
        to bottom,
        $warm-yellow,
        $warm-yellow 5px,
        transparent 5px,
        transparent 10px
      );
    }
  }

  .tl-item {
    position: relative;
    padding: 0 0 22px;

    &:last-child { padding-bottom: 0; }

    .tl-dot {
      position: absolute;
      left: -38px;
      top: 0;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      border: 2.5px solid #FBF5E6;
      box-shadow: 0 0 0 1.5px currentColor, 0 2px 8px rgba(0,0,0,0.15);
      background: #FBF5E6;
      z-index: 2;
    }

    .tl-seg-info {
      position: absolute;
      left: 2px;
      top: -18px;
      font-family: $font-typewriter;
      font-size: 10px;
      color: #FFF;
      background: $highway-blue;
      padding: 2px 8px;
      border-radius: 10px;
      display: flex;
      gap: 8px;
      z-index: 1;

      .si-dist { color: #FFE68A; }
    }

    .tl-content {
      background: rgba(255, 250, 235, 0.85);
      border: 1.5px solid rgba(139, 111, 71, 0.25);
      border-radius: 6px;
      padding: 10px 14px;
      position: relative;

      &::before {
        content: '';
        position: absolute;
        left: -6px;
        top: 13px;
        width: 10px;
        height: 10px;
        background: rgba(255, 250, 235, 0.85);
        border-left: 1.5px solid rgba(139, 111, 71, 0.25);
        border-bottom: 1.5px solid rgba(139, 111, 71, 0.25);
        transform: rotate(45deg);
      }
    }

    .tl-header {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 4px;
    }

    .tl-index {
      font-family: $font-typewriter;
      font-size: 11px;
      padding: 2px 7px;
      background: $warm-yellow;
      color: #3E2C1C;
      font-weight: 700;
      border-radius: 3px;
    }

    .tl-time {
      font-family: $font-typewriter;
      font-size: 12px;
      color: rgba(62, 44, 28, 0.6);
    }

    .tl-name {
      font-family: $font-body;
      font-size: 15px;
      font-weight: 700;
      color: $deep-brown;
    }

    .tl-stay {
      font-family: $font-typewriter;
      font-size: 10px;
      padding: 2px 7px;
      background: rgba(90, 122, 74, 0.15);
      color: $moss-green;
      border-radius: 10px;
    }

    .tl-note {
      font-family: 'Ma Shan Zheng', 'Kaiti', serif;
      font-size: 13px;
      color: rgba(62, 44, 28, 0.6);
      margin-top: 4px;
      line-height: 1.5;
      font-style: italic;
    }
  }

  .tips-scroll {
    background:
      linear-gradient(180deg, rgba(255, 240, 200, 0.7) 0%, rgba(255, 245, 215, 0.85) 50%, rgba(255, 240, 200, 0.7) 100%);
    border: 1.5px solid rgba(212, 160, 60, 0.4);
    border-radius: 8px;
    padding: 18px 22px;
    position: relative;
    margin-top: 8px;

    &::before,
    &::after {
      content: '❧';
      position: absolute;
      color: $warm-yellow;
      font-size: 18px;
      opacity: 0.7;
    }
    &::before { top: 6px; left: 12px; }
    &::after { bottom: 6px; right: 12px; transform: scaleX(-1); }

    .tips-title {
      font-family: $font-display;
      font-size: 13px;
      font-weight: 700;
      color: $vintage-red;
      letter-spacing: 3px;
      text-align: center;
      margin-bottom: 12px;

      &::before,
      &::after {
        content: '✦';
        color: $warm-yellow;
        margin: 0 8px;
        font-size: 10px;
      }
    }

    ul {
      margin: 0;
      padding-left: 22px;

      li {
        font-family: $font-body;
        font-size: 13px;
        color: rgba(62, 44, 28, 0.75);
        line-height: 1.8;
        margin-bottom: 2px;
      }
    }
  }

  .modal-footer {
    padding: 16px 28px 20px;
    background: linear-gradient(180deg, rgba(232, 220, 196, 0.4), rgba(232, 220, 196, 0.7));
    border-top: 2px solid rgba(212, 160, 60, 0.4);
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .foot-btn {
    padding: 11px 22px;
    border: 2px solid rgba(139, 111, 71, 0.4);
    border-radius: 6px;
    background: #FBF5E6;
    font-family: $font-display;
    font-size: 13px;
    font-weight: 700;
    color: $deep-brown;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 8px;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(62, 44, 28, 0.15);
    }

    &.primary {
      background: linear-gradient(180deg, #3A7CB8 0%, $highway-blue 100%);
      color: #FFF;
      border-color: #1E4A78;
    }
    &.gold {
      background: linear-gradient(180deg, $warm-yellow 0%, #B88820 100%);
      color: #FFF;
      border-color: #8B6914;
    }
    &.ghost:hover {
      background: $vintage-red;
      color: #FFF;
      border-color: $vintage-red;
    }
  }
</style>

{#if $showPreview}
  <div class="mask" on:click={onMaskClick}>
    <div class="modal" role="dialog" aria-label="行程预览">
      <div class="tear-line">
        <span class="tear-icon">✂️</span>
      </div>

      <div class="modal-body">
        <div class="header-section">
          <div class="postmark">
            <span class="pm-label">POST</span>
            <span class="pm-date">{todayStamp}</span>
            <span class="pm-city">✦ VINTAGE ✦</span>
          </div>
          <h1 class="route-title">ROUTE ITINERARY</h1>
          <h2 class="route-subtitle">{$currentRoute.name || '未命名路线'}</h2>
        </div>

        <div class="stats-card">
          <div class="stat-item">
            <div class="stat-value">
              {formatDistance(estimates.totalDistance)}
            </div>
            <div class="stat-label">总里程</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">
              {formatDuration(estimates.totalDuration)}
            </div>
            <div class="stat-label">总时长</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">
              {formatCurrency(estimates.fuelCost)}
            </div>
            <div class="stat-label">预计油费</div>
          </div>
        </div>

        {#if $currentRoute.markers.length >= 2}
          <div class="route-flow">
            <span class="flow-point">🚩 {startName}</span>
            <span class="flow-arrow">➡️</span>
            <span class="flow-point">🏁 {endName}</span>
          </div>
        {/if}

        <div class="section-header">
          <span class="sh-line"></span>
          <span class="sh-text">行程时间轴</span>
          <span class="sh-line"></span>
        </div>

        {#if $currentRoute.markers.length > 0}
          <div class="timeline">
            {#each $currentRoute.markers as marker, idx}
              {@const typeInfo = markerTypeInfo[marker.type]}
              {@const prevSeg = idx > 0 ? $segments[idx - 1] : null}
              <div class="tl-item">
                <div class="tl-dot" style="color: {typeInfo.color};">
                  {typeInfo.icon}
                </div>
                {#if prevSeg}
                  <div class="tl-seg-info">
                    <span class="si-dist">{formatDistance(prevSeg.distance)}</span>
                    <span>{formatDuration(prevSeg.duration || 0)}</span>
                  </div>
                {/if}
                <div class="tl-content">
                  <div class="tl-header">
                    <span class="tl-index">D{idx + 1}</span>
                    {#if marker.arrivalTime}
                      <span class="tl-time">🕐 {marker.arrivalTime}</span>
                    {/if}
                    <span class="tl-name">{marker.name || '途经点'}</span>
                    {#if marker.stayDuration}
                      <span class="tl-stay">⏸ {marker.stayDuration}分钟</span>
                    {/if}
                  </div>
                  {#if marker.note}
                    <div class="tl-note">「{truncateNote(marker.note)}」</div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <div class="section-header">
          <span class="sh-line"></span>
          <span class="sh-text">注意事项</span>
          <span class="sh-line"></span>
        </div>

        <div class="tips-scroll">
          <div class="tips-title">驾驶安全建议</div>
          <ul>
            {#each safetyTips as tip}
              <li>{tip}</li>
            {/each}
          </ul>
        </div>
      </div>

      <footer class="modal-footer">
        <button class="foot-btn primary" on:click={handlePrint}>
          🖨️ 打印行程单
        </button>
        <button class="foot-btn gold" on:click={handleDownloadGPX}>
          📥 下载 GPX
        </button>
        <button class="foot-btn ghost" on:click={close}>
          ✖️ 关闭
        </button>
      </footer>
    </div>
  </div>
{/if}
