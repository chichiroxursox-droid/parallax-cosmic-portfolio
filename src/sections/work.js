import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function initWork() {
  const section = document.querySelector('#work');
  const track = document.querySelector('.work-track');
  const cards = gsap.utils.toArray('.work-card');
  const progressBar = document.querySelector('.work-progress-bar');

  if (!section || !track || cards.length === 0) return;

  // ── Parallax tilt on hover ──────────────────────────────────────────────
  // Tilt is applied to .card-thumb only; the card itself lifts via CSS :hover
  cards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;   // -0.5 to 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      const thumb = card.querySelector('.card-thumb');
      if (thumb) {
        thumb.style.transform = `perspective(800px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
      }
    });

    card.addEventListener('mouseleave', () => {
      const thumb = card.querySelector('.card-thumb');
      if (thumb) {
        thumb.style.transition = 'transform 0.4s ease';
        thumb.style.transform = '';
        setTimeout(() => { thumb.style.transition = ''; }, 400);
      }
    });
  });

  // ── Horizontal scroll setup ─────────────────────────────────────────────
  const totalScroll = track.scrollWidth - window.innerWidth;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => `+=${totalScroll}`,
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        if (progressBar) progressBar.style.width = `${self.progress * 100}%`;

        // ── Active card detection ─────────────────────────────────────────
        // Find which card's centre is closest to the viewport centre
        const vpCentreX = window.innerWidth / 2;

        let closestCard = null;
        let closestDist = Infinity;

        cards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          const cardCentreX = rect.left + rect.width / 2;
          const dist = Math.abs(cardCentreX - vpCentreX);
          if (dist < closestDist) {
            closestDist = dist;
            closestCard = card;
          }
        });

        cards.forEach((card) => {
          card.classList.remove('is-active', 'is-flanking');
          if (card === closestCard) {
            card.classList.add('is-active');
          } else {
            card.classList.add('is-flanking');
          }
        });
      },
    },
  });

  tl.to(track, {
    x: -totalScroll,
    ease: 'none',
  });

  // ── Card entrance animations ────────────────────────────────────────────
  cards.forEach((card) => {
    gsap.from(card, {
      opacity: 0,
      x: 100,
      duration: 0.6,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: card,
        containerAnimation: tl,
        start: 'left 85%',
        toggleActions: 'play none none reverse',
      },
    });
  });
}

export { initWork };
