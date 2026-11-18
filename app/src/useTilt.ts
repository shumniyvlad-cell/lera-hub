// Наклон до 6° и блик за курсором — только мышь и только когда движение включено.
import {useEffect} from 'react';

export function useTilt(selector = '.tilt') {
  useEffect(() => {
    if (!document.documentElement.classList.contains('motion') || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let el: HTMLElement | null = null;
    let raf = 0;
    const reset = (x: HTMLElement) => { x.style.transform = ''; x.style.removeProperty('--gx'); x.style.removeProperty('--gy'); };
    const move = (e: PointerEvent) => {
      const t = (e.target as HTMLElement).closest?.(selector) as HTMLElement | null;
      if (el && el !== t) reset(el);
      el = t;
      if (!t) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = t.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        const max = r.width > 420 ? 2.5 : 6;
        t.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) translateZ(0)`;
        t.style.setProperty('--gx', `${px * 100}%`);
        t.style.setProperty('--gy', `${py * 100}%`);
      });
    };
    const leave = () => { if (el) reset(el); el = null; };
    addEventListener('pointermove', move, {passive: true});
    document.addEventListener('pointerleave', leave);
    return () => { removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); cancelAnimationFrame(raf); };
  }, [selector]);
}
