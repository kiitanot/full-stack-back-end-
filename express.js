const express = require('express');
const path = require('path');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config(); // For environment variables

const app = express();

// MongoDB connection URI and database name
const uri = process.env.MONGO_URI; // Use environment variable for security
const dbName = 'Webstore'; // Correct database name

let productsCollection, ordersCollection;

// Middleware
app.use(cors());
app.use(express.json());

// Logger middleware
const logger = (req, res, next) => {
  const now = new Date();
  const logMessage = `[${now.toISOString()}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`;
  console.log(logMessage);
  next();
};

app.use(logger);

// Ensure Database Connection Middleware
async function ensureDbConnection(req, res, next) {
  if (!productsCollection || !ordersCollection) {
    return res.status(500).json({ error: 'Database connection not established' });
  }
  next();
}

// Connect to MongoDB with retries
async function connectToDatabase(retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await MongoClient.connect(uri);
      console.log('Connected to MongoDB');
      const db = client.db(dbName);
      productsCollection = db.collection('products');
      ordersCollection = db.collection('orders');
      return; // Exit on successful connection
    } catch (error) {
      console.error(`MongoDB connection attempt ${i + 1} failed:`, error);
      if (i < retries - 1) await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error('Failed to connect to MongoDB after retries');
}

// Serve static files in the "images" directory
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/images', (req, res) => {
  res.status(404).json({ error: 'Image not found' });
});

// Routes
app.get('/products', async (req, res) => {
  try {
    const products = await productsCollection.find().toArray();
    if (products.length === 0) {
      console.warn('No products found');
      return res.status(404).json({ error: 'No products found' });
    }
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.post('/orders', async (req, res) => {
  const { productIds, customerName, phoneNumber } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0 || !customerName || !phoneNumber) {
    return res.status(400).json({ error: 'Missing required fields: customerName, or phoneNumber' });
  }

  try {
    const validProductIds = await productsCollection.find({
      _id: { $in: productIds.map((id) => new ObjectId(id)) }
    }).toArray();

    if (validProductIds.length !== productIds.length) {
      return res.status(400).json({ error: 'Some product IDs are invalid' });
    }

    const order = { productIds, customerName, phoneNumber, date: new Date() };
    const orderResult = await ordersCollection.insertOne(order);

    res.status(201).json({ message: 'Order created successfully', orderId: orderResult.insertedId });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'An error occurred while processing the order' });
  }
});

app.put('/products/:id', async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  if (typeof updateData !== 'object' || Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'Invalid update payload' });
  }

  try {
    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product updated successfully', updatedFields: updateData });
  } catch (error) {
    console.error('Failed to update product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

app.get('/search', async (req, res) => {
  const searchTerm = req.query.searchTerm?.toLowerCase() || '';

  try {
    const parsedPrice = parseFloat(searchTerm);
    const searchConditions = [
      { title: { $regex: searchTerm, $options: 'i' } },
      { location: { $regex: searchTerm, $options: 'i' } }
    ];

    if (!isNaN(parsedPrice)) {
      searchConditions.push({ price: parsedPrice });
    }

    searchConditions.push({ availability: { $eq: searchTerm } });

    const results = await productsCollection.find({ $or: searchConditions }).toArray();
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Error searching for products' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.send('Welcome!');
});

// Start the server only after database connection is established
connectToDatabase()
  .then(() => {
    app.use(ensureDbConnection);
    const port = process.env.PORT || 3000;
    app.listen(port, (err) => {
      if (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
      }
      console.log(`App is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize application:', err);
    process.exit(1);
  });
