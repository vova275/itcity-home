<script>
  import { path } from '../lib/icons.js';
  let { name, size = 24, color = 'currentColor' } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill={color} aria-hidden="true"><path d={path(name)} /></svg>
