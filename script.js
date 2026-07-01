if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

window.scrollTo(0, 0);

const contactButton = document.querySelector('.contact-button');
const toast = document.getElementById('toast');
const main = document.querySelector('main');
const gradientContainer = document.querySelector('.hero-gradient');
let toastTimeout;
let buttonTimeout;

let orbTargetX = 0;
let orbTargetY = 0;
let orbTargetScale = 1;
let orbTargetRotate = 0;
let orbCurrentX = 0;
let orbCurrentY = 0;
let orbCurrentScale = 1;
let orbCurrentRotate = 0;

function animateGradientOrb() {
  orbCurrentX += (orbTargetX - orbCurrentX) * 0.16;
  orbCurrentY += (orbTargetY - orbCurrentY) * 0.16;
  orbCurrentScale += (orbTargetScale - orbCurrentScale) * 0.12;
  orbCurrentRotate += (orbTargetRotate - orbCurrentRotate) * 0.14;

  if (gradientContainer) {
    gradientContainer.style.setProperty('--orb-x', `${orbCurrentX}px`);
    gradientContainer.style.setProperty('--orb-y', `${orbCurrentY}px`);
    gradientContainer.style.setProperty('--orb-scale', orbCurrentScale.toFixed(3));
    gradientContainer.style.setProperty('--orb-rotate', `${orbCurrentRotate.toFixed(2)}deg`);
  }

  requestAnimationFrame(animateGradientOrb);
}

if (main && gradientContainer && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  main.addEventListener('mousemove', (event) => {
    const rect = main.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    const intensity = Math.min(Math.hypot(x, y) * 1.4, 1);

    orbTargetX = x * 90;
    orbTargetY = y * 70;
    orbTargetScale = 1 + intensity * 0.1;
    orbTargetRotate = x * 14;
  });

  main.addEventListener('mouseleave', () => {
    orbTargetX = 0;
    orbTargetY = 0;
    orbTargetScale = 1;
    orbTargetRotate = 0;
  });

  animateGradientOrb();
}

function showToast(message) {
  if (!toast) return;

  clearTimeout(toastTimeout);
  toast.classList.remove('toast--visible');
  toast.textContent = message;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });
  });

  toastTimeout = setTimeout(() => {
    toast.classList.remove('toast--visible');
  }, 3000);
}

function resetContactButton(button, defaultLabel) {
  button.textContent = defaultLabel;
  button.classList.remove('contact-button--copied');
}

if (contactButton) {
  contactButton.addEventListener('click', async () => {
    const email = contactButton.dataset.email;
    const defaultLabel = 'Contact';

    try {
      await navigator.clipboard.writeText(email);
      contactButton.textContent = 'Copied!';
      contactButton.classList.add('contact-button--copied');
      showToast("Andy's email was copied to your clipboard");

      clearTimeout(buttonTimeout);
      buttonTimeout = setTimeout(() => {
        resetContactButton(contactButton, defaultLabel);
      }, 5000);
    } catch {
      contactButton.textContent = email;
      contactButton.classList.add('contact-button--copied');

      clearTimeout(buttonTimeout);
      buttonTimeout = setTimeout(() => {
        resetContactButton(contactButton, defaultLabel);
      }, 3000);
    }
  });
}
