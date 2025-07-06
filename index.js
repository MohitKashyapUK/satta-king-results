const http = require('node:http');
const axios = require('axios');
const cheerio = require('cheerio');

// Helper function to scrape the data. Ise alag kar diya taaki dobara use kar sakein.
async function scrapeData() {
    const response = await axios.get("https://satta-king-fast.com", {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const $ = cheerio.load(response.data);
    
    const table = $('#mix-chart > table tr');
    let completeData = [];
    
    const headers = [];
    const headerRow = table.eq(1);
    headerRow.find('th').each((i, el) => {
        headers.push($(el).text().trim());
    });
    
    for (let i = 2; i < table.length - 2; i++) {
        const row = table.eq(i);
        const cells = row.children();
        
        if (cells.length > 0) {
            let rowData = {};
            const dateCell = cells.first();
            rowData.date = dateCell.attr('title') || dateCell.text().trim();
            
            cells.not(':first-child').each((j, cell) => {
                if (j < headers.length) {
                    rowData[headers[j]] = $(cell).text().trim();
                }
            });
            completeData.push(rowData);
        }
    }
    
    // Poora data headers ke saath return karein
    return { headers, data: completeData };
}


// Yeh function ab initial HTML banayega
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
        .table-container { width: 100%; }
        table { width: 100%; border-collapse: collapse; margin: 0; }
        th, td { padding: 20px 12px; text-align: center; border: 1px solid #ddd; }
        th { background-color: #4CAF50; color: white; font-weight: bold; position: sticky; top: 0; font-size: 24px; }
        th:first-child, td:first-child {
            width: 150px; /* Badi screen par Date column ki width set kar di hai */
            font-size: 22px;
            font-weight: bold;
        }
        th:not(:first-child), td:not(:first-child) { font-size: 32px; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .date-column { background-color: #e8f5e8; font-weight: bold; }
        .no-data { color: #999; font-style: italic; }
        tr:hover { background-color: #fff3cd !important; border: 2px solid #ffc107; }
        #toggleButton { display: block; margin: 20px auto; padding: 10px 20px; font-size: 16px; cursor: pointer; border: 1px solid #4CAF50; background-color: white; color: #4CAF50; border-radius: 5px; transition: background-color 0.3s, color 0.3s; }
        #toggleButton:hover { background-color: #4CAF50; color: white; }
        #toggleButton:disabled { background-color: #ccc; cursor: not-allowed; }

        /* --- MEDIA QUERY FOR MOBILE RESPONSIVENESS --- */
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
                width: auto; /* Chhoti screen par Date column ki fixed width hata di */
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

    // Sirf initial data (aakhiri 2) daalein
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
                // Naye API endpoint se poora data fetch karein
                const response = await fetch('/all-results');
                const fullData = await response.json();
                
                // Table body ko khali karein
                tableBody.innerHTML = '';
                
                // Naye data se table rows banayein
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
                
                // Button ko hata dein
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
        // --- YAHAN ROUTING LOGIC ADD KIYA GAYA HAI ---

        // 1. Agar koi /all-results maange to poora data JSON mein bhej do
        if (req.url === '/all-results') {
            const tableData = await scrapeData();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(tableData));
            return;
        }

        // 2. Agar koi JSON data maange (purana logic)
        if (req.headers['accept'] === 'application/json' || req.url.includes('json')) {
            const tableData = await scrapeData();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(tableData, null, 2));
            return;
        }
        
        // 3. Initial Page Load (Default)
        const { headers, data } = await scrapeData();
        const lastTwoResults = data.slice(-2); // Sirf aakhiri 2 results
        const html = generateInitialHTML(headers, lastTwoResults);
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        
    } catch (error) {
        console.error('Error:', error);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`
            <html>
                <body style="font-family: Arial; text-align: center; margin-top: 50px;">
                    <h2>❌ Error fetching data</h2>
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
});