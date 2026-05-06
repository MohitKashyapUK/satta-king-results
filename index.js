const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');
const cheerio = require('cheerio');

// Helper function to process game results logic
function getGameResult(data, key) {
    if (!data || data.length === 0) return 'XX';

    // Priority 1: Check last available result (Latest)
    const latest = data[data.length - 1];
    if (latest && latest[key] && latest[key] !== 'XX') {
        return latest[key];
    }

    // Priority 2: Check second-last result (Old)
    if (data.length >= 2) {
        const previous = data[data.length - 2];
        if (previous && previous[key] && previous[key] !== 'XX') {
            return previous[key] + '.';
        }
    }

    // Fallback
    return 'XX';
}

// Helper function to scrape the data from satta-king-fast.com
async function scrapeData() {
    const response = await axios.get("https://satta-king-fast.com/", {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        validateStatus: () => true
    });

    if (!response.data || response.data.toString().trim() === '') {
        throw new Error('Empty response received from the website');
    }

    const $ = cheerio.load(response.data);

    // Second table has the monthly data
    const table = $('table').eq(1);

    const headers = ['DSWR', 'FRBD', 'GZBD', 'GALI'];
    const completeData = [];
    
    // Extract month and year from the first row
    let monthNum = new Date().getMonth() + 1;
    let yearNum = new Date().getFullYear();
    const titleText = table.find('tr').eq(0).text();
    const match = titleText.match(/Chart of\s+([A-Za-z]+)\s+(\d{4})/i);
    
    if (match) {
        const monthName = match[1];
        yearNum = match[2];
        const dateObj = new Date(`${monthName} 1, ${yearNum}`);
        if (!isNaN(dateObj)) {
            monthNum = dateObj.getMonth() + 1;
        }
    }
    
    const formattedMonth = monthNum.toString().padStart(2, '0');

    table.find('tr').each((i, row) => {
        if (i < 2) return; // Skip title and header rows
        
        const cols = $(row).find('td');
        if (cols.length >= 5) {
            const dayStr = $(cols[0]).text().trim();
            
            // Validate day string (e.g. '01', '15', etc.)
            if (/^\d{1,2}$/.test(dayStr)) {
                const formattedDay = dayStr.padStart(2, '0');
                const date = `${formattedDay}-${formattedMonth}-${yearNum}`;
                
                const rowData = {
                    date: date,
                    DSWR: $(cols[1]).text().trim() || 'XX',
                    FRBD: $(cols[2]).text().trim() || 'XX',
                    GZBD: $(cols[3]).text().trim() || 'XX',
                    GALI: $(cols[4]).text().trim() || 'XX'
                };
                
                completeData.push(rowData);
            }
        }
    });

    return { headers, data: completeData };
}


// Function to generate initial HTML
function generateInitialHTML(headers, initialData) {
    const totalRows = initialData.length;

    let html = `<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Satta King Complete Results</title>
    <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    h1 { text-align: center; color: #333; margin: 20px 0 30px 0; font-size: 36px; }
    .table-container { width: 100%; overflow-x: auto; }
    table {
        width: 100%;
        border-collapse: collapse;
        margin: 0;
        table-layout: fixed;
    }
    th, td { padding: 20px 12px; text-align: center; border: 1px solid #ddd; }
    th { background-color: #4CAF50; color: white; font-weight: bold; position: sticky; top: 0; font-size: 24px; }
    th:first-child, td:first-child {
        width: 150px;
        font-size: 22px;
        font-weight: bold;
    }
    th:not(:first-child), td:not(:first-child) {
        font-size: 32px;
        font-weight: bold;
    }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .date-column { background-color: #e8f5e8; font-weight: bold; }
    .no-data { color: #999; font-style: italic; }
    tr:hover { background-color: #fff3cd !important; border: 2px solid #ffc107; }
    #toggleButton { display: block; margin: 20px auto; padding: 10px 20px; font-size: 16px; cursor: pointer; border: 1px solid #4CAF50; background-color: white; color: #4CAF50; border-radius: 5px; transition: background-color 0.3s, color 0.3s; }
    #toggleButton:hover { background-color: #4CAF50; color: white; }
    #toggleButton:disabled { background-color: #ccc; cursor: not-allowed; }

    @media (max-width: 480px) {
        h1 {
            font-size: 24px;
            margin: 20px 10px;
        }
        th {
            font-size: 14px;
            padding: 12px 4px;
        }
        td {
            padding: 12px 4px;
        }
        th:first-child, td:first-child {
            width: 75px;
            font-size: 14px;
        }
        th:not(:first-child), td:not(:first-child) {
            font-size: 20px;
        }
    }
    </style>
    </head>
    <body>
    <h1>🎲 Satta King Complete Results 🎲</h1>
    <div class="table-container">
    <table id="results-table">
    <thead>
    <tr>
    <th>Date</th>
    ${headers.map(h => `<th>${h}</th>`).join('')}
    </tr>
    </thead>
    <tbody>`;

    // Initial data (last 2 results)
    initialData.forEach(row => {
        html += `<tr>
        <td class="date-column">${row.date}</td>
        ${headers.map(header => {
            const value = row[header] || 'XX';
            const cellClass = value === 'XX' ? 'no-data' : '';
            return `<td class="${cellClass}">${value}</td>`;
        }).join('')}
        </tr>`;
    });

    html += `</tbody>
    </table>
    </div>
    <button id="toggleButton">Show All Results</button>

    <script>
    const toggleButton = document.getElementById('toggleButton');
    const tableBody = document.querySelector('#results-table tbody');

    toggleButton.addEventListener('click', async () => {
        toggleButton.textContent = 'Loading...';
        toggleButton.disabled = true;

        try {
            // Fetch all data from API
            const response = await fetch('/all-results');
            const fullData = await response.json();

            // Clear table body
            tableBody.innerHTML = '';

            // Create new table rows
            fullData.data.forEach(row => {
                let rowHtml = '<tr>';
                rowHtml += \`<td class="date-column">\${row.date}</td>\`;

                fullData.headers.forEach(header => {
                    const value = row[header] || 'XX';
                    const cellClass = value === 'XX' ? 'no-data' : '';
                    rowHtml += \`<td class="\${cellClass}">\${value}</td>\`;
                });

                rowHtml += '</tr>';
                tableBody.innerHTML += rowHtml;
            });

            // Hide button
            toggleButton.style.display = 'none';

        } catch (error) {
            toggleButton.textContent = 'Failed to load. Try again.';
            toggleButton.disabled = false;
            console.error('Error fetching all results:', error);
        }
    });
    </script>
    </body>
    </html>`;

    return html;
}


const server = http.createServer(async (req, res) => {
    try {
        // Favicon.ico route
        if (req.url === '/favicon.ico') {
            const faviconPath = path.join(__dirname, 'favicon.ico');

            if (fs.existsSync(faviconPath)) {
                const faviconData = fs.readFileSync(faviconPath);
                res.writeHead(200, {
                    'Content-Type': 'image/x-icon'
                });
                res.end(faviconData);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Favicon not found');
            }
            return;
        }

        // All results API endpoint
        if (req.url === '/all-results') {
            const tableData = await scrapeData();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(tableData));
            return;
        }

        // Map for easy lookup: route -> data key
        const gameMap = {
            '/faridabad-string': 'FRBD',
            '/gaziabad-string': 'GZBD',
            '/gali-string': 'GALI',
            '/disawar-string': 'DSWR'
        };

        // Handle individual game string routes
        if (gameMap[req.url]) {
            const { data } = await scrapeData();
            const key = gameMap[req.url];
            const result = getGameResult(data, key);

            // Format: "Name [Value]"
            const displayNames = {
                '/faridabad-string': 'Faridabad',
                '/gaziabad-string': 'Gaziabad',
                '/gali-string': 'Gali',
                '/disawar-string': 'Disawar'
            };

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(`${displayNames[req.url]} ${result}`);
            return;
        }

        // Handle /sk-string (Combined)
        if (req.url === '/sk-string') {
            const { data } = await scrapeData();

            // Use the data from the last row for the Date header
            const lastRow = data[data.length - 1];
            const date = lastRow ? lastRow.date : 'Unknown Date';

            const fbd = getGameResult(data, 'FRBD');
            const gb = getGameResult(data, 'GZBD');
            const gali = getGameResult(data, 'GALI');
            const ds = getGameResult(data, 'DSWR');

            const responseText = `${date}\n\nFaridabad ${fbd}\nGaziabad ${gb}\nGali ${gali}\nDisawar ${ds}`;

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(responseText);
            return;
        }

        // JSON data request
        if (req.headers['accept'] === 'application/json' || req.url.includes('json')) {
            const tableData = await scrapeData();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(tableData, null, 2));
            return;
        }

        // Initial Page Load (Default)
        const { headers, data } = await scrapeData();
        const lastTwoResults = data.slice(-2); // Last 2 results only
        const html = generateInitialHTML(headers, lastTwoResults);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);

    } catch (error) {
        console.error('Error:', error);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`
        <html>
        <body style="font-family: Arial; text-align: center; margin-top: 50px;">
        <h2>⚠️ Error fetching data</h2>
        <p>Unable to fetch data from Satta King website.</p>
        <p><strong>Error:</strong> ${error.message}</p>
        <p><a href="javascript:location.reload()">Try Again</a></p>
        </body>
        </html>
        `);
    }
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, HOST, () => {
    console.log(`🚀 Satta King Scraper Server running at http://${HOST}:${PORT}`);
    console.log(`   • Initial page (2 results): http://${HOST}:${PORT}`);
    console.log(`   • Full data API: http://${HOST}:${PORT}/all-results`);
    console.log(`   • Individual game strings:`);
    console.log(`     - Faridabad: http://${HOST}:${PORT}/faridabad-string`);
    console.log(`     - Gaziabad: http://${HOST}:${PORT}/gaziabad-string`);
    console.log(`     - Gali: http://${HOST}:${PORT}/gali-string`);
    console.log(`     - Disawar: http://${HOST}:${PORT}/disawar-string`);
    console.log(`   • Combined string: http://${HOST}:${PORT}/sk-string`);
    console.log(`   • Favicon: http://${HOST}:${PORT}/favicon.ico`);
});