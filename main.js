// main.js

// Importing modules
const { app, BrowserWindow, ipcMain, dialog, Tray } = require('electron/main')
const path = require('node:path')
const opcua = require('node-opcua')
const fss = require('fs');
const { clearInterval } = require('node:timers');
const fs = require('fs').promises;
const { Menu } = require('electron');
const { cp } = require('node:fs');

// try {
//   require('electron-reloader')(module);
// } catch {}

if(handleSquirrelEvent(app)) {
  return;
}

function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require('child_process');

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function(command, args) {
    let spawnedProcess, error;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
    } catch (error) {}

    return spawnedProcess;
  };

  const spawnUpdate = function(args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      spawnUpdate(['--createShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      spawnUpdate(['--removeShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      app.quit();
      return true;
  }
}

// GLOBAL VARIABLES - tanks, client and sessions
const pathToJSON = path.join(process.resourcesPath, 'json')
const pathToAssets = path.join(process.resourcesPath, 'assets')
const pathToCerts = path.join(process.resourcesPath, 'certs')
var tanks = getTanks();
const intervals = new Map();
var sessions = new Map();
var clients = new Map();
var remoteAccessSubscription;
var mainWindow;
var isQuitting;

// EVENEMENTS / HANDLER

/**
 * HANDLER: readJsonFile
 * Handles the IPC event 'read-json-file' to read data from a specified JSON file.
 * This handler is responsible for fetching and parsing the contents of a JSON file, returning
 * the parsed data to the caller. It's commonly used to load configuration or state information
 * from disk.
 *
 * @param {Event} event - The IPC event object, not used in the function but required by the IPC API.
 * @param {string} filePath - The relative path to the JSON file that needs to be read. This path
 *                            should be relative to a base JSON directory specified by `pathToJSON`.
 *
 * Operations:
 * 1. Calculate the full path to the JSON file by combining the base directory (`pathToJSON`) with the
 *    provided relative path (`filePath`).
 * 2. Read the file asynchronously using `fs.readFile` to avoid blocking the main thread, ensuring
 *    the application remains responsive.
 * 3. Parse the contents of the file from a JSON string into a JavaScript object using `JSON.parse`.
 *    This parsed data is then returned to the caller.
 *
 * Error Handling:
 * - If an error occurs during file reading or parsing, log the error using `console.error`.
 * - Rethrow the error after logging to allow the calling context to handle it appropriately. This
 *   may involve user notifications, error logging, or retries.
 *
 * Note:
 * - It's crucial that the file exists at the specified path and the application has read permissions
 *   for the directory to ensure successful operation.
 * - Proper error handling in the caller is necessary to gracefully handle potential issues such
 *   as file not found, access denied, or invalid JSON content.
 */
ipcMain.handle('read-json-file', async (event, filePath) => {
  try {
      const jsonFilePath = path.join(pathToJSON, filePath);
      const data = await fs.readFile(jsonFilePath, 'utf8');
      return JSON.parse(data);
  } catch (error) {
      console.error('Failed to read JSON file', error);
      throw error;
  }
});

/**
 * HANDLER: deleteJsonFileContent
 * Handles the IPC event 'delete-json-file-content' to clear the content of a specified JSON file.
 * This handler is designed to reset the content of a JSON file by overwriting it with an empty array,
 * effectively removing all stored data without deleting the file itself. This approach preserves file permissions
 * and avoids the need to recreate the file.
 *
 * @param {Event} event - The IPC event object, not used in the function but required by the IPC API.
 * @param {string} filePath - The relative path to the JSON file whose content is to be deleted. This path
 *                            should be relative to a base JSON directory specified by `pathToJSON`.
 *
 * Operations:
 * 1. Calculate the full path to the JSON file by combining the base directory (`pathToJSON`) with the
 *    provided relative path (`filePath`).
 * 2. Use `fs.writeFile` to overwrite the file content with an empty array ('[]'), which is the default
 *    state for cleared JSON files.
 *
 * Error Handling:
 * - Any exceptions thrown by file operations are caught and logged using `console.error`.
 * - The caught error is then rethrown to allow the calling context to handle the failure, possibly by
 *   notifying the user or performing additional error handling measures.
 *
 * Note:
 * - This function assumes that the JSON file is used to store an array. If the default cleared state
 *   should be an empty object ({}), this behavior needs to be adjusted accordingly.
 * - It's essential to ensure that the file exists and the application has write permissions to the directory
 *   to prevent runtime errors.
 */

ipcMain.handle('delete-json-file-content', async (event, filePath) => {
  try {
      const jsonFilePath = path.join(pathToJSON, filePath);
      await fs.writeFile(jsonFilePath, '[]');
  } catch (error) {
      console.error('Failed to delete JSON file content', error);
      throw error;
  }
});

/**
 * HANDLER: createNewTank
 * Handles the IPC event 'create-new-tank' to add a new tank to the system.
 * This method creates a new tank entry in tanks_infos.json, initializes related files, and attempts to establish
 * a session for the new tank.
 *
 * @param {Event} event - The IPC event object, not used in the function but required by the IPC API.
 * @param {Object} tankInfos - Object containing necessary information to create a new tank.
 * @param {string} tankInfos.tankId - Unique identifier for the new tank.
 * @param {string} tankInfos.ipAddress - IP address for the new tank.
 * @param {boolean} tankInfos.synchroValue - Synchronization setting for the new tank.
 *
 * Operations:
 * 1. Read the existing tank data from 'tanks_infos.json'.
 * 2. Parse the JSON into an array and add the new tank information.
 * 3. Write the updated array back to 'tanks_infos.json'.
 * 4. Create new files for storing historical data and data to send for the new tank.
 * 5. Send an initialization message to the renderer to update the UI with the new tank info.
 * 6. Attempt to initiate a session for the new tank using its data.
 * 7. If a session is successfully created, update the synchronization status.
 * 8. Refresh the in-memory tank list.
 *
 * Error Handling:
 * - Catch and log any errors that occur during file operations, JSON parsing, or session initialization.
 * - Errors may include file access issues, invalid JSON structure, or network-related problems.
 *
 * Note:
 * - This function assumes that the tanks data is stored in a structured format that includes an array of objects,
 *   each representing a tank with its ID as a key.
 * - It's crucial that the file paths are correct and the file permissions allow reading and writing.
 */
ipcMain.handle('create-new-tank', async (event, tankInfos) => {
  const tankId = tankInfos.tankId;
  const ipAddr = tankInfos.ipAddress;
  const synchro = tankInfos.synchroValue;

  try {
    // Adding new tank to the tanks_infos.json file
    const data = await fs.readFile(path.join(pathToJSON, 'tanks_infos.json'), 'utf-8');
    const tanksData = JSON.parse(data);
    const infoToPush = {[tankId]: {"ipAddr": ipAddr, "synchro": synchro}};
    tanksData.push(infoToPush);

    await fs.writeFile(path.join(pathToJSON, 'tanks_infos.json'), JSON.stringify(tanksData, null, 2));

    // Creating a new history file for the new tank
    await fs.writeFile(path.join(pathToJSON, `history_${tankId}.json`), '[]');

    // Creating a new dataToSend file for the new tank
    await fs.writeFile(path.join(pathToJSON, `dataToSend_${tankId}.json`), '{}');

    mainWindow.webContents.send('initialize-view', [infoToPush]);

    // Trying to connect to the new tank
    const tankData = tanksData.find(tank => Object.keys(tank)[0] === tankId)[tankId];
    
    await initializeASession(tankId, tankData);

    const session = sessions.get(tankId);

    if(session && session !== null) {
      const synchro = tankData.synchro;
      setSynchro(tankId, synchro);
    }

    tanks = getTanks();
    tanksId = tanks.map(tank => Object.keys(tank)[0]);
  } catch (error) {
    console.log('create-new-tank | Error while creating a new tank :', error);
  }
});

/**
 * HANDLER: checkIfTankIdAndIpAddressExist
 * Handles the IPC event 'check-if-tank-id-and-ip-address-exist' to determine if a given tank ID and IP address
 * already exist in the tanks data.
 *
 * This handler checks for the existence of the specified tank ID and IP address across the tanks dataset
 * loaded from a centralized storage (likely a JSON file or an in-memory data structure).
 *
 * @param {Event} event - The IPC event object, not used in the function but required by the IPC API.
 * @param {Object} tankInfos - Object containing the tank ID and IP address to be checked.
 * @param {string} tankInfos.tankId - The tank ID to check for existence in the dataset.
 * @param {string} tankInfos.ipAddr - The IP address to check for existence associated with any tank in the dataset.
 *
 * Operations:
 * 1. Retrieve the complete list of tanks from a centralized data source via the getTanks function.
 * 2. Check for the existence of the tank ID in the dataset.
 * 3. Check if any tank in the dataset is associated with the specified IP address.
 * 4. Return an object with boolean values indicating the existence of the tank ID and the IP address.
 *
 * Example Response:
 * - { tankIdExists: true, ipAddrExists: false }
 * This response indicates that the tank ID already exists in the dataset, but the IP address does not.
 *
 * Note:
 * - The method assumes that the tank data is well-structured where each tank is an object in an array, 
 *   and each tank object has a key representing the tank ID.
 * - It's crucial that the getTanks function reliably loads current and accurate tank data for the checks to be valid.
 */
ipcMain.handle('check-if-tank-id-and-ip-address-exist', async (event, tankInfos) => {
  const tankId = tankInfos.tankId;
  const ipAddr = tankInfos.ipAddr;

  const tanksData = getTanks();

  const tankIdExists = tanksData.some(tank => Object.keys(tank)[0] === tankId);
  const ipAddrExists = tanksData.some(tank => tank[Object.keys(tank)[0]].ipAddr === ipAddr);

  return {tankIdExists, ipAddrExists};
});

/**
 * HANDLER: updateATank
 * Handles the IPC event 'update-a-tank' to update specific information for an existing tank.
 * This handler modifies tank details, renames related data files, and updates in-memory data structures.
 *
 * @param {Event} event - The IPC event object, not used in the function but required by the IPC API.
 * @param {Object} tankInfos - Object containing the tank's current and new identifiers and additional data.
 * @param {string} tankInfos.tankId - Current identifier of the tank.
 * @param {string} tankInfos.newTankId - New identifier for the tank if it is being changed.
 * @param {string} tankInfos.ipAddr - Updated IP address for the tank.
 * @param {boolean} tankInfos.synchro - Updated synchronization status of the tank.
 *
 * Operations:
 * 1. Load the current tanks' information from 'tanks_infos.json'.
 * 2. Locate the specific tank using 'tankId' and update its entry if found.
 * 3. If the tank is not found, log an error and terminate the operation.
 * 4. Update the tank entry with new ID, IP address, and synchronization status.
 * 5. Write the updated tank data back to 'tanks_infos.json'.
 * 6. Rename related files (historical and data-to-send files) to reflect the new tank ID.
 * 7. Remove old tank IDs from in-memory clients and sessions maps, then initialize a new session for the updated tank.
 * 8. Refresh and reload in-memory lists of tank IDs based on updated data.
 * 9. Handle any errors during the file operations or JSON parsing and log them to the console.
 *
 * Note:
 * This function handles significant file and data operations. It's essential to ensure that file paths and data integrity
 * are maintained, especially when renaming files and updating JSON structures. Errors in file handling could result
 * in data loss or corruption.
 */
ipcMain.handle('update-a-tank', async (event, tankInfos) => {
  const tankId = tankInfos.tankId;
  const newTankId = tankInfos.newTankId;
  const ipAddr = tankInfos.ipAddr;
  const synchro = tankInfos.synchro;

  try {
    const data = await fs.readFile(path.join(pathToJSON, 'tanks_infos.json'), 'utf-8');
    const tanksData = JSON.parse(data);

    const tankIndex = tanksData.findIndex(tank => Object.keys(tank)[0] === tankId);

    if(tankIndex === -1) {
      console.error('update-a-tank | Tank not found');
      return;
    }

    tanksData[tankIndex] = {[newTankId]: {"ipAddr": ipAddr, "synchro": synchro}};

    await fs.writeFile(path.join(pathToJSON, 'tanks_infos.json'), JSON.stringify(tanksData, null, 2));
    await fs.rename(path.join(pathToJSON, `history_${tankId}.json`), path.join(pathToJSON, `history_${newTankId}.json`));
    await fs.rename(path.join(pathToJSON, `dataToSend_${tankId}.json`), path.join(pathToJSON, `dataToSend_${newTankId}.json`));

    const tankData = tanksData.find(tank => Object.keys(tank)[0] === newTankId)[newTankId];
    
    clients.delete(tankId);
    sessions.delete(tankId);

    await initializeASession(newTankId, tankData);

    const session = sessions.get(newTankId);

    if(session && session !== null) {
      const synchro = tankData.synchro;
      setSynchro(newTankId, synchro);
    }

    tanks = getTanks();
    tanksId = tanks.map(tank => Object.keys(tank)[0]);

  } catch(error){
    console.log('update-a-tank | Error while updating a tank :', error);
  }
});

/**
 * HANDLER: deleteATank
 * Handles the IPC event 'delete-a-tank' to remove a specific tank's data from the application.
 *
 * This handler performs multiple operations to ensure that all traces of the tank are removed, 
 * including data from JSON files and any associated session or client data.
 *
 * @param {Event} event - The IPC event object, not used in the function but required by the IPC API.
 * @param {string} tankId - The unique identifier for the tank to be deleted.
 *
 * Operations:
 * 1. Load the current tanks' information from 'tanks_infos.json'.
 * 2. Parse the JSON data to find the specific tank using its ID.
 * 3. If the tank is found, remove it from the array and update the JSON file.
 * 4. Delete related tank-specific files (history and data to send files) which store additional data about the tank.
 * 5. Clean up in-memory data related to the tank by removing its entries from `clients` and `sessions` maps.
 * 6. Reload the tanks' data to refresh any cached or in-memory lists of tanks.
 * 7. Handle any errors that occur during file operations or JSON parsing and log them to the console.
 *
 * Note:
 * This function assumes that tank-specific files are named following a specific format:
 * 'history_{tankId}.json' and 'dataToSend_{tankId}.json'. Errors in the naming format or file access issues
 * might cause the deletion process to fail and should be handled appropriately.
 */
ipcMain.handle('delete-a-tank', async (event, tankId) => {
  try {
    const data = await fs.readFile(path.join(pathToJSON, 'tanks_infos.json'), 'utf-8');
    const tanksData = JSON.parse(data);

    const tankIndex = tanksData.findIndex(tank => Object.keys(tank)[0] === tankId);

    if(tankIndex === -1) {
      console.error('delete-a-tank | Tank not found');
      return;
    }

    tanksData.splice(tankIndex, 1);

    await fs.writeFile(path.join(pathToJSON, 'tanks_infos.json'), JSON.stringify(tanksData, null, 2));
    await fs.unlink(path.join(pathToJSON, `history_${tankId}.json`));
    await fs.unlink(path.join(pathToJSON, `dataToSend_${tankId}.json`));

    clients.delete(tankId);
    sessions.delete(tankId);

    tanks = getTanks();
    tanksId = tanks.map(tank => Object.keys(tank)[0]);

  } catch(error){
    console.log('delete-a-tank | Error while deleting a tank :', error);
  }
});

/**
 * HANDLER : updateOpenAtLogin
 * Handles the IPC event 'update-open-at-login' to update the user's preference regarding
 * whether the application should open automatically at system startup.
 *
 * This handler writes the new preference value to a JSON file 'open_at_login.json'.
 * If the write operation fails, it logs an error to the console.
 *
 * @param {Event} event - The IPC event object, not used in the function but required by the API.
 * @param {boolean|object} value - The new value for the 'open at login' preference.
 *     This could be a boolean indicating the status, or an object with more detailed configuration.
 *
 * Operations:
 * 1. Attempt to write the new preference value to 'open_at_login.json' located in a predefined path.
 * 2. The value is stringified with JSON formatting for readability in the file.
 * 3. Catch and log any errors that occur during the file write operation.
 *
 * Example:
 * The 'value' parameter should typically be passed as follows:
 * - true: Set the application to open at login.
 * - false: Do not open the application at login.
 * Alternatively, an object containing detailed settings could be provided based on the application's requirements.
 */
ipcMain.handle('update-open-at-login', async (event, value) => {
  // Write new value in openAtLogin.json
  try {
    await fs.writeFile(path.join(pathToJSON, 'open_at_login.json'), JSON.stringify(value, null, 2));
  } catch(error) {
    console.error('update-open-at-login | Error while updating open at login value :', error);
  }
});

/**
 * HANDLER: requestAccessToTank
 * Handles the IPC event 'request-access-to-tank' to manage remote access requests for tanks.
 * 
 * This handler initiates a session based on a provided tankId, attempts to write a single node
 * to request remote access, and sets up a subscription to monitor changes in the access state.
 * It handles different states of access: granted, denied, and terminated, and communicates
 * these states back to the renderer process.
 * 
 * @param {Event} event - The IPC event object, used to communicate with the renderer process.
 * @param {string} tankId - Unique identifier for the tank, used to retrieve the session and manage access.
 *
 * Operations:
 * 1. Retrieve session using tankId.
 * 2. Request access by writing a 'true' boolean to the 'remoteAccessRequestId' node.
 * 3. On successful write, create a subscription to monitor the state of the remote access.
 * 4. Set up handlers on the subscription to log and handle various events:
 *    - 'started': Logs the start of the subscription.
 *    - 'keepalive': Logs keepalive signals.
 *    - 'terminated': Logs when the subscription is terminated.
 * 5. Monitor 'remoteAccessStateId' node for changes to handle the states:
 *    - '-1' (denied): Terminates the subscription and notifies the renderer.
 *    - '1' (granted): Notifies the renderer of granted access.
 *    - '-2' (terminated): Ends the subscription and notifies the renderer of the termination.
 * 6. In case of errors during the write operation or subscription setup, logs the errors and returns false.
 * 7. If no session is found for the provided tankId, logs an error and returns false.
 */
ipcMain.handle('request-access-to-tank', async (event, tankId) => {
  const session = sessions.get(tankId);

  if(session && session !== null) {
    const remoteAccessRequestId = "ns=6;s=::OpcUaWrite:lo_WidgetDemandeRemoteAccess";
    const remoteAccessStateId = "ns=6;s=::OpcUaWrite:lo_WidgetEtatConnexion";

    const requestAccessValue = {
      dataType: "Boolean", 
      value: true
    };

    try {
      const response = await session.writeSingleNode(remoteAccessRequestId, requestAccessValue);
      if(response === opcua.StatusCodes.Good){
        var subscription = await session.createSubscription2({
          requestedPublishingInterval: 1000,
          requestedLifetimeCount: 1000,
          requestedMaxKeepAliveCount: 10,
          maxNotificationsPerPublish: 10,
          publishingEnabled: true,
          priority: 10
        });

        subscription
        .on("started", () =>
          console.log(
            "request-access-to-tank | Subscription started - subscriptionId=",
            subscription.subscriptionId
          )
        )
        .on("keepalive", () => console.log("request-access-to-tank | keepalive"))
        .on("terminated", () => console.log("request-access-to-tank | subscription terminated"));

        const itemToMonitor = {
          nodeId: remoteAccessStateId,
          attributeId: opcua.AttributeIds.Value
        };

        const parameters = {
          samplingInterval: 100,
          discardOldest: true,
          queueSize: 10
        };

        const monitoredItem = await subscription.monitor(itemToMonitor, parameters, opcua.TimestampsToReturn.Both);

        remoteAccessSubscription = subscription;

        monitoredItem.on("changed", async function(dataValue) {
          console.log("request-access-to-tank | Value changed for remote access state: ", dataValue.value.value);
          // Connexion refusée | APPUI SUR NON SUR RL40
          if(dataValue.value.value === -1) {
            remoteAccessSubscription.terminate();
            
            mainWindow.webContents.send('remote-access-granted', false);
            
            const requestAccessValue = {
              dataType: "SByte", 
              value: 0
            };
            
            await session.writeSingleNode(remoteAccessStateId, requestAccessValue);

            //Connexion acceptée | APPUI SUR OUI SUR RL40
          } else if(dataValue.value.value === 1) {
            mainWindow.webContents.send('remote-access-granted', true);

            // Connexion coupée | APPUI SUR STOP SUR RL40
          } else if(dataValue.value.value === -2) {
            remoteAccessSubscription.terminate();
            
            mainWindow.webContents.send('remote-access-finished');
            
            const requestAccessValue = {
              dataType: "SByte", 
              value: 0
            };
            
            await session.writeSingleNode(remoteAccessStateId, requestAccessValue);
          }

        });

        return true;
      }
      else {
        console.error('request-access-to-tank | Error while requesting access to tank :', response);
        return false;
      }
    } catch(error) {
      console.error('request-access-to-tank | Error while requesting access to tank :', error);
      return false;
    }
  } else {
    console.error('request-access-to-tank | No session found for tank', tankId);
    return false;
  }
});

// HANDLER: closeCurrentConnectionToTank
// This handler closes the current connection to the tank identified by `tankId`.
// It terminates the subscription and writes the value to the server to close the connection.
ipcMain.handle('close-current-connection', async (event, tankId) => {
  const session = sessions.get(tankId);
  const remoteAccessStateId = "ns=6;s=::OpcUaWrite:lo_WidgetEtatConnexion";
  if(remoteAccessSubscription && remoteAccessSubscription !== null) {
    remoteAccessSubscription.terminate();
    remoteAccessSubscription = null;
    // Connexion coupée depuis le widget | -3 | Appuie sur le bouton "Home" ou fin du timer dans la page de gestion à distance
    const requestAccessValue = {
      dataType: "SByte", 
      value: -3
    };
    
    await session.writeSingleNode(remoteAccessStateId, requestAccessValue);
  }
});

// HANDLER: reinitializeRemoteAccessState
// This handler reinitializes the remote access state for the tank identified by `tankId`.
// It writes the value to the server and terminates the subscription if it exists.
ipcMain.handle('reinitialize-remote-access-state', async (event, tankId) => {
  const session = sessions.get(tankId);
  const remoteAccessStateId="ns=6;s=::OpcUaWrite:lo_WidgetEtatConnexion";
  if(remoteAccessSubscription && remoteAccessSubscription !== null) {
    remoteAccessSubscription.terminate();
    remoteAccessSubscription = null;
    const requestAccessValue = {
      dataType: "SByte", 
      value: 0
    };
    
    await session.writeSingleNode(remoteAccessStateId, requestAccessValue);
  }
});

// HANDLER: stopButtonClicked
// This handler sends a request to the OPC UA server to click the stop button for the tank identified by `tankId`.
// It writes the value to the server and waits for a return value to confirm the action was successful.
ipcMain.handle('stop-button-clicked', async (event, tankId) => {
  const session = sessions.get(tankId);
  const stopButtonId = "ns=6;s=::OpcUaWrite:lo_WidgetActionStop";
  const returnInfoStopButtonId="ns=6;s=::OpcUaWrite:lo_WigdetRetourActionStop";
  const stopButtonValue = {
    dataType: "Boolean", 
    value: true
  };

  try {
    const response = await session.writeSingleNode(stopButtonId, stopButtonValue);
    if(response === opcua.StatusCodes.Good){
      console.log('stop-button-clicked | Stop button clicked for tank', tankId);
      const returnInfoStopButtonValue = await session.read({nodeId: returnInfoStopButtonId});
      if(returnInfoStopButtonValue.value.value) {
        console.log('stop-button-clicked | Info came back ', tankId, ':', returnInfoStopButtonValue.value.value);
        return true;
      } else {
        console.error('stop-button-clicked | No return info for stop button ', tankId, ':', returnInfoStopButtonValue);
        return false;
      }
    } else {
      console.error('stop-button-clicked | Error while clicking stop button for tank', tankId, ':', response);
      return false;
    }
  } catch(error) {
    console.error('stop-button-clicked | Error while clicking stop button for tank', tankId, ':', error);
    return false;
  }
});

// HANDLER: coldButtonClicked
// This handler sends a request to the OPC UA server to click the cold button for the tank identified by `tankId`.
// It writes the value to the server and waits for a return value to confirm the action was successful.
ipcMain.handle('cold-button-clicked', async (event, tankId) => {
  const session = sessions.get(tankId);
  const coldButtonId = "ns=6;s=::OpcUaWrite:lo_WidgetActionFroid";
  const returnInfoColdButtonId="ns=6;s=::OpcUaWrite:lo_WigdetRetourActionFroid";
  const coldButtonValue = {
    dataType: "Boolean", 
    value: true
  };
  
  try {
    const response = await session.writeSingleNode(coldButtonId, coldButtonValue);
    if(response === opcua.StatusCodes.Good){
      console.log('cold-button-clicked | Cold button clicked for tank', tankId);
      const returnInfoColdButtonValue = await session.read({nodeId: returnInfoColdButtonId});
      if(returnInfoColdButtonValue.value.value) {
        console.log('cold-button-clicked | Info came back ', tankId, ':', returnInfoColdButtonValue.value.value);
        return true;
      } else {
        console.error('cold-button-clicked | No return info for cold button ', tankId, ':', returnInfoColdButtonValue);
        return false;
      }
    } else {
      console.error('cold-button-clicked | Error while clicking cold button for tank', tankId, ':', response);
      return false;
    }
  } catch(error) {
    console.error('cold-button-clicked | Error while clicking cold button for tank', tankId, ':', error);
    return false; 
  }
});

// HANDLER: agitationButtonClicked
// This handler sends a request to the OPC UA server to click the agitation button for the tank identified by `tankId`.
// It writes the value to the server and waits for a return value to confirm the action was successful.
ipcMain.handle('agitation-button-clicked', async (event, tankId) => {
  const session = sessions.get(tankId);
  const agitationButtonId = "ns=6;s=::OpcUaWrite:lo_WidgetActionAgit";
  const returnInfoAgitationButtonId="ns=6;s=::OpcUaWrite:lo_WigdetRetourActionAgit";
  const agitationButtonValue = {
    dataType: "Boolean", 
    value: true
  };

  try {
    const response = await session.writeSingleNode(agitationButtonId, agitationButtonValue);
    if(response === opcua.StatusCodes.Good){
      console.log('agitation-button-clicked | Agitation button clicked for tank', tankId);
      const returnInfoAgitationButtonValue = await session.read({nodeId: returnInfoAgitationButtonId});
      if(returnInfoAgitationButtonValue.value.value) {
        console.log('agitation-button-clicked | Info came back ', tankId, ':', returnInfoAgitationButtonValue.value.value);
        return true;
      } else {
        console.error('agitation-button-clicked | No return info for agitation button ', tankId, ':', returnInfoAgitationButtonValue);
        return false;
      }
    } else {
      console.error('agitation-button-clicked | Error while clicking agitation button for tank', tankId, ':', response);
      return false;
    }
  } catch(error) {
    console.error('agitation-button-clicked | Error while clicking agitation button for tank', tankId, ':', error);
    return false;
  }
});

// HANDLER: washingButtonClicked
// This handler sends a request to the OPC UA server to click the washing button for the tank identified by `tankId`.
// It writes the value to the server and waits for a return value to confirm the action was successful.
ipcMain.handle('washing-button-clicked', async (event, tankId) => {
  const session = sessions.get(tankId);
  const washingButtonId = "ns=6;s=::OpcUaWrite:lo_WidgetActionLavage";
  const returnInfoWashingButtonId="ns=6;s=::OpcUaWrite:lo_WigdetRetourActionLavage";
  const washingButtonValue = {
    dataType: "Boolean", 
    value: true
  };

  try {
    const response = await session.writeSingleNode(washingButtonId, washingButtonValue);
    if(response === opcua.StatusCodes.Good){
      console.log('washing-button-clicked | Washing button clicked for tank', tankId);
      const returnInfoWashingButtonValue = await session.read({nodeId: returnInfoWashingButtonId});
      if(returnInfoWashingButtonValue.value.value) {
        console.log('washing-button-clicked | Info came back ', tankId, ':', returnInfoWashingButtonValue.value.value);
        return true;
      } else {
        console.error('washing-button-clicked | No return info for washing button ', tankId, ':', returnInfoWashingButtonValue);
        return false;
      }
    } else {
      console.error('washing-button-clicked | Error while clicking washing button for tank', tankId, ':', response);
      return false;
    }
  } catch(error){
    console.error('washing-button-clicked | Error while clicking washing button for tank', tankId, ':', error);
    return false;
  }
});

// HANDLER: getTemperature
// This handler retrieves the current temperature of the tank identified by `tankId` from the OPC UA server.
// It reads the temperature value from the server and returns it to the renderer process.
ipcMain.handle('get-temperature', async (event, tankId) => {
  const session = sessions.get(tankId);
  const temperatureId = "ns=6;s=::OpcUaRead:lo_Widget_DataList.Temperature";

  try {
    const temperatureValue = await session.read({nodeId: temperatureId});
    return temperatureValue.value.value;
  } catch(error) {
    console.error('get-temperature | Error while getting temperature for tank', tankId, ':', error);
    return undefined;
  }
});

// HANDLER: getMode
// This handler retrieves the current mode of the tank identified by `tankId` from the OPC UA server.
// It reads the mode value from the server and returns it to the renderer process.
ipcMain.handle('get-mode', async (event, tankId) => {
  const session = sessions.get(tankId);
  const tankStateId="ns=6;s=::OpcUaRead:lo_Widget_DataList.State";

  try {
    const modeValue = await session.read({nodeId: tankStateId});
    return modeValue.value.value;
  } catch(error) {
    console.error('get-mode | Error while getting mode for tank', tankId, ':', error);
    return undefined;
  }
});

// FUNCTIONS

// getTanks function:
// This function reads tank information from a local JSON file and parses it.
// It returns an array of tank objects containing configuration details.
// If the file cannot be read or parsed, it logs the error and throws an exception.
function getTanks() {
  try  {
    const data = fss.readFileSync(path.join(pathToJSON, 'tanks_infos.json'), 'utf-8');
    const tanks = JSON.parse(data);
    return tanks;
  } catch (err) {
    console.error(err);
    throw new Error("No tanks found.");
  }
}

// getAlertLabels function:
// This asynchronous function reads a JSON file containing alert information and parses it to find the 
// corresponding alert codes for a given list of alert IDs. It returns an array of alert codes where each code 
// corresponds to the respective alert ID provided. If an alert ID does not match any entry in the JSON data, 
// it returns a default "Unknown" label for that ID. The function handles and logs any errors that occur during 
// file reading or data processing, rethrowing them for further handling.
async function getAlertLabels(alertIds) {
  try {

    if(alertIds.length === 0 || (alertIds.length === 1 && alertIds[0] === "")) return [""];

    const data = await fs.readFile(path.join(pathToJSON, 'alerts_dict.json'));
    const alerts = JSON.parse(data);

    return alertIds.map(id => {
      const alert = alerts.find(a => a.Id === id);
      return alert ? alert.Code : `Inconnu (${id})`
    });
  } catch (error) {
    console.error("Error reading alerts file:", error)
    throw error;
  }
}

// writeHistory function:
// This asynchronous function appends new tank data to a JSON file specific to a tank identified by `tankId`.
// It first reads the existing history from the file, parses it, adds the new data, and then writes the updated 
// array back to the JSON file, formatting it for readability. If any error occurs during the file read, update, 
// or write process, the error is logged and the function completes without throwing, allowing the application 
// to continue running.
async function writeHistory(tankId, newData){
  try {
    const data = await fs.readFile(path.join(pathToJSON, `history_${tankId}.json`));
    const json = JSON.parse(data);
    json.push(newData);
    await fs.writeFile(path.join(pathToJSON, `history_${tankId}.json`), JSON.stringify(json, null, 2));
  } catch(error) {
    console.error("Erreur lors de l'ajout de la nouvelle donnée :", error);
  }
}

// writeDataToSend function:
// This asynchronous function writes the tank data to a JSON file specific to the tank identified by `tankId`.
// It takes the tankId and data as parameters, and writes the data to the file in a formatted JSON format.
// If any error occurs during the file write process, it logs the error to the console.
async function writeDataToSend(tankId, data){
  try {
    await fs.writeFile(path.join(pathToJSON, `dataToSend_${tankId}.json`), JSON.stringify(data, null, 2));
  } catch(error) {
    console.error("Erreur lors de l'écriture des données à envoyer :", error);
  }
}

// readDataToSend function:
// This asynchronous function reads the tank data to be sent from a JSON file specific to the tank identified by `tankId`.
// It takes the tankId as a parameter and reads the data from the corresponding file using the `fs.readFile` method.
// The function then parses the data as JSON and returns it. If any error occurs during the file read or data parsing process,
// it logs the error to the console and returns undefined.
async function readDataToSend(tankId){
  try {
    const data = await fs.readFile(path.join(pathToJSON, `dataToSend_${tankId}.json`));
    return JSON.parse(data);
  } catch(error) {
    console.error("Erreur lors de la lecture des données à envoyer :", error);
    return undefined;
  }
}

// sendingDataToMyRainbow function:
// This asynchronous function sends tank data to a specified URL using a POST request.
// It takes the tankId as a parameter and constructs the URL to post the data.
// The function then reads the tank data from a JSON file specific to the tank using the readDataToSend function.
// The data is then sent to the specified URL as a JSON payload using the fetch API.
// The function returns a promise that resolves with the response from the server.
async function sendingDataToMyRainbow(tankId){
  const urlToPost=`https://my-rainbow-test.azurewebsites.net/api/tanks/notify/${tankId}`;
  
  const data = await readDataToSend(tankId);
  
  const response = await fetch(urlToPost, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  // return response;
}

// initializeSessions function:
// This asynchronous function initializes OPC UA sessions for each tank in the provided array.
// It iterates through each tank, extracts the tankId and tankInfos, and creates an OPC UA client with the specified configuration.
// The function then attempts to connect to the OPC UA server and create a session for the tank.
// If successful, the session and client are stored in the sessions and clients maps respectively.
// If any errors occur during connection or session creation, the function logs the error to the console.
async function initializeSessions(tanks) {
  for (const tank of tanks) {
    const tankId = Object.keys(tank)[0];
    const tankInfos = tank[tankId];
    await initializeASession(tankId, tankInfos)
  }
}


// initializeASession function:
// This asynchronous function initializes an OPC UA session for a specific tank using the provided tankId and tankInfos.
// It creates an OPC UA client with the specified configuration and attempts to connect to the OPC UA server.
// If the connection is successful, a session is created for the tank and stored in the sessions map.
// If any errors occur during connection or session creation, the function logs the error to the console.
async function initializeASession(tankId, tankInfos) {
  const client = opcua.OPCUAClient.create({
    applicationName: 'MonClientOPCUA',
    endpointMustExist: false,
    securityMode: opcua.MessageSecurityMode.SignAndEncrypt,
    securityPolicy: opcua.SecurityPolicy.Basic256Sha256,
    certificateFile: path.join(pathToCerts, 'client_cert.pem'),
    privateKeyFile: path.join(pathToCerts, 'client_key.pem'),
    keepSessionAlive: true,
    connectionStrategy: {
      maxRetry: 1,
      initialDelay: 500,
    }
  });

  client.on('backoff', (retry, delay) => {
    console.log(`BACKOFF | Retrying connection to OPC UA server for tank ${tankId} in ${delay} ms`);
    console.log("BACKOFF | Retry number: ", retry);
  });

  client.on('close', () => {
    console.log(`CLOSE | Disconnected from OPC UA server for tank ${tankId}`);
    sessions.delete(tankId);
    clients.delete(tankId);
    clearInterval(intervals.get(tankId));
  });

  client.on('connection_lost', async () => {
      console.log(`CONNECTION LOST | Connection lost to OPC UA server for tank ${tankId}`);
      
      const intervalIds = intervals.get(tankId);
      const session = sessions.get(tankId);

      if(intervalIds) {
        intervalIds.forEach(id => clearInterval(id));
        intervals.delete(tankId);
      }

      if(session) {
        try {
          await session.close();
          sessions.set(tankId, null);
        } catch(error) {
          console.error(`CONNECTION LOST | Error closing session for tank ${tankId}:`, error);
        }
      }

      mainWindow.webContents.send('connection-lost', tankId);
  });

  client.on('connection_reestablished', () => {
    console.log(`CONNECTION REESTABLISHED | Connection reestablished to OPC UA server for tank ${tankId}`);
    initializeASession(tankId, tankInfos);
    setSynchro(tankId, tankInfos.synchro);
  });

  try {
    const session = await connectAndCreateSession(tankInfos, client);
    sessions.set(tankId, session);
    clients.set(tankId, client);
  } catch(error) {
    console.error(`Error connecting to OPC UA server for tank ${tankId} :`, error)
  }
}

// connectAndCreateSession function:
// This asynchronous function takes tank information, constructs an OPC UA endpoint URL, 
// and attempts to connect to the OPC UA server at that URL. It then creates and returns a session.
// If there are any errors during connection or session creation, it logs the error and rethrows it to be handled by the caller.
async function connectAndCreateSession(tankInfos, client) {
  try {
    const ipAddr = tankInfos.ipAddr;

    const endpointUrl = `opc.tcp://${ipAddr}:4840`;
    
    if(!client.isConnected) {
      await client.connect(endpointUrl);
    }
  
    const userIdentity = {userName: 'Widget', password: 'WGT1963'};
  
    const session = await client.createSession({
      type: opcua.UserTokenType.UserName,
      userName: userIdentity.userName,
      password: userIdentity.password
    });

    return session;
  } catch (error) {
    console.error(`connectAndCreateSession | ${tankInfos.ipAddr} | Error while creating a session and connecting to it : ${error}`);
    return null;
  }
}


// retrieveDataFromOPCUA function:
// This asynchronous function retrieves a variety of data points from an OPC UA server for a specific tank,
// identified by tankId, using an established session. It reads various parameters such as state, temperature,
// fill levels, and more. The data is then formatted, posted to a specified URL, and written into a historical
// JSON file for record-keeping. The function also handles formatting of date and time for logging, processes
// alert codes for any system alerts, and ensures the session is cleanly closed after data retrieval. If no
// session is found for the given tankId, it logs an error and returns early. This function is a key component
// in the monitoring and management of tank data in real-time operation environments.
async function retrieveDataFromOPCUA(tankId) {
  const tankStateId="ns=6;s=::OpcUaRead:lo_Widget_DataList.State";
  const temperatureId = "ns=6;s=::OpcUaRead:lo_Widget_DataList.Temperature";
  const fillHeightId = "ns=6;s=::OpcUaRead:lo_Widget_DataList.FillHeight";
  const fillVolumeId = "ns=6;s=::OpcUaRead:lo_Widget_DataList.FillVolume";
  const alertsId = "ns=6;s=::OpcUaRead:lo_Widget_DataList.Alerts";
  const fillRateId = "ns=6;s=::OpcUaRead:lo_Widget_DataList.FillRate";
  const passwordId = "ns=6;s=::OpcUaRead:lo_Widget_DataList.Password";
  const tempAmbientId = "ns=6;s=::OpcUaRead:lo_Widget_DataList.TempAmbiant";
  const tempEntreeLaitId = "ns=6;s=::OpcUaRead:lo_Widget_DataList.TempEntreeLait";
  const tempRecupId = "ns=6;s=::OpcUaRead:lo_Widget_DataList.TempRecup";
  const tempSortieRecuperateurId = "ns=6;s=::OpcUaRead:lo_Widget_DataList.TempSortieRecuperateur";
  const consoElecId = "ns=6;s=::OpcUaRead:lo_Widget_DataList.ConsoElec";
  const energyRecupId = "ns=6;s=::OpcUaRead:lo_Widget_DataList.EnergyRecup";
  const volumeEauChaudeRecupId = "ns=6;s=::OpcUaRead:lo_Widget_DataList.VolumeEauChaudeRecup";

  const session = sessions.get(tankId);

  if(!session) {
    console.error(`No session found for ${tankId}`);
    return;
  }

  const password = await session.read({nodeId: passwordId});
  const tankState = await session.read({ nodeId: tankStateId });
  const temp = await session.read({ nodeId: temperatureId });
  const fillHeight = await session.read({nodeId: fillHeightId});
  const fillVolume = await session.read({nodeId: fillVolumeId});
  const fillRate = await session.read({nodeId: fillRateId});
  const alerts = await session.read({nodeId: alertsId});
  const tempAmbient = await session.read({ nodeId: tempAmbientId });
  const tempEntreeLait = await session.read({ nodeId: tempEntreeLaitId });
  const tempRecup = await session.read({ nodeId: tempRecupId });
  const tempSortieRecuperateur = await session.read({ nodeId: tempSortieRecuperateurId });
  const consoElec = await session.read({ nodeId: consoElecId });
  const energyRecup = await session.read({ nodeId: energyRecupId });
  const volumeEauChaudeRecup = await session.read({ nodeId: volumeEauChaudeRecupId });

  const data = {
    "Password": password.value.value,
    "State": tankState.value.value,
    "Temperature": Number(temp.value.value.toFixed(2)),
    "FillHeight": fillHeight.value.value,
    "FillVolume": Number(fillVolume.value.value.toFixed(2)),
    "FillRate": Number(fillRate.value.value.toFixed(2)),
    "TempRecup": tempRecup.value.value,
    "TempAmbiant": tempAmbient.value.value,
    "ConsoElec": consoElec.value.value,
    "EnergyRecup": energyRecup.value.value,
    "TempSortieRecuperateur": tempSortieRecuperateur.value.value,
    "TempEntreeLait": tempEntreeLait.value.value,
    "VolumeEauChaudeRecup": volumeEauChaudeRecup.value.value,
    "Alerts": alerts.value.value,
  };

  await writeDataToSend(tankId, data);

  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0'); // Ajoute un zéro devant si nécessaire
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Les mois sont indexés à partir de 0
  const year = today.getFullYear();
  const hours = String(today.getHours()).padStart(2, '0');
  const minutes = String(today.getMinutes()).padStart(2, '0');
  const seconds = String(today.getSeconds()).padStart(2, '0');

  const alertsArray = alerts.value.value.split(";");
  const paddedAlerts = alertsArray.map(id => {
    if(id !== "") {
      return String(id).padStart(4, '0')
    } else {
      return id;
    }
  });

  const alertLabels = await getAlertLabels(paddedAlerts);

  const alertsToWrite = (alertLabels.length === 1 && alertLabels[0] === "") ? "Aucune alarme" : alertLabels.join(", ");

  const dataToWrite = {
    "Date": `${day}/${month}/${year}`,
    "Heure": `${hours}:${minutes}:${seconds}`,
    "Mode": tankState.value.value,
    "Temperature": Number(temp.value.value.toFixed(2)) + "°C",
    "Taux": Number(fillRate.value.value.toFixed(2)) + "%",
    "Volume": Number(fillVolume.value.value.toFixed(2)) + "L",
    "Defauts": alertsToWrite,
  }
  
  await writeHistory(tankId, dataToWrite);

  return {
    "tankId": tankId,
    "data": dataToWrite
  };
}

// createWindow function:
// This function initializes and opens a new browser window for the application using Electron's BrowserWindow class.
// It sets specific properties for the window, such as dimensions, resize behavior, and menu bar visibility.
// The function also specifies a preload script and loads an HTML file into the window, 
// which serves as the entry point of the application's user interface.
// Optionally, developer tools can be activated for debugging purposes by uncommenting the line that opens DevTools.
function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 980,
    height: 630,
    resizable: false,
    icon: path.join(pathToAssets, 'img', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'view/index.html'));
  mainWindow.setIcon(path.join(pathToAssets, 'img', 'icon.ico'));
  // Open the DevTools. 
  // mainWindow.webContents.openDevTools();

  return mainWindow;
}

// setSynchro function:
// This function sets up intervals for OPC UA data retrieval and data sending to MyRainbow for a specific tank.
// It takes the tankId and synchro interval as parameters and creates two intervals: one for data retrieval
// and one for data sending. The data retrieval interval fetches data from the OPC UA server at regular intervals
// and updates the view in the application. The data sending interval posts the tank data to MyRainbow at specified intervals.
function setSynchro(tankId, synchro){
  const intervalOPCUAId = setInterval(async () => {
    try {
      const data = await retrieveDataFromOPCUA(tankId).catch(error => {
        console.error("Error during OPC UA data retrieval :", error);
      });
      
      if(data) {
        mainWindow.webContents.send('update-view', data);
      }
    } catch(error) {
      console.error("Error during OPC UA data retrieval :", error);
    }
  }, synchro*1000);

  const waitingTimeBetweenTwoSends = 15*60*1000; // 15 minutes

  const intervalMyRainbowId = setInterval(async () => {
    await sendingDataToMyRainbow(tankId)
    .catch(error => {
      console.error("Error during data sending to MyRainbow :", error);
    });
  }, waitingTimeBetweenTwoSends);

  intervals.set(tankId, [intervalOPCUAId, intervalMyRainbowId]);
}

// main function:
// This asynchronous function serves as the entry point of the application.
// It initializes sessions for all tanks, sets up intervals for OPC UA data retrieval and data sending to MyRainbow.
// The function iterates through each tank, retrieves data from OPC UA server at regular intervals,
// and sends the data to MyRainbow at specified intervals.
// Any errors that occur during data retrieval or sending are logged to the console.
async function main() {
  await initializeSessions(tanks);

  const tanksIDWithActiveSession = Array.from(sessions)
    .filter(([tankId, session]) => session !== null)
    .map(([tankId, session]) => tankId);

  const tanksWithActiveSession = tanks.filter(tank =>
    tanksIDWithActiveSession.includes(Object.keys(tank)[0])
  );

  tanksWithActiveSession.forEach(tank => {
    const tankId = Object.keys(tank)[0];
    const synchro = tank[tankId].synchro;

    setSynchro(tankId, synchro);
  });
  
  
  const tryingToConnectNewTanks = setInterval(async () => {
    const tanksWithoutSession = Array
    .from(sessions)
    .filter(([tankId, session]) => session === null)
    .map(([tankId, session]) => tankId);

    for(const tankId of tanksWithoutSession){
      const tankInfos = tanks.find(tank => Object.keys(tank)[0] === tankId)[tankId];
      try {
        const session = await connectAndCreateSession(tankInfos, clients.get(tankId));
        
        if(!session) {
          continue;
        }

        sessions.set(tankId, session);
        const synchro = tankInfos.synchro;
        setSynchro(tankId, synchro);
      } catch (error) {
        console.error(`Error while trying to connect to new tank ${tankId} :`, error);
      }
    }
  }, 20000);

  intervals.set("tryingToConnectNewTanks", tryingToConnectNewTanks);
}

async function setOpenAtLogin() {
  try {
    const data = await fs.readFile(path.join(pathToJSON, 'open_at_login.json'), 'utf-8');
    console.log('Open at login data:', JSON.parse(data));
    mainWindow.webContents.send('initialize-open-at-login', JSON.parse(data));
    app.setLoginItemSettings({
      openAtLogin: JSON.parse(data),
    });
  } catch (error) {
    console.error('Failed to read open at login file', error);
    throw error;
  }
}


/**
 * Initializes the main window, sets up the tray icon, and handles application lifecycle events.
 * This script configures the main behaviors for the application window, tray interaction, and ensures
 * clean shutdown procedures are followed. It also handles reactivation of the app and other global events.
 *
 * Operations:
 * 1. Create the main application window and configure the tray icon with a context menu.
 * 2. Define the interaction behavior of the application, such as minimizing to tray and handling window close events
 *    to prevent the application from exiting unless explicitly quitting.
 * 3. Set up event listeners for 'did-finish-load' to initialize views and perform startup operations.
 * 4. Handle application activation events, particularly for macOS, to recreate the window if no other windows exist.
 * 5. Manage application quit procedures to ensure all intervals are cleared and sessions are properly closed.
 * 6. Terminate any active subscriptions and close all client and session connections before the application quits.
 *
 * Lifecycle Event Handlers:
 * - 'whenReady': Prepares the main window, tray icon, and associated events when the app is ready.
 * - 'before-quit': Ensures that all cleanup is performed before the application quits, such as clearing intervals
 *   and terminating remote access subscriptions.
 * - 'window-all-closed': Handles cleanup of sessions and clients, especially relevant for non-macOS platforms,
 *   where the app should quit when all windows are closed.
 * - 'activate': Handles re-creating the window on macOS when the dock icon is clicked and no other windows are open.
 *
 * Note:
 * - The application distinguishes between user-initiated quit actions and programmatic close events,
 *   using a flag `isQuitting` to determine the appropriate action (hide vs. quit).
 * - This script assumes that global variables for sessions, clients, and other states are managed elsewhere
 *   in the application's codebase.
 */
app.whenReady().then(() => {
  mainWindow = createWindow();
  const tray = new Tray(path.join(pathToAssets, 'img', 'icon.ico'));

  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "Afficher l'application",
      click: function() {
        mainWindow.show();
      }
    }, 
    {
      label: "Quitter",
      click: function() {
        isQuitting = true;
        app.quit();
      }
    }
  ]));

  mainWindow.webContents.on('did-finish-load', ()=>{
    mainWindow.webContents.send('initialize-view', tanks);
    main();
    setOpenAtLogin();
  });

  mainWindow.on('minimize', function (event) {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('close', function (event) {
    if(!isQuitting){
      event.preventDefault();
      mainWindow.hide();
      event.returnValue = false;
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
});

app.on('before-quit', () => {
  isQuitting = true;
  intervals.forEach(interval => {
    clearInterval(interval);
  });
});

app.on('window-all-closed', async function () {
  if(remoteAccessSubscription && remoteAccessSubscription !== null) {
    remoteAccessSubscription.terminate();
    // EtatConnexion à 0
    const requestAccessValue = {
      dataType: "SByte", 
      value: 0
    };

    const remoteAccessStateId="ns=6;s=::OpcUaWrite:lo_WidgetEtatConnexion";

    for(const session of sessions.values()){
      if(session && session !== null){
        await session.writeSingleNode(remoteAccessStateId, requestAccessValue);
      }
    }
  }
  
  for(const session of sessions.values()){
    if(session && session !== null){
      await session.close();
    }
  }

  for(const client of clients.values()){
    await client.disconnect();
  }

  if (process.platform !== 'darwin') app.quit()
});