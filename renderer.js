// renderer.js
function getMode(state) {
    switch(state) {
        case 0:
            return 'Stand by';
        case 1:
            return 'Froid';
        case 2:
            return 'Lavage';
        case 3:
            return 'Agitation';
        default:
            return 'Inconnu';
    }
}

function getIcon(state) {
    switch(state) {
        case 0:
            return 'fa-solid fa-power-off';
        case 1:
            return 'fa-solid fa-snowflake';
        case 2:
            return 'fa-solid fa-shower';
        case 3:
            return 'fa-solid fa-wave-square';
        default:
            return 'fa-solid fa-question';
    }
}

document.addEventListener('DOMContentLoaded', (event) => {
    /**
     * Sets up an event listener for 'onInitializeView', which is triggered to update the UI with tank information.
     * Depending on the presence or absence of tank data, it either populates the tank info container with relevant
     * tank details or displays a message indicating no tanks are available. This function also handles dynamic
     * creation of modals for tank settings and the setup of event listeners for tank-specific interactions.
     *
     * @param {Array|Object} data - Data containing tank information, which could be an array of tank objects or null.
     *
     * Operations:
     * - Check if any tank data exists:
     *   1. If no data is provided, or the array is empty, check if a no-tank message is already displayed.
     *      If not, create and display a message indicating no tanks have been added.
     *   2. If data exists, ensure any no-tank message is removed, then iterate over each tank object to create
     *      and display detailed information for each tank including status indicators, temperature, fill rate, and more.
     * - Dynamically create interactive elements for each tank such as settings buttons, which trigger modals for
     *   further actions like updating or deleting tank data.
     * - Set up event listeners for these interactive elements to handle clicks, which involve tasks like opening modals,
     *   updating tank settings, or initiating tank deletion.
     *
     * Detailed UI Components Created:
     * - For each tank, generate a detailed row containing:
     *   - Tank ID and name
     *   - State indicators with icons
     *   - Temperature and fill rate displays
     *   - Action buttons for viewing history, remote access, and opening settings modals
     * - For each tank, also create a modal for settings that allows users to modify tank details or delete the tank.
     *
     * Error Handling:
     * - Handle JSON data parsing errors or any other exceptions by logging them to the console.
     *
     * Note:
     * - This function is crucial for providing interactive and up-to-date tank information to the user.
     * - It assumes the incoming data is well-formed and contains all necessary details for each tank.
     * - The settings modal and other interactive elements require specific IDs and class names to function correctly,
     *   relying on consistent HTML structure and CSS for proper styling and behavior.
     */
    window.electronAPI.onInitializeView((data) => {
        const tankInfosContainer = document.getElementById('tank-infos-container');
        
        const noTankDisplay = tankInfosContainer.querySelector('.no-tank-to-display');
        if(data === null || data.length === 0) {
            if(!noTankDisplay || noTankDisplay === null){
                // Ajoute le message s'il n'est pas déjà là
                const noTankMessage = document.createElement('div');
                noTankMessage.className = 'no-tank-to-display';
                noTankMessage.innerHTML = `Aucune cuve n'a encore été ajoutée.<br>Pour ajouter une cuve, cliquez sur le bouton "+" à droite.`;
                tankInfosContainer.appendChild(noTankMessage);
            }
            return;    
        }

        if(noTankDisplay || noTankDisplay !== null) {
            noTankDisplay.remove();
        } 
        
        data.forEach((tankObj) => {
            const tankId = Object.keys(tankObj)[0];
            const tankData = tankObj[tankId];

            // CONTAINER FOR TANK ITEM
            const tankItem = document.createElement('div');
            tankItem.id = `tank-${tankId}`;
            tankItem.className = 'box tank-item-row';

            // TANK NAME
            const tankName = document.createElement('div');
            tankName.id = `tank-name-${tankId}`;
            tankName.className = 'box-title';
            tankName.innerText = `${tankId}`;

            // TANK INFOS
            const tankDetails = document.createElement('div');
            tankDetails.id = `tank-details-${tankId}`;
            tankDetails.className = 'tank-details';

            // TANK STATE
            const tankState = document.createElement('div');
            tankState.id = `tank-state-${tankId}`;
            tankState.className = 'tank-state';
            
            const tankStateIconText = document.createElement('span');
            tankStateIconText.id = `tank-state-icon-text-${tankId}`;
            tankStateIconText.className = 'icon-text';

            const tankStateIconSpan = document.createElement('span');
            tankStateIconSpan.id = `tank-state-icon-span-${tankId}`;
            tankStateIconSpan.className = 'icon';

            const tankStateIcon = document.createElement('i');
            tankStateIcon.id = `tank-state-icon-${tankId}`;
            tankStateIcon.className = 'fa-solid fa-power-off';

            const tankStateText = document.createElement('span');
            tankStateText.id = `tank-state-text-${tankId}`;
            tankStateText.className = 'tank-infos';
            tankStateText.innerText = 'Non connecté';

            tankStateIconSpan.appendChild(tankStateIcon);
            tankStateIconText.appendChild(tankStateIconSpan);
            tankStateIconText.appendChild(tankStateText);
            tankState.appendChild(tankStateIconText);

            // TANK TEMPERATURE
            const tankTemperature = document.createElement('div');
            tankTemperature.id = `temperature-${tankId}`;
            tankTemperature.className = 'temperature';
            
            const tankTemperatureIconText = document.createElement('span');
            tankTemperatureIconText.id = `tank-temperature-icon-text-${tankId}`;
            tankTemperatureIconText.className = 'icon-text';

            const tankTemperatureIconSpan = document.createElement('span');
            tankTemperatureIconSpan.id = `tank-temperature-icon-span-${tankId}`;
            tankTemperatureIconSpan.className = 'icon';

            const tankTemperatureIcon = document.createElement('i');
            tankTemperatureIcon.id = `tank-temperature-icon-${tankId}`;
            tankTemperatureIcon.className = 'fa-solid fa-temperature-half';

            const tankTemperatureText = document.createElement('span');
            tankTemperatureText.id = `tank-temperature-text-${tankId}`;
            tankTemperatureText.className = 'tank-infos';
            tankTemperatureText.innerText = '???°C';

            tankTemperatureIconSpan.appendChild(tankTemperatureIcon);
            tankTemperatureIconText.appendChild(tankTemperatureIconSpan);
            tankTemperatureIconText.appendChild(tankTemperatureText);
            tankTemperature.appendChild(tankTemperatureIconText);

            // TANK FILL RATE
            const tankFillRate = document.createElement('div');
            tankFillRate.id = `tank-fill-rate-${tankId}`;
            tankFillRate.className = 'fill-rate';
            
            const tankFillRateIconText = document.createElement('span');
            tankFillRateIconText.id = `tank-fill-rate-icon-text-${tankId}`;
            tankFillRateIconText.className = 'icon-text';

            const tankFillRateIconSpan = document.createElement('span');
            tankFillRateIconSpan.id = `tank-fill-rate-icon-span-${tankId}`;
            tankFillRateIconSpan.className = 'icon';

            const tankFillRateIcon = document.createElement('i');
            tankFillRateIcon.id = `tank-fill-rate-icon-${tankId}`;
            tankFillRateIcon.className = 'fa-solid fa-fill';

            const tankFillRateText = document.createElement('span');
            tankFillRateText.id = `tank-fill-rate-text-${tankId}`;
            tankFillRateText.className = 'tank-infos';
            tankFillRateText.innerText = '???%';

            tankFillRateIconSpan.appendChild(tankFillRateIcon);
            tankFillRateIconText.appendChild(tankFillRateIconSpan);
            tankFillRateIconText.appendChild(tankFillRateText);
            tankFillRate.appendChild(tankFillRateIconText);

            // TANK ALARMS
            const tankAlarms = document.createElement('div');
            tankAlarms.id = `alarms-${tankId}`;
            tankAlarms.className = 'tank-alarms';

            const tankAlarmsIconText = document.createElement('span');
            tankAlarmsIconText.id = `tank-alarms-icon-text-${tankId}`;
            tankAlarmsIconText.className = 'icon-text';

            const tankAlarmsIconSpan = document.createElement('span');
            tankAlarmsIconSpan.id = `tank-alarms-icon-span-${tankId}`;
            tankAlarmsIconSpan.className = 'icon';

            const tankAlarmsIcon = document.createElement('i');
            tankAlarmsIcon.id = `tank-alarms-icon-${tankId}`;
            tankAlarmsIcon.className = 'fa-solid fa-circle-xmark';

            const tankAlarmsText = document.createElement('span');
            tankAlarmsText.id = `tank-alarms-text-${tankId}`;
            tankAlarmsText.className = 'tank-infos';
            tankAlarmsText.innerText = '???';

            tankAlarmsIconSpan.appendChild(tankAlarmsIcon);
            tankAlarmsIconText.appendChild(tankAlarmsIconSpan);
            tankAlarmsIconText.appendChild(tankAlarmsText);
            tankAlarms.appendChild(tankAlarmsIconText);

            // TANK ACTIONS

            // TANK HISTORY BUTTON
            const tankHistoryAnchor = document.createElement('a');
            tankHistoryAnchor.id = `tank-history-anchor-${tankId}`;
            tankHistoryAnchor.href = `history.html`;
            tankHistoryAnchor.className = 'tank-history';

            tankHistoryAnchor.addEventListener('click', (event) => {
                localStorage.setItem('tankId', tankId);
            });

            const tankHistoryButton = document.createElement('div');
            tankHistoryButton.id = `tank-history-button-${tankId}`;

            const tankHistoryButtonIcon = document.createElement('i');
            tankHistoryButtonIcon.id = `tank-history-button-icon-${tankId}`;
            tankHistoryButtonIcon.className = 'fa-solid fa-clock-rotate-left';

            tankHistoryButton.appendChild(tankHistoryButtonIcon);
            tankHistoryAnchor.appendChild(tankHistoryButton);

            // TANK REMOTE ACCESS BUTTON
            const tankRemoteAccessAnchor = document.createElement('a');
            tankRemoteAccessAnchor.id = `tank-remote-access-anchor-${tankId}`;
            tankRemoteAccessAnchor.href = `remote.html`;
            tankRemoteAccessAnchor.className = 'tank-remote-access';

            tankRemoteAccessAnchor.addEventListener('click', (event) => {
                localStorage.setItem('tankId', tankId);

            });

            const tankRemoteAccessButton = document.createElement('div');
            tankRemoteAccessButton.id = `tank-remote-access-button-${tankId}`;

            const tankRemoteAccessButtonIcon = document.createElement('i');
            tankRemoteAccessButtonIcon.id = `tank-remote-access-button-icon-${tankId}`;
            tankRemoteAccessButtonIcon.className = 'fa-solid fa-wifi';

            tankRemoteAccessButton.appendChild(tankRemoteAccessButtonIcon);
            tankRemoteAccessAnchor.appendChild(tankRemoteAccessButton);

            // TANK SETTINGS BUTTON
            const tankSettingsModalButton = document.createElement('button');
            tankSettingsModalButton.id = `tank-settings-modal-button-${tankId}`;
            tankSettingsModalButton.className = 'settings-modal-trigger';

            const tankSettingsButton = document.createElement('div');
            tankSettingsButton.id = `tank-settings-button-${tankId}`;
            tankSettingsButton.className = 'tank-settings';

            const tankSettingsButtonIcon = document.createElement('i');
            tankSettingsButtonIcon.id = `tank-settings-button-icon-${tankId}`;
            tankSettingsButtonIcon.className = 'fa-solid fa-gear';

            tankSettingsButton.appendChild(tankSettingsButtonIcon);
            tankSettingsModalButton.appendChild(tankSettingsButton);

            // APPEND CHILDREN TO TANK INFOS CONTAINER
            tankDetails.appendChild(tankState);
            tankDetails.appendChild(tankTemperature);
            tankDetails.appendChild(tankFillRate);
            tankDetails.appendChild(tankAlarms);
            tankDetails.appendChild(tankHistoryAnchor);
            tankDetails.appendChild(tankRemoteAccessAnchor);
            tankDetails.appendChild(tankSettingsModalButton);
            
            tankItem.appendChild(tankName);
            tankItem.appendChild(tankDetails);

            tankInfosContainer.appendChild(tankItem);

            // SETTINGS MODAL
            const settingsModal = document.createElement('div');
            settingsModal.id = `settings-modal-${tankId}`;
            settingsModal.className = 'modal';

            const settingsModalBackground = document.createElement('div');
            settingsModalBackground.className = 'modal-background';

            const settingsModalCard = document.createElement('div');
            settingsModalCard.className = 'modal-card';

            // HEAD //
            const settingsModalCardHead = document.createElement('header');
            settingsModalCardHead.className = 'modal-card-head';

            const settingsModalCardHeadTitle = document.createElement('div');
            settingsModalCardHeadTitle.className = 'box-title';
            settingsModalCardHeadTitle.innerHTML = `Paramètres de la cuve ${tankId}`;

            settingsModalCardHead.appendChild(settingsModalCardHeadTitle);

            // BODY //
            const settingsModalCardBody = document.createElement('section');
            settingsModalCardBody.className = 'modal-card-body';

            const settingsModalTankNameDiv = document.createElement('div');
            settingsModalTankNameDiv.className = 'field';

            const settingsModalTankNameLabel = document.createElement('label');
            settingsModalTankNameLabel.className = 'label form-label';
            settingsModalTankNameLabel.innerText = 'Nom de la cuve';

            const settingsModalTankNameControl = document.createElement('div');
            settingsModalTankNameControl.className = 'control';

            const settingsModalTankNameInput = document.createElement('input');
            settingsModalTankNameInput.id = `tank-name-settings-${tankId}`;
            settingsModalTankNameInput.className = 'input font-for-input';
            settingsModalTankNameInput.type = 'text';
            settingsModalTankNameInput.placeholder = 'Nom de la cuve';
            settingsModalTankNameInput.value = tankId;

            settingsModalTankNameControl.appendChild(settingsModalTankNameInput);
            settingsModalTankNameDiv.appendChild(settingsModalTankNameLabel);
            settingsModalTankNameDiv.appendChild(settingsModalTankNameControl);

            const settingsModalIpAddressDiv = document.createElement('div');
            settingsModalIpAddressDiv.className = 'field';

            const settingsModalIpAddressLabel = document.createElement('label');
            settingsModalIpAddressLabel.className = 'label form-label';
            settingsModalIpAddressLabel.innerText = 'Adresse IP de votre appareil';

            const settingsModalIpAddressControl = document.createElement('div');
            settingsModalIpAddressControl.className = 'control';

            const settingsModalIpAddressInput = document.createElement('input');
            settingsModalIpAddressInput.id = `ip-addr-settings-${tankId}`;
            settingsModalIpAddressInput.className = 'input font-for-input';
            settingsModalIpAddressInput.type = 'text';
            settingsModalIpAddressInput.value = tankData.ipAddr;
            settingsModalIpAddressInput.maxLength = 17;

            settingsModalIpAddressControl.appendChild(settingsModalIpAddressInput);
            settingsModalIpAddressDiv.appendChild(settingsModalIpAddressLabel);
            settingsModalIpAddressDiv.appendChild(settingsModalIpAddressControl);

            const settingsModalSynchroDiv = document.createElement('div');
            settingsModalSynchroDiv.className = 'field';

            const settingsModalSynchroLabel = document.createElement('label');
            settingsModalSynchroLabel.className = 'label form-label';
            settingsModalSynchroLabel.innerText = 'Synchronisation (en s)';

            const settingsModalSynchroControl = document.createElement('div');
            settingsModalSynchroControl.className = 'control';

            const settingsModalSynchroInput = document.createElement('input');
            settingsModalSynchroInput.id = `synchro-settings-${tankId}`;
            settingsModalSynchroInput.className = 'input font-for-input';
            settingsModalSynchroInput.type = 'number';
            settingsModalSynchroInput.value = tankData.synchro;

            settingsModalSynchroControl.appendChild(settingsModalSynchroInput);
            settingsModalSynchroDiv.appendChild(settingsModalSynchroLabel);
            settingsModalSynchroDiv.appendChild(settingsModalSynchroControl);
            
            settingsModalCardBody.appendChild(settingsModalTankNameDiv);
            settingsModalCardBody.appendChild(settingsModalIpAddressDiv);
            settingsModalCardBody.appendChild(settingsModalSynchroDiv);

            // FOOTER //
            const settingsModalCardFoot = document.createElement('footer');
            settingsModalCardFoot.className = 'modal-card-foot is-flex is-align-items-center is-justify-content-space-between';

            const settingsModalButtons = document.createElement('div');
            settingsModalButtons.className = 'button-group';

            const settingsModalLeftButtons = document.createElement('div');

            const settingsModalSaveButton = document.createElement('button');
            settingsModalSaveButton.id = `update-existing-tank-${tankId}`;
            settingsModalSaveButton.className = 'button is-success blue-for-button space-between-buttons';
            settingsModalSaveButton.innerText = 'Modifier';

            const settingsModalCancelButton = document.createElement('button');
            settingsModalCancelButton.id = `cancel-update-existing-tank-${tankId}`;
            settingsModalCancelButton.className = 'button button-close';
            settingsModalCancelButton.innerText = 'Annuler';

            const settingsModalDeleteButton = document.createElement('button');
            settingsModalDeleteButton.id = `delete-existing-tank-${tankId}`;
            settingsModalDeleteButton.className = 'button red-for-button';
            settingsModalDeleteButton.innerText = `Supprimer la cuve ${tankId}`;

            settingsModalLeftButtons.appendChild(settingsModalSaveButton);
            settingsModalLeftButtons.appendChild(settingsModalCancelButton);

            settingsModalButtons.appendChild(settingsModalLeftButtons);
            settingsModalButtons.appendChild(settingsModalDeleteButton);

            settingsModalCardFoot.appendChild(settingsModalButtons);

            // APPENDING TO SETTINGS MODAL //
            settingsModalCard.appendChild(settingsModalCardHead);
            settingsModalCard.appendChild(settingsModalCardBody);
            settingsModalCard.appendChild(settingsModalCardFoot);

            settingsModal.appendChild(settingsModalBackground);
            settingsModal.appendChild(settingsModalCard);

            tankInfosContainer.appendChild(settingsModal);

            // Add a click event on buttons to open a specific modal
            (document.querySelectorAll(`#tank-settings-modal-button-${tankId}`) || []).forEach(($trigger) => {
                $trigger.addEventListener('click', () => {
                    const modal = document.getElementById(`settings-modal-${tankId}`);
                    openModal(modal);
                });
            });

            // Add a click event on various child elements to close the parent modal
            (document.querySelectorAll(`#settings-modal-${tankId} .modal-background, #settings-modal-${tankId} .button-close`) || []).forEach(($close) => {
                const $target = $close.closest('.modal');

                $close.addEventListener('click', () => {
                    closeModal($target);
                });
            });

            const updateExistingTankButton = document.getElementById(`update-existing-tank-${tankId}`);
            updateExistingTankButton.addEventListener('click', () => {
                const tankNameInput = document.getElementById(`tank-name-settings-${tankId}`);
                const ipAddrInput = document.getElementById(`ip-addr-settings-${tankId}`);
                const synchroInput = document.getElementById(`synchro-settings-${tankId}`);

                const tankData = {
                    tankId: tankId,
                    newTankId: tankNameInput.value,
                    ipAddr: ipAddrInput.value,
                    synchro: synchroInput.value
                };

                if(tankData.newTankId.length === 0 || tankData.ipAddr.length === 0 || tankData.synchro.length === 0) {
                    alert('Veuillez remplir tous les champs.');
                    return;
                }

                const tankNameToDisplay = document.getElementById(`tank-name-${tankId}`);
                tankNameToDisplay.innerText = tankData.newTankId;

                window.electronAPI.updateATank(tankData);
                closeModal(document.getElementById(`settings-modal-${tankId}`));
            });

            const deleteExistingTankButton = document.getElementById(`delete-existing-tank-${tankId}`);
            deleteExistingTankButton.addEventListener('click', () => {
                const confirmation = confirm(`Êtes-vous sûr de vouloir supprimer la cuve ${tankId} ?`);
                if(confirmation) {
                    window.electronAPI.deleteATank(tankId);
                    document.getElementById(`tank-${tankId}`).remove();
                    closeModal(document.getElementById(`settings-modal-${tankId}`));
                }
            });
        });
    });

    function openModal($el) {
        $el.classList.add('is-active');
    }

    function closeModal($el) {
        $el.classList.remove('is-active');
    }

    window.electronAPI.onUpdateView((data) => {
        const tankId = data.tankId;
        const dataToDisplay = data.data;
        const tankStateText = document.getElementById(`tank-state-text-${tankId}`);
        const tankTemperatureText = document.getElementById(`tank-temperature-text-${tankId}`);
        const tankFillRateText = document.getElementById(`tank-fill-rate-text-${tankId}`);
        const tankAlarmsText = document.getElementById(`tank-alarms-text-${tankId}`);
        const tankStateIcon = document.getElementById(`tank-state-icon-${tankId}`);

        tankStateText.innerText = getMode(dataToDisplay.Mode);
        tankStateIcon.className = getIcon(dataToDisplay.Mode);
        tankTemperatureText.innerText = dataToDisplay.Temperature;
        tankFillRateText.innerText = dataToDisplay.Taux;
        tankAlarmsText.innerText = dataToDisplay.Defauts;
    });

    window.electronAPI.onInitializeOpenAtLogin((data) => {
        const openAtLoginCheckbox = document.getElementById('open-at-startup');
        openAtLoginCheckbox.checked = data;
    });

    window.electronAPI.onConnectionLost((tankId) => {
        const tankStateText = document.getElementById(`tank-state-text-${tankId}`);
        const tankStateIcon = document.getElementById(`tank-state-icon-${tankId}`);
        const tankTemperatureText = document.getElementById(`tank-temperature-text-${tankId}`);
        const tankFillRateText = document.getElementById(`tank-fill-rate-text-${tankId}`);
        const tankAlarmsText = document.getElementById(`tank-alarms-text-${tankId}`);

        tankStateText.innerText = 'Déconnecté';
        tankStateIcon.className = 'fa-solid fa-power-off';
        tankTemperatureText.innerText = '???°C';
        tankFillRateText.innerText = '???%';
        tankAlarmsText.innerText = '???';
    });
});
