    const ADMIN_ICONS={
      'crosshair-center':`<path d="M12 4.5v5M12 14.5v5M4.5 12h5M14.5 12h5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
      trash:`<path d="M7 8h10" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round"/><path d="M9.25 8V6.6a1.4 1.4 0 0 1 1.4-1.4h2.7a1.4 1.4 0 0 1 1.4 1.4V8" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round"/><path d="M8.25 8.35l.7 11.3h6.1l.7-11.3" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linejoin="round"/><path d="M10.5 11.25v5.75M13.5 11.25v5.75" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>`,
      star:`<path d="M12 3.1 14.62 9.28 21.4 9.7 16.18 14.22 17.9 20.9 12 17.42 6.1 20.9 7.82 14.22 2.6 9.7 9.38 9.28 12 3.1z" fill="currentColor"/>`,
      'star-outline':`<path d="M12 4.35 14.05 9.2 19.35 9.55 15.3 13.05 16.65 18.3 12 15.55 7.35 18.3 8.7 13.05 4.65 9.55 9.95 9.2 12 4.35z" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"/>`
    };

    function renderFavoriteStarIcon(filled,className='admin-icon location-star-icon'){
      return renderAdminIcon(filled?'star':'star-outline',className);
    }

    function renderAdminIcon(name,className='admin-icon'){
      const inner=ADMIN_ICONS[name];
      if(!inner)return '';
      return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
    }

    window.renderAdminIcon=renderAdminIcon;
    window.renderFavoriteStarIcon=renderFavoriteStarIcon;
    window.ADMIN_ICONS=ADMIN_ICONS;
