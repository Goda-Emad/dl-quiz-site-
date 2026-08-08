// main.js — shared utilities for DL Quiz Site
// (currently minimal; extend as needed)

// Highlight active nav link based on current page
document.addEventListener('DOMContentLoaded', () => {
  const links = document.querySelectorAll('.nav-link');
  const page  = location.pathname.split('/').pop() || 'index.html';
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href === page) link.classList.add('active');
    else link.classList.remove('active');
  });
});
