document.addEventListener('DOMContentLoaded', () => {
    const ipInput = document.getElementById('ip-addr');
    const tankName = document.getElementById('tank-name');
    const synchro = document.getElementById('synchro');
    const addingNewTankButton = document.getElementById('adding-new-tank');
    const appSettingsValidation = document.getElementById('app-settings-validation');
    
    addingNewTankButton.addEventListener('click', async function(event) {
        const ipAddress = ipInput.value;
        const tankId = tankName.value;
        const synchroValue = synchro.value;

        if(ipAddress.length === 0 && tankId.length === 0 && synchroValue.length === 0) {
            alert('L\'adresse IP doit être complète, le nom du réservoir et la synchronisation ne peuvent pas être vide. Veuillez vérifier votre saisie.');
            return;
        }

        if (ipAddress.length === 0) {
            alert('L\'adresse IP ne peut pas être vide. Veuillez vérifier votre saisie.');
            return;
        }

        if (tankId.length === 0) {
            alert('Le nom du réservoir ne peut pas être vide');
            return;
        }

        if (synchroValue.length === 0) {
            alert('La synchronisation ne peut pas être vide');
            return;
        }

        const exists = await window.electronAPI.checkIfTankIdAndIpAddressExist({ ipAddress, tankId });

        if(exists.tankIdExists) {
            alert('Le nom du réservoir existe déjà. Veuillez en choisir un autre.');
            return;
        }

        if(exists.ipAddrExists) {
            alert("L'adresse IP existe déjà. Veuillez en choisir une autre.");
            return;
        }

        const newTank = {
          ipAddress,
          tankId,
          synchroValue
        }

        window.electronAPI.createNewTank({ ipAddress, tankId, synchroValue });

        ipInput.value = '';
        tankName.value = '';
        synchro.value = 20;

        closeAllModals();
    });

    appSettingsValidation.addEventListener('click', function(event) {
        const checkboxValue = document.getElementById('open-at-startup').checked;
        window.electronAPI.updateOpenAtLogin(checkboxValue);
        closeAllModals();
    });

    // Functions to open and close a modal
    function openModal($el) {
      $el.classList.add('is-active');
    }
  
    function closeModal($el) {
      $el.classList.remove('is-active');
    }
  
    function closeAllModals() {
      (document.querySelectorAll('.modal') || []).forEach(($modal) => {
        closeModal($modal);
      });
    }
  
    // Add a click event on buttons to open a specific modal
    (document.querySelectorAll('.add-new-tank-modal-trigger, .settings-modal-trigger, .app-settings-modal-trigger') || []).forEach(($trigger) => {
      const modal = $trigger.dataset.target;
      const $target = document.getElementById(modal);
  
      $trigger.addEventListener('click', () => {
        openModal($target);
      });
    });
  
    // Add a click event on various child elements to close the parent modal
    (document.querySelectorAll('.modal-background, .modal-close, .modal-card-head .delete, .modal-card-foot .button-close') || []).forEach(($close) => {
      const $target = $close.closest('.modal');
  
      $close.addEventListener('click', () => {
        closeModal($target);
      });
    });
  
    // Add a keyboard event to close all modals
    document.addEventListener('keydown', (event) => {
      if(event.key === "Escape") {
        closeAllModals();
      }
    });
  });