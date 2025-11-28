// manager/src/utils/logger.js

/**
 * UI操作に関するデバッグ情報を一貫した形式でコンソールに出力します。
 *
 * @param {object} options - ロギングする情報。
 * @param {string} options.event - イベントの種類 (e.g., 'click', 'change', 'mount')。
 * @param {string} options.action - 実行されたアクション名 (e.g., 'open-settings', 'select-version')。
 * @param {string} [options.component] - イベント発生元のコンポーネント名。
 * @param {HTMLElement} [options.element] - イベントが発生したDOM要素。
 * @param {Record<string, any>} [options.details] - 追加情報 (e.g., { value: '1.20.1' })。
 */
export function logUiInteraction({ event, action, component, element, details }) {
    if (!console.group) {
        console.log(`[UI LOG] ${component || ''} | ${event}: ${action}`, { element, ...details });
        return;
    }

    const componentName = component || 'Global';
    const title = `%c[${componentName}]%c ${action}`;

    console.groupCollapsed(
        title,
        'color: #4f46e5; font-weight: bold;',
        'color: inherit; font-weight: normal;'
    );

    console.log(`%cEvent:%c ${event}`, 'font-weight: bold;', 'font-weight: normal;');

    if (element) {
        console.log('%cElement:%c', 'font-weight: bold;', 'font-weight: normal;', element);
    }

    if (details) {
        Object.entries(details).forEach(([key, value]) => {
            console.log(`%c${key.charAt(0).toUpperCase() + key.slice(1)}:%c`, 'font-weight: bold;', 'font-weight: normal;', value);
        });
    }
    
    console.groupEnd();
}