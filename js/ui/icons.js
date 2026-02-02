export const ICONS = {
  search: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>`,
  reset: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/></svg>`,
  clear: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19V4M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>`,
  ruler: `<svg viewBox="0 0 24 24"><path d="M7,2H17A2,2 0 0,1 19,4V20A2,2 0 0,1 17,22H7A2,2 0 0,1 5,20V4A2,2 0 0,1 7,2M7,4V6H10V8H7V10H12V12H7V14H10V16H7V18H12V20H17V4H7Z"/></svg>`,
  compass: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12,2A1,1 0 0,1 13,3A1,1 0 0,1 12,4A1,1 0 0,1 11,3A1,1 0 0,1 12,2M9.2,5.2L10.5,5.2L11,8.1L11.5,5.2L12.8,5.2L13.3,8.1L13.8,5.2L15.1,5.2L13.6,15H15V17H13.3L12.8,20.2L12.5,22H11.5L11.2,20.2L10.7,17H9V15H10.4L8.9,5.2M12,9L11.5,12H12.5L12,9Z"/></svg>`,
  scan: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M14,6L10.25,11L13.1,14.8L11.5,16C9.81,13.75 7,10 7,10L1,18H23L14,6Z"/></svg>`,
  visible: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12,4C7,4,2.73,7.11,1,11.5C2.73,15.89,7,19,12,19s9.27-3.11,11-7.5C21.27,7.11,17,4,12,4z M12,16.5 c-2.76,0-5-2.24-5-5s2.24-5,5-5s5,2.24,5,5S14.76,16.5,12,16.5z M12,8.5c-1.66,0-3,1.34-3,3s1.34,3,3,3s3-1.34-3-3S13.66,8.5,12,8.5 z"/></svg>`,
  map: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/></svg>`,
  izogips: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M3.5 18.5L9.5 12.5L13.5 16.5L20.5 9.5" fill="none" stroke="#00ff00" stroke-width="2" stroke-linecap="round"/><path d="M3.5 12.5L9.5 6.5L13.5 10.5L20.5 3.5" fill="none" stroke="#00ff00" stroke-width="2" stroke-linecap="round"/></svg>`,
  print: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>`,
  download: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z"/></svg>`,
  help: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z"/></svg>`,
  fox: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#ff6b00"><g transform="scale(0.0131) translate(2266, 331)"><path d="m-2096-331-105 438 107 463-172 376 158 45c-21 13-82 46-82 46s409 146 438 158l166 246 179 59c6 3 172-53 195-61l168-245s383-131 455-157l-87-45 176-45s-108-222-139-290c-12-28-26-56-40-83l-13-27 86-440-105-438-491 445h-403l-491-445Zm41 138 292 451-263 242-99-390 70-303Zm1303-1 70 306-93 375-268-230 291-451Zm-1109 864 220 61 88 140s34 455 37 457l113 71 116-73 34-455s71-112 91-140c52-16 197-55 218-60-15 23-93 130-100 141-2 2-134 42-164 53l-16 34 46 327 67-183 270-188c2-1 178 43 253 63-33 10-226 58-226 58 24 14 91 47 99 52l-359 125c-4 2-151 219-168 243-2 3-157 54-157 54l-155-51-167-246c-3-3-327-120-349-128l87-51c-15-6-190-54-197-56l211-64 272 187 68 183c3-23 41-280 46-324 0-3-10-25-15-34-4-6-129-43-164-53-16-20-81-117-99-143Z" /></g></svg>`,
};

export function injectIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const k = el.getAttribute('data-icon');
    if (ICONS[k]) el.innerHTML += ` ` + ICONS[k];
  });
}
