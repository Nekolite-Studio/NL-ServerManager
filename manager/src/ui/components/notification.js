// manager/src/ui/components/notification.js

export const showNotification = (message, type = 'info', id = null, duration = 5000) => {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notifId = id || `notif-${Date.now()}`;
    let notif = document.getElementById(notifId);

    // 同じIDの通知が既にあれば内容を更新、なければ新規作成
    if (notif) {
        // 既存のタイマーをクリア
        const oldTimeout = notif.dataset.timeoutId;
        if (oldTimeout) clearTimeout(parseInt(oldTimeout));
    } else {
        notif = document.createElement('div');
        notif.id = notifId;
        container.appendChild(notif);
    }
    
    const baseClasses = 'w-full max-w-xs p-4 text-white rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300';
    let typeClasses = '';
    let icon = '';

    switch(type) {
        case 'success':
            typeClasses = 'bg-green-500 dark:bg-green-600';
            icon = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
            break;
        case 'error':
            typeClasses = 'bg-red-500 dark:bg-red-600';
            icon = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
            break;
        default: // info
            typeClasses = 'bg-blue-500 dark:bg-blue-600';
            icon = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
            break;
    }

    notif.className = `${baseClasses} ${typeClasses}`;
    notif.innerHTML = `
        <div class="flex-shrink-0">${icon}</div>
        <p class="flex-1">${message}</p>
        <button data-dismiss-target="${notifId}" class="p-1 rounded-md hover:bg-black/20">
             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    `;
    
    const removeNotif = () => {
        notif.classList.add('opacity-0');
        setTimeout(() => notif.remove(), 300);
    };

    if (duration > 0) {
        const timeoutId = setTimeout(removeNotif, duration);
        notif.dataset.timeoutId = timeoutId.toString();
    }

    notif.querySelector(`[data-dismiss-target]`).addEventListener('click', () => {
        const timeoutId = notif.dataset.timeoutId;
        if (timeoutId) clearTimeout(parseInt(timeoutId));
        removeNotif();
    });
};

// 互換性のためにグローバルにも代入
window.showNotification = showNotification;