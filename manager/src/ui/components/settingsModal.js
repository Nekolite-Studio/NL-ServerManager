// manager/src/ui/components/settingsModal.js

import { state } from '../../../renderer-state.js';
import { logUiInteraction } from '../../utils/logger.js';

export class SettingsModal {
    constructor() {
        this.modalContainer = document.getElementById('modal-container');
        this.componentName = 'SettingsModal';
    }

    open() {
        logUiInteraction({ event: 'mount', action: 'open-modal', component: this.componentName });
        this.render();
        // イベントリスナーの設定はrenderメソッド内で行う
    }

    close() {
        logUiInteraction({ event: 'unmount', action: 'close-modal', component: this.componentName });
        this.modalContainer.innerHTML = '';
    }

    render() {
        const layoutOptions = [
            { value: 'accordion', name: 'Accordion List', desc: 'Simple vertical list. Good for small clusters.' },
            { value: 'kanban', name: 'Kanban Board', desc: 'Horizontal columns per agent.' },
            { value: 'treegrid', name: 'Tree Data Grid', desc: 'High density table view.' },
            { value: 'sidebar', name: 'Sidebar Filter', desc: 'Global list with agent filtering.' },
            { value: 'tabs', name: 'Tabbed Focus', desc: 'Focus on one agent at a time.' }
        ];

        const html = `
            <div id="settings-modal" class="fixed inset-0 z-50">
                <!-- 背景 -->
                <div class="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" data-action="close-settings-modal"></div>
                
                <!-- モーダルコンテンツ -->
                <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                    <div class="bg-white dark:bg-gray-800 w-full max-w-lg rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 pointer-events-auto transform transition-all scale-100">
                        
                        <!-- ヘッダー -->
                        <div class="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <h2 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <i data-lucide="settings-2" class="w-5 h-5 text-primary"></i>
                                Settings
                            </h2>
                            <button data-action="close-settings-modal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <i data-lucide="x" class="w-5 h-5"></i>
                            </button>
                        </div>

                        <!-- ボディ -->
                        <div class="p-6 space-y-6">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Dashboard Layout</label>
                                <div class="grid grid-cols-1 gap-3">
                                    ${layoutOptions.map(opt => `
                                        <label class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 dark:has-[:checked]:bg-primary/10">
                                            <div>
                                                <div class="font-bold text-sm text-gray-900 dark:text-gray-200">${opt.name}</div>
                                                <div class="text-xs text-gray-500">${opt.desc}</div>
                                            </div>
                                            <input type="radio" name="layout" value="${opt.value}" class="accent-primary w-4 h-4" ${state.layoutMode === opt.value ? 'checked' : ''} data-action="switch-layout">
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- フッター -->
                        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 rounded-b-xl flex justify-end">
                            <button data-action="close-settings-modal" class="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-sm font-bold rounded-lg shadow transition-colors">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.modalContainer.innerHTML = html;
        lucide.createIcons();
    }
}