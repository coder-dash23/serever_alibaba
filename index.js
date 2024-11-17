import express, { json } from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; // For server-side fetch
import { config } from 'dotenv';

config();

const app = express();
// Validate AgentQL API Key
if (!process.env.AGENTQL_API_KEY) {
  console.error('Missing AgentQL API Key in environment variables.');
  process.exit(1);
}

app.use(cors({
  origin: ["https://alibaba-scraper.vercel.app"],
  methods: ["POST", "GET"],
  credentials: true
}));

app.use(json()); // Use express.json() to parse JSON request bodies

// Endpoint to scrape using AgentQL API
app.post('/scrape', async (req, res) => {
  const { urls } = req.body;

  // Validate input
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'At least one URL is required.' });
  }

  try {
    const result = []; // To store the scraped data

    for (const url of urls) {
      console.log(`Scraping: ${url}`);

      const response = await fetch('https://api.agentql.com/v1/query-data', {
        method: 'POST',
        headers: {
          'X-API-Key': process.env.AGENTQL_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `{
            product_details {
              product_name
              product_url
              prices[] {
                price
                quantity_range
              }
              images[]
            }
            supplier_information {
              name
              location
              years_in_business
            }
            product_attributes {
              Plug_Type[]
              warranty
              type
              function
              application
              place_of_origin
              power
              voltage
              after_sales_service
              power_source
              app_controlled
              capacity
              style
              brand_name
              model_number
              non_stick_material
              shape
              material
              controlling_mode
              operating_language
              private_mold
              temperature
              product_name
              item
              keywords
              color
              multi_function
              usage
              certification
              packaging_and_delivery {
                selling_units
                single_package_size
                single_gross_weight
              }
            }
            Sample_price
          }`,
          url,
          params: {
            is_screenshot_enabled: false,
            wait_for: 0,
            is_scroll_to_bottom_enabled: false,
          },
        }),
      });

      const data = await response.json();
      if (response.ok && data.data) {
        const productDetails = data.data.product_details;

        // Safely handle product_details
        let queryDetails = [];
        if (Array.isArray(productDetails)) {
          queryDetails = productDetails.map((product) => ({
            product_name: product.product_name || '',
            product_url: (product.product_url || '').split('?')[0], // Trim URL
            prices: product.prices || [],
            images: product.images || [],
            supplier_information: data.data.supplier_information || [],
            product_attributes: data.data.product_attributes || [],
            sample_price: data.data.Sample_price || null,
          }));
        } else if (typeof productDetails === 'object' && productDetails !== null) {
          queryDetails.push({
            product_name: productDetails.product_name || '',
            product_url: (productDetails.product_url || '').split('?')[0],
            prices: productDetails.prices || [],
            images: productDetails.images || [],
            supplier_information: data.data.supplier_information || [],
            product_attributes: data.data.product_attributes || [],
            sample_price: data.data.Sample_price || null,
          });
        } else {
          console.warn(`Unexpected product_details format for URL: ${url}`);
        }

        console.log('Query Details:', queryDetails);
        // Access supplier name safely
        if (queryDetails[0]?.supplier_information?.length > 0) {
          console.log(queryDetails[0].supplier_information[0].name);
        } else {
          console.log('Supplier information is unavailable.');
        }

        result.push({
          url,
          queryDetails, // Add all query details for the current URL
        });

        console.log(`Data scraped successfully from ${url}`);
      } else {
        console.warn(`Failed to scrape data from ${url}: ${data.message || 'Unknown error'}`);
      }
    }

    // Return results as a response
    res.json(result);
  } catch (error) {
    console.error('Error occurred during scraping:', error);
    res.status(500).json({ error: 'Internal server error during scraping.' });
  }
});
