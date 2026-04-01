import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function initAbout() {
  // Reveal each line on scroll
  gsap.utils.toArray('.reveal-line').forEach((line, i) => {
    gsap.to(line, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: line,
        start: 'top 80%',
        toggleActions: 'play none none reverse',
      },
    });
  });

  // Stats counter animation
  gsap.utils.toArray('.stat-num').forEach((stat) => {
    const target = stat.textContent;
    if (target === '∞') {
      gsap.fromTo(stat, { opacity: 0, scale: 0.5 }, {
        opacity: 1,
        scale: 1,
        duration: 0.6,
        ease: 'back.out(2)',
        scrollTrigger: {
          trigger: stat,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        },
      });
    } else {
      const num = parseFloat(target);
      gsap.from(stat, {
        textContent: 0,
        duration: 1.5,
        ease: 'back.out(1.5)',
        snap: { textContent: 1 },
        scrollTrigger: {
          trigger: stat,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        },
      });
    }
  });
}

export { initAbout };
