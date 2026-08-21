/**
 * main.js
 * 진입점. DOM이 준비되면 AppController를 시작한다.
 */
document.addEventListener('DOMContentLoaded', () => {
  new AppController().init();
});
