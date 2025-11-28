// manager/src/ui/components/agentRegisterModal.js
import { logUiInteraction } from '../../utils/logger.js';

export class AgentRegisterModal {
    constructor() {
        this.modalContainer = document.getElementById('modal-container');
        this.handleConfirm = this.handleConfirm.bind(this);
        this.componentName = 'AgentRegisterModal';
    }

    open() {
        logUiInteraction({ event: 'mount', action: 'open-modal', component: this.componentName });
        this.render();
        this.addEventListeners();
    }

    close() {
        logUiInteraction({ event: 'unmount', action: 'close-modal', component: this.componentName });
        this.modalContainer.innerHTML = '';
    }

    addEventListeners() {
        document.getElementById('confirm-register-agent-btn')?.addEventListener('click', this.handleConfirm);
        document.getElementById('cancel-register-agent-btn')?.addEventListener('click', () => this.close());
        this.modalContainer.querySelector('.bg-black')?.addEventListener('click', () => this.close());
    }

    handleConfirm(e) {
        const alias = document.getElementById('agent-name-input').value;
        const ip = document.getElementById('agent-ip-input').value;
        const port = document.getElementById('agent-port-input').value;
        
        const agentData = { alias, ip, port: parseInt(port, 10) };

        logUiInteraction({
            event: 'click',
            action: 'confirm-add-agent',
            component: this.componentName,
            element: e.currentTarget,
            details: { ...agentData }
        });

        if (alias && ip && port) {
            window.electronAPI.addAgent(agentData);
            this.close();
        } else {
            // TODO: Add proper validation feedback
            alert('すべてのフィールドを入力してください。');
        }
    }

    render() {
        const html = `
            <div id="register-agent-modal" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                    <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">エージェント登録</h3>
                    <div class="space-y-4">
                        <div>
                            <label for="agent-name-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300">エージェント名 (エイリアス)</label>
                            <input type="text" id="agent-name-input" placeholder="例: リビングPC" class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                        </div>
                        <div>
                            <label for="agent-ip-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300">IPアドレス</label>
                            <input type="text" id="agent-ip-input" placeholder="例: 192.168.1.10" class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                        </div>
                        <div>
                            <label for="agent-port-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300">ポート番号</label>
                            <input type="number" id="agent-port-input" value="8080" class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary focus:ring-primary sm:text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                        </div>
                    </div>
                    <div class="mt-6 flex justify-end gap-4">
                        <button id="cancel-register-agent-btn" type="button" class="bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">キャンセル</button>
                        <button id="confirm-register-agent-btn" type="button" class="bg-primary hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300">登録</button>
                    </div>
                </div>
            </div>
        `;
        this.modalContainer.innerHTML = html;
        lucide.createIcons();
    }
}