<script lang="ts">
  import { showPublishPlaza, showToast } from '@/stores/ui.store';
  import { currentRoute } from '@/stores/route.store';
  import { CommunityService } from '@/services/community.service';
  import { CommunityStorage } from '@/services/community-storage.service';
  import { ROUTE_THEME_LABELS, ROUTE_THEME_ICONS, type RouteTheme } from '@/types';
  import { onMount } from 'svelte';

  let author = '';
  let description = '';
  let rating: 1 | 2 | 3 | 4 | 5 = 3;
  let hoverRating = 0;
  let submitting = false;
  let selectedThemes: RouteTheme[] = [];
  let detectingThemes = false;

  $: markerCount = $currentRoute.markers.length;
  $: canPublish = markerCount >= 2 && author.trim().length > 0;
  $: routeName = $currentRoute.name;

  const allThemes: RouteTheme[] = ['nature', 'culture', 'food', 'road_trip'];

  const ratingLabels: Record<number, string> = {
    1: '轻松休闲',
    2: '简单易行',
    3: '中等难度',
    4: '较有挑战',
    5: '极限挑战'
  };

  function toggleTheme(theme: RouteTheme) {
    const idx = selectedThemes.indexOf(theme);
    if (idx >= 0) {
      selectedThemes.splice(idx, 1);
    } else {
      selectedThemes.push(theme);
    }
    selectedThemes = [...selectedThemes];
  }

  function isThemeSelected(theme: RouteTheme): boolean {
    return selectedThemes.includes(theme);
  }

  async function detectThemes() {
    detectingThemes = true;
    try {
      const detected = await CommunityService.autoDetectThemes($currentRoute);
      selectedThemes = detected;
      showToast(`已自动识别 ${detected.length} 个主题标签`, 'success');
    } catch (e) {
      showToast('自动识别失败', 'error');
    } finally {
      detectingThemes = false;
    }
  }

  onMount(async () => {
    author = CommunityStorage.loadAuthorName();
    if ($currentRoute.markers.length >= 2) {
      try {
        selectedThemes = await CommunityService.autoDetectThemes($currentRoute);
      } catch (e) {
        // ignore
      }
    }
  });

  function close() {
    showPublishPlaza.set(false);
  }

  function onMaskClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function setRating(val: number) {
    rating = val as 1 | 2 | 3 | 4 | 5;
  }

  async function handlePublish() {
    if (!canPublish || submitting) return;
    submitting = true;
    try {
      await CommunityService.publishToPlaza($currentRoute, author, description, rating, selectedThemes);
      showToast('路线已发布到广场！', 'success');
      close();
    } catch (e: any) {
      showToast('发布失败：' + (e.message || '未知错误'), 'error');
    } finally {
      submitting = false;
    }
  }
</script>

{#if $showPublishPlaza}
  <div class="mask" on:click={onMaskClick}>
    <div class="modal">
      <header class="modal-header">
        <div class="title-wrap">
          <h2>发布到广场</h2>
          <div class="subtitle">Publish to Community</div>
        </div>
        <button class="close-btn" on:click={close} aria-label="关闭">✕</button>
      </header>

      <div class="modal-body">
        <div class="route-preview">
          <div class="preview-icon">🗺️</div>
          <div class="preview-info">
            <span class="preview-name">{routeName}</span>
            <span class="preview-meta">📍 {markerCount} 个标记点</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="pub-author">
            <span class="label-icon">✍️</span>
            作者昵称
          </label>
          <input
            id="pub-author"
            type="text"
            class="form-input"
            placeholder="输入你的昵称..."
            bind:value={author}
            maxlength={20}
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="pub-desc">
            <span class="label-icon">📝</span>
            路线简介
          </label>
          <textarea
            id="pub-desc"
            class="form-textarea"
            placeholder="描述你的路线亮点、适合人群、注意事项..."
            bind:value={description}
            maxlength={300}
            rows={3}
          ></textarea>
          <span class="char-count">{description.length}/300</span>
        </div>

        <div class="form-group">
          <label class="form-label">
            <span class="label-icon">⭐</span>
            难度评分（自评）
          </label>
          <div class="rating-row">
            <div class="star-group">
              {#each [1, 2, 3, 4, 5] as val}
                <button
                  class="star-btn"
                  class:active={val <= (hoverRating || rating)}
                  on:click={() => setRating(val)}
                  on:mouseenter={() => hoverRating = val}
                  on:mouseleave={() => hoverRating = 0}
                >
                  {val <= (hoverRating || rating) ? '★' : '☆'}
                </button>
              {/each}
            </div>
            <span class="rating-label">{ratingLabels[hoverRating || rating]}</span>
          </div>
        </div>

        <div class="form-group">
          <div class="label-row">
            <label class="form-label">
              <span class="label-icon">🏷️</span>
              路线主题标签
            </label>
            <button class="detect-btn" on:click={detectThemes} disabled={detectingThemes}>
              {detectingThemes ? '识别中...' : '✨ 智能识别'}
            </button>
          </div>
          <div class="theme-grid">
            {#each allThemes as theme}
              <button
                type="button"
                class="theme-chip"
                class:selected={isThemeSelected(theme)}
                on:click={() => toggleTheme(theme)}
              >
                <span class="theme-icon">{ROUTE_THEME_ICONS[theme]}</span>
                <span class="theme-label">{ROUTE_THEME_LABELS[theme]}</span>
              </button>
            {/each}
          </div>
          {#if selectedThemes.length === 0}
            <span class="hint-text">请至少选择一个主题标签</span>
          {/if}
        </div>
      </div>

      <footer class="modal-footer">
        <button class="btn btn-cancel" on:click={close}>取消</button>
        <button
          class="btn btn-publish"
          on:click={handlePublish}
          disabled={!canPublish || submitting}
        >
          {submitting ? '发布中...' : '🚀 发布到广场'}
        </button>
      </footer>
    </div>
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
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.25s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal {
    width: 440px;
    max-width: 92vw;
    max-height: 90vh;
    background: $sand;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 48px rgba(26, 20, 16, 0.35);
    animation: slideUp 0.3s ease;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E");
      pointer-events: none;
    }
    > * { position: relative; z-index: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(24px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .modal-header {
    padding: 18px 20px 14px;
    background: linear-gradient(180deg, #5C472F 0%, #3E2C1C 100%);
    border-bottom: 4px solid $warm-yellow;
    display: flex;
    align-items: center;
    justify-content: space-between;

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
      letter-spacing: 4px;
      margin: 0;
      text-shadow: 1px 1px 0 rgba(0,0,0,0.3);
    }

    .subtitle {
      font-family: $font-typewriter;
      font-size: 9px;
      color: rgba(245, 239, 224, 0.5);
      letter-spacing: 3px;
      margin-top: 3px;
      text-transform: uppercase;
    }

    .close-btn {
      width: 32px;
      height: 32px;
      border: 2px solid rgba(245, 239, 224, 0.4);
      border-radius: 50%;
      background: rgba(245, 239, 224, 0.08);
      color: #FBF5E6;
      font-size: 14px;
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

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .route-preview {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    background: rgba(255, 250, 235, 0.7);
    border: 1.5px solid rgba(139, 111, 71, 0.25);
    border-radius: 6px;

    .preview-icon {
      font-size: 32px;
    }

    .preview-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .preview-name {
      font-family: $font-display;
      font-size: 15px;
      font-weight: 600;
      color: $deep-brown;
    }

    .preview-meta {
      font-family: $font-typewriter;
      font-size: 11px;
      color: rgba(62, 44, 28, 0.55);
    }
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: relative;
  }

  .form-label {
    font-family: $font-display;
    font-size: 12px;
    font-weight: 600;
    color: $deep-brown;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 6px;

    .label-icon {
      font-size: 14px;
    }
  }

  .form-input, .form-textarea {
    width: 100%;
    padding: 10px 14px;
    background: #FBF5E6;
    border: 1.5px solid rgba(139, 111, 71, 0.3);
    border-radius: 6px;
    font-family: $font-body;
    font-size: 14px;
    color: $deep-brown;
    outline: none;
    transition: all 0.2s;
    resize: vertical;

    &:focus {
      border-color: $highway-blue;
      box-shadow: 0 0 0 3px rgba(44, 95, 143, 0.1);
    }

    &::placeholder {
      color: rgba(62, 44, 28, 0.35);
    }
  }

  .char-count {
    position: absolute;
    bottom: 8px;
    right: 10px;
    font-family: $font-typewriter;
    font-size: 10px;
    color: rgba(62, 44, 28, 0.4);
  }

  .rating-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .star-group {
    display: flex;
    gap: 2px;
  }

  .star-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: rgba(212, 160, 60, 0.35);
    transition: all 0.15s;
    padding: 2px;
    line-height: 1;

    &.active {
      color: $warm-yellow;
      text-shadow: 0 1px 4px rgba(212, 160, 60, 0.4);
    }

    &:hover {
      transform: scale(1.2);
    }
  }

  .rating-label {
    font-family: $font-body;
    font-size: 13px;
    color: rgba(62, 44, 28, 0.7);
    font-style: italic;
  }

  .label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .detect-btn {
    padding: 4px 12px;
    border: 1.5px solid rgba(44, 95, 143, 0.35);
    border-radius: 16px;
    background: rgba(44, 95, 143, 0.06);
    color: $highway-blue;
    font-family: $font-display;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: rgba(44, 95, 143, 0.12);
      border-color: $highway-blue;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .theme-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .theme-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    border: 1.5px solid rgba(139, 111, 71, 0.3);
    border-radius: 8px;
    background: #FBF5E6;
    cursor: pointer;
    transition: all 0.2s;

    .theme-icon {
      font-size: 18px;
    }

    .theme-label {
      font-family: $font-display;
      font-size: 13px;
      font-weight: 600;
      color: $deep-brown;
    }

    &:hover {
      border-color: rgba(212, 160, 60, 0.6);
      background: rgba(255, 240, 180, 0.3);
    }

    &.selected {
      border-color: $highway-blue;
      background: rgba(44, 95, 143, 0.1);
      box-shadow: 0 2px 6px rgba(44, 95, 143, 0.15);

      .theme-label {
        color: $highway-blue;
      }
    }
  }

  .hint-text {
    font-family: $font-typewriter;
    font-size: 11px;
    color: rgba(62, 44, 28, 0.4);
    margin-top: 4px;
  }

  .modal-footer {
    padding: 12px 20px 16px;
    border-top: 2px solid $warm-yellow;
    background: rgba(255, 250, 235, 0.7);
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  .btn {
    padding: 10px 22px;
    border-radius: 6px;
    font-family: $font-display;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: 0.5px;
    border: 1.5px solid transparent;

    &.btn-cancel {
      background: #FBF5E6;
      border-color: rgba(139, 111, 71, 0.3);
      color: rgba(62, 44, 28, 0.7);

      &:hover {
        background: #FFF;
        border-color: rgba(139, 111, 71, 0.5);
      }
    }

    &.btn-publish {
      background: $highway-blue;
      border-color: $highway-blue;
      color: $warm-yellow;

      &:hover:not(:disabled) {
        background: #265680;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(44, 95, 143, 0.3);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
</style>
