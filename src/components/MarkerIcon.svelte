<script lang="ts">
  import type { MarkerType } from '@/types';

  export let type: MarkerType;
  export let size: number = 36;
  export let selected: boolean = false;
  export let orderNumber: number = 0;

  $: badgeSize = Math.round(size * 0.72);
  $: iconFontSize = Math.round(size * 0.42);
  $: pinHeight = Math.round(size * 0.35);
  $: totalHeight = size + pinHeight;
  $: orderBadgeSize = Math.round(size * 0.32);
  $: orderFontSize = Math.round(size * 0.18);

  function getColors() {
    switch (type) {
      case 'attraction':
        return {
          primary: '#5A7A4A',
          secondary: '#3E5A32',
          border: '#2C4222',
          shadow: 'rgba(90, 122, 74, 0.5)'
        };
      case 'restaurant':
        return {
          primary: '#D4A03C',
          secondary: '#B8892C',
          border: '#8F6A20',
          shadow: 'rgba(212, 160, 60, 0.5)'
        };
      case 'hotel':
        return {
          primary: '#3E2C1C',
          secondary: '#2A1E13',
          border: '#1A1410',
          shadow: 'rgba(62, 44, 28, 0.5)'
        };
      case 'gas':
        return {
          primary: '#8B3A2E',
          secondary: '#6E2C23',
          border: '#4F1E18',
          shadow: 'rgba(139, 58, 46, 0.5)'
        };
    }
  }

  function getEmoji() {
    switch (type) {
      case 'attraction': return '🏛️';
      case 'restaurant': return '🍽️';
      case 'hotel': return '🏨';
      case 'gas': return '⛽';
    }
  }

  function getShapeClipPath() {
    switch (type) {
      case 'hotel':
        const r = Math.round(badgeSize * 0.15);
        return `polygon(
          ${r}px 0, ${badgeSize - r}px 0,
          ${badgeSize}px ${r}px, ${badgeSize}px ${badgeSize - r}px,
          ${badgeSize - r}px ${badgeSize}px, ${r}px ${badgeSize}px,
          0 ${badgeSize - r}px, 0 ${r}px
        )`;
      case 'gas':
        const s = badgeSize;
        return `polygon(
          ${s * 0.5}px 0, ${s}px ${s * 0.18}px,
          ${s * 0.95}px ${s * 0.85}px, ${s * 0.5}px ${s}px,
          ${s * 0.05}px ${s * 0.85}px, 0 ${s * 0.18}px
        )`;
      case 'attraction':
        return 'circle(50% at 50% 50%)';
      case 'restaurant':
      default:
        return 'circle(50% at 50% 50%)';
    }
  }

  $: colors = getColors();
  $: emoji = getEmoji();
  $: clipPath = getShapeClipPath();
</script>

<div
  class="marker-icon {selected ? 'selected' : ''}"
  style="
    --size: {size}px;
    --badge-size: {badgeSize}px;
    --pin-height: {pinHeight}px;
    --total-height: {totalHeight}px;
    --icon-font-size: {iconFontSize}px;
    --order-badge-size: {orderBadgeSize}px;
    --order-font-size: {orderFontSize}px;
    --color-primary: {colors.primary};
    --color-secondary: {colors.secondary};
    --color-border: {colors.border};
    --color-shadow: {colors.shadow};
  "
>
  <svg viewBox="0 0 {size} {totalHeight}" width={size} height={totalHeight} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pinGrad-{type}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color={colors.primary} stop-opacity="1" />
        <stop offset="100%" stop-color={colors.border} stop-opacity="1" />
      </linearGradient>
      <linearGradient id="badgeGrad-{type}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color={colors.primary} stop-opacity="1" />
        <stop offset="100%" stop-color={colors.secondary} stop-opacity="1" />
      </linearGradient>
      <filter id="shadow-{type}" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="3" stdDeviation="2" flood-color={colors.border} flood-opacity="0.4" />
      </filter>
    </defs>

    <path
      d="
        M {size * 0.35} {badgeSize * 0.88}
        Q {size * 0.5} {totalHeight + 2} {size * 0.65} {badgeSize * 0.88}
        Q {size * 0.5} {badgeSize + 2} {size * 0.35} {badgeSize * 0.88}
        Z
      "
      fill="url(#pinGrad-{type})"
      filter="url(#shadow-{type})"
    />

    {#if type === 'attraction'}
      <g filter="url(#shadow-{type})">
        <circle cx={size / 2} cy={badgeSize / 2} r={badgeSize / 2 - 1} fill="url(#badgeGrad-{type})" stroke={colors.border} stroke-width="2" />
        <circle
          cx={size / 2} cy={badgeSize / 2} r={badgeSize / 2 - 4}
          fill="none" stroke={colors.border} stroke-width="0.5"
          stroke-dasharray="3 2" opacity="0.5"
        />
      </g>
    {:else if type === 'restaurant'}
      <g filter="url(#shadow-{type})">
        <circle cx={size / 2} cy={badgeSize / 2} r={badgeSize / 2 - 1} fill="url(#badgeGrad-{type})" stroke={colors.border} stroke-width="2" />
        <circle cx={size / 2} cy={badgeSize / 2} r={badgeSize / 2 - 4} fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
      </g>
    {:else if type === 'hotel'}
      <g filter="url(#shadow-{type})">
        <rect
          x={(size - badgeSize) / 2 + 1}
          y={1}
          width={badgeSize - 2}
          height={badgeSize - 2}
          rx={badgeSize * 0.15}
          ry={badgeSize * 0.15}
          fill="url(#badgeGrad-{type})"
          stroke={colors.border}
          stroke-width="2"
        />
        <line
          x1={(size - badgeSize) / 2 + 4}
          y1={badgeSize * 0.35}
          x2={size / 2 + badgeSize / 2 - 4}
          y2={badgeSize * 0.35}
          stroke="rgba(212, 160, 60, 0.8)"
          stroke-width="1.5"
        />
        <line
          x1={(size - badgeSize) / 2 + 4}
          y1={badgeSize * 0.65}
          x2={size / 2 + badgeSize / 2 - 4}
          y2={badgeSize * 0.65}
          stroke="rgba(212, 160, 60, 0.8)"
          stroke-width="1.5"
        />
      </g>
    {:else if type === 'gas'}
      <g filter="url(#shadow-{type})">
        <path
          d="
            M {size / 2} {1}
            L {(size - badgeSize) / 2 + badgeSize - 1} {badgeSize * 0.18}
            L {(size - badgeSize) / 2 + badgeSize * 0.95} {badgeSize * 0.85}
            L {size / 2} {badgeSize - 1}
            L {(size - badgeSize) / 2 + badgeSize * 0.05} {badgeSize * 0.85}
            L {(size - badgeSize) / 2 + 1} {badgeSize * 0.18}
            Z
          "
          fill="url(#badgeGrad-{type})"
          stroke={colors.border}
          stroke-width="2"
        />
      </g>
    {/if}
  </svg>

  <span class="marker-emoji" style="font-size: {iconFontSize}px;">
    {emoji}
  </span>

  {#if orderNumber > 0}
    <span class="order-badge" style="width: {orderBadgeSize}px; height: {orderBadgeSize}px; font-size: {orderFontSize}px;">
      {orderNumber}
    </span>
  {/if}

  {#if selected}
    <span class="pulse-ring"></span>
  {/if}
</div>

<style lang="scss">
  @use '../styles/animations';

  .marker-icon {
    position: relative;
    display: inline-block;
    width: var(--size);
    height: var(--total-height);
    transform-origin: 50% calc(var(--total-height) - 4px);
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    filter: drop-shadow(0 2px 4px rgba(26, 20, 16, 0.3));

    &.selected {
      transform: scale(1.2);
      z-index: 10;
      animation: marker-bounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
    }
  }

  .marker-emoji {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: var(--badge-size);
    height: var(--badge-size);
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    pointer-events: none;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
    z-index: 2;
  }

  .order-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: $highway-blue;
    color: $cream;
    border: 2px solid $cream;
    border-radius: 50%;
    font-family: $font-display;
    font-weight: 700;
    line-height: 1;
    z-index: 5;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.3);
  }

  .pulse-ring {
    position: absolute;
    top: 50%;
    left: 50%;
    width: var(--badge-size);
    height: var(--badge-size);
    transform: translate(-50%, -50%) translateY(calc(var(--pin-height) * -0.15));
    border: 3px solid var(--color-primary);
    border-radius: 50%;
    opacity: 0;
    z-index: 0;
    animation: marker-pulse 1.6s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
    box-shadow: 0 0 20px var(--color-shadow);
  }

  @keyframes marker-bounce {
    0%, 100% {
      transform: scale(1.2) translateY(0);
    }
    50% {
      transform: scale(1.2) translateY(-6px);
    }
  }

  @keyframes marker-pulse {
    0% {
      transform: translate(-50%, -50%) translateY(calc(var(--pin-height) * -0.15)) scale(1);
      opacity: 0.7;
    }
    80%, 100% {
      transform: translate(-50%, -50%) translateY(calc(var(--pin-height) * -0.15)) scale(1.8);
      opacity: 0;
    }
  }
</style>
