const express = require('express');
const puppeteer = require('puppeteer')
const cors = require('cors');
app = express();
app.use(cors());

app.get('/api/book/:isbn', async (req, res) => {
    const { isbn } = req.params;
    const url = `https://opac.nlv.gov.vn/pages/opac/wpid-search-stype-form-quick-sfield-isbn-keyword-${isbn}.html`;

    try {
        // Khởi tạo trình duyệt và mở trang
        const browser = await puppeteer.launch({
            args: [
                "--disable-setuid-sandbox",
                "--no-sandbox",
                "--single-process",
                "--no-zygote",
            ],
            executablePath:
                process.env.NODE_ENV === "production"
                    ? process.env.PUPPETEER_EXECUTABLE_PATH
                    : puppeteer.executablePath(),
        });
        const page = await browser.newPage();

        // Điều hướng đến URL của sách với ISBN
        await page.goto(url, { waitUntil: 'networkidle2' });

        const buttons = await page.$$('.btn.btn-default'); // Thay bằng class thực tế của button
        for (const button of buttons) {
            const buttonText = await page.evaluate(el => el.textContent, button);
            if (buttonText.includes('Xem chi tiết')) {
                await button.click();
                break; 
            }
        }

        await page.waitForSelector('div.media-body > dl > dd:nth-child(2) > dl > dd:nth-child(2) > a');

        // Lấy dữ liệu từ trang sau khi đã tải đầy đủ
        const result = await page.evaluate(() => {
            const title = document.querySelector('#ulSearchResult > li > div.media-body > h4 > a')?.innerText.trim();
            const author = document.querySelector('div.media-body > dl > dd:nth-child(2) > dl > dd:nth-child(2) > a')?.innerText.trim();
            let publisher = document.querySelector('div.media-body > dl > dd:nth-child(3) > dl > dd:nth-child(2)')?.innerText.trim();
            const description = document.querySelector('div.media-body > dl > dd:nth-child(5) > dl > dd:nth-child(2)')?.innerText.trim();
            const tags = document.querySelector('div.media-body > dl > dd:nth-child(6) > dl > dd:nth-child(2)')?.innerText.trim()
            const des = document.querySelector('#divBibDetail727879 > div.media-body > dl > dd:nth-child(8) > dl > dd:nth-child(2)')?.innerHTML.trim()
            const yearRegex = /\b\d{4}\b$/;
            const yearMatch = publisher.match(yearRegex);
            const publisherRegex = /; (.*?), \d{4}$/;
            const pageRegex = /(\d+)\s*tr/;
            let year = '';
            let pages;
            const publisherMatch = publisher.match(publisherRegex);
            if (publisherMatch) {
                publisher = publisherMatch[1].trim();
            }
            if (yearMatch) {
                year = yearMatch[0];
                publisher = publisher.replace(/^H\.:.*?; /, '').replace(yearRegex, '').trim().replace(/[,;]$/, '');
            }
            const pageMatch = description.match(pageRegex);
            if (pageMatch) {
                pages = pageMatch[1];
            }
            return { title, author, publisher: publisher, publish_year: year, page: pages, tags, description : des };
        });


        // Đóng trình duyệt
        await browser.close();

        // Gửi dữ liệu dưới dạng JSON
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching data' });
    }
})

// Configuring port for APP
app.listen(3000 || process.env.PORT, () => console.log(`Listening on port 3000`))

