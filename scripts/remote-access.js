function getModeInFullLetters(state) {
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

document.addEventListener('DOMContentLoaded', async (event) => {
    const tankId = localStorage.getItem('tankId');
    const buttonSpan = document.getElementById('button-text-span');
    const intervals = [];

    const remoteAccessContainer = document.getElementById('remote-access-container');
    const homeButton = document.getElementById('remote-access-home-button');

    if(tankId) {
        if(buttonSpan){
            buttonSpan.innerHTML = "Demander l'accès à la cuve " + tankId;
        }

        const requestAccessButton = document.getElementById('remote-access-request-btn');
        requestAccessButton.addEventListener('click', async () => {
            if(confirm('Voulez-vous vraiment demander l\'accès à cette cuve ?')) {
                const response = await window.electronAPI.requestAccessToTank(tankId);
                if(response) {
                    remoteAccessContainer.innerHTML = "";
                    
                    const titleDiv = document.createElement('div');
                    titleDiv.className = 'box-title';
                    titleDiv.innerHTML = "Demande d'accès envoyée, en attente de l'acceptation...";

                    remoteAccessContainer.appendChild(titleDiv);
                }
            }
        });

        homeButton.addEventListener('click', async () => {
            window.location.href = 'index.html';
            intervals.forEach(interval => clearInterval(interval));
            await window.electronAPI.closeCurrentConnectionToTank(tankId);
        });

        /**
         * Sets up an event listener for the 'onRemoteAccessFinished' event.
         * This event is triggered when remote access to a tank is terminated externally (e.g., from the RL40 device).
         * Upon receiving this event, the application will alert the user that the remote access connection has been terminated,
         * clear all active intervals to stop ongoing operations, navigate back to the index page, and reinitialize the remote access state.
         *
         * Operations:
         * 1. Display an alert to inform the user that the remote access connection has been terminated.
         * 2. Clear all active intervals. This step ensures that no lingering operations continue running, which could
         *    affect the performance or state of the application after remote access has ended.
         * 3. Navigate to 'index.html'. This redirects the user to the main or home page of the application, typically
         *    used to refresh the user interface or provide a starting point for further actions.
         * 4. Call 'reinitializeRemoteAccessState' to reset any remote access-related configurations or states within the
         *    application. This might include resetting variables, flags, or configurations that were set during the remote
         *    access session.
         *
         * Note:
         * - It is crucial to ensure that all necessary cleanup and state reinitialization are performed after remote access
         *   ends to prevent inconsistencies or issues in the application's subsequent operations.
         * - The function 'reinitializeRemoteAccessState' should be robust and handle various scenarios to ensure the application
         *   returns to a stable state ready for new operations or another remote access session.
         */
        window.electronAPI.onRemoteAccessFinished(async () => {
            alert("La connexion a été coupée depuis le RL40.")
            intervals.forEach(interval => clearInterval(interval));
            window.location.href = 'index.html';
            await window.electronAPI.reinitializeRemoteAccessState(tankId);
        });


        /**
         * Sets up an event listener for 'onRemoteAccessGranted', which triggers upon receiving confirmation
         * of remote access status for a tank. Depending on the access status, the UI is updated to either
         * allow interaction with the tank or prompt for access request.
         *
         * @param {boolean} data - Response from the main process indicating whether access is granted.
         * 
         * Operations:
         * - If access is granted (`data` is true):
         *   1. Display an alert notifying the user that access has been successfully granted.
         *   2. Clear the content of the remote access container to prepare for new UI elements.
         *   3. Create and append UI elements that allow the user to interact with the tank, including:
         *      - Buttons for stop, cold, agitation, and washing actions.
         *      - A mode display that updates every 700ms.
         *      - A temperature display that updates every 700ms.
         *      - A countdown timer that starts from 5 minutes and updates every second.
         *   4. Set up event listeners for each button to handle specific actions (e.g., stop, cold).
         *   5. Initiate intervals for updating mode and temperature, and a countdown timer for session duration.
         *      These intervals are stored for potential cleanup.
         *   6. Append all created elements to the remote access container.
         * - If access is denied (`data` is false):
         *   1. Alert the user that access has been denied.
         *   2. Clear the remote access container and display a button allowing the user to request access again.
         *   3. Set up an event listener on the button to handle re-requesting access upon user confirmation.
         *
         * Note:
         * - This function must handle various states and responses to ensure the UI accurately reflects the current
         *   access status and provides appropriate controls for user interaction.
         * - Proper error handling and cleanup are essential, especially for intervals and event listeners to prevent
         *   memory leaks and ensure application responsiveness.
         * - Dynamic UI updates based on asynchronous data require careful management of state and DOM elements to
         *   avoid inconsistencies or race conditions.
         */
        window.electronAPI.onRemoteAccessGranted((data) => {
            if(data) {
                alert('Accès à la cuve ' + tankId + ' accordé avec succès');
                remoteAccessContainer.innerHTML = "";

                const buttonContainerDiv = document.createElement('div');
                buttonContainerDiv.className = 'button-container';

                const stopButton = document.createElement('div');
                stopButton.className = 'widget-stop-button';

                const coldButton = document.createElement('div');
                coldButton.className = 'widget-cold-button';

                const agitationButton = document.createElement('div');
                agitationButton.className = 'widget-agitation-button';

                const washingButton = document.createElement('div');
                washingButton.className = 'widget-washing-button';

                const modeDiv = document.createElement('div');
                modeDiv.className = 'widget-mode';
                modeDiv.innerHTML = 'Mode : <span id="mode-span">???</span>';

                const modeInterval = setInterval(async () => {
                    const mode = await window.electronAPI.getMode(tankId);
                    document.getElementById('mode-span').innerHTML = getModeInFullLetters(mode);
                }, 700);

                const temperatureDiv = document.createElement('div');
                temperatureDiv.className = 'widget-temperature';
                temperatureDiv.innerHTML = 'Température : <span id="temperature-span">???°C</span>';
                
                const tempInterval = setInterval(async () => {
                    const temperature = await window.electronAPI.getTemperature(tankId);
                    document.getElementById('temperature-span').innerHTML = temperature.toFixed(2) + '°C';
                }, 700);

                intervals.push(modeInterval);
                intervals.push(tempInterval);

                const timerDiv = document.createElement('div');
                timerDiv.className = 'widget-timer';
                timerDiv.innerHTML = 'Temps restant : <span id="timer-span">???</span>';

                let timer = 5*60, minutes = 0, seconds = 0;
                const timerInterval = setInterval(() => {
                    minutes = parseInt(timer / 60, 10);
                    seconds = parseInt(timer % 60, 10);

                    minutes = minutes < 10 ? "0" + minutes : minutes;
                    seconds = seconds < 10 ? "0" + seconds : seconds;

                    document.getElementById('timer-span').innerHTML = minutes + ":" + seconds;

                    if (--timer < 0) {
                        timer = 5;
                        clearInterval(timerInterval);
                        alert("La durée de la session est terminée. Vous allez être redirigé vers la page d'accueil.");
                        homeButton.click();
                    }
                }, 1000);

                stopButton.addEventListener('click', async () => {
                    await window.electronAPI.stopButtonClicked(tankId);
                });

                coldButton.addEventListener('click', async () => {
                    await window.electronAPI.coldButtonClicked(tankId);
                });

                agitationButton.addEventListener('click', async () => {
                    await window.electronAPI.agitationButtonClicked(tankId);
                });

                washingButton.addEventListener('click', async () => {
                    await window.electronAPI.washingButtonClicked(tankId);
                });

                buttonContainerDiv.appendChild(stopButton);
                buttonContainerDiv.appendChild(coldButton);
                buttonContainerDiv.appendChild(agitationButton);
                buttonContainerDiv.appendChild(washingButton);

                remoteAccessContainer.appendChild(buttonContainerDiv);
                remoteAccessContainer.appendChild(modeDiv);
                remoteAccessContainer.appendChild(temperatureDiv);
                remoteAccessContainer.appendChild(timerDiv);
            } else {
                alert('Accès à la cuve ' + tankId + ' refusé');

                const button = document.createElement('button');
                button.className = 'button is-large is-fullwidth';
                button.id = 'remote-access-request-btn';

                button.addEventListener('click', async () => {
                    if(confirm('Voulez-vous vraiment demander l\'accès à cette cuve ?')) {
                        const response = await window.electronAPI.requestAccessToTank(tankId);
                        if(response) {
                            remoteAccessContainer.innerHTML = "";
                            
                            const titleDiv = document.createElement('div');
                            titleDiv.className = 'box-title';
                            titleDiv.innerHTML = "Demande d'accès envoyée, en attente de l'acceptation...";

                            remoteAccessContainer.appendChild(titleDiv);
                        }
                    }
                });

                const spanIcon = document.createElement('span');
                spanIcon.className = 'icon';

                const icon = document.createElement('i');
                icon.className = 'fas fa-wifi';

                spanIcon.appendChild(icon);

                const spanText = document.createElement('span');
                spanText.style.margin = '.3em 0 .3em 1.5em';
                spanText.id = 'button-text-span';
                spanText.innerHTML = "Demander l'accès à la cuve " + tankId;

                button.appendChild(spanIcon);
                button.appendChild(spanText);

                remoteAccessContainer.innerHTML = "";
                remoteAccessContainer.appendChild(button);
            }
        });
    }
});