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

// Helper function to scrape data from sattakingrecords.com monthly record page
async function scrapeData() {
    // Dynamically build URL using current year and month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // "01" to "12"

    const url = `https://sattakingrecords.com/satta-king-record.php?year_select=${year}&month_select=${month}`;

    const response = await axios.get(url, {
        timeout: 10000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    const $ = cheerio.load(response.data);

    // Games we want to track (as they appear in the table header)
    const targetGames = ['DISAWAR', 'FARIDABAD', 'GHAZIABAD', 'GALI'];

    // Internal short keys
    const gameKeyMap = {
        'DISAWAR': 'DSWR',
        'FARIDABAD': 'FRBD',
        'GHAZIABAD': 'GZBD',
        'GALI': 'GALI'
    };

    let colIndices = {};
    let dateColIndex = -1;
    const completeData = [];

    $('table').each((_, table) => {
        const firstRow = $(table).find('tr').first();
        const ths = firstRow.find('th, td');

        const tempHeaders = [];
        ths.each((i, th) => {
            tempHeaders.push($(th).text().trim().toUpperCase());
        });

        // Only process the table that has a DATE column
        const dateIdx = tempHeaders.indexOf('DATE');
        if (dateIdx === -1) return;

        dateColIndex = dateIdx;

        // Find target game column indices
        colIndices = {};
        tempHeaders.forEach((h, i) => {
            if (targetGames.includes(h)) {
                colIndices[i] = h;
            }
        });

        // Parse data rows (skip header row)
        $(table).find('tr').slice(1).each((_, tr) => {
            const cells = $(tr).find('td');
            if (cells.length === 0) return;

            const dayNum = $(cells[dateColIndex]).text().trim();
            if (!dayNum || isNaN(parseInt(dayNum))) return;

            // Format date as DD-MM-YYYY
            const day = String(parseInt(dayNum)).padStart(2, '0');
            const date = `${day}-${month}-${year}`;

            const row = { date };
            let hasAnyResult = false;

            Object.entries(colIndices).forEach(([colIdx, gameName]) => {
                const cell = cells[parseInt(colIdx)];
                const val = cell ? $(cell).text().trim() : '';
                const shortKey = gameKeyMap[gameName];

                if (val && val !== '--' && val !== '') {
                    row[shortKey] = val;
                    hasAnyResult = true;
                } else {
                    row[shortKey] = 'XX';
                }
            });

            // Only include rows that have at least one real result
            if (hasAnyResult) {
                completeData.push(row);
            }
        });

        return false; // Stop after first matching table
    });

    // Sort by date ascending (DD-MM-YYYY)
    completeData.sort((a, b) => {
        const toISO = (d) => d.split('-').reverse().join('-');
        return new Date(toISO(a.date)) - new Date(toISO(b.date));
    });

    const shortHeaders = ['DSWR', 'FRBD', 'GZBD', 'GALI'];
    return { headers: shortHeaders, data: completeData };
}


// Function to generate initial HTML
function generateInitialHTML(headers, initialData) {
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
        h1 { font-size: 24px; margin: 20px 10px; }
        th { font-size: 14px; padding: 12px 4px; }
        td { padding: 12px 4px; }
        th:first-child, td:first-child { width: 75px; font-size: 14px; }
        th:not(:first-child), td:not(:first-child) { font-size: 20px; }
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
            const response = await fetch('/all-results');
            const fullData = await response.json();

            tableBody.innerHTML = '';

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
        // Favicon route
        if (req.url === '/favicon.ico') {
            const faviconPath = path.join(__dirname, 'favicon.ico');
            if (fs.existsSync(faviconPath)) {
                const faviconData = fs.readFileSync(faviconPath);
                res.writeHead(200, { 'Content-Type': 'image/x-icon' });
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

        // Default: Initial Page Load (last 2 results)
        const { headers, data } = await scrapeData();
        const lastTwoResults = data.slice(-2);
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
    console.log(`   • Full data API:             http://${HOST}:${PORT}/all-results`);
    console.log(`   • Individual game strings:`);
    console.log(`     - Faridabad: http://${HOST}:${PORT}/faridabad-string`);
    console.log(`     - Gaziabad:  http://${HOST}:${PORT}/gaziabad-string`);
    console.log(`     - Gali:      http://${HOST}:${PORT}/gali-string`);
    console.log(`     - Disawar:   http://${HOST}:${PORT}/disawar-string`);
    console.log(`   • Combined string: http://${HOST}:${PORT}/sk-string`);
    console.log(`   • Favicon:         http://${HOST}:${PORT}/favicon.ico`);
});