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

/**
 * Converts JSON data into an Excel worksheet and writes it to an XLSX file, which is then automatically downloaded.
 * This function is utilized for exporting data, such as historical entries, into a format that can be easily
 * shared or analyzed outside the application.
 *
 * @param {Array} jsonData - An array of objects where each object represents a row in the resulting Excel file.
 *                           Each key in the object represents a column header in the Excel sheet.
 * @param {string} fileName - The desired name of the resulting Excel file, without the file extension.
 *
 * Operations:
 * 1. Convert the provided JSON data into an Excel worksheet using the XLSX library's `json_to_sheet` method.
 *    This method maps each object in the array to a row in the worksheet, and object keys to column headers.
 * 2. Create a new workbook using `book_new` method from the XLSX library.
 * 3. Append the newly created worksheet to the workbook as a sheet named "Historique".
 * 4. Write the workbook to an XLSX file and initiate a download using `writeFile`. The file is named according
 *    to the `fileName` parameter with a `.xlsx` extension appended.
 *
 * Note:
 * - This function assumes that the JSON data is structured correctly for conversion and that each object
 *   in the array has consistent keys which will serve as the column headers in the Excel file.
 * - The function triggers an automatic download of the file, which requires appropriate permissions and settings
 *   in the user's browser to successfully save the file locally.
 */
function exportToExcel(jsonData, fileName) {
    // Convertir les données en feuille de travail
    const worksheet = XLSX.utils.json_to_sheet(jsonData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Historique");

    // Écrire le fichier et le télécharger
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Asynchronously generates a table displaying the historical data of a specific tank.
 * This function fetches JSON-formatted historical data from a file, constructs a table to display
 * this data, and appends the table to a designated container in the HTML document.
 *
 * @param {string} tankId - The unique identifier for the tank whose history is to be displayed.
 * 
 * Operations:
 * 1. Read the historical data from a JSON file named `history_{tankId}.json` using `window.electronAPI.readJsonFile`.
 * 2. Clear the existing content in the 'history-container' to prepare for new data.
 * 3. Construct a new table with columns for Date, Hour, Mode, Temperature, Fill Rate, Volume, and Faults.
 * 4. Populate the table with data from the JSON file, adding each historical entry as a row in the table.
 * 5. Append the constructed table to the 'history-container' in the DOM to make it visible to the user.
 *
 * Error Handling:
 * - Catch and log any errors encountered during the reading of the JSON file or the processing of data.
 * - Errors may prevent the table from being populated but should be handled gracefully to avoid script crashes.
 *
 * Note:
 * - This function relies on a specific data structure in the JSON file; each entry should have the properties:
 *   Date, Hour, Mode, Temperature, Fill Rate, Volume, and Faults.
 * - The function includes handling to reverse the data array to display the most recent entries first.
 * - Proper formatting and localization (e.g., date and temperature) should be ensured by the respective utility functions.
 */
async function generatingHistoryTable(tankId){
    try {
        var jsonData = await window.electronAPI.readJsonFile(`history_${tankId}.json`);

        const historyTitle = document.getElementById('history-title');
        historyTitle.innerText = `Historique de la cuve ${tankId}`;
        
        // CONTAINER
        const historyContainer = document.getElementById('history-container');
        historyContainer.innerHTML = '';

        // TABLE
        const historyTable = document.createElement('table');
        historyTable.id = 'history-table';
        historyTable.className = 'table is-striped is-hoverable is-fullwidth';

        // TABLE HEAD
        const tableHead = document.createElement('thead');
        tableHead.className = 'history-header';

        // TR IN HEAD
        const tableHeadRow = document.createElement('tr');

        // THs IN HEAD
        const tableHeadDate = document.createElement('th');
        tableHeadDate.innerText = 'Date';

        const tableHeadHeure = document.createElement('th');
        tableHeadHeure.innerText = 'Heure';

        const tableHeadMode = document.createElement('th');
        tableHeadMode.innerText = 'Mode';

        const tableHeadTemperature = document.createElement('th');
        tableHeadTemperature.innerText = 'Température';

        const tableHeadTaux = document.createElement('th');
        tableHeadTaux.innerText = 'Taux de remplissage';

        const tableHeadVolume = document.createElement('th');
        tableHeadVolume.innerText = 'Volume';

        const tableHeadDefauts = document.createElement('th');
        tableHeadDefauts.innerText = 'Défauts';

        // APPENDING TO TABLE HEAD
        tableHeadRow.appendChild(tableHeadDate);
        tableHeadRow.appendChild(tableHeadHeure);
        tableHeadRow.appendChild(tableHeadMode);
        tableHeadRow.appendChild(tableHeadTemperature);
        tableHeadRow.appendChild(tableHeadTaux);
        tableHeadRow.appendChild(tableHeadVolume);
        tableHeadRow.appendChild(tableHeadDefauts);

        tableHead.appendChild(tableHeadRow);

        // TABLE BODY
        const tableBody = document.createElement('tbody');
        tableBody.className = 'history-body';

        jsonData = jsonData.reverse();

        jsonData.forEach((item) => {
            const date = item.Date;
            const heure = item.Heure;
            const mode = item.Mode;
            const temperature = item.Temperature;
            const taux = item.Taux;
            const volume = item.Volume;
            const defauts = item.Defauts;

            // TR IN BODY
            const tableBodyRow = document.createElement('tr');

            // TDs IN BODY
            const tableBodyDate = document.createElement('td');
            tableBodyDate.innerText = date;

            const tableBodyHeure = document.createElement('td');
            tableBodyHeure.innerText = heure;

            const tableBodyMode = document.createElement('td');
            tableBodyMode.innerText = getMode(mode);

            const tableBodyTemperature = document.createElement('td');
            tableBodyTemperature.innerText = temperature;
            tableBodyTemperature.className = 'align-right';

            const tableBodyTaux = document.createElement('td');
            tableBodyTaux.innerText = taux;
            tableBodyTaux.className = 'align-right';

            const tableBodyVolume = document.createElement('td');
            tableBodyVolume.innerText = volume;
            tableBodyVolume.className = 'align-right';

            const tableBodyDefauts = document.createElement('td');
            tableBodyDefauts.innerText = defauts;

            // APPENDING TO TABLE BODY
            tableBodyRow.appendChild(tableBodyDate);
            tableBodyRow.appendChild(tableBodyHeure);
            tableBodyRow.appendChild(tableBodyMode);
            tableBodyRow.appendChild(tableBodyTemperature);
            tableBodyRow.appendChild(tableBodyTaux);
            tableBodyRow.appendChild(tableBodyVolume);
            tableBodyRow.appendChild(tableBodyDefauts);

            tableBody.appendChild(tableBodyRow);
        });

        // APPENDING TO TABLE
        historyTable.appendChild(tableHead);
        historyTable.appendChild(tableBody);

        // APPENDING TO CONTAINER
        historyContainer.appendChild(historyTable);

        return jsonData;

    } catch(error) {
        console.error('Error reading data.json', error);
    }
}

document.addEventListener('DOMContentLoaded', async (event) => {
    const tankId = localStorage.getItem('tankId');
    if(tankId) {
        const jsonData = await generatingHistoryTable(tankId);
        const exportButton = document.getElementById('export-excel');
        const deleteButton = document.getElementById('delete-history');

        exportButton.addEventListener('click', () => {
            exportToExcel(jsonData, `Historique_${tankId}`);
        });

        deleteButton.addEventListener('click', async () => {
            if(confirm('Voulez-vous vraiment supprimer l\'historique de cette cuve ?')){
                await window.electronAPI.deleteJsonFileContent(`history_${tankId}.json`);
                jsonData = await generatingHistoryTable(tankId);
            }
        });
    }
});