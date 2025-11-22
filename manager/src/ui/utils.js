// manager/src/ui/utils.js

export const getStatusClasses = (status) => {
    switch (status) {
        case 'running':
            return { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-500/20' };
        case 'starting':
        case 'stopping':
            return { text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-500/20' };
        case 'stopped':
        default:
            return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/20' };
    }
};

export const getAgentStatusClasses = (status) => {
    switch (status) {
        case 'Connected':
            return { text: 'text-green-800 dark:text-green-200', bg: 'bg-green-100 dark:bg-green-900', dot: 'bg-green-500' };
        case 'Connecting...':
            return { text: 'text-yellow-800 dark:text-yellow-200', bg: 'bg-yellow-100 dark:bg-yellow-900', dot: 'bg-yellow-500 animate-pulse' };
        case 'Disconnected':
        default:
            return { text: 'text-red-800 dark:text-red-200', bg: 'bg-red-100 dark:bg-red-900', dot: 'bg-red-500' };
    }
};

export const getTpsColor = (tps) => tps >= 19 ? 'text-green-500' : tps >= 15 ? 'text-yellow-500' : 'text-red-500';
export const getCpuColor = (cpu) => cpu >= 80 ? 'text-red-500' : cpu >= 50 ? 'text-yellow-500' : 'text-green-500';
export const getMemoryColor = (mem, max) => (mem/max) >= 0.8 ? 'text-red-500' : (mem/max) >= 0.5 ? 'text-yellow-500' : 'text-green-500';