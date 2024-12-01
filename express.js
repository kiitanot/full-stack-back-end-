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
app.use((req, res, next) => {
  res.on('finish', () => {
    if (req.method === 'POST' && req.originalUrl === '/orders') {
      console.log(`[LOG] Inventory updated for order: ${JSON.stringify(req.body.productIds)}`);
    }
  });
  next();
});


// Apply logger middleware globally
app.use(logger);



app.use('/images', (req, res, next) => {
  const imagePath = path.join(__dirname, '/images', req.url); // Ensure 'lesson-images' folder exists and images are inside it

  // Check if the file exists
  fs.access(imagePath, fs.constants.F_OK, (err) => {
    if (err) {
      // If the file does not exist, return an error message
      return res.status(404).json({ error: 'Image not found' });
    }
    // If the file exists, serve the file
    res.sendFile(imagePath);
  });
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
    const session = await productsCollection.client.startSession(); // Start a session for transaction
    session.startTransaction();

    const updatedProducts = [];
    for (const productId of productIds) {
      // Ensure product ID is valid
      if (!ObjectId.isValid(productId)) {
        throw new Error(`Invalid product ID: ${productId}`);
      }

      // Decrement inventory atomically
      const result = await productsCollection.updateOne(
        { _id: new ObjectId(productId), availableInventory: { $gt: 0 } }, // Check inventory is sufficient
        { $inc: { availableInventory: -1 } }, // Atomically decrement inventory
        { session } // Include the session in the query
      );

      if (result.matchedCount === 0) {
        throw new Error(`Product with ID ${productId} is out of stock or not found.`);
      }

      updatedProducts.push(productId);
    }

    // Create the order
    const order = { productIds, customerName, phoneNumber, date: new Date() };
    const orderResult = await ordersCollection.insertOne(order, { session });

    await session.commitTransaction(); // Commit the transaction
    session.endSession();

    // Respond with success and the order ID
    res.status(201).json({ message: 'Order created successfully', orderId: orderResult.insertedId, updatedProducts });
  } catch (error) {
    console.error('Error creating order:', error);
    if (session.inTransaction()) await session.abortTransaction(); // Roll back if any error occurs
    session.endSession();
    res.status(500).json({ error: error.message || 'An error occurred while processing the order' });
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
      { _id: new ObjectId(id) },  // Ensure we're looking for the right product
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




// Search

app.get('/search', async (req, res) => {
  const searchTerm = req.query.searchTerm?.toLowerCase() || ''; // Capture search term from query parameters and convert to lowercase

  try {
    // Filter products based on search term matching the specified fields
    const results = await productsCollection.find({
      $or: [
        { title: { $regex: searchTerm, $options: 'i' } },
        { location: { $regex: searchTerm, $options: 'i' } },
        { price: { $eq: parseFloat(searchTerm) } },
        { availableInventory: { $eq: parseFloat(searchTerm) } }
      ]
    }).toArray();

    // Return the filtered products as JSON response
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Error searching for products' });
  }
});



// Start the server

const port = process.env.PORT || 3000;
app.get('/', (req, res) => {
  res.send('Welcome!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});