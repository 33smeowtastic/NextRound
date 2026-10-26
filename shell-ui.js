// Brothforge source lockup copied verbatim; CSS is linked separately for this unbundled app.

// One geometric mark for every lockup: 12 vertices, 30 edges, no lighting effects.
const vertices = [[50,2],[91.57,26],[91.57,74],[50,98],[8.43,74],[8.43,26],[26,37],[74,37],[50,79],[50,21],[26,63],[74,63]];
const edges = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,6],[0,7],[0,9],[1,7],[1,9],[1,11],[2,7],[2,8],[2,11],[3,8],[3,10],[3,11],[4,6],[4,8],[4,10],[5,6],[5,9],[5,10],[6,7],[7,8],[8,6],[9,10],[10,11],[11,9]];
export const brandIconMarkup = `<svg class="bf-brand__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false"><g stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" stroke-linecap="round">${edges.map(([a,b]) => `<path d="M${vertices[a].join(' ')}L${vertices[b].join(' ')}"/>`).join('')}</g></svg>`;

// Hand-drawn Bezier outlines from the selected reference: fine circular forms,
// four-point O counters, and tapered R / T / F / E terminals. No font or bitmap.
// The reusable asset uses these same paths and the same 962 : 118 viewBox.
export const brandWordmarkMarkup = `<svg class="bf-brand__wordmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 962 118" fill="currentColor" fill-rule="evenodd" aria-hidden="true" focusable="false"><path data-letter="B" d="M0 12H39C54 12 61 21 61 34C61 41 58 47 53 51C66 55 75 65 75 78C75 94 64 104 47 104H2V61C2 52 8 48 17 48H38C48 48 54 43 54 34C54 26 48 20 39 20H18C10 20 4 17 0 12ZM10 61V96H46C59 96 67 89 67 78C67 66 59 56 46 56H18C12 56 10 57 10 61Z"/><path data-letter="R" d="M99 12H139C155 12 165 21 165 36C165 50 154 59 139 59H128C139 66 148 79 159 92C173 108 184 113 203 113C179 118 160 109 146 94C130 76 120 59 105 52H137C149 52 158 47 158 36C158 25 149 20 138 20H118C109 20 103 17 99 12ZM104 64C109 75 113 96 104 104Z"/><path data-letter="O" d="M242 13C267 13 287 33 287 58C287 84 267 104 242 104C217 104 198 84 198 58C198 33 217 13 242 13ZM242 20C221 20 205 37 205 58C205 80 221 97 242 97C263 97 280 80 280 58C280 37 263 20 242 20ZM242 46C244 53 247 56 254 58C247 60 244 63 242 70C240 63 237 60 230 58C237 56 240 53 242 46Z"/><path data-letter="T" d="M301 12H373C368 18 362 20 352 20H348C343 20 341 25 341 31V104H333V33C333 27 335 23 340 20H321C311 20 306 18 301 12Z"/><path data-letter="H" d="M398 12H406V50C406 54 410 56 417 56H448C452 56 455 58 456 62V12H464V104H456V70C456 64 452 61 446 61H417C412 61 408 59 406 56V104H398Z"/><path data-letter="F" d="M496 56C498 23 514 11 538 9C556 8 568 7 580 0C570 16 558 20 539 20C517 20 503 30 496 56ZM496 104V67C496 57 502 51 512 51H548C544 58 538 60 529 60H511C506 60 505 64 505 70V85C505 94 501 100 496 104Z"/><path data-letter="O" d="M627 13C652 13 672 33 672 58C672 84 652 104 627 104C602 104 582 84 582 58C582 33 602 13 627 13ZM627 20C606 20 589 37 589 58C589 80 606 97 627 97C648 97 665 80 665 58C665 37 648 20 627 20ZM627 46C629 53 632 56 639 58C632 60 629 63 627 70C625 63 622 60 615 58C622 56 625 53 627 46Z"/><path data-letter="R" d="M692 12H731C747 12 756 21 756 36C756 50 745 59 731 59H720C731 66 740 79 751 92C764 108 776 113 794 113C771 118 752 109 738 94C722 76 712 59 697 52H729C741 52 749 47 749 36C749 25 741 20 730 20H710C702 20 696 17 692 12ZM698 64C703 75 707 96 698 104Z"/><path data-letter="G" d="M860 12C855 18 849 20 839 20H828C807 20 790 37 790 58C790 80 807 96 829 96H852V59H837C831 59 826 56 822 51H860V104H829C803 104 783 84 783 58C783 32 803 12 828 12Z"/><path data-letter="E" d="M891 38C891 20 900 12 916 12H962C958 18 952 20 943 20H914C901 20 895 25 891 38ZM891 104V65C891 55 897 51 906 51H943C939 57 934 59 925 59H906C903 59 900 61 900 66V96H944C952 96 956 99 962 104Z"/></svg>`;

export function normalizeBrandVariant(variant) {
  return ['a', 'b', 'c'].includes(variant) ? variant : 'a';
}

export function brandMarkup(variant = 'a') {
  const selected = normalizeBrandVariant(variant);
  const words = selected === 'a'
    ? `<span class="bf-brand__words"><span class="bf-brand__en">${brandWordmarkMarkup}<span class="bf-brand__en-text">BROTHFORGE</span></span><span class="bf-brand__zh">${[...'骨汤造物所'].map(character => `<span>${character}</span>`).join('')}</span></span>`
    : selected === 'c'
    ? '<span class="bf-brand__words"><span class="bf-brand__zh"><span>骨汤</span><span>造物所</span></span><span class="bf-brand__en">BROTHFORGE</span></span>'
    : `<span class="bf-brand__words"><span class="bf-brand__zh">骨汤造物所</span><span class="bf-brand__en">BROTHFORGE</span></span>`;
  return `<span class="bf-brand bf-brand--${selected}" data-brand-variant="${selected}" role="img" aria-label="骨汤造物所 BROTHFORGE">${brandIconMarkup}${words}</span>`;
}

export function applyBrand(root = document, variant = 'a') {
  root.querySelectorAll('[data-brand-lockup]').forEach((host) => { host.innerHTML = brandMarkup(variant); });
}

// Brothforge's current home brand uses variant a and navigates to #relic.
export function shellBrandMarkup({ expanded = false, mobile = false } = {}) {
  const expandFirst = mobile && !expanded;
  const navigationState = mobile
    ? ` aria-expanded="${expanded}" aria-controls="sidebar-nav"${expandFirst ? ' data-action="expand-brand-nav"' : ''}`
    : '';
  return `<a class="shell-brand" href="https://www.brothforge.com/#relic" target="_top" aria-label="${expandFirst ? '展开导航' : '骨汤造物所首页'}"${navigationState}>${brandMarkup('a')}</a>`;
}
