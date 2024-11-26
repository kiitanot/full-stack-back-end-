const express = require('express');
const path = require('path');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const app = express();



// MongoDB connection URI and database name
const uri = 'mongodb+srv://ko460:nCEsXelqNFBfvPGQ@webstorecluster.wu59k.mongodb.net/?retryWrites=true&w=majority&appName=WebstoreCluster';
const dbName = 'Webstore'; // Correct database name

let productsCollection, ordersCollection;

// Connect to MongoDB
MongoClient.connect(uri)
  .then((client) => {
    console.log('Connected to MongoDB');
    const db = client.db(dbName);  // Connecting to the 'WebstoreCluster' database
    productsCollection = db.collection('products'); // "products" collection
    ordersCollection = db.collection('orders'); // "orders" collection

    // Create indexes for sorting and searching
    productsCollection.createIndex({ title: 'text', description: 'text', location: 'text' });
    productsCollection.createIndex({ price: 1 });
    productsCollection.createIndex({ availableInventory: 1 });
    productsCollection.createIndex({ location: 1 });
  })
  .catch((err) => console.error('Failed to connect to MongoDB:', err));

app.use(cors());
app.use(express.json());
// Logger middleware
const logger = (req, res, next) => {
  const now = new Date();
  const logMessage = `[${now.toISOString()}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`;
  console.log(logMessage);
  next();
};

// Apply logger middleware globally
app.use(logger);

// Static file middleware for images with error handling
const imagesDirectory = path.join(__dirname, '../fs coursework/images');
app.use('/images', (req, res, next) => {
  const filePath = path.join(imagesDirectory, req.url);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Image not found' });
  }
});

// GET route for products
app.get('/products', async (req, res) => {
  if (!productsCollection) {
    return res.status(500).json({ error: 'Database not initialized' });
  }
  try {
    const products = await productsCollection.find().toArray();
    if (products.length === 0) {
      return res.status(404).json({ error: 'No products found' });
    }
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// POST route for orders
app.post('/orders', async (req, res) => {
  const { productIds, customerName } = req.body;

  if (!productIds || !Array.isArray(productIds) || productIds.length === 0 || !customerName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const order = { productIds, customerName, date: new Date() };
    const result = await ordersCollection.insertOne(order);
    res.status(201).json({ message: 'Order created', orderId: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// PUT route to update product stock
app.put('/products/:id', async (req, res) => {
  const { id } = req.params;
  const { availableStock } = req.body;


  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }
  if (availableStock == null || typeof availableStock !== 'number' || availableStock < 0) {
    return res.status(400).json({ error: 'Invalid stock value' });
  }

  try {
    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { availableStock } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product stock updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product stock' });
  }
});

// GET route for searching products
app.get('/search', async (req, res) => {
  const { query } = req.query;
  try {
    const products = await productsCollection.find({
      $text: { $search: query } // Full-text search
    }).toArray();

    if (products.length === 0) {
      return res.status(404).json({ error: 'No products found matching the search criteria' });
    }
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
