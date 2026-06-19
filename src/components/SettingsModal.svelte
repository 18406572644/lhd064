<script lang="ts">
  import { showSettings, showToast } from '@/stores/ui.store';
  import { vehicleConfig } from '@/stores/settings.store';
  import type { VehicleConfig } from '@/types';

  type VehiclePreset = 'sedan' | 'suv' | 'rv' | 'motorcycle';

  interface PresetOption {
    id: VehiclePreset;
    label: string;
    icon: string;
    config: VehicleConfig;
  }

  const defaultConfig: VehicleConfig = {
    fuelConsumption: 8,
    fuelPrice: 7.5,
    averageSpeed: 80,
    restStopInterval: 200,
    restStopDuration: 20
  };

  const presets: PresetOption[] = [
    {
      id: 'sedan',
      label: '小型轿车',
      icon: '🚗',
      config: { fuelConsumption: 7, fuelPrice: 7.5, averageSpeed: 90, restStopInterval: 250, restStopDuration: 15 }
    },
    {
      id: 'suv',
      label: 'SUV',
      icon: '🚙',
      config: { fuelConsumption: 10, fuelPrice: 7.8, averageSpeed: 85, restStopInterval: 200, restStopDuration: 20 }
    },
    {
      id: 'rv',
      label: '房车',
      icon: '🚐',
      config: { fuelConsumption: 15, fuelPrice: 7.8, averageSpeed: 70, restStopInterval: 150, restStopDuration: 45 }
    },
    {
      id: 'motorcycle',
      label: '摩托车',
      icon: '🏍️',
      config: { fuelConsumption: 4, fuelPrice: 8.0, averageSpeed: 75, restStopInterval: 180, restStopDuration: 25 }
    }
  ];

  let local: VehicleConfig = { ...defaultConfig };
  let selectedPreset: VehiclePreset | '' = '';
  let dirty = false;

  function syncFromStore() {
    vehicleConfig.subscribe(cfg => {
      local = { ...cfg };
      dirty = false;
      detectPreset();
    })();
  }
  syncFromStore();

  function detectPreset() {
    for (const p of presets) {
      if (
        p.config.fuelConsumption === local.fuelConsumption &&
        p.config.averageSpeed === local.averageSpeed &&
        Math.abs(p.config.restStopInterval - local.restStopInterval) < 5
      ) {
        selectedPreset = p.id;
        return;
      }
    }
    selectedPreset = '';
  }

  function close() {
    showSettings.set(false);
  }

  function onMaskClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function applyPreset(id: VehiclePreset) {
    const preset = presets.find(p => p.id === id);
    if (!preset) return;
    local = { ...preset.config };
    selectedPreset = id;
    dirty = true;
    showToast(`已选择：${preset.label}`, 'info');
  }

  function onRangeChange() {
    dirty = true;
    selectedPreset = '';
  }

  function onInputChange() {
    dirty = true;
    selectedPreset = '';
  }

  function save() {
    const cleaned: VehicleConfig = {
      fuelConsumption: Math.max(3, Math.min(20, Number(local.fuelConsumption) || 8)),
      fuelPrice: Math.max(2, Math.min(20, Number(local.fuelPrice) || 7.5)),
      averageSpeed: Math.max(40, Math.min(140, Number(local.averageSpeed) || 80)),
      restStopInterval: Math.max(100, Math.min(1000, Number(local.restStopInterval) || 200)),
      restStopDuration: Math.max(10, Math.min(120, Number(local.restStopDuration) || 20))
    };
    vehicleConfig.set(cleaned);
    dirty = false;
    showToast('车辆设置已保存', 'success');
    close();
  }

  function resetToDefault() {
    if (confirm('确定要重置为默认设置吗？')) {
      local = { ...defaultConfig };
      selectedPreset = '';
      dirty = true;
      showToast('已重置为默认值', 'info');
    }
  }

  function estimateFuelFor100km(): string {
    const cost = local.fuelConsumption * local.fuelPrice;
    return `¥${cost.toFixed(1)} / 百公里`;
  }

  function estimateRange(): string {
    const tank = 50;
    const km = (tank / local.fuelConsumption) * 100;
    return `${Math.round(km)} km / 50L油箱`;
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
    width: 520px;
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

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 26px;

    &::-webkit-scrollbar {
      width: 7px;
    }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb {
      background: rgba(212, 160, 60, 0.4);
      border-radius: 4px;
    }
  }

  .section-title {
    font-family: $font-display;
    font-size: 12px;
    font-weight: 700;
    color: $highway-blue;
    letter-spacing: 2px;
    margin: 0 0 10px;
    display: flex;
    align-items: center;
    gap: 10px;

    &::before,
    &::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(212, 160, 60, 0.5), transparent);
    }
    &::before { flex: 0 0 0; }
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 22px;
  }

  .preset-card {
    padding: 12px 6px;
    border: 2px solid rgba(139, 111, 71, 0.25);
    border-radius: 6px;
    background: rgba(255, 250, 235, 0.6);
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: rgba(212, 160, 60, 0.6);
      transform: translateY(-2px);
      box-shadow: 0 4px 10px rgba(62, 44, 28, 0.1);
    }

    &.active {
      border-color: $highway-blue;
      background: rgba(44, 95, 143, 0.08);
      box-shadow: 0 0 0 3px rgba(44, 95, 143, 0.1);
    }

    .p-icon {
      font-size: 28px;
      line-height: 1;
      margin-bottom: 4px;
    }
    .p-label {
      font-family: $font-display;
      font-size: 11px;
      font-weight: 600;
      color: $deep-brown;
      letter-spacing: 0.5px;
    }
  }

  .field {
    margin-bottom: 18px;
  }

  .field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .field-label {
      font-family: $font-display;
      font-size: 13px;
      font-weight: 600;
      color: $deep-brown;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 6px;

      .f-icon { font-size: 15px; }
    }

    .field-value {
      font-family: $font-typewriter;
      font-size: 15px;
      font-weight: 700;
      color: $highway-blue;
      background: rgba(44, 95, 143, 0.06);
      padding: 3px 10px;
      border-radius: 10px;
      border: 1px solid rgba(44, 95, 143, 0.15);

      .f-unit {
        font-size: 11px;
        color: rgba(62, 44, 28, 0.5);
        font-weight: 400;
        margin-left: 2px;
      }
    }
  }

  .range-wrap {
    position: relative;
    padding: 0 4px;
  }

  input[type="range"] {
    width: 100%;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;

    &::-webkit-slider-runnable-track {
      height: 6px;
      background: linear-gradient(90deg, $warm-yellow var(--pct, 50%), rgba(139, 111, 71, 0.2) var(--pct, 50%));
      border-radius: 3px;
      border: 1px solid rgba(139, 111, 71, 0.2);
    }

    &::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px;
      height: 20px;
      margin-top: -8px;
      background: #FFF;
      border: 3px solid $highway-blue;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(44, 95, 143, 0.3);
      transition: all 0.15s;

      &:hover {
        transform: scale(1.12);
        box-shadow: 0 3px 10px rgba(44, 95, 143, 0.4);
      }
      &:active {
        transform: scale(1.05);
      }
    }

    &::-moz-range-track {
      height: 6px;
      background: rgba(139, 111, 71, 0.2);
      border-radius: 3px;
    }
    &::-moz-range-thumb {
      width: 18px;
      height: 18px;
      background: #FFF;
      border: 3px solid $highway-blue;
      border-radius: 50%;
    }
  }

  .range-ticks {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-family: $font-typewriter;
    font-size: 10px;
    color: rgba(62, 44, 28, 0.45);
    padding: 0 2px;
  }

  .num-input-wrap {
    display: flex;
    align-items: center;
    gap: 8px;

    .num-input {
      flex: 1;
      padding: 9px 12px;
      background: rgba(255, 250, 235, 0.8);
      border: 1.5px solid rgba(139, 111, 71, 0.3);
      border-radius: 5px;
      font-family: $font-typewriter;
      font-size: 15px;
      font-weight: 700;
      color: $deep-brown;
      outline: none;
      transition: border-color 0.2s;

      &:focus {
        border-color: $highway-blue;
        box-shadow: 0 0 0 3px rgba(44, 95, 143, 0.1);
      }
    }

    .num-unit {
      font-family: $font-display;
      font-size: 12px;
      color: rgba(62, 44, 28, 0.55);
      min-width: 60px;
    }
  }

  .estimate-card {
    margin: 18px 0 8px;
    padding: 14px 18px;
    background: linear-gradient(135deg, rgba(212, 160, 60, 0.08), rgba(44, 95, 143, 0.06));
    border: 1.5px dashed rgba(212, 160, 60, 0.5);
    border-radius: 8px;

    .ec-title {
      font-family: $font-display;
      font-size: 11px;
      color: rgba(62, 44, 28, 0.55);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 10px;
      text-align: center;
    }

    .ec-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 18px;
    }

    .ec-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;

      .ec-label {
        font-family: $font-body;
        font-size: 12px;
        color: rgba(62, 44, 28, 0.6);
      }
      .ec-val {
        font-family: $font-typewriter;
        font-size: 13px;
        font-weight: 700;
        color: $deep-brown;
      }
    }
  }

  .modal-footer {
    padding: 14px 26px 18px;
    border-top: 2px solid rgba(212, 160, 60, 0.4);
    background: rgba(232, 220, 196, 0.35);
    display: flex;
    gap: 12px;

    .dirty-tag {
      position: absolute;
      top: 18px;
      right: 62px;
      padding: 2px 8px;
      background: rgba(139, 58, 46, 0.1);
      color: $vintage-red;
      border: 1px solid rgba(139, 58, 46, 0.3);
      border-radius: 10px;
      font-family: $font-typewriter;
      font-size: 10px;
      letter-spacing: 1px;
    }
  }

  .btn {
    flex: 1;
    padding: 12px 16px;
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
    justify-content: center;
    gap: 8px;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(62, 44, 28, 0.15);
    }

    &.primary {
      background: linear-gradient(180deg, #3A7CB8, $highway-blue);
      color: #FFF;
      border-color: #1E4A78;
    }
    &.ghost:hover {
      background: rgba(255, 250, 235, 0.9);
    }
    &.warn:hover {
      border-color: $vintage-red;
      color: $vintage-red;
      background: rgba(139, 58, 46, 0.06);
    }
  }
</style>

{#if $showSettings}
  <div class="mask" on:click={onMaskClick}>
    <div class="modal" role="dialog" aria-label="车辆设置">
      <header class="modal-header">
        {#if dirty}
          <span class="dirty-tag">● 有未保存更改</span>
        {/if}
        <h2>
          <span>⚙️</span>
          车辆设置
        </h2>
        <button class="close-btn" on:click={close} aria-label="关闭">✕</button>
      </header>

      <div class="modal-body">
        <h3 class="section-title">预设车型</h3>
        <div class="preset-grid">
          {#each presets as p}
            <div
              class="preset-card {selectedPreset === p.id ? 'active' : ''}"
              on:click={() => applyPreset(p.id)}
              title={p.label}
            >
              <div class="p-icon">{p.icon}</div>
              <div class="p-label">{p.label}</div>
            </div>
          {/each}
        </div>

        <div class="field">
          <div class="field-row">
            <label class="field-label">
              <span class="f-icon">⛽</span>
              百公里油耗
            </label>
            <div class="field-value">
              {local.fuelConsumption}
              <span class="f-unit">L</span>
            </div>
          </div>
          <div class="range-wrap">
            <input
              type="range"
              min="3"
              max="20"
              step="0.5"
              bind:value={local.fuelConsumption}
              on:input={onRangeChange}
              style="--pct: {((local.fuelConsumption - 3) / (20 - 3)) * 100}%"
            />
            <div class="range-ticks">
              <span>3</span>
              <span>8</span>
              <span>12</span>
              <span>16</span>
              <span>20</span>
            </div>
          </div>
        </div>

        <div class="field">
          <div class="field-row">
            <label class="field-label">
              <span class="f-icon">💰</span>
              汽油价格
            </label>
            <div class="field-value">
              ¥ {local.fuelPrice}
              <span class="f-unit">/L</span>
            </div>
          </div>
          <div class="num-input-wrap">
            <input
              class="num-input"
              type="number"
              min="2"
              max="20"
              step="0.1"
              bind:value={local.fuelPrice}
              on:input={onInputChange}
            />
            <span class="num-unit">元 / 升</span>
          </div>
        </div>

        <div class="field">
          <div class="field-row">
            <label class="field-label">
              <span class="f-icon">🏁</span>
              平均车速
            </label>
            <div class="field-value">
              {local.averageSpeed}
              <span class="f-unit">km/h</span>
            </div>
          </div>
          <div class="range-wrap">
            <input
              type="range"
              min="40"
              max="140"
              step="5"
              bind:value={local.averageSpeed}
              on:input={onRangeChange}
              style="--pct: {((local.averageSpeed - 40) / (140 - 40)) * 100}%"
            />
            <div class="range-ticks">
              <span>40</span>
              <span>65</span>
              <span>90</span>
              <span>115</span>
              <span>140</span>
            </div>
          </div>
        </div>

        <div class="field">
          <div class="field-row">
            <label class="field-label">
              <span class="f-icon">☕</span>
              休息间隔
            </label>
            <div class="field-value">
              {local.restStopInterval}
              <span class="f-unit">km</span>
            </div>
          </div>
          <div class="num-input-wrap">
            <input
              class="num-input"
              type="number"
              min="100"
              max="1000"
              step="10"
              bind:value={local.restStopInterval}
              on:input={onInputChange}
            />
            <span class="num-unit">公里 / 次</span>
          </div>
        </div>

        <div class="field">
          <div class="field-row">
            <label class="field-label">
              <span class="f-icon">⏱️</span>
              每次休息
            </label>
            <div class="field-value">
              {local.restStopDuration}
              <span class="f-unit">min</span>
            </div>
          </div>
          <div class="num-input-wrap">
            <input
              class="num-input"
              type="number"
              min="10"
              max="120"
              step="5"
              bind:value={local.restStopDuration}
              on:input={onInputChange}
            />
            <span class="num-unit">分钟</span>
          </div>
        </div>

        <div class="estimate-card">
          <div class="ec-title">✦ 预估参考 ✦</div>
          <div class="ec-grid">
            <div class="ec-item">
              <span class="ec-label">油费成本</span>
              <span class="ec-val">{estimateFuelFor100km()}</span>
            </div>
            <div class="ec-item">
              <span class="ec-label">预估续航</span>
              <span class="ec-val">{estimateRange()}</span>
            </div>
            <div class="ec-item">
              <span class="ec-label">每日行驶</span>
              <span class="ec-val">{Math.round(local.averageSpeed * 8)} km / 8h</span>
            </div>
            <div class="ec-item">
              <span class="ec-label">休息频次</span>
              <span class="ec-val">{Math.max(1, Math.round(500 / local.restStopInterval))} 次 / 500km</span>
            </div>
          </div>
        </div>
      </div>

      <footer class="modal-footer">
        <button class="btn warn" on:click={resetToDefault}>
          ↺ 重置
        </button>
        <button class="btn ghost" on:click={close}>
          取消
        </button>
        <button class="btn primary" on:click={save}>
          ✓ 保存设置
        </button>
      </footer>
    </div>
  </div>
{/if}
