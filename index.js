const express = require('express');
const puppeteer = require('puppeteer')
const cors = require('cors');
app = express();
app.use(cors());
const translate = require('google-translate-api-x');

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
            return { title, author, publisher: publisher, publish_year: year, page: pages, tags, description: des };
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
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

app.get('/api/book', async (req, res) => {
    const bookName = req.query.name;
    if (!bookName) {
        return res.status(400).json({ error: 'Book name is required!' });
    }

    const searchUrl = `https://www.goodreads.com/search?q=${encodeURIComponent(bookName)}`;

    try {
        // const browser = await puppeteer.launch({
        //     args: [
        //         "--disable-setuid-sandbox",
        //         "--no-sandbox",
        //         "--single-process",
        //         "--no-zygote",
        //     ],
        //     executablePath:
        //         process.env.NODE_ENV === "production"
        //             ? process.env.PUPPETEER_EXECUTABLE_PATH
        //             : puppeteer.executablePath(),
        // });
        const browser = await puppeteer.launch({ headless: false })
        const page = await browser.newPage();
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });
        const bookPageUrl = await page.evaluate(() => {
            const bookLink = document.querySelector('.bookTitle');
            return bookLink ? bookLink.href : null;
        });

        if (!bookPageUrl) {
            await browser.close();
            return res.status(404).json({ error: 'Book not found!' });
        }

        await page.goto(bookPageUrl, { waitUntil: 'domcontentloaded' });

        const popupSelector =
            'body > div.Overlay.Overlay--floating > div > div.Overlay__header > div > div > button > span';

        try {
            await page.waitForSelector(popupSelector, { timeout: 5000 });
            await sleep(2000)
            console.log("Popup detected. Attempting to close...");
            const exitButton = await page.$(popupSelector);
            if (exitButton) {
                await exitButton.click();
                console.log("Popup closed successfully.");
                await page.waitForTimeout(1000);
            } else {
                console.log("Popup close button not found.");
            }
        } catch (e) {
            console.log(e);
        }
        const showMoreButtonSelector =
            '#__next > div.PageFrame.PageFrame--siteHeaderBanner > main > div.BookPage__gridContainer > div.BookPage__rightColumn > div.BookPage__mainContent > div.BookPageMetadataSection > div.BookPageMetadataSection__description > div > div.TruncatedContent__gradientOverlay > div > button';

        try {
            await page.waitForSelector(showMoreButtonSelector, { timeout: 3000 });
            console.log("'Show More' button detected. Clicking...");
            const showMore = await page.$(showMoreButtonSelector);
            if (showMore) {
                await showMore.click()
                await page.waitForTimeout(1000);
                await sleep(2000)
                const bookDescription = await page.evaluate(() => {
                    const descriptionElement = document.querySelector(
                        '#__next > div.PageFrame.PageFrame--siteHeaderBanner > main > div.BookPage__gridContainer > div.BookPage__rightColumn > div.BookPage__mainContent > div.BookPageMetadataSection > div.BookPageMetadataSection__description > div > div.TruncatedContent__text.TruncatedContent__text--large.TruncatedContent__text--expanded > div > div'
                    );
                    return descriptionElement ? descriptionElement.innerText.trim() : 'No description available.';
                });

                const author = await page.evaluate(() => {
                    const descriptionElement = document.querySelector(
                    '#__next > div.PageFrame.PageFrame--siteHeaderBanner > main > div.BookPage__gridContainer > div.BookPage__rightColumn > div.BookPage__mainContent > div.BookPageMetadataSection > div.BookPageMetadataSection__contributor > h3 > div > span:nth-child(1) > a > span.ContributorLink__name'
                    );
                    return descriptionElement ? descriptionElement.innerText.trim() : 'No description available.';
                });

                console.log("Book description extracted:", bookDescription);
                let d = await translateTextFree(bookDescription)
                await browser.close();

                return res.json({
                    name: bookName,
                    url: bookPageUrl,
                    description: d || bookDescription,
                    author:author
                });
            } else {
                await sleep(2000)
                const bookDescription = await page.evaluate(() => {
                    const descriptionElement = document.querySelector(
                        '#__next > div.PageFrame.PageFrame--siteHeaderBanner > main > div.BookPage__gridContainer > div.BookPage__rightColumn > div.BookPage__mainContent > div.BookPageMetadataSection > div.BookPageMetadataSection__description > div > div.TruncatedContent__text.TruncatedContent__text--large > div > div > span'
                    );
                    return descriptionElement ? descriptionElement.innerText.trim() : 'No description available.';
                });

                console.log("Book description extracted:", bookDescription);
                let d = await translateTextFree(bookDescription)
                await browser.close();

                return res.json({
                    name: bookName,
                    url: bookPageUrl,
                    description: d || bookDescription,
                });
            }

        } catch (e) {
            console.log("'Show More' button not found or not clickable.");
            await sleep(2000)
            const bookDescription = await page.evaluate(() => {
                const descriptionElement = document.querySelector(
                    '#__next > div.PageFrame.PageFrame--siteHeaderBanner > main > div.BookPage__gridContainer > div.BookPage__rightColumn > div.BookPage__mainContent > div.BookPageMetadataSection > div.BookPageMetadataSection__description > div > div.TruncatedContent__text.TruncatedContent__text--large > div > div > span'
                );
                return descriptionElement ? descriptionElement.innerText.trim() : 'No description available.';
            });

            console.log("Book description extracted:", bookDescription);
            let d = await translateTextFree(bookDescription)
            await browser.close();

            return res.json({
                name: bookName,
                url: bookPageUrl,
                description: d || bookDescription,
            });
        }

    } catch (error) {
        console.error('Error while scraping:', error);

        // if (browser) {
        //     await browser.close();
        // }

        return res.status(500).json({ error: 'Something went wrong while scraping the book data.' });
    }
});
async function translateTextFree(text, targetLanguage = 'vi') {
    try {
        const res = await translate(text, { to: targetLanguage });
        return res.text;
    } catch (error) {
        console.error('Error while translating:', error);
        return 'Translation failed!';
    }
}


app.listen(3000 || process.env.PORT, () => console.log(`Listening on port 3000`))

