<script lang="ts">
  import { showExport, showToast, mapInstance } from '@/stores/ui.store';
  import { currentRoute } from '@/stores/route.store';
  import { vehicleConfig } from '@/stores/settings.store';
  import { calculateTripEstimates } from '@/services/trip-estimator';
  import { ExportService } from '@/services/export.service';
  import type { RouteData, RouteSegment } from '@/types';

  type TabId = 'gpx' | 'itinerary' | 'thumbnail';

  interface TabOption {
    id: TabId;
    label: string;
    icon: string;
  }

  const tabs: TabOption[] = [
    { id: 'gpx', label: 'GPX 导出', icon: '🗺️' },
    { id: 'itinerary', label: '行程单', icon: '📋' },
    { id: 'thumbnail', label: '缩略图', icon: '🖼️' }
  ];

  type ItineraryStyle = 'vintage' | 'minimal' | 'postcard';

  interface StyleOption {
    id: ItineraryStyle;
    label: string;
    preview: string;
  }

  const styleOptions: StyleOption[] = [
    { id: 'vintage', label: '复古车票', preview: '🎟️' },
    { id: 'minimal', label: '简约打印', preview: '📄' },
    { id: 'postcard', label: '相片明信片', preview: '💌' }
  ];

  interface ThumbSize {
    id: string;
    label: string;
    w: number;
    h: number;
  }

  const thumbSizes: ThumbSize[] = [
    { id: 's', label: '800 × 600', w: 800, h: 600 },
    { id: 'm', label: '1200 × 900', w: 1200, h: 900 },
    { id: 'l', label: '1920 × 1080', w: 1920, h: 1080 }
  ];

  type ImageFormat = 'png' | 'jpeg';

  let activeTab: TabId = 'gpx';

  // GPX options
  let includeWaypoints = true;
  let includeTrack = true;
  let includeElevation = false;
  let exportingGpx = false;

  // Itinerary options
  let selectedStyle: ItineraryStyle = 'vintage';
  let includeNotes = true;
  let includePhotos = false;
  let includeEstimates = true;
  let exportingHtml = false;
  let printing = false;

  // Thumbnail options
  let selectedSizeId = 'm';
  let imageFormat: ImageFormat = 'jpeg';
  let jpegQuality = 85;
  let generatingThumb = false;

  $: selectedSize = thumbSizes.find(s => s.id === selectedSizeId) || thumbSizes[1];
  $: estimates = calculateTripEstimates($currentRoute.markers, $vehicleConfig);

  function close() {
    showExport.set(false);
  }

  function onMaskClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  async function handleExportGPX() {
    exportingGpx = true;
    try {
      await ExportService.exportGPX($currentRoute);
      showToast('GPX 文件已生成并下载', 'success');
    } catch (e) {
      console.error(e);
      showToast('生成 GPX 失败', 'error');
    } finally {
      exportingGpx = false;
    }
  }

  async function handlePrintItinerary() {
    printing = true;
    try {
      ExportService.printItinerary($currentRoute, estimates.segments, estimates);
      showToast('正在打开打印窗口', 'info');
    } catch (e) {
      console.error(e);
      showToast('打印失败', 'error');
    } finally {
      printing = false;
    }
  }

  async function handleSaveHTML() {
    exportingHtml = true;
    try {
      await ExportService.exportItineraryHTML($currentRoute, estimates.segments, estimates);
      showToast('行程单 HTML 已下载', 'success');
    } catch (e) {
      console.error(e);
      showToast('生成 HTML 失败', 'error');
    } finally {
      exportingHtml = false;
    }
  }

  async function handleGenerateThumbnail() {
    generatingThumb = true;
    try {
      const mapEl = $mapInstance?._container as HTMLElement | null;
      if (!mapEl) {
        showToast('地图未准备好', 'error');
        return;
      }

      const dataUrl = await ExportService.generateThumbnail(mapEl);
      if (!dataUrl) {
        showToast('缩略图生成失败', 'error');
        return;
      }

      const targetW = selectedSize.w;
      const targetH = selectedSize.h;

      const srcImg = new Image();
      srcImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        srcImg.onload = () => resolve();
        srcImg.onerror = () => reject(new Error('load'));
        srcImg.src = dataUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('ctx');

      ctx.fillStyle = '#E8DCC4';
      ctx.fillRect(0, 0, targetW, targetH);

      const srcRatio = srcImg.width / srcImg.height;
      const dstRatio = targetW / targetH;
      let sx = 0, sy = 0, sw = srcImg.width, sh = srcImg.height;
      if (srcRatio > dstRatio) {
        sw = srcImg.height * dstRatio;
        sx = (srcImg.width - sw) / 2;
      } else {
        sh = srcImg.width / dstRatio;
        sy = (srcImg.height - sh) / 2;
      }
      ctx.drawImage(srcImg, sx, sy, sw, sh, 0, 0, targetW, targetH);

      const stampText = $currentRoute.name || 'Vintage Route';
      ctx.save();
      ctx.translate(targetW - 120, 90);
      ctx.rotate(-15 * Math.PI / 180);
      ctx.strokeStyle = 'rgba(139, 58, 46, 0.75)';
      ctx.lineWidth = 3;
      ctx.strokeRect(-70, -24, 140, 48);
      ctx.fillStyle = 'rgba(139, 58, 46, 0.75)';
      ctx.font = 'bold 14px "Special Elite", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stampText.length > 10 ? stampText.slice(0, 10) + '..' : stampText, 0, -6);
      ctx.font = '10px "Special Elite", monospace';
      ctx.fillStyle = 'rgba(139, 58, 46, 0.6)';
      ctx.fillText(new Date().toLocaleDateString('zh-CN'), 0, 12);
      ctx.restore();

      const mime = imageFormat === 'png' ? 'image/png' : 'image/jpeg';
      const quality = imageFormat === 'jpeg' ? jpegQuality / 100 : undefined;
      const outUrl = canvas.toDataURL(mime, quality);

      const a = document.createElement('a');
      const ext = imageFormat === 'png' ? 'png' : 'jpg';
      const cleanName = ($currentRoute.name || 'route').replace(/[\\/:*?"<>|]/g, '_');
      a.href = outUrl;
      a.download = `${cleanName}_${targetW}x${targetH}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showToast('缩略图已下载', 'success');
    } catch (e) {
      console.error(e);
      showToast('缩略图生成失败', 'error');
    } finally {
      generatingThumb = false;
    }
  }
</script>

<style lang="scss">
  @use '../styles/mixins' as *;

  .mask {
    position: fixed;
    inset: 0;
    background: rgba(62, 44, 28, 0.6);
    z-index: 1500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: fadeIn 0.2s ease;
    backdrop-filter: blur(2px);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal {
    width: 500px;
    max-width: 100%;
    max-height: 90vh;
    background: #FBF5E6;
    border: 3px double rgba(139, 111, 71, 0.6);
    border-radius: 8px;
    box-shadow: 0 20px 60px rgba(26, 20, 16, 0.4);
    display: flex;
    flex-direction: column;
    position: relative;
    animation: modalIn 0.25s ease;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 8px; left: 8px; right: 8px; bottom: 8px;
      border: 1px solid rgba(212, 160, 60, 0.3);
      border-radius: 5px;
      pointer-events: none;
    }
    > * { position: relative; z-index: 1; }
  }

  @keyframes modalIn {
    from { opacity: 0; transform: translateY(16px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .modal-header {
    padding: 18px 24px 14px;
    border-bottom: 2px solid rgba(212, 160, 60, 0.5);
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;

    .stamp {
      position: absolute;
      top: -6px;
      right: 52px;
      padding: 4px 12px;
      border: 2px solid $vintage-red;
      color: $vintage-red;
      font-family: $font-typewriter;
      font-size: 10px;
      letter-spacing: 2px;
      transform: rotate(8deg);
      opacity: 0.85;
      border-radius: 3px;
      background: rgba(255, 250, 235, 0.6);
    }

    h2 {
      font-family: $font-display;
      font-size: 20px;
      font-weight: 700;
      color: $deep-brown;
      letter-spacing: 3px;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .close-btn {
      width: 34px;
      height: 34px;
      border: 1.5px solid rgba(139, 111, 71, 0.4);
      border-radius: 50%;
      background: transparent;
      font-size: 15px;
      color: rgba(62, 44, 28, 0.7);
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background: $vintage-red;
        color: #FFF;
        border-color: $vintage-red;
      }
    }
  }

  .tab-bar {
    display: flex;
    padding: 0 16px;
    border-bottom: 1px solid rgba(139, 111, 71, 0.2);
    background: rgba(232, 220, 196, 0.2);

    .tab-btn {
      flex: 1;
      padding: 12px 8px 11px;
      background: transparent;
      border: none;
      border-bottom: 3px solid transparent;
      margin-bottom: -1px;
      font-family: $font-display;
      font-size: 12px;
      font-weight: 600;
      color: rgba(62, 44, 28, 0.55);
      cursor: pointer;
      transition: all 0.2s;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;

      &:hover { color: $deep-brown; }

      &.active {
        color: $highway-blue;
        border-bottom-color: $highway-blue;
        background: rgba(255, 250, 235, 0.5);
      }
    }
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 22px 26px;

    &::-webkit-scrollbar {
      width: 7px;
    }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb {
      background: rgba(212, 160, 60, 0.4);
      border-radius: 4px;
    }
  }

  .tab-content { animation: fadeIn 0.2s ease; }

  .desc-block {
    padding: 12px 14px;
    background: rgba(255, 250, 235, 0.7);
    border-left: 3px solid $warm-yellow;
    border-radius: 4px;
    font-family: $font-body;
    font-size: 13px;
    color: rgba(62, 44, 28, 0.7);
    line-height: 1.7;
    margin-bottom: 18px;
  }

  .field {
    margin-bottom: 14px;

    .field-label {
      display: block;
      font-family: $font-display;
      font-size: 12px;
      font-weight: 600;
      color: $highway-blue;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: rgba(255, 250, 235, 0.6);
    border: 1px solid rgba(139, 111, 71, 0.2);
    border-radius: 5px;
    margin-bottom: 6px;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: rgba(255, 250, 235, 0.9);
      border-color: rgba(212, 160, 60, 0.4);
    }

    &.disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: $highway-blue;
      cursor: pointer;
    }

    label {
      font-family: $font-body;
      font-size: 13px;
      color: $deep-brown;
      cursor: pointer;
      flex: 1;

      .sub-hint {
        font-size: 11px;
        color: rgba(62, 44, 28, 0.45);
        font-style: italic;
        margin-left: 6px;
      }
    }
  }

  .style-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .style-card {
    padding: 14px 8px;
    border: 2px solid rgba(139, 111, 71, 0.25);
    border-radius: 6px;
    background: rgba(255, 250, 235, 0.6);
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: rgba(212, 160, 60, 0.6);
      transform: translateY(-2px);
    }

    &.active {
      border-color: $highway-blue;
      background: rgba(44, 95, 143, 0.08);
      box-shadow: 0 0 0 3px rgba(44, 95, 143, 0.1);
    }

    .style-preview {
      font-size: 32px;
      margin-bottom: 6px;
      line-height: 1;
    }
    .style-label {
      font-family: $font-display;
      font-size: 11px;
      font-weight: 600;
      color: $deep-brown;
      letter-spacing: 0.5px;
    }
  }

  .size-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .size-btn {
    padding: 12px 6px;
    border: 2px solid rgba(139, 111, 71, 0.25);
    border-radius: 5px;
    background: rgba(255, 250, 235, 0.6);
    cursor: pointer;
    text-align: center;
    transition: all 0.2s;

    &:hover { border-color: rgba(212, 160, 60, 0.5); }
    &.active {
      border-color: $highway-blue;
      background: rgba(44, 95, 143, 0.08);
    }

    .size-num {
      font-family: $font-typewriter;
      font-size: 13px;
      font-weight: 700;
      color: $deep-brown;
    }
  }

  .format-row {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;

    .format-radio {
      flex: 1;
      padding: 10px;
      border: 2px solid rgba(139, 111, 71, 0.25);
      border-radius: 5px;
      background: rgba(255, 250, 235, 0.6);
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;

      &:hover { border-color: rgba(212, 160, 60, 0.5); }
      &.active {
        border-color: $highway-blue;
        background: rgba(44, 95, 143, 0.08);
      }

      .fm-label {
        font-family: $font-typewriter;
        font-size: 13px;
        font-weight: 700;
        color: $deep-brown;
      }
    }
  }

  .quality-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(255, 250, 235, 0.5);
    border: 1px solid rgba(139, 111, 71, 0.15);
    border-radius: 5px;

    .q-label {
      font-family: $font-display;
      font-size: 12px;
      color: rgba(62, 44, 28, 0.65);
      min-width: 56px;
    }
    input[type="range"] {
      flex: 1;
      accent-color: $warm-yellow;
    }
    .q-value {
      font-family: $font-typewriter;
      font-size: 13px;
      font-weight: 700;
      color: $warm-yellow;
      min-width: 40px;
      text-align: right;
    }
  }

  .preview-frame {
    aspect-ratio: 4 / 3;
    background: linear-gradient(135deg, #D4C8A8, #B8A880);
    border: 2px solid rgba(139, 111, 71, 0.35);
    border-radius: 6px;
    margin-bottom: 16px;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 30% 35%, rgba(90, 122, 74, 0.25) 0%, transparent 45%),
        radial-gradient(ellipse at 70% 65%, rgba(44, 95, 143, 0.22) 0%, transparent 50%),
        repeating-linear-gradient(45deg, transparent 0 12px, rgba(139, 111, 71, 0.06) 12px 24px);
    }

    .pin {
      position: absolute;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2.5px solid #FFF;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      &.a { top: 26%; left: 22%; background: $vintage-red; }
      &.b { top: 42%; left: 48%; background: $moss-green; }
      &.c { top: 62%; left: 72%; background: $highway-blue; }
    }

    .pf-info {
      position: absolute;
      bottom: 8px;
      left: 8px;
      right: 8px;
      padding: 6px 10px;
      background: rgba(255, 250, 235, 0.85);
      border-radius: 4px;
      font-family: $font-typewriter;
      font-size: 10px;
      color: rgba(62, 44, 28, 0.7);
      display: flex;
      justify-content: space-between;
    }

    .map-stamp {
      position: absolute;
      top: 10px;
      right: 12px;
      padding: 3px 8px;
      border: 1.5px solid $vintage-red;
      color: $vintage-red;
      font-family: $font-typewriter;
      font-size: 9px;
      transform: rotate(-10deg);
      opacity: 0.8;
      background: rgba(255, 250, 235, 0.6);
    }
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 20px;
  }

  .actions-row {
    display: flex;
    gap: 10px;
  }

  .btn {
    flex: 1;
    padding: 12px 14px;
    border: 2px solid rgba(139, 111, 71, 0.4);
    border-radius: 6px;
    background: #FBF5E6;
    font-family: $font-display;
    font-size: 13px;
    font-weight: 700;
    color: $deep-brown;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(62, 44, 28, 0.15);
    }
    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    &.primary {
      background: linear-gradient(180deg, #3A7CB8, $highway-blue);
      color: #FFF;
      border-color: #1E4A78;
    }
    &.gold {
      background: linear-gradient(180deg, $warm-yellow, #B88820);
      color: #FFF;
      border-color: #8B6914;
    }
  }
</style>

{#if $showExport}
  <div class="mask" on:click={onMaskClick}>
    <div class="modal" role="dialog" aria-label="导出行程数据">
      <header class="modal-header">
        <div class="stamp">EXPORT</div>
        <h2>
          <span>✦</span>
          导出行程数据
          <span>✦</span>
        </h2>
        <button class="close-btn" on:click={close} aria-label="关闭">✕</button>
      </header>

      <div class="tab-bar">
        {#each tabs as t}
          <button
            class="tab-btn {activeTab === t.id ? 'active' : ''}"
            on:click={() => activeTab = t.id}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        {/each}
      </div>

      <div class="modal-body">
        {#if activeTab === 'gpx'}
          <div class="tab-content">
            <div class="desc-block">
              GPX (GPS Exchange Format) 是标准的 GPS 数据交换格式，可导入大多数导航软件和户外应用中使用。
            </div>

            <div class="field">
              <label class="field-label">包含内容</label>
              <div class="checkbox-row">
                <input type="checkbox" bind:checked={includeWaypoints} id="opt-wp" />
                <label for="opt-wp">
                  Waypoints（航点）
                  <span class="sub-hint">每个标记点的坐标与名称</span>
                </label>
              </div>
              <div class="checkbox-row">
                <input type="checkbox" bind:checked={includeTrack} id="opt-trk" />
                <label for="opt-trk">
                  Track（轨迹）
                  <span class="sub-hint">完整的路线连线</span>
                </label>
              </div>
              <div class="checkbox-row disabled">
                <input type="checkbox" bind:checked={includeElevation} disabled id="opt-elev" />
                <label for="opt-elev">
                  高程数据
                  <span class="sub-hint">暂未支持</span>
                </label>
              </div>
            </div>

            <div class="actions">
              <button
                class="btn primary"
                disabled={exportingGpx || (!includeWaypoints && !includeTrack)}
                on:click={handleExportGPX}
              >
                {exportingGpx ? '生成中...' : '📄 生成并下载 GPX'}
              </button>
            </div>
          </div>

        {:else if activeTab === 'itinerary'}
          <div class="tab-content">
            <div class="field">
              <label class="field-label">样式风格</label>
              <div class="style-grid">
                {#each styleOptions as s}
                  <div
                    class="style-card {selectedStyle === s.id ? 'active' : ''}"
                    on:click={() => selectedStyle = s.id}
                  >
                    <div class="style-preview">{s.preview}</div>
                    <div class="style-label">{s.label}</div>
                  </div>
                {/each}
              </div>
            </div>

            <div class="field">
              <label class="field-label">包含内容</label>
              <div class="checkbox-row">
                <input type="checkbox" bind:checked={includeNotes} id="i-notes" />
                <label for="i-notes">标记点备注</label>
              </div>
              <div class="checkbox-row">
                <input type="checkbox" bind:checked={includePhotos} id="i-photos" />
                <label for="i-photos">照片</label>
              </div>
              <div class="checkbox-row">
                <input type="checkbox" bind:checked={includeEstimates} id="i-est" />
                <label for="i-est">估算数据（里程/时间/油费）</label>
              </div>
            </div>

            <div class="actions">
              <div class="actions-row">
                <button
                  class="btn primary"
                  disabled={printing}
                  on:click={handlePrintItinerary}
                >
                  🖨️ 直接打印
                </button>
                <button
                  class="btn gold"
                  disabled={exportingHtml}
                  on:click={handleSaveHTML}
                >
                  💾 保存为 HTML
                </button>
              </div>
            </div>
          </div>

        {:else if activeTab === 'thumbnail'}
          <div class="tab-content">
            <div class="preview-frame">
              <div class="pin a"></div>
              <div class="pin b"></div>
              <div class="pin c"></div>
              <div class="map-stamp">MAP</div>
              <div class="pf-info">
                <span>📌 {$currentRoute.markers.length} 个标记</span>
                <span>{selectedSize.label}</span>
              </div>
            </div>

            <div class="field">
              <label class="field-label">图片尺寸</label>
              <div class="size-grid">
                {#each thumbSizes as sz}
                  <div
                    class="size-btn {selectedSizeId === sz.id ? 'active' : ''}"
                    on:click={() => selectedSizeId = sz.id}
                  >
                    <div class="size-num">{sz.label}</div>
                  </div>
                {/each}
              </div>
            </div>

            <div class="field">
              <label class="field-label">图片格式</label>
              <div class="format-row">
                <div
                  class="format-radio {imageFormat === 'png' ? 'active' : ''}"
                  on:click={() => imageFormat = 'png'}
                >
                  <span class="fm-label">PNG</span>
                </div>
                <div
                  class="format-radio {imageFormat === 'jpeg' ? 'active' : ''}"
                  on:click={() => imageFormat = 'jpeg'}
                >
                  <span class="fm-label">JPEG</span>
                </div>
              </div>
            </div>

            {#if imageFormat === 'jpeg'}
              <div class="field">
                <label class="field-label">JPEG 质量</label>
                <div class="quality-row">
                  <span class="q-label">低 → 高</span>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="5"
                    bind:value={jpegQuality}
                  />
                  <span class="q-value">{jpegQuality}%</span>
                </div>
              </div>
            {/if}

            <div class="actions">
              <button
                class="btn primary"
                disabled={generatingThumb}
                on:click={handleGenerateThumbnail}
              >
                {generatingThumb ? '生成中...' : '🖼️ 生成并下载图片'}
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
