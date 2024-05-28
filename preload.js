const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
    'electronAPI', {
        onUpdateView: (callback) => {
            ipcRenderer.on('update-view', (event, data) => callback(data));
        },
        onInitializeView: (callback) => {
            ipcRenderer.on('initialize-view', (event, data) => callback(data));
        },
        onInitializeOpenAtLogin: (callback) => {
            ipcRenderer.on('initialize-open-at-login', (event, data) => callback(data));
        },
        onRemoteAccessGranted: (callback) => {
            ipcRenderer.on('remote-access-granted', (event, data) => callback(data));
        },
        onRemoteAccessFinished: (callback) => {
            ipcRenderer.on('remote-access-finished', (event, data) => callback(data));
        },
        onConnectionLost: (callback) => {
            ipcRenderer.on('connection-lost', (event, data) => callback(data));
        },
        readJsonFile: (filePath) => ipcRenderer.invoke('read-json-file', filePath),
        deleteJsonFileContent: (filePath) => ipcRenderer.invoke('delete-json-file-content', filePath),
        checkIfTankIdAndIpAddressExist: (data) => ipcRenderer.invoke('check-if-tank-id-and-ip-address-exist', data),
        createNewTank: (data) => ipcRenderer.invoke('create-new-tank', data),
        updateATank: (data) => ipcRenderer.invoke('update-a-tank', data),
        deleteATank: (data) => ipcRenderer.invoke('delete-a-tank', data),
        updateOpenAtLogin: (data) => ipcRenderer.invoke('update-open-at-login', data),
        requestAccessToTank: (data) => ipcRenderer.invoke('request-access-to-tank', data),
        closeCurrentConnectionToTank: (data) => ipcRenderer.invoke('close-current-connection', data),
        reinitializeRemoteAccessState: (data) => ipcRenderer.invoke('reinitialize-remote-access-state', data),
        stopButtonClicked: (data) => ipcRenderer.invoke('stop-button-clicked', data),
        coldButtonClicked: (data) => ipcRenderer.invoke('cold-button-clicked', data),
        agitationButtonClicked: (data) => ipcRenderer.invoke('agitation-button-clicked', data),
        washingButtonClicked: (data) => ipcRenderer.invoke('washing-button-clicked', data),
        getTemperature: (data) => ipcRenderer.invoke('get-temperature', data),
        getMode: (data) => ipcRenderer.invoke('get-mode', data),
    }
);
