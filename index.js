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

        await page.waitForSelector('#aBibDetail727468');
        await page.click('#aBibDetail727468');

        // Chờ cho các phần tử cần thiết tải xong (sử dụng selector của phần tử mà bạn muốn lấy)
        await page.waitForSelector('#divBibDetail727468 > div.media-body > dl > dd:nth-child(2) > dl > dd:nth-child(2) > a');

        // Lấy dữ liệu từ trang sau khi đã tải đầy đủ
        const result = await page.evaluate(() => {
            const title = document.querySelector('#ulSearchResult > li > div.media-body > h4 > a')?.innerText.trim();
            const author = document.querySelector('#divBibDetail727468 > div.media-body > dl > dd:nth-child(2) > dl > dd:nth-child(2) > a')?.innerText.trim();
            const publisher = document.querySelector('#divBibDetail727468 > div.media-body > dl > dd:nth-child(3) > dl > dd:nth-child(2)')?.innerText.trim();
            const description = document.querySelector('#divBibDetail727468 > div.media-body > dl > dd:nth-child(5) > dl > dd:nth-child(2)')?.innerText.trim();
            const tags = document.querySelector('#divBibDetail727468 > div.media-body > dl > dd:nth-child(6) > dl > dd:nth-child(2) > a:nth-child(1)')?.innerText.trim()
            return { title, author, publisher, description, tags };
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

