<script lang="ts">
  export let text: string;
  export let color: string = '#2C5F8F';
  export let textColor: string = '#D4A03C';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let icon: string = '';
  export let tilt: number = 0;
  export let disabled: boolean = false;

  $: sizeConfig = {
    sm: { height: 28, paddingX: 10, fontSize: 11, iconSize: 13, gap: 5, rivetSize: 5, rivetInset: 4, rivetBottom: 3 },
    md: { height: 40, paddingX: 16, fontSize: 13, iconSize: 16, gap: 8, rivetSize: 7, rivetInset: 7, rivetBottom: 5 },
    lg: { height: 56, paddingX: 24, fontSize: 16, iconSize: 22, gap: 10, rivetSize: 9, rivetInset: 10, rivetBottom: 7 }
  }[size];
</script>

<button
  class="road-sign"
  style="
    --sign-color: {color};
    --sign-text-color: {textColor};
    --sign-tilt: {tilt}deg;
    --height: {sizeConfig.height}px;
    --padding-x: {sizeConfig.paddingX}px;
    --font-size: {sizeConfig.fontSize}px;
    --icon-size: {sizeConfig.iconSize}px;
    --gap: {sizeConfig.gap}px;
    --rivet-size: {sizeConfig.rivetSize}px;
    --rivet-inset: {sizeConfig.rivetInset}px;
    --rivet-bottom: {sizeConfig.rivetBottom}px;
  "
  {disabled}
  on:click
>
  <span class="rivet rivet-tl"></span>
  <span class="rivet rivet-tr"></span>
  <span class="rivet rivet-bl"></span>
  <span class="rivet rivet-br"></span>
  <span class="sign-content">
    {#if icon}
      <span class="sign-icon">{icon}</span>
    {/if}
    <span class="sign-text">{text}</span>
  </span>
</button>

<style lang="scss">
  .road-sign {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: var(--height);
    padding: 0 var(--padding-x);
    gap: var(--gap);
    border: 3px solid var(--sign-text-color);
    border-radius: 4px;
    background:
      repeating-linear-gradient(
        90deg,
        var(--sign-color) 0px,
        var(--sign-color) 2px,
        rgba(255, 255, 255, 0.03) 2px,
        rgba(255, 255, 255, 0.03) 4px
      ),
      repeating-linear-gradient(
        0deg,
        transparent 0px,
        transparent 1px,
        rgba(255, 255, 255, 0.02) 1px,
        rgba(255, 255, 255, 0.02) 2px
      ),
      var(--sign-color);
    color: var(--sign-text-color);
    font-family: $font-typewriter;
    font-weight: 600;
    font-size: var(--font-size);
    letter-spacing: 0.5px;
    cursor: pointer;
    transform: rotate(var(--sign-tilt)) translateY(0);
    transition: all 0.2s ease;
    box-shadow:
      0 4px 0 rgba(0, 0, 0, 0.25),
      0 6px 12px rgba(26, 20, 16, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    overflow: visible;
    user-select: none;
    -webkit-user-select: none;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 2px;
      box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.08);
      pointer-events: none;
    }

    &:not(:disabled):hover {
      animation: sign-wobble 0.6s ease-in-out;
      transform: rotate(var(--sign-tilt)) translateY(-2px);
      box-shadow:
        0 6px 0 rgba(0, 0, 0, 0.25),
        0 8px 16px rgba(26, 20, 16, 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.18),
        inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    }

    &:not(:disabled):active {
      transform: rotate(var(--sign-tilt)) translateY(1px);
      box-shadow:
        0 2px 0 rgba(0, 0, 0, 0.25),
        0 3px 6px rgba(26, 20, 16, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.12),
        inset 0 -1px 0 rgba(0, 0, 0, 0.1);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      filter: grayscale(0.5);
    }
  }

  .rivet {
    position: absolute;
    width: var(--rivet-size);
    height: var(--rivet-size);
    border-radius: 50%;
    background: var(--sign-text-color);
    box-shadow:
      inset 0 1px 2px rgba(0, 0, 0, 0.35),
      inset 0 -1px 1px rgba(255, 255, 255, 0.25);
    z-index: 1;
    pointer-events: none;

    &.rivet-tl {
      top: var(--rivet-bottom);
      left: var(--rivet-inset);
    }

    &.rivet-tr {
      top: var(--rivet-bottom);
      right: var(--rivet-inset);
    }

    &.rivet-bl {
      bottom: var(--rivet-bottom);
      left: var(--rivet-inset);
    }

    &.rivet-br {
      bottom: var(--rivet-bottom);
      right: var(--rivet-inset);
    }
  }

  .sign-content {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
    white-space: nowrap;
    text-transform: uppercase;
    text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.15);
  }

  .sign-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(--icon-size);
    line-height: 1;
    filter: drop-shadow(1px 1px 0 rgba(0, 0, 0, 0.15));
  }

  .sign-text {
    display: inline;
    line-height: 1;
  }

  @keyframes sign-wobble {
    0%, 100% { transform: rotate(var(--sign-tilt)); }
    25% { transform: rotate(calc(var(--sign-tilt) - 1.5deg)); }
    75% { transform: rotate(calc(var(--sign-tilt) + 1.5deg)); }
  }
</style>
