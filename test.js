const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/compare-prices", async (req, res) => {
  const { prescriptions, zipCodes } = req.body;
  const results = [];

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  for (const rx of prescriptions) {
    for (const zip of zipCodes) {
      const url = `https://www.goodrx.com/${rx.drug}?dosage=${rx.dosage}&quantity=${rx.qty}&postal_code=${zip}`;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
        await new Promise(r => setTimeout(r, 2500));

        // Evaluate visible price nodes in the page
        const extracted = await page.evaluate((rx, zip) => {
          const rows = [];
          const text = document.body.innerText;
          const regex = /(Walgreens|CVS|Walmart|Costco|Kroger|Sam's Club)[^\$\n]*\$\s*(\d+\.?\d*)/gi;
          let match;

          while ((match = regex.exec(text)) !== null) {
            rows.push({
              medication: rx.drug.charAt(0).toUpperCase() + rx.drug.slice(1),
              dosage: rx.dosage,
              quantity: rx.qty,
              zipCode: zip,
              pharmacy: match[1],
              price: `$${match[2]}`
            });
          }
          return rows;
        }, rx, zip);

        results.push(...extracted);
      } catch (err) {
        console.error(`Error loading ${rx.drug} in ${zip}:`, err.message);
      }
    }
  }

  await browser.close();
  res.json({ results });
});

app.listen(3000, () => {
  console.log("GoodRx bridge server running on http://localhost:3000");
});
