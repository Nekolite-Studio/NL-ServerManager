// manager/src/ui/components/propertiesEditor.js

// server.properties 入力フィールド生成（メタデータ駆動）
export const createPropertyInput = (prop, currentValue) => {
    const { key, type, description, 'default': defaultValue, 'enum': enumValues, min, max, step } = prop;

    const container = document.createElement('div');
    // 新レイアウト: グリッドで要素を配置
    container.className = 'grid grid-cols-[auto_minmax(0,_1fr)_minmax(0,_1.5fr)_auto] items-center gap-x-4 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0';

    // 1. ヘルプアイコンとポップアップ
    const helpContainer = document.createElement('div');
    helpContainer.className = 'relative flex items-center justify-center';
    helpContainer.innerHTML = `
        <button data-action="show-help" data-key="${key}" class="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </button>
        <div id="help-popup-${key}" class="absolute bottom-full left-0 mb-2 w-72 bg-gray-800 text-white text-sm rounded py-2 px-3 transition-opacity duration-300 pointer-events-none z-20 hidden">
            <p class="font-semibold">${key}</p>
            <p class="mt-1 text-xs text-gray-300">${description}</p>
            <div class="font-mono text-gray-400 text-xs mt-2">Default: ${defaultValue}</div>
        </div>
    `;
    container.appendChild(helpContainer);


    // 2. 設定タイトル
    const label = document.createElement('label');
    label.htmlFor = key;
    label.className = 'text-sm font-medium text-gray-800 dark:text-gray-200 truncate';
    label.textContent = key;
    container.appendChild(label);
    
    // 3. 入力要素
    const inputContainer = document.createElement('div');
    let inputElement;
    const baseInputClasses = "w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary";

    switch (type) {
        case 'boolean':
            // On/Offのラジオボタンに変更
            inputElement = document.createElement('div');
            inputElement.className = 'flex items-center gap-x-4';
            const idOn = `${key}-on`;
            const idOff = `${key}-off`;
            const checkedOn = currentValue === true ? 'checked' : '';
            const checkedOff = currentValue === false ? 'checked' : '';
            inputElement.innerHTML = `
                <div class="flex items-center">
                    <input id="${idOn}" name="${key}" type="radio" data-key="${key}" value="true" ${checkedOn} class="h-4 w-4 border-gray-300 text-primary focus:ring-primary property-input-radio">
                    <label for="${idOn}" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">On</label>
                </div>
                <div class="flex items-center">
                    <input id="${idOff}" name="${key}" type="radio" data-key="${key}" value="false" ${checkedOff} class="h-4 w-4 border-gray-300 text-primary focus:ring-primary property-input-radio">
                    <label for="${idOff}" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">Off</label>
                </div>
            `;
            break;
        case 'enum':
            inputElement = document.createElement('select');
            inputElement.id = key;
            inputElement.dataset.key = key;
            inputElement.className = `${baseInputClasses} property-input`;
            (enumValues || []).forEach(o => {
                const option = document.createElement('option');
                option.value = o;
                option.textContent = o;
                if (currentValue === o) {
                    option.selected = true;
                }
                inputElement.appendChild(option);
            });
            break;
        case 'number':
            inputElement = document.createElement('input');
            inputElement.type = 'number';
            inputElement.id = key;
            inputElement.dataset.key = key;
            inputElement.value = currentValue;
            inputElement.className = `${baseInputClasses} property-input`;
            if (min !== undefined) inputElement.min = min;
            if (max !== undefined) inputElement.max = max;
            if (step !== undefined) inputElement.step = step;
            break;
        case 'string':
        default:
            inputElement = document.createElement('input');
            inputElement.type = key.includes('password') ? 'password' : 'text';
            inputElement.id = key;
            inputElement.dataset.key = key;
            inputElement.value = currentValue;
            inputElement.className = `${baseInputClasses} property-input`;
            break;
    }
    inputContainer.appendChild(inputElement);
    container.appendChild(inputContainer);

    // 4. リセットボタン
    const resetContainer = document.createElement('div');
    resetContainer.className = 'flex items-center justify-end';
    const resetButton = document.createElement('button');
    resetButton.dataset.action = 'confirm-reset-property';
    resetButton.dataset.key = key;
    resetButton.className = 'p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400';
    resetButton.title = 'デフォルト値に戻す';
    resetButton.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3"></path></svg>`;
    resetContainer.appendChild(resetButton);
    container.appendChild(resetContainer);
    
    return container;
};


// server.properties エディタレンダリング
export const renderPropertiesEditor = async (server) => {
    const properties = server.properties || {};
    const annotations = await window.electronAPI.getServerPropertiesAnnotations();

    // アノテーションをグループごとに動的に分類
    const groupedAnnotations = Object.values(annotations).reduce((acc, annotation) => {
        const groupName = annotation.group || 'その他';
        if (!acc[groupName]) {
            acc[groupName] = [];
        }
        acc[groupName].push(annotation);
        return acc;
    }, {});

    const editorContainer = document.createElement('div');
    editorContainer.id = 'properties-editor';
    editorContainer.className = 'space-y-4 custom-scrollbar pr-2';

    // 定義済みの順序、なければアルファベット順
    const groupOrder = ['ワールド設定', 'プレイヤー設定', 'MOB・NPC設定', 'サーバー技術設定', 'Query & RCON', 'その他'];
    const sortedGroupNames = Object.keys(groupedAnnotations).sort((a, b) => {
        const indexA = groupOrder.indexOf(a);
        const indexB = groupOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    for (const groupName of sortedGroupNames) {
        const groupAnnotations = groupedAnnotations[groupName];
        
        const details = document.createElement('details');
        details.className = 'group bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 open:ring-2 open:ring-primary/50 dark:open:ring-primary/70 transition-all';
        details.open = true;

        const summary = document.createElement('summary');
        summary.className = 'text-lg font-bold text-gray-800 dark:text-white p-4 cursor-pointer flex items-center justify-between list-none';
        summary.innerHTML = `
            <span>${groupName}</span>
            <svg class="w-6 h-6 text-gray-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        `;
        details.appendChild(summary);

        const itemsContainer = document.createElement('div');
        // レスポンシブグリッドレイアウト
        itemsContainer.className = 'px-4 pb-4 grid grid-cols-1 xl:grid-cols-2 gap-x-6';
        
        groupAnnotations.forEach(annotation => {
            const { key } = annotation;
            // サーバーに値がなければ、アノテーションのデフォルト値を使用
            const currentValue = properties[key] !== undefined ? properties[key] : annotation.default;
            const inputElement = createPropertyInput(annotation, currentValue);
            itemsContainer.appendChild(inputElement);
        });

        if (itemsContainer.hasChildNodes()) {
            details.appendChild(itemsContainer);
            editorContainer.appendChild(details);
        }
    }
    return editorContainer;
};