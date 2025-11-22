// manager/src/ui/components/modal.js

export const showConfirmationModal = (message, onConfirm) => {
    // 既存のモーダルがあれば削除
    const existingModal = document.getElementById('confirmation-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'confirmation-modal';
    modal.className = 'fixed inset-0 bg-gray-900 bg-opacity-50 dark:bg-opacity-80 flex justify-center items-center z-50 transition-opacity duration-300';
    
    // フェードインのために少し遅延させる
    setTimeout(() => modal.classList.add('opacity-100'), 10);

    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-md transform transition-all duration-300 scale-95">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">確認</h3>
            <p class="text-gray-600 dark:text-gray-300 mt-4">${message}</p>
            <div class="mt-8 flex justify-end gap-4">
                <button id="confirm-cancel-btn" class="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 font-semibold">いいえ</button>
                <button id="confirm-ok-btn" class="px-6 py-2 bg-primary text-white rounded-md hover:bg-indigo-700 font-semibold">はい</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    
    const content = modal.querySelector('div > div');
    setTimeout(() => content.classList.add('scale-100'), 10);


    const closeModal = () => {
        modal.classList.remove('opacity-100');
        content.classList.remove('scale-100');
        setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('#confirm-ok-btn').addEventListener('click', () => {
        if(onConfirm) onConfirm();
        closeModal();
    });
    modal.querySelector('#confirm-cancel-btn').addEventListener('click', closeModal);
    // 背景クリックで閉じる
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'confirmation-modal') {
            closeModal();
        }
    });
};

// 互換性のためにグローバルにも代入
window.showConfirmationModal = showConfirmationModal;