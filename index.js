const http = require('node:http');
const axios = require('axios');
const cheerio = require('cheerio');

function IST_date() {
    const options = {
        timeZone: 'Asia/Kolkata',
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    return new Date(new Date().toLocaleString('en-US', options));
}

function scrapeCompleteTable($) {
    const table = $('#mix-chart > table tr');
    let completeData = [];
    
    // Get table headers (game names)
    const headers = [];
    const headerRow = table.eq(1);
    headerRow.find('th').each((i, el) => {
        headers.push($(el).text().trim());
    });
    
    // Get all data rows (skip first 2 rows - they are headers, skip last 2 rows)
    for (let i = 2; i < table.length - 2; i++) {
        const row = table.eq(i);
        const cells = row.children();
        
        if (cells.length > 0) {
            let rowData = {};
            
            // First cell is usually date/time
            const dateCell = cells.first();
            rowData.date = dateCell.attr('title') || dateCell.text().trim();
            
            // Rest are game results
            cells.not(':first-child').each((j, cell) => {
                if (j < headers.length) {
                    rowData[headers[j]] = $(cell).text().trim();
                }
            });
            
            completeData.push(rowData);
        }
    }
    
    return { headers, data: completeData };
}

function generateHTMLTable(tableData) {
    const { headers, data } = tableData;
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Satta King Complete Results</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        h1 {
            text-align: center;
            color: #333;
            margin: 20px 0 30px 0;
            font-size: 36px;
        }
        .table-container {
            width: 100%;
            overflow-x: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 0;
        }
        th, td {
            padding: 20px 12px;
            text-align: center;
            border: 1px solid #ddd;
        }
        th {
            background-color: #4CAF50;
            color: white;
            font-weight: bold;
            position: sticky;
            top: 0;
            font-size: 24px;
        }
        th:first-child, td:first-child {
            width: 120px;
            font-size: 22px;
            font-weight: bold;
        }
        th:not(:first-child), td:not(:first-child) {
            width: 150px;
            font-size: 32px;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }

        .date-column {
            background-color: #e8f5e8;
            font-weight: bold;
        }
        .no-data {
            color: #999;
            font-style: italic;
        }
        tr:hover {
            background-color: #fff3cd !important;
            border: 2px solid #ffc107;
        }
        .update-time {
            text-align: center;
            color: #666;
            margin: 20px 0;
            font-size: 14px;
        }
        @media (max-width: 768px) {
            body {
                padding: 0;
            }
            th, td {
                padding: 15px 8px;
                font-size: 20px;
            }
            th:first-child, td:first-child {
                font-size: 18px;
            }
            th:not(:first-child), td:not(:first-child) {
                font-size: 24px;
            }
            h1 {
                font-size: 28px;
                margin: 10px 0 20px 0;
            }
        }
    </style>
</head>
<body>
    <h1>🎲 Satta King Complete Results 🎲</h1>
    <div class="table-container">
        <table>
                <thead>
                    <tr>
                        <th>Date</th>`;
    
    // Add headers
    headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    
    html += `</tr></thead><tbody>`;
    
    // Add data rows
    data.forEach((row, index) => {
        html += `<tr>`;
        html += `<td class="date-column">${row.date}</td>`;
        
        headers.forEach(header => {
            const value = row[header] || 'XX';
            const cellClass = value === 'XX' ? 'no-data' : '';
            html += `<td class="${cellClass}">${value}</td>`;
        });
        
        html += `</tr>`;
    });
    
    html += `</tbody></table>
    </div>
</body>
</html>`;
    
    return html;
}

const server = http.createServer(async (req, res) => {
    try {
        const response = await axios.get("https://satta-king-fast.com", {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Check if user wants JSON data
        if (req.headers['accept'] === 'application/json' || req.url.includes('json')) {
            const tableData = scrapeCompleteTable($);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(tableData, null, 2));
            return;
        }
        
        // Check if user wants plain text (for bots/APIs)
        if (!req.headers['user-agent'] || !req.headers['user-agent'].includes('Mozilla')) {
            const tableData = scrapeCompleteTable($);
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            
            let textOutput = 'SATTA KING RESULTS\n';
            textOutput += '='.repeat(50) + '\n\n';
            
            tableData.data.forEach((row, index) => {
                textOutput += `${index === 0 ? '*** LATEST *** ' : ''}${row.date}\n`;
                tableData.headers.forEach(header => {
                    const value = row[header] || 'XX';
                    textOutput += `${header}: ${value}\n`;
                });
                textOutput += '-'.repeat(30) + '\n';
            });
            
            res.end(textOutput);
            return;
        }
        
        // Default: Return HTML table
        const tableData = scrapeCompleteTable($);
        const html = generateHTMLTable(tableData);
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        
    } catch (error) {
        console.error('Error scraping data:', error);
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
    console.log(`📊 Access modes:`);
    console.log(`   • HTML Table: http://${HOST}:${PORT}`);
    console.log(`   • JSON Data: http://${HOST}:${PORT}?json=1`);
    console.log(`   • Text Format: Use non-browser user-agent`);
});