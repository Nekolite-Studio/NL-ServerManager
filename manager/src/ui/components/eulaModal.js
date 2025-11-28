// manager/src/ui/components/eulaModal.js

export class EulaModal {
    constructor() {
        this.modalContainer = document.getElementById('modal-container');
        this.modalElement = null;
        this.onConfirm = null;
        this.onCancel = null;
    }

    open({ eulaContent, onConfirm, onCancel }) {
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;

        this.modalContainer.innerHTML = this._createHtml(eulaContent);
        this.modalElement = this.modalContainer.querySelector('#eula-modal-component');
        this.modalElement.classList.remove('hidden');

        this._addEventListeners();

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    close() {
        if (this.modalElement) {
            this.modalElement.classList.add('hidden');
            // アニメーションのため少し待ってから中身を消す
            setTimeout(() => {
                if (this.modalContainer.contains(this.modalElement)) {
                    this.modalContainer.innerHTML = '';
                }
            }, 300);
        }
        this.onConfirm = null;
        this.onCancel = null;
    }

    _addEventListeners() {
        const confirmBtn = this.modalElement.querySelector('#confirm-eula-btn');
        const cancelBtn = this.modalElement.querySelector('#cancel-eula-btn');
        const closeModalBtns = this.modalElement.querySelectorAll('[data-action="close-modal"]');

        confirmBtn.addEventListener('click', () => {
            if (this.onConfirm) {
                this.onConfirm();
            }
            this.close();
        });

        cancelBtn.addEventListener('click', () => {
            if (this.onCancel) {
                this.onCancel();
            }
            this.close();
        });

        closeModalBtns.forEach(btn => btn.addEventListener('click', () => this.close()));
    }

    _createHtml(eulaContent) {
        return `
        <div id="eula-modal-component" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl transform transition-all duration-300 scale-100">
                <div class="flex justify-between items-center border-b dark:border-gray-700 pb-3 mb-4">
                    <h3 class="text-xl leading-6 font-bold text-gray-900 dark:text-white flex items-center">
                        <i data-lucide="file-text" class="w-5 h-5 mr-2 text-yellow-500"></i>
                        Minecraft EULAへの同意が必要です
                    </h3>
                    <button data-action="close-modal" class="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                
                <div class="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    <p>Minecraftサーバーを初めて起動するには、Mojang Studiosの<a href="https://account.mojang.com/documents/minecraft_eula"
                            target="_blank" class="text-primary hover:underline">エンドユーザーライセンス契約(EULA)</a>に同意する必要があります。</p>
                    <p class="mt-4">以下の内容を確認し、同意する場合は「同意してサーバーを起動」ボタンを押してください。</p>
                </div>
                <div
                    class="mt-4 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md p-4 max-h-60 overflow-y-auto">
                    <pre class="text-xs whitespace-pre-wrap font-mono">${eulaContent || 'EULAのテキストを読み込み中です...'}</pre>
                </div>
                <div class="mt-6 flex justify-end gap-4">
                    <button id="cancel-eula-btn" type="button"
                        class="px-4 py-2 rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 font-bold transition-colors duration-300">キャンセル</button>
                    <button id="confirm-eula-btn" type="button"
                        class="px-4 py-2 rounded-lg text-white bg-primary hover:bg-indigo-700 font-bold transition-colors duration-300 flex items-center gap-2">
                        <i data-lucide="check" class="w-4 h-4"></i>
                        同意してサーバーを起動
                    </button>
                </div>
            </div>
        </div>
        `;
    }
}