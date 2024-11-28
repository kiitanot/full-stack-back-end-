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
const imageDirectory = path.resolve(__dirname, '../fs_coursework/images');
console.log("Image directory:", imageDirectory);  // Log the resolved directory for debugging

app.use('/images', express.static(imageDirectory));


app.use((req, res, next) => {
  if (req.url.startsWith('/images/')) {
    return res.status(404).send('Image not found');
  }
  next();
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
  const { productIds, customerName, phoneNumber } = req.body;

  // Validate input
  if (!productIds || !Array.isArray(productIds) || productIds.length === 0 || !customerName || !phoneNumber) {
    return res.status(400).json({ error: 'Missing required fields: customerName, or phoneNumber' });
  }

  try {
    const order = { productIds, customerName, phoneNumber, date: new Date() };
    const orderResult = await ordersCollection.insertOne(order);

    // Respond with success and the order ID
    res.status(201).json({ message: 'Order created successfully', orderId: orderResult.insertedId });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'An error occurred while processing the order' });
  }
});







// PUT route to update any attribute of a product
app.put('/products/:id', async (req, res) => {
  const { id } = req.params;
  const updateData = req.body; // Accept entire update payload

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }
  if (typeof updateData !== 'object' || Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'Invalid update payload' });
  }

  try {
    const result = await productsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData } // Dynamically apply updates
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product updated successfully', updatedFields: updateData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
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

const port = process.env.PORT || 3000;
app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});