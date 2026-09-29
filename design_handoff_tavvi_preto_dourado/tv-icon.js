// <tv-icon name="mail" size="16" stroke="1.75"></tv-icon> — renders a Lucide icon (same set the codebase uses via react-icons/lu and lucide-react-native).
(function () {
  const pascal = (s) => s.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());
  const pending = new Set();
  function whenReady(el) {
    if (window.lucide && window.lucide.icons) return el.draw();
    pending.add(el);
  }
  const poll = setInterval(() => {
    if (window.lucide && window.lucide.icons) { clearInterval(poll); pending.forEach((el) => el.draw()); pending.clear(); }
  }, 30);
  class TvIcon extends HTMLElement {
    static get observedAttributes() { return ['name', 'size', 'stroke']; }
    connectedCallback() {
      this.style.display = 'inline-flex';
      this.style.flexShrink = '0';
      this.style.lineHeight = '0';
      whenReady(this);
    }
    attributeChangedCallback() { if (this.isConnected) whenReady(this); }
    draw() {
      const L = window.lucide; if (!L) return;
      const node = L.icons[pascal(this.getAttribute('name') || 'circle')];
      const size = this.getAttribute('size') || '16';
      this.style.width = size + 'px'; this.style.height = size + 'px';
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      if (!node) { root.innerHTML = ''; return; }
      const svg = L.createElement(node);
      svg.setAttribute('width', size); svg.setAttribute('height', size);
      svg.setAttribute('stroke-width', this.getAttribute('stroke') || '1.75');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.display = 'block';
      root.replaceChildren(svg);
    }
  }
  if (!customElements.get('tv-icon')) customElements.define('tv-icon', TvIcon);
})();
